import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type {
  HevyDraftRoutine,
  HevyFolderRecord,
  HevyRoutineRecord,
  HevySyncConfig,
  HevyTemplateMatch,
  SyncResult,
} from "./types.js";

type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes("429") || normalized.includes("rate limit") || normalized.includes("too many requests");
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function extractText(result: ToolCallResult): string | undefined {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const textItem = content.find((item) => item.type === "text" && typeof item.text === "string");
  return textItem?.text;
}

function ensureToolSuccess(result: ToolCallResult, toolName: string): ToolCallResult {
  if ((result as { isError?: boolean }).isError) {
    const message = extractText(result) ?? `MCP tool ${toolName} returned an error.`;
    throw new Error(message);
  }

  return result;
}

function extractJson<T>(result: ToolCallResult): T {
  const structured = (result as { structuredContent?: unknown }).structuredContent;
  if (structured != null) {
    return structured as T;
  }

  const text = extractText(result);
  if (!text) {
    throw new Error("Tool result did not include structured content or text content.");
  }

  return JSON.parse(text) as T;
}

function extractJsonArrayOrEmpty(result: ToolCallResult, emptyPrefix: string): unknown[] {
  const structured = (result as { structuredContent?: unknown }).structuredContent;
  if (Array.isArray(structured)) {
    return structured;
  }

  const text = extractText(result);
  if (!text) {
    return [];
  }

  if (text.startsWith(emptyPrefix)) {
    return [];
  }

  return JSON.parse(text) as unknown[];
}

function bestTemplateMatch(candidates: HevyTemplateMatch[], query: string, localName: string): HevyTemplateMatch | undefined {
  const normalizedLocal = normalizeText(localName);
  const normalizedQuery = normalizeText(query);

  return (
    candidates.find((candidate) => normalizeText(candidate.title) === normalizedLocal) ??
    candidates.find((candidate) => normalizeText(candidate.title) === normalizedQuery) ??
    candidates.find((candidate) => normalizeText(candidate.title).includes(normalizedLocal)) ??
    candidates.find((candidate) => normalizeText(candidate.title).includes(normalizedQuery)) ??
    candidates[0]
  );
}

function queryVariants(localName: string, preferredQuery?: string): string[] {
  const variants = new Set<string>();

  if (preferredQuery) {
    variants.add(preferredQuery);
  }

  variants.add(localName);

  const withoutParenthetical = localName.replace(/\s*\([^)]*\)/g, "").trim();
  if (withoutParenthetical) {
    variants.add(withoutParenthetical);
  }

  const simplified = withoutParenthetical
    .replace(/\bMachine\b|\bCable\b|\bDumbbell\b|\bBarbell\b|\bAssisted\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (simplified) {
    variants.add(simplified);
  }

  return [...variants].filter(Boolean);
}

function normalizeTemplate(item: unknown): HevyTemplateMatch | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const record = item as Record<string, unknown>;
  const id = record.id;
  const title = record.title;
  if (typeof id !== "string" || typeof title !== "string") {
    return undefined;
  }

  const primaryMuscleGroup =
    typeof record.primaryMuscleGroup === "string"
      ? record.primaryMuscleGroup
      : typeof record.primary_muscle_group === "string"
        ? record.primary_muscle_group
        : undefined;

  return {
    id,
    title,
    primaryMuscleGroup,
    isCustom: typeof record.isCustom === "boolean" ? record.isCustom : typeof record.is_custom === "boolean" ? record.is_custom : undefined,
  };
}

function normalizeRoutine(item: unknown): HevyRoutineRecord | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const record = item as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.title !== "string") {
    return undefined;
  }

  const folderId =
    typeof record.folderId === "number"
      ? record.folderId
      : typeof record.folder_id === "number"
        ? record.folder_id
        : null;

  return {
    id: record.id,
    title: record.title,
    folderId,
  };
}

function normalizeFolder(item: unknown): HevyFolderRecord | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const record = item as Record<string, unknown>;
  const title =
    typeof record.title === "string"
      ? record.title
      : typeof record.name === "string"
        ? record.name
        : undefined;

  const id = typeof record.id === "number" ? record.id : undefined;

  if (!title || id == null) {
    return undefined;
  }

  return { id, title };
}

function routineKey(title: string, folderId: number | null): string {
  return `${folderId ?? "null"}::${title}`;
}

export class HevyMcpClient {
  private client = new Client({ name: "531-maker-hevy-sync", version: "0.1.0" });

  private transport: StdioClientTransport | null = null;

  private lastRequestAt = 0;

  constructor(private readonly config: HevySyncConfig) {}

  private async paceRequests(): Promise<void> {
    const requestDelayMs = this.config.requestDelayMs ?? 400;
    const now = Date.now();
    const waitMs = this.lastRequestAt + requestDelayMs - now;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    this.lastRequestAt = Date.now();
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const maxRetries = this.config.maxRetries ?? 4;
    const retryBackoffMs = this.config.retryBackoffMs ?? 1200;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await this.paceRequests();
        const result = await this.client.callTool({ name, arguments: args });
        return ensureToolSuccess(result, name);
      } catch (error) {
        if (attempt === maxRetries || !isRateLimitError(error)) {
          throw error;
        }

        const backoff = retryBackoffMs * (attempt + 1);
        await sleep(backoff);
      }
    }

    throw new Error(`Failed to call MCP tool ${name}.`);
  }

  async connect(): Promise<void> {
    const command = this.config.mcpCommand ?? "npx";
    const args = this.config.mcpArgs ?? ["-y", "hevy-mcp"];
    const apiKey = process.env.HEVY_API_KEY;
    if (!apiKey) {
      throw new Error("HEVY_API_KEY is required for MCP-backed Hevy sync.");
    }

    this.transport = new StdioClientTransport({
      command,
      args,
      env: {
        ...process.env,
        HEVY_API_KEY: apiKey,
      } as Record<string, string>,
      stderr: "pipe",
    });

    await this.client.connect(this.transport);
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  async listTools(): Promise<string[]> {
    const result = await this.client.listTools();
    return result.tools.map((tool) => tool.name);
  }

  async searchTemplates(query: string, primaryMuscleGroup?: string): Promise<HevyTemplateMatch[]> {
    const result = await this.callTool("search-exercise-templates", {
        query,
        ...(primaryMuscleGroup ? { primaryMuscleGroup } : {}),
        refresh: false,
    });

    const parsed = extractJsonArrayOrEmpty(result, "No exercise templates found matching");
    return asArray(parsed).map(normalizeTemplate).filter((item): item is HevyTemplateMatch => item != null);
  }

  async getAllRoutines(): Promise<HevyRoutineRecord[]> {
    const routines: HevyRoutineRecord[] = [];

    for (let page = 1; page <= 100; page += 1) {
      const result = await this.callTool("get-routines", { page, pageSize: 10 });

      const parsed = extractJsonArrayOrEmpty(result, "No routines found for the specified parameters");
      const pageItems = asArray(parsed).map(normalizeRoutine).filter((item): item is HevyRoutineRecord => item != null);
      routines.push(...pageItems);
      if (pageItems.length < 10) {
        break;
      }
    }

    return routines;
  }

  async getAllFolders(): Promise<HevyFolderRecord[]> {
    const folders: HevyFolderRecord[] = [];

    for (let page = 1; page <= 100; page += 1) {
      const result = await this.callTool("get-routine-folders", { page, pageSize: 10 });

      const parsed = extractJsonArrayOrEmpty(result, "No routine folders found for the specified parameters");
      const pageItems = asArray(parsed).map(normalizeFolder).filter((item): item is HevyFolderRecord => item != null);
      folders.push(...pageItems);
      if (pageItems.length < 10) {
        break;
      }
    }

    return folders;
  }

  async getOrCreateFolder(folderName: string): Promise<number> {
    const folders = await this.getAllFolders();
    const existing = folders.find((folder) => normalizeText(folder.title) === normalizeText(folderName));
    if (existing) {
      return existing.id;
    }

    const result = await this.callTool("create-routine-folder", { name: folderName });

    const parsed = extractJson<Record<string, unknown>>(result);
    const directId = parsed.id;
    if (typeof directId === "number") {
      return directId;
    }

    const refreshedFolders = await this.getAllFolders();
    const created = refreshedFolders.find((folder) => normalizeText(folder.title) === normalizeText(folderName));
    if (created) {
      return created.id;
    }

    throw new Error(`Could not determine folder ID for newly created folder ${folderName}.`);
  }

  async resolveExerciseIds(routines: HevyDraftRoutine[]): Promise<void> {
    const seen = new Map<string, string>();

    for (const routine of routines) {
      for (const exercise of routine.exercises) {
        if (exercise.exerciseTemplateId) {
          continue;
        }

        if (exercise.lookup.templateId) {
          exercise.exerciseTemplateId = exercise.lookup.templateId;
          continue;
        }

        const queries = queryVariants(exercise.localName, exercise.lookup.query);
        let match: HevyTemplateMatch | undefined;

        for (const query of queries) {
          const cacheKey = `${query}::${exercise.lookup.primaryMuscleGroup ?? ""}`;
          if (seen.has(cacheKey)) {
            exercise.exerciseTemplateId = seen.get(cacheKey);
            match = { id: seen.get(cacheKey) as string, title: query };
            break;
          }

          const candidates = await this.searchTemplates(query, exercise.lookup.primaryMuscleGroup);
          match = bestTemplateMatch(candidates, query, exercise.localName);
          if (match) {
            exercise.exerciseTemplateId = match.id;
            seen.set(cacheKey, match.id);
            break;
          }
        }

        if (!match || !exercise.exerciseTemplateId) {
          throw new Error(
            `Could not resolve a Hevy exercise template for ${exercise.localName}. Tried queries: ${queries.join(", ")}.`,
          );
        }
      }
    }
  }

  async syncRoutines(routines: HevyDraftRoutine[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const folderId = routines[0]?.folderName ? await this.getOrCreateFolder(routines[0].folderName) : null;
    const existing = await this.getAllRoutines();
    const byTitle = new Map(existing.map((routine) => [routineKey(routine.title, routine.folderId ?? null), routine]));

    for (const routine of routines) {
      const payload = {
        title: routine.title,
        folderId,
        notes: routine.notes,
        exercises: routine.exercises.map((exercise) => {
          if (!exercise.exerciseTemplateId) {
            throw new Error(`Exercise ${exercise.localName} is missing a resolved template ID.`);
          }

          return {
            exerciseTemplateId: exercise.exerciseTemplateId,
            supersetId: exercise.supersetId ?? null,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
            sets: exercise.sets.map((set) => ({
              type: set.type,
              ...(typeof set.weightKg === "number" ? { weightKg: set.weightKg } : {}),
              ...(typeof set.reps === "number" ? { reps: set.reps } : {}),
              ...(set.repRange ? { repRange: set.repRange } : {}),
              ...(typeof set.distanceMeters === "number" ? { distanceMeters: set.distanceMeters } : {}),
              ...(typeof set.durationSeconds === "number" ? { durationSeconds: set.durationSeconds } : {}),
              ...(typeof set.customMetric === "number" ? { customMetric: set.customMetric } : {}),
            })),
          };
        }),
      };

      const existingRoutine = byTitle.get(routineKey(routine.title, folderId));
      if (existingRoutine) {
        await this.callTool("update-routine", {
            routineId: existingRoutine.id,
            ...payload,
        });

        results.push({ action: "updated", title: routine.title, routineId: existingRoutine.id });
        continue;
      }

      const createResult = await this.callTool("create-routine", payload);
      const created = extractJson<Record<string, unknown>>(createResult);
      results.push({
        action: "created",
        title: routine.title,
        routineId: typeof created.id === "string" ? created.id : undefined,
      });
    }

    return results;
  }
}