import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  CandidateBlockReport,
  CurrentOneRmSnapshot,
  HevyCompletedWorkout,
  HevyFolderRecord,
  HevyRoutineRecord,
  ManagedRoutineBlock,
  ManagedRoutineBlockRoutine,
  MatchedWorkout,
  NextBlockReport,
  OneRmCsvRecord,
  ProposedOneRmUpdate,
} from "./types.js";

const BLOCK_FOLDER_PATTERN = /^5\/3\/1 - (\d{4}-\d{2}-\d{2}) Block$/;
const ROUTINE_TITLE_PATTERN = /^W(\d+)D(\d+):\s+/;

const CONSERVATIVE_1RM_BUMPS_LB: Record<string, number> = {
  Deadlift: 10,
  Squat: 10,
  Bench: 5,
  OHP: 5,
};

function roundToNearestFive(weightLb: number): number {
  return Math.round(weightLb / 5) * 5;
}

function toPracticalTrainingMax(oneRmLb: number): number {
  return roundToNearestFive(oneRmLb * 0.9);
}

function buildCurrentOneRmSnapshot(records: OneRmCsvRecord[]): CurrentOneRmSnapshot[] {
  return records.map((record) => ({
    lift: record.lift,
    oneRmLb: record.oneRmLb,
    trainingMaxLb: toPracticalTrainingMax(record.oneRmLb),
  }));
}

function normalizeRoutineTitle(title: string): { week: number; day: number } | undefined {
  const match = ROUTINE_TITLE_PATTERN.exec(title);
  if (!match) {
    return undefined;
  }

  return {
    week: Number.parseInt(match[1] ?? "0", 10),
    day: Number.parseInt(match[2] ?? "0", 10),
  };
}

export function parseOneRmCsv(csvText: string): OneRmCsvRecord[] {
  return csvText
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(","))
    .map(([lift, oneRmLb]) => ({
      lift: (lift ?? "").trim(),
      oneRmLb: Number.parseFloat((oneRmLb ?? "").trim()),
    }))
    .filter((record) => record.lift.length > 0 && Number.isFinite(record.oneRmLb));
}

export function serializeOneRmCsv(records: OneRmCsvRecord[]): string {
  const lines = records.map((record) => `${record.lift},${Number.isInteger(record.oneRmLb) ? record.oneRmLb.toString() : record.oneRmLb.toFixed(2)}`);
  return [`Lift,1RM (lbs)`, ...lines].join("\n") + "\n";
}

export async function loadOneRmCsv(filePath = "1rms.csv"): Promise<OneRmCsvRecord[]> {
  const csvText = await readFile(resolve(filePath), "utf8");
  return parseOneRmCsv(csvText);
}

export async function writeOneRmCsv(records: OneRmCsvRecord[], filePath = "1rms.csv"): Promise<void> {
  await writeFile(resolve(filePath), serializeOneRmCsv(records), "utf8");
}

export function findManagedRoutineBlocks(routines: HevyRoutineRecord[], folders: HevyFolderRecord[]): ManagedRoutineBlock[] {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const blockMap = new Map<number, ManagedRoutineBlock>();

  for (const routine of routines) {
    if (routine.folderId == null) {
      continue;
    }

    const folder = folderById.get(routine.folderId);
    if (!folder) {
      continue;
    }

    const folderMatch = BLOCK_FOLDER_PATTERN.exec(folder.title);
    const titleMatch = normalizeRoutineTitle(routine.title);
    if (!folderMatch || !titleMatch) {
      continue;
    }

    const existingBlock = blockMap.get(folder.id) ?? {
      folderId: folder.id,
      folderName: folder.title,
      blockDate: folderMatch[1] ?? "",
      routines: [],
    };

    const managedRoutine: ManagedRoutineBlockRoutine = {
      id: routine.id,
      title: routine.title,
      folderId: folder.id,
      week: titleMatch.week,
      day: titleMatch.day,
    };

    existingBlock.routines.push(managedRoutine);
    blockMap.set(folder.id, existingBlock);
  }

  return [...blockMap.values()]
    .map((block) => ({
      ...block,
      routines: block.routines.sort((left, right) => left.week - right.week || left.day - right.day),
    }))
    .sort((left, right) => right.blockDate.localeCompare(left.blockDate));
}

function blockStartTimestamp(blockDate: string): number {
  return Date.parse(`${blockDate}T00:00:00Z`);
}

function buildCandidateBlockReport(block: ManagedRoutineBlock, workouts: HevyCompletedWorkout[]): CandidateBlockReport {
  const startTimestamp = blockStartTimestamp(block.blockDate);
  const workoutsByRoutineId = new Map<string, HevyCompletedWorkout[]>();

  for (const workout of workouts) {
    if (!workout.routineId) {
      continue;
    }

    const existing = workoutsByRoutineId.get(workout.routineId) ?? [];
    existing.push(workout);
    workoutsByRoutineId.set(workout.routineId, existing);
  }

  const matchedWorkouts: MatchedWorkout[] = [];
  const missingRoutineTitles: string[] = [];

  for (const routine of block.routines) {
    const matches = (workoutsByRoutineId.get(routine.id) ?? [])
      .filter((workout) => {
        const startTime = workout.startTime ? Date.parse(workout.startTime) : Number.NaN;
        return Number.isFinite(startTime) ? startTime >= startTimestamp : true;
      })
      .sort((left, right) => (right.startTime ?? "").localeCompare(left.startTime ?? ""));

    const match = matches[0];
    if (!match) {
      missingRoutineTitles.push(routine.title);
      continue;
    }

    matchedWorkouts.push({
      routineId: routine.id,
      routineTitle: routine.title,
      workoutId: match.id,
      workoutTitle: match.title,
      startTime: match.startTime,
      exerciseTitles: match.exercises.map((exercise) => exercise.title),
    });
  }

  return {
    folderId: block.folderId,
    folderName: block.folderName,
    blockDate: block.blockDate,
    totalRoutines: block.routines.length,
    completedRoutines: matchedWorkouts.length,
    isComplete: matchedWorkouts.length === block.routines.length,
    matchedWorkouts,
    missingRoutineTitles,
  };
}

export function buildConservativeOneRmUpdates(records: OneRmCsvRecord[]): ProposedOneRmUpdate[] {
  return records.map((record) => {
    const incrementLb = CONSERVATIVE_1RM_BUMPS_LB[record.lift] ?? 5;
    const proposedOneRmLb = record.oneRmLb + incrementLb;

    return {
      lift: record.lift,
      currentOneRmLb: record.oneRmLb,
      incrementLb,
      proposedOneRmLb,
      currentTrainingMaxLb: toPracticalTrainingMax(record.oneRmLb),
      proposedTrainingMaxLb: toPracticalTrainingMax(proposedOneRmLb),
    };
  });
}

export function applyOneRmUpdates(records: OneRmCsvRecord[], updates: ProposedOneRmUpdate[]): OneRmCsvRecord[] {
  const proposedByLift = new Map(updates.map((update) => [update.lift, update.proposedOneRmLb]));
  return records.map((record) => ({
    ...record,
    oneRmLb: proposedByLift.get(record.lift) ?? record.oneRmLb,
  }));
}

export function buildNextBlockReport(params: {
  lookbackDays: number;
  routines: HevyRoutineRecord[];
  folders: HevyFolderRecord[];
  workouts: HevyCompletedWorkout[];
  oneRmRecords: OneRmCsvRecord[];
}): NextBlockReport {
  const managedBlocks = findManagedRoutineBlocks(params.routines, params.folders);
  const candidateBlocks = managedBlocks.map((block) => buildCandidateBlockReport(block, params.workouts));
  const selectedBlock = candidateBlocks.find((block) => block.isComplete);
  const warnings: string[] = [];
  const currentOneRmSnapshot = buildCurrentOneRmSnapshot(params.oneRmRecords);
  let status: NextBlockReport["status"] = "waiting_for_completion";
  let recommendedAction = "Complete the current managed block or expand detection rules before applying any 1RM update.";

  if (candidateBlocks.length === 0) {
    status = "no_managed_blocks_found";
    recommendedAction = "No managed 5/3/1 block was detected. Publish and complete a block using the current folder/title convention or expand the detection rules.";
    warnings.push("No managed 5/3/1 Hevy blocks were found. v1 only detects blocks stored in folders named '5/3/1 - YYYY-MM-DD Block' with routine titles like 'W1D2: Deadlift/Bench'.");
  }

  if (!selectedBlock && candidateBlocks.length > 0) {
    warnings.push("Managed 5/3/1 blocks were found, but none had all routines completed in the current workout history lookback window.");
  }

  if (selectedBlock) {
    status = "ready_for_approval";
    recommendedAction = "Review the proposed conservative 1RM bumps and, if they look right, rerun with --apply.";
  }

  return {
    generatedAt: new Date().toISOString(),
    lookbackDays: params.lookbackDays,
    status,
    recommendedAction,
    detectedManagedBlocks: managedBlocks.length,
    currentOneRmSnapshot,
    candidateBlocks,
    ...(selectedBlock ? { selectedBlock } : {}),
    proposedOneRmUpdates: selectedBlock ? buildConservativeOneRmUpdates(params.oneRmRecords) : [],
    warnings,
  };
}