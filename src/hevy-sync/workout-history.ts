import type {
  HevyCompletedWorkout,
  HevyCompletedWorkoutExercise,
  HevyCompletedWorkoutPage,
  HevyCompletedWorkoutSet,
} from "./types.js";

const HEVY_API_BASE_URL = "https://api.hevyapp.com/v1";

function normalizeSet(item: unknown): HevyCompletedWorkoutSet | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const record = item as Record<string, unknown>;
  return {
    index: typeof record.index === "number" ? record.index : undefined,
    type: typeof record.type === "string" ? record.type : undefined,
    weightKg: typeof record.weight_kg === "number" ? record.weight_kg : null,
    reps: typeof record.reps === "number" ? record.reps : null,
    distanceMeters: typeof record.distance_meters === "number" ? record.distance_meters : null,
    durationSeconds: typeof record.duration_seconds === "number" ? record.duration_seconds : null,
    rpe: typeof record.rpe === "number" ? record.rpe : null,
    customMetric: typeof record.custom_metric === "number" ? record.custom_metric : null,
  };
}

function normalizeExercise(item: unknown): HevyCompletedWorkoutExercise | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const record = item as Record<string, unknown>;
  if (typeof record.title !== "string") {
    return undefined;
  }

  const rawSets = Array.isArray(record.sets) ? record.sets : [];

  return {
    index: typeof record.index === "number" ? record.index : undefined,
    title: record.title,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    exerciseTemplateId: typeof record.exercise_template_id === "string" ? record.exercise_template_id : undefined,
    supersetId: typeof record.superset_id === "number" ? record.superset_id : null,
    sets: rawSets.map(normalizeSet).filter((set): set is HevyCompletedWorkoutSet => set != null),
  };
}

function normalizeWorkout(item: unknown): HevyCompletedWorkout | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const record = item as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.title !== "string") {
    return undefined;
  }

  const rawExercises = Array.isArray(record.exercises) ? record.exercises : [];

  return {
    id: record.id,
    title: record.title,
    routineId: typeof record.routine_id === "string" ? record.routine_id : null,
    description: typeof record.description === "string" ? record.description : undefined,
    startTime: typeof record.start_time === "string" ? record.start_time : undefined,
    endTime: typeof record.end_time === "string" ? record.end_time : undefined,
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : undefined,
    createdAt: typeof record.created_at === "string" ? record.created_at : undefined,
    exercises: rawExercises.map(normalizeExercise).filter((exercise): exercise is HevyCompletedWorkoutExercise => exercise != null),
  };
}

export class HevyWorkoutHistoryClient {
  constructor(private readonly apiKey = process.env.HEVY_API_KEY) {
    if (!this.apiKey) {
      throw new Error("HEVY_API_KEY is required for Hevy workout history access.");
    }
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${HEVY_API_BASE_URL}${path}`, {
      headers: {
        "api-key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Hevy API request failed for ${path}: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  async getWorkoutsPage(page: number, pageSize: number): Promise<HevyCompletedWorkoutPage> {
    const payload = await this.fetchJson<Record<string, unknown>>(`/workouts?page=${page}&pageSize=${pageSize}`);
    const rawWorkouts = Array.isArray(payload.workouts) ? payload.workouts : [];

    return {
      page: typeof payload.page === "number" ? payload.page : page,
      pageCount: typeof payload.page_count === "number" ? payload.page_count : page,
      workouts: rawWorkouts.map(normalizeWorkout).filter((workout): workout is HevyCompletedWorkout => workout != null),
    };
  }

  async getRecentWorkouts(options: { lookbackDays?: number; pageSize?: number; maxPages?: number } = {}): Promise<HevyCompletedWorkout[]> {
    const lookbackDays = options.lookbackDays ?? 180;
    const pageSize = options.pageSize ?? 10;
    const maxPages = options.maxPages ?? 100;
    const cutoffTimestamp = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const workouts: HevyCompletedWorkout[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const currentPage = await this.getWorkoutsPage(page, pageSize);
      if (currentPage.workouts.length === 0) {
        break;
      }

      workouts.push(
        ...currentPage.workouts.filter((workout) => {
          const startTimestamp = workout.startTime ? Date.parse(workout.startTime) : Number.NaN;
          return Number.isFinite(startTimestamp) ? startTimestamp >= cutoffTimestamp : true;
        }),
      );

      const oldestTimestamp = Math.min(
        ...currentPage.workouts.map((workout) => (workout.startTime ? Date.parse(workout.startTime) : Number.POSITIVE_INFINITY)),
      );

      if (currentPage.workouts.length < pageSize || oldestTimestamp < cutoffTimestamp) {
        break;
      }
    }

    return workouts;
  }
}