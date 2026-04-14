export type HevySetType = "warmup" | "normal" | "failure" | "dropset";

export interface RepRange {
  start: number;
  end: number;
}

export interface ParsedSet {
  type: HevySetType;
  weightLb?: number;
  reps?: number;
  repRange?: RepRange;
  distanceMeters?: number;
  isAmrap?: boolean;
}

export interface ParsedExercise {
  name: string;
  rawLine: string;
  role: "main1" | "main2" | "accessory";
  notes: string[];
  sets: ParsedSet[];
  supersetGroup?: number;
  restSeconds?: number;
}

export interface ParsedSession {
  week: number;
  day: number;
  mainLift1: ParsedExercise;
  mainLift2: ParsedExercise;
  accessories: ParsedExercise[];
}

export interface ParsedRoutineDocument {
  blockDate: string;
  sourcePath: string;
  sessions: ParsedSession[];
}

export interface HevyDraftSet {
  type: HevySetType;
  sourceWeightLb?: number;
  weightKg?: number;
  reps?: number | null;
  repRange?: RepRange | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  customMetric?: number | null;
}

export interface ExerciseLookup {
  query?: string;
  templateId?: string;
  primaryMuscleGroup?: string;
}

export interface HevyDraftExercise {
  localName: string;
  exerciseTemplateId?: string;
  lookup: ExerciseLookup;
  supersetId?: number | null;
  restSeconds?: number;
  notes?: string;
  sets: HevyDraftSet[];
}

export interface HevyDraftRoutine {
  sourceWeek: number;
  sourceDay: number;
  title: string;
  notes: string;
  folderName?: string;
  exercises: HevyDraftExercise[];
}

export interface HevySyncConfig {
  folderName?: string;
  titlePrefix?: string;
  mcpCommand?: string;
  mcpArgs?: string[];
  useRepRanges?: boolean;
  weightRoundingKg?: number;
  requestDelayMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  exerciseOverrides?: Record<string, ExerciseLookup>;
}

export interface HevyTemplateMatch {
  id: string;
  title: string;
  primaryMuscleGroup?: string;
  isCustom?: boolean;
}

export interface HevyRoutineRecord {
  id: string;
  title: string;
  folderId?: number | null;
}

export interface HevyFolderRecord {
  id: number;
  title: string;
}

export interface SyncResult {
  action: "created" | "updated";
  title: string;
  routineId?: string;
}

export interface HevyCompletedWorkoutSet {
  index?: number;
  type?: string;
  weightKg?: number | null;
  reps?: number | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  customMetric?: number | null;
}

export interface HevyCompletedWorkoutExercise {
  index?: number;
  title: string;
  notes?: string;
  exerciseTemplateId?: string;
  supersetId?: number | null;
  sets: HevyCompletedWorkoutSet[];
}

export interface HevyCompletedWorkout {
  id: string;
  title: string;
  routineId?: string | null;
  description?: string;
  startTime?: string;
  endTime?: string;
  updatedAt?: string;
  createdAt?: string;
  exercises: HevyCompletedWorkoutExercise[];
}

export interface HevyCompletedWorkoutPage {
  page: number;
  pageCount: number;
  workouts: HevyCompletedWorkout[];
}

export interface OneRmCsvRecord {
  lift: string;
  oneRmLb: number;
}

export interface ManagedRoutineBlockRoutine {
  id: string;
  title: string;
  folderId: number;
  week: number;
  day: number;
}

export interface ManagedRoutineBlock {
  folderId: number;
  folderName: string;
  blockDate: string;
  routines: ManagedRoutineBlockRoutine[];
}

export interface MatchedWorkout {
  routineId: string;
  routineTitle: string;
  workoutId: string;
  workoutTitle: string;
  startTime?: string;
  exerciseTitles: string[];
}

export interface CandidateBlockReport {
  folderId: number;
  folderName: string;
  blockDate: string;
  totalRoutines: number;
  completedRoutines: number;
  isComplete: boolean;
  matchedWorkouts: MatchedWorkout[];
  missingRoutineTitles: string[];
}

export interface ProposedOneRmUpdate {
  lift: string;
  currentOneRmLb: number;
  incrementLb: number;
  proposedOneRmLb: number;
  currentTrainingMaxLb: number;
  proposedTrainingMaxLb: number;
}

export interface CurrentOneRmSnapshot {
  lift: string;
  oneRmLb: number;
  trainingMaxLb: number;
}

export interface NextBlockReport {
  generatedAt: string;
  lookbackDays: number;
  status: "ready_for_approval" | "waiting_for_completion" | "no_managed_blocks_found";
  recommendedAction: string;
  detectedManagedBlocks: number;
  currentOneRmSnapshot: CurrentOneRmSnapshot[];
  candidateBlocks: CandidateBlockReport[];
  selectedBlock?: CandidateBlockReport;
  proposedOneRmUpdates: ProposedOneRmUpdate[];
  warnings: string[];
}