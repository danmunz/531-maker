import { basename } from "node:path";

import type {
  ParsedExercise,
  ParsedRoutineDocument,
  ParsedSession,
  ParsedSet,
  RepRange,
} from "./types.js";

function nextNonEmpty(lines: string[], start: number): string {
  for (let index = start; index < lines.length; index += 1) {
    const candidate = lines[index]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  throw new Error(`Expected non-empty line after index ${start}`);
}

function parseMainLiftOne(rawLine: string): ParsedExercise {
  const match = rawLine.match(/^- (.+?) 5\/3\/1 - (.+)$/);
  if (!match) {
    throw new Error(`Could not parse main lift 1 line: ${rawLine}`);
  }

  const [, name, prescription] = match;
  const setMatches = prescription.split(", ").map((segment) => {
    const setMatch = segment.match(/(\d+)%x(\d+)(\+?) \((\d+(?:\.\d+)?)\)/);
    if (!setMatch) {
      throw new Error(`Could not parse work set: ${segment}`);
    }

    const [, , reps, plus, weightLb] = setMatch;
    return {
      type: "normal" as const,
      reps: Number(reps),
      weightLb: Number(weightLb),
      isAmrap: plus === "+",
    } satisfies ParsedSet;
  });

  const notes = [rawLine.slice(2)];
  if (setMatches.some((set) => set.isAmrap)) {
    notes.push("Last work set is AMRAP.");
  }

  return {
    name,
    rawLine,
    role: "main1",
    notes,
    restSeconds: 180,
    sets: setMatches,
  };
}

function parseMainLiftTwo(rawLine: string): ParsedExercise {
  const match = rawLine.match(/^- (.+?) FSL (\d+)x(\d+) - (\d+)% \((\d+(?:\.\d+)?)\)$/);
  if (!match) {
    throw new Error(`Could not parse main lift 2 line: ${rawLine}`);
  }

  const [, name, setCount, reps, percent, weightLb] = match;
  const sets = Array.from({ length: Number(setCount) }, () => ({
    type: "normal" as const,
    reps: Number(reps),
    weightLb: Number(weightLb),
  }));

  return {
    name,
    rawLine,
    role: "main2",
    notes: [rawLine.slice(2), `FSL work at ${percent}% TM.`],
    restSeconds: 150,
    sets,
  };
}

function parseRepRange(rangeText: string): RepRange | undefined {
  const rangeMatch = rangeText.match(/^(\d+)-(\d+)$/);
  if (!rangeMatch) {
    return undefined;
  }

  return {
    start: Number(rangeMatch[1]),
    end: Number(rangeMatch[2]),
  };
}

function parseAccessory(rawLine: string, supersetGroup?: number): ParsedExercise {
  const match = rawLine.match(/^- (.+?) - (\d+) x (.+)$/);
  if (!match) {
    throw new Error(`Could not parse accessory line: ${rawLine}`);
  }

  const [, name, setCountText, prescription] = match;
  const setCount = Number(setCountText);
  const notes: string[] = [];
  let sets: ParsedSet[] = [];

  const perSide = prescription.endsWith(" per side");
  const normalizedPrescription = perSide
    ? prescription.slice(0, -" per side".length)
    : prescription;

  const distanceMatch = normalizedPrescription.match(/^(\d+)(?:-(\d+))? m$/);
  if (distanceMatch) {
    const start = Number(distanceMatch[1]);
    const end = distanceMatch[2] ? Number(distanceMatch[2]) : start;
    notes.push(`Target distance: ${start}-${end} m.`);
    sets = Array.from({ length: setCount }, () => ({
      type: "normal" as const,
      distanceMeters: start,
    }));
  } else {
    const range = parseRepRange(normalizedPrescription);
    if (range) {
      notes.push(`Target rep range: ${range.start}-${range.end}.`);
      sets = Array.from({ length: setCount }, () => ({
        type: "normal" as const,
        reps: range.start,
        repRange: range,
      }));
    } else {
      const exactMatch = normalizedPrescription.match(/^(\d+)$/);
      if (!exactMatch) {
        throw new Error(`Unsupported accessory prescription: ${rawLine}`);
      }

      const reps = Number(exactMatch[1]);
      sets = Array.from({ length: setCount }, () => ({
        type: "normal" as const,
        reps,
      }));
    }
  }

  if (perSide) {
    notes.push("Perform each set per side.");
  }

  return {
    name,
    rawLine,
    role: "accessory",
    notes,
    supersetGroup,
    restSeconds: supersetGroup ? 75 : 60,
    sets,
  };
}

function parseAccessories(lines: string[], start: number): { accessories: ParsedExercise[]; endIndex: number } {
  const accessories: ParsedExercise[] = [];
  let index = start;
  let supersetGroup: number | undefined;

  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";

    if (trimmed.startsWith("## Week") || trimmed.startsWith("### Day")) {
      break;
    }

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "Superset A") {
      supersetGroup = 1;
      index += 1;
      continue;
    }

    if (trimmed === "Accessory B") {
      supersetGroup = undefined;
      index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      accessories.push(parseAccessory(trimmed, supersetGroup));
      index += 1;
      continue;
    }

    throw new Error(`Unexpected accessories line: ${trimmed}`);
  }

  return {
    accessories,
    endIndex: index,
  };
}

export function parseRoutineMarkdown(content: string, sourcePath: string): ParsedRoutineDocument {
  const lines = content.split(/\r?\n/);
  const titleLine = lines[0]?.trim() ?? "";
  const titleMatch = titleLine.match(/^# 5\/3\/1 Routine - (\d{4}-\d{2}-\d{2})(?: .+)?$/);
  if (!titleMatch) {
    throw new Error(`Could not parse routine title in ${basename(sourcePath)}`);
  }

  const sessions: ParsedSession[] = [];
  let currentWeek: number | undefined;
  let currentDay: number | undefined;
  let mainLift1: ParsedExercise | undefined;
  let mainLift2: ParsedExercise | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? "";
    if (!trimmed) {
      continue;
    }

    const weekMatch = trimmed.match(/^## Week (\d+)$/);
    if (weekMatch) {
      currentWeek = Number(weekMatch[1]);
      continue;
    }

    const dayMatch = trimmed.match(/^### Day (\d+)$/);
    if (dayMatch) {
      currentDay = Number(dayMatch[1]);
      mainLift1 = undefined;
      mainLift2 = undefined;
      continue;
    }

    if (trimmed === "Main Lift 1") {
      mainLift1 = parseMainLiftOne(nextNonEmpty(lines, index + 1));
      continue;
    }

    if (trimmed === "Main Lift 2") {
      mainLift2 = parseMainLiftTwo(nextNonEmpty(lines, index + 1));
      continue;
    }

    if (trimmed === "Accessories") {
      if (currentWeek == null || currentDay == null || !mainLift1 || !mainLift2) {
        throw new Error(`Missing day context before accessories at line ${index + 1}`);
      }

      const { accessories, endIndex } = parseAccessories(lines, index + 1);
      sessions.push({
        week: currentWeek,
        day: currentDay,
        mainLift1,
        mainLift2,
        accessories,
      });
      index = endIndex - 1;
    }
  }

  return {
    blockDate: titleMatch[1],
    sourcePath,
    sessions,
  };
}