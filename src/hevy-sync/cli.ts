import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { HevyMcpClient } from "./mcp.js";
import {
  applyOneRmUpdates,
  buildNextBlockReport,
  loadOneRmCsv,
  writeOneRmCsv,
} from "./one-rm-updater.js";
import { parseRoutineMarkdown } from "./parser.js";
import { buildDraftRoutines, mergeConfig } from "./payloads.js";
import type { HevyDraftExercise, HevyDraftRoutine, HevySyncConfig, RepRange } from "./types.js";
import { HevyWorkoutHistoryClient } from "./workout-history.js";

const LOCAL_ENV_FILES = [".env", ".env.local"];

interface PublishedRoutineSet {
  type?: string;
  weight_kg?: number | null;
  reps?: number | null;
  rep_range?: RepRange | null;
}

interface PublishedRoutineExercise {
  title?: string;
  exercise_template_id?: string;
  superset_id?: number | null;
  supersets_id?: number | null;
  sets?: PublishedRoutineSet[];
}

interface PublishedRoutine {
  id?: string;
  title?: string;
  exercises?: PublishedRoutineExercise[];
}

const KILOGRAMS_PER_POUND = 0.45359237;

function normalizeEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

async function loadLocalEnv(): Promise<void> {
  for (const fileName of LOCAL_ENV_FILES) {
    const filePath = resolve(process.cwd(), fileName);
    let raw: string;

    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }

    for (const line of raw.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      if (!key || key in process.env) {
        continue;
      }

      const rawValue = trimmed.slice(equalsIndex + 1);
      process.env[key] = normalizeEnvValue(rawValue);
    }
  }
}

function nextBlockReviewPath(outputPath: string): string {
  if (outputPath.endsWith(".json")) {
    return outputPath.replace(/\.json$/i, ".review.txt");
  }

  return `${outputPath}.review.txt`;
}

function formatNextBlockReview(report: Awaited<ReturnType<typeof buildNextBlockReport>>): string {
  const lines: string[] = [];
  lines.push("5/3/1 Next Block Review");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Status: ${report.status}`);
  lines.push(`Lookback Days: ${report.lookbackDays}`);
  lines.push(`Detected Managed Blocks: ${report.detectedManagedBlocks}`);
  lines.push(`Recommended Action: ${report.recommendedAction}`);
  lines.push("");

  lines.push("Current 1RMs");
  for (const record of report.currentOneRmSnapshot) {
    lines.push(`- ${record.lift}: 1RM ${record.oneRmLb} lb, TM ${record.trainingMaxLb} lb`);
  }
  lines.push("");

  lines.push("Candidate Blocks");
  if (report.candidateBlocks.length === 0) {
    lines.push("- None detected");
  } else {
    for (const block of report.candidateBlocks) {
      lines.push(`- ${block.blockDate} | ${block.folderName} | ${block.completedRoutines}/${block.totalRoutines} completed | ${block.isComplete ? "complete" : "incomplete"}`);
      if (block.matchedWorkouts.length > 0) {
        lines.push("  Matched Workouts:");
        for (const workout of block.matchedWorkouts) {
          lines.push(`  - ${workout.routineTitle} -> ${workout.workoutTitle}${workout.startTime ? ` @ ${workout.startTime}` : ""}`);
        }
      }
      if (block.missingRoutineTitles.length > 0) {
        lines.push("  Missing Routines:");
        for (const title of block.missingRoutineTitles) {
          lines.push(`  - ${title}`);
        }
      }
    }
  }
  lines.push("");

  lines.push("Proposed 1RM Updates");
  if (report.proposedOneRmUpdates.length === 0) {
    lines.push("- None. A fully completed managed block is required before conservative bumps are proposed.");
  } else {
    for (const update of report.proposedOneRmUpdates) {
      lines.push(`- ${update.lift}: ${update.currentOneRmLb} -> ${update.proposedOneRmLb} lb (TM ${update.currentTrainingMaxLb} -> ${update.proposedTrainingMaxLb} lb)`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function expectedPublishedExerciseName(localName: string): string {
  switch (localName) {
    case "Squat":
      return "Squat (Barbell)";
    case "Deadlift":
      return "Deadlift (Barbell)";
    case "Bench Press":
      return "Bench Press (Barbell)";
    case "Overhead Press":
      return "Overhead Press (Barbell)";
    default:
      return localName;
  }
}

function resolveExpectedTemplateId(exercise: HevyDraftExercise): string | null {
  return exercise.exerciseTemplateId ?? exercise.lookup.templateId ?? null;
}

function expectedRepRange(exercise: HevyDraftExercise): Array<RepRange | null> {
  return exercise.sets.map((set) => set.repRange ?? (typeof set.reps === "number" ? { start: set.reps, end: set.reps } : null));
}

function expectedDisplayWeights(exercise: HevyDraftExercise): Array<number | null> {
  return exercise.sets.map((set) => (typeof set.sourceWeightLb === "number" ? Number(set.sourceWeightLb.toFixed(2)) : null));
}

function actualDisplayWeights(exercise: PublishedRoutineExercise): Array<number | null> {
  return (exercise.sets ?? []).map((set) =>
    typeof set.weight_kg === "number" ? Number((set.weight_kg / KILOGRAMS_PER_POUND).toFixed(2)) : null,
  );
}

async function fetchPublishedRoutine(routineId: string): Promise<PublishedRoutine> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    throw new Error("HEVY_API_KEY is required for published routine verification.");
  }

  const response = await fetch(`https://api.hevyapp.com/v1/routines/${routineId}`, {
    headers: { "api-key": apiKey },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch published routine ${routineId}: ${response.status} ${response.statusText}`);
  }

  const parsed = (await response.json()) as { routine?: PublishedRoutine | PublishedRoutine[] };
  const routine = Array.isArray(parsed.routine) ? parsed.routine[0] : parsed.routine;
  if (!routine) {
    throw new Error(`Published routine ${routineId} was missing from the Hevy API response.`);
  }

  return routine;
}

async function verify(routinePath: string, config: HevySyncConfig): Promise<void> {
  const absolutePath = resolve(routinePath);
  const content = await readFile(absolutePath, "utf8");
  const document = parseRoutineMarkdown(content, absolutePath);
  const drafts = buildDraftRoutines(document, config);

  const client = new HevyMcpClient(config);
  await client.connect();
  try {
    const tools = await client.listTools();
    const requiredTools = ["search-exercise-templates", "get-routines", "get-routine-folders"];
    for (const tool of requiredTools) {
      if (!tools.includes(tool)) {
        throw new Error(`Connected MCP server is missing required tool ${tool}.`);
      }
    }

    await client.resolveExerciseIds(drafts);

    const folderName = drafts[0]?.folderName;
    if (!folderName) {
      throw new Error("Draft routines did not include a folder name, so published verification could not locate the block.");
    }

    const folders = await client.getAllFolders();
    const folder = folders.find((item) => item.title === folderName);
    if (!folder) {
      throw new Error(`Could not find the published Hevy folder ${folderName}.`);
    }

    const routines = await client.getAllRoutines();
    const liveByTitle = new Map(
      routines
        .filter((routine) => routine.folderId === folder.id)
        .map((routine) => [routine.title, routine]),
    );

    const mismatches: Array<Record<string, unknown>> = [];

    for (const draft of drafts) {
      const liveSummary = liveByTitle.get(draft.title);
      if (!liveSummary) {
        mismatches.push({ title: draft.title, issue: "missing_published_routine" });
        continue;
      }

      const published = await fetchPublishedRoutine(liveSummary.id);
      const publishedExercises = published.exercises ?? [];
      if (draft.exercises.length !== publishedExercises.length) {
        mismatches.push({
          title: draft.title,
          issue: "exercise_count",
          expected: draft.exercises.length,
          actual: publishedExercises.length,
        });
        continue;
      }

      for (let index = 0; index < draft.exercises.length; index += 1) {
        const expected = draft.exercises[index];
        const actual = publishedExercises[index];
        const issues: Array<Record<string, unknown>> = [];

        const expectedName = expectedPublishedExerciseName(expected.localName);
        const expectedTemplateId = resolveExpectedTemplateId(expected);
        const expectedWeights = expectedDisplayWeights(expected);
        const actualWeights = actualDisplayWeights(actual);
        const expectedReps = expected.sets.map((set) => set.reps ?? null);
        const actualReps = (actual.sets ?? []).map((set) => set.reps ?? null);
        const expectedRanges = expectedRepRange(expected);
        const actualRanges = (actual.sets ?? []).map((set) => set.rep_range ?? null);
        const expectedSetTypes = expected.sets.map((set) => set.type);
        const actualSetTypes = (actual.sets ?? []).map((set) => set.type ?? null);
        const actualSupersetId = actual.superset_id ?? actual.supersets_id ?? null;

        if (expectedName !== (actual.title ?? null)) {
          issues.push({ type: "sequence_name", expected: expectedName, actual: actual.title ?? null });
        }

        if (expectedTemplateId !== (actual.exercise_template_id ?? null)) {
          issues.push({ type: "template_id", expected: expectedTemplateId, actual: actual.exercise_template_id ?? null });
        }

        if (JSON.stringify(expectedWeights) !== JSON.stringify(actualWeights)) {
          issues.push({ type: "displayed_weight_lb", expected: expectedWeights, actual: actualWeights });
        }

        if (JSON.stringify(expectedReps) !== JSON.stringify(actualReps)) {
          issues.push({ type: "reps", expected: expectedReps, actual: actualReps });
        }

        if (JSON.stringify(expectedRanges) !== JSON.stringify(actualRanges)) {
          issues.push({ type: "rep_ranges", expected: expectedRanges, actual: actualRanges });
        }

        if (JSON.stringify(expectedSetTypes) !== JSON.stringify(actualSetTypes)) {
          issues.push({ type: "set_types", expected: expectedSetTypes, actual: actualSetTypes });
        }

        if ((expected.supersetId ?? null) !== actualSupersetId) {
          issues.push({ type: "superset_id", expected: expected.supersetId ?? null, actual: actualSupersetId });
        }

        if (issues.length > 0) {
          mismatches.push({
            title: draft.title,
            index,
            expectedExercise: expectedName,
            actualExercise: actual.title ?? null,
            issues,
          });
        }
      }
    }

    console.log(JSON.stringify({ checkedRoutines: drafts.length, mismatchCount: mismatches.length, mismatches }, null, 2));
    if (mismatches.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

async function nextBlock(config: HevySyncConfig, options: { apply: boolean; outputPath?: string; lookbackDays: number }): Promise<void> {
  const client = new HevyMcpClient(config);
  await client.connect();

  try {
    const tools = await client.listTools();
    const requiredTools = ["get-routines", "get-routine-folders"];
    for (const tool of requiredTools) {
      if (!tools.includes(tool)) {
        throw new Error(`Connected MCP server is missing required tool ${tool}.`);
      }
    }

    const historyClient = new HevyWorkoutHistoryClient();
    const [folders, routines, workouts, oneRmRecords] = await Promise.all([
      client.getAllFolders(),
      client.getAllRoutines(),
      historyClient.getRecentWorkouts({ lookbackDays: options.lookbackDays }),
      loadOneRmCsv(),
    ]);

    const report = buildNextBlockReport({
      lookbackDays: options.lookbackDays,
      routines,
      folders,
      workouts,
      oneRmRecords,
    });
    const reviewText = formatNextBlockReview(report);

    if (options.outputPath) {
      const destination = resolve(options.outputPath);
      await ensureParentDirectory(destination);
      await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      await writeFile(resolve(nextBlockReviewPath(destination)), reviewText, "utf8");
    }

    if (options.apply) {
      if (!report.selectedBlock) {
        throw new Error("No fully completed managed 5/3/1 block was found, so 1rms.csv was not updated.");
      }

      const updatedRecords = applyOneRmUpdates(oneRmRecords, report.proposedOneRmUpdates);
      await writeOneRmCsv(updatedRecords);
    }

    console.log(reviewText.trimEnd());
    console.log("");
    console.log(
      JSON.stringify(
        {
          ...report,
          applyMode: options.apply ? "applied" : "dry-run",
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

function parseArgs(argv: string[]): { command: string; positionals: string[]; flags: Map<string, string | boolean> } {
  const [command = "preview", ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue != null) {
      flags.set(key, inlineValue);
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      index += 1;
      continue;
    }

    flags.set(key, true);
  }

  return { command, positionals, flags };
}

async function loadConfig(configPath?: string): Promise<HevySyncConfig> {
  if (!configPath) {
    return mergeConfig({});
  }

  const raw = await readFile(resolve(configPath), "utf8");
  return mergeConfig(JSON.parse(raw) as HevySyncConfig);
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

function defaultOutputPath(routinePath: string): string {
  const absolute = resolve(routinePath);
  const filename = absolute.split("/").pop()?.replace(/\.md$/, ".hevy-preview.json") ?? "routine.hevy-preview.json";
  return resolve(dirname(absolute), filename);
}

async function preview(routinePath: string, config: HevySyncConfig, outputPath?: string): Promise<void> {
  const absolutePath = resolve(routinePath);
  const content = await readFile(absolutePath, "utf8");
  const document = parseRoutineMarkdown(content, absolutePath);
  const drafts = buildDraftRoutines(document, config);
  const destination = resolve(outputPath ?? defaultOutputPath(absolutePath));

  await ensureParentDirectory(destination);
  await writeFile(destination, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");

  console.log(`Wrote Hevy preview payloads to ${destination}`);
  console.log(`Prepared ${drafts.length} routines from ${absolutePath}`);
}

async function sync(routinePath: string, config: HevySyncConfig, dryRun = false, outputPath?: string): Promise<void> {
  const absolutePath = resolve(routinePath);
  const content = await readFile(absolutePath, "utf8");
  const document = parseRoutineMarkdown(content, absolutePath);
  const drafts = buildDraftRoutines(document, config);

  const client = new HevyMcpClient(config);
  await client.connect();
  try {
    const tools = await client.listTools();
    const requiredTools = [
      "search-exercise-templates",
      "get-routines",
      "create-routine",
      "update-routine",
      "get-routine-folders",
      "create-routine-folder",
    ];
    for (const tool of requiredTools) {
      if (!tools.includes(tool)) {
        throw new Error(`Connected MCP server is missing required tool ${tool}.`);
      }
    }

    await client.resolveExerciseIds(drafts);

    if (dryRun) {
      if (outputPath) {
        const destination = resolve(outputPath);
        await ensureParentDirectory(destination);
        await writeFile(destination, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
        console.log(`Wrote resolved dry-run payloads to ${destination}`);
      } else {
        console.log(JSON.stringify(drafts, null, 2));
      }
      console.log(`Dry run complete. Resolved ${drafts.length} routines without creating anything.`);
      return;
    }

    const results = await client.syncRoutines(drafts);
    for (const result of results) {
      console.log(`${result.action.toUpperCase()}: ${result.title}${result.routineId ? ` (${result.routineId})` : ""}`);
    }
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  await loadLocalEnv();

  const { command, positionals, flags } = parseArgs(process.argv.slice(2));
  const configPath = typeof flags.get("config") === "string" ? String(flags.get("config")) : undefined;
  const config = await loadConfig(configPath);

  if (command === "next-block") {
    const outPath = typeof flags.get("out") === "string" ? String(flags.get("out")) : undefined;
    const lookbackDays = typeof flags.get("lookback-days") === "string" ? Number.parseInt(String(flags.get("lookback-days")), 10) : 180;
    await nextBlock(config, { apply: Boolean(flags.get("apply")), outputPath: outPath, lookbackDays });
    return;
  }

  const routinePath = positionals[0];
  if (!routinePath) {
    throw new Error("Usage: hevy:preview|hevy:sync|hevy:verify <routine.md> [--config path] [--out path] [--dry-run] | hevy:next-block [--config path] [--out path] [--lookback-days N] [--apply]");
  }

  if (command === "preview") {
    const outPath = typeof flags.get("out") === "string" ? String(flags.get("out")) : undefined;
    await preview(routinePath, config, outPath);
    return;
  }

  if (command === "sync") {
    const outPath = typeof flags.get("out") === "string" ? String(flags.get("out")) : undefined;
    await sync(routinePath, config, Boolean(flags.get("dry-run")), outPath);
    return;
  }

  if (command === "verify") {
    await verify(routinePath, config);
    return;
  }

  throw new Error(`Unknown command ${command}. Use preview, sync, verify, or next-block.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});