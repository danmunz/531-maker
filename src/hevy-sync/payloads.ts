import { basename } from "node:path";

import type {
  ExerciseLookup,
  HevyDraftExercise,
  HevyDraftRoutine,
  HevyDraftSet,
  HevySyncConfig,
  ParsedExercise,
  ParsedRoutineDocument,
  RepRange,
} from "./types.js";

const DEFAULT_EXERCISE_LOOKUPS: Record<string, ExerciseLookup> = {
  Squat: { query: "Squat (Barbell)", primaryMuscleGroup: "quadriceps" },
  Deadlift: { query: "Deadlift (Barbell)" },
  "Bench Press": { query: "Bench Press (Barbell)", primaryMuscleGroup: "chest" },
  "Overhead Press": { query: "Overhead Press (Barbell)", primaryMuscleGroup: "shoulders" },
  "Seated Row (Machine)": { query: "Seated Row", primaryMuscleGroup: "upper_back" },
  "Lat Pulldown (Cable)": { query: "Lat Pulldown", primaryMuscleGroup: "lats" },
  "Pull Up (Assisted)": { query: "Pull Up", primaryMuscleGroup: "lats" },
  "Incline Chest Press (Machine)": { query: "Incline Chest Press", primaryMuscleGroup: "chest" },
  "Incline Bench Press (Dumbbell)": { query: "Incline Dumbbell Bench Press", primaryMuscleGroup: "chest" },
  "Lateral Raise (Dumbbell)": { query: "Dumbbell Lateral Raise", primaryMuscleGroup: "shoulders" },
  "Triceps Rope Pushdown": { query: "Rope Pushdown", primaryMuscleGroup: "triceps" },
  "Triceps Extension (Dumbbell)": { query: "Dumbbell Triceps Extension", primaryMuscleGroup: "triceps" },
  "Cable Crunch": { query: "Cable Crunch", primaryMuscleGroup: "abdominals" },
  "Hanging Knee Raise": { query: "Hanging Knee Raise", primaryMuscleGroup: "abdominals" },
  "Seated Leg Curl (Machine)": { query: "Seated Leg Curl", primaryMuscleGroup: "hamstrings" },
  Lunge: { query: "Lunge", primaryMuscleGroup: "quadriceps" },
};

const DEFAULT_CONFIG: Required<Pick<HevySyncConfig, "mcpCommand" | "mcpArgs" | "useRepRanges" | "weightRoundingKg" | "requestDelayMs" | "maxRetries" | "retryBackoffMs">> = {
  mcpCommand: "npx",
  mcpArgs: ["-y", "hevy-mcp"],
  useRepRanges: false,
  weightRoundingKg: 0.001,
  requestDelayMs: 400,
  maxRetries: 4,
  retryBackoffMs: 1200,
};

export function mergeConfig(config: HevySyncConfig): HevySyncConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    exerciseOverrides: {
      ...(config.exerciseOverrides ?? {}),
    },
  };
}

function shortLiftLabel(name: string): string {
  switch (name) {
    case "Bench Press":
      return "Bench";
    case "Overhead Press":
      return "OHP";
    default:
      return name;
  }
}

function decimalPlaces(value: number): number {
  const valueText = value.toString();
  const decimalPart = valueText.split(".")[1];
  return decimalPart?.length ?? 0;
}

function poundsToRoundedKilograms(weightLb: number, incrementKg: number): number {
  const exactKg = weightLb * 0.45359237;

  if (incrementKg <= 0) {
    return exactKg;
  }

  const roundedKg = Math.round(exactKg / incrementKg) * incrementKg;
  return Number(roundedKg.toFixed(decimalPlaces(incrementKg)));
}

function buildWeightStorageNote(rounding: number): string {
  if (rounding <= 0) {
    return "Hevy payload weights are stored in exact kg converted from the authored lb loads.";
  }

  if (rounding < 0.01) {
    return `Hevy payload weights are stored in kg with ${rounding} kg precision to preserve the authored lb display in Hevy.`;
  }

  return `Hevy payload weights are stored in kg rounded to the configured ${rounding} kg increment.`;
}

function routineTitle(document: ParsedRoutineDocument, week: number, day: number, main1: string, main2: string, config: HevySyncConfig): string {
  const shortTitle = `W${week}D${day}: ${shortLiftLabel(main1)}/${shortLiftLabel(main2)}`;
  if (config.titlePrefix) {
    return `${config.titlePrefix} ${shortTitle}`;
  }

  return shortTitle;
}

function buildRoutineNotes(document: ParsedRoutineDocument, week: number, day: number): string {
  return [
    `Generated from ${basename(document.sourcePath)}.`,
    `Source block date: ${document.blockDate}.`,
    `Session: Week ${week}, Day ${day}.`,
  ].join(" ");
}

function buildLookup(name: string, config: HevySyncConfig): ExerciseLookup {
  const override = config.exerciseOverrides?.[name];
  if (override) {
    return {
      ...DEFAULT_EXERCISE_LOOKUPS[name],
      ...override,
    };
  }

  return DEFAULT_EXERCISE_LOOKUPS[name] ?? { query: name };
}

function mergeNotes(notes: string[]): string | undefined {
  const uniqueNotes = [...new Set(notes.filter(Boolean))];
  const merged = uniqueNotes.join(" ");
  return merged || undefined;
}

function buildSetNote(repRange: RepRange | undefined, useRepRanges: boolean): string[] {
  if (!repRange || useRepRanges) {
    return [];
  }

  return [`Target rep range: ${repRange.start}-${repRange.end}.`];
}

function resolvePayloadRepRange(repRange: RepRange | undefined, reps: number | undefined): RepRange | null {
  if (repRange) {
    return repRange;
  }

  if (typeof reps === "number") {
    return { start: reps, end: reps };
  }

  return null;
}

function convertExercise(exercise: ParsedExercise, config: HevySyncConfig): HevyDraftExercise {
  const useRepRanges = config.useRepRanges ?? DEFAULT_CONFIG.useRepRanges;
  const rounding = config.weightRoundingKg ?? DEFAULT_CONFIG.weightRoundingKg;

  const sets: HevyDraftSet[] = exercise.sets.map((set) => ({
    type: set.type,
    sourceWeightLb: set.weightLb,
    weightKg:
      typeof set.weightLb === "number"
        ? poundsToRoundedKilograms(set.weightLb, rounding)
        : undefined,
    reps: typeof set.reps === "number" ? set.reps : null,
    repRange: resolvePayloadRepRange(set.repRange, typeof set.reps === "number" ? set.reps : undefined),
    distanceMeters: set.distanceMeters ?? null,
    durationSeconds: null,
    customMetric: null,
  }));

  const notes = [...exercise.notes];
  for (const set of exercise.sets) {
    notes.push(...buildSetNote(set.repRange, useRepRanges));
  }

  if (exercise.sets.some((set) => typeof set.weightLb === "number")) {
    notes.push(`Source prescription is authored in lb and rounded to the nearest 5 lb before kg conversion.`);
    notes.push(buildWeightStorageNote(rounding));
  }

  return {
    localName: exercise.name,
    lookup: buildLookup(exercise.name, config),
    supersetId: exercise.supersetGroup ?? null,
    restSeconds: exercise.restSeconds,
    notes: mergeNotes(notes),
    sets,
  };
}

export function buildDraftRoutines(document: ParsedRoutineDocument, rawConfig: HevySyncConfig = {}): HevyDraftRoutine[] {
  const config = mergeConfig(rawConfig);
  const folderName = config.folderName ?? `5/3/1 - ${document.blockDate} Block`;

  return document.sessions.map((session) => ({
    sourceWeek: session.week,
    sourceDay: session.day,
    title: routineTitle(
      document,
      session.week,
      session.day,
      session.mainLift1.name,
      session.mainLift2.name,
      config,
    ),
    notes: buildRoutineNotes(document, session.week, session.day),
    folderName,
    exercises: [
      convertExercise(session.mainLift1, config),
      convertExercise(session.mainLift2, config),
      ...session.accessories.map((exercise) => convertExercise(exercise, config)),
    ],
  }));
}