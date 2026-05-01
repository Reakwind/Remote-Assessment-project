export type PatientTaskKey =
  | "trailMaking"
  | "cube"
  | "clock"
  | "naming"
  | "memory"
  | "digitSpan"
  | "vigilance"
  | "serial7"
  | "language"
  | "abstraction"
  | "delayedRecall"
  | "orientation";

export interface PatientStepConfig {
  step: number;
  next: string;
  prev: string;
  taskKey?: PatientTaskKey;
  incompleteMessage?: string;
}

const STEP_CONFIG: Record<string, PatientStepConfig> = {
  patient: {
    step: 1,
    next: "/patient/cube",
    prev: "/",
    taskKey: "trailMaking",
    incompleteMessage: "יש להשלים את הציור לפני מעבר למשימה הבאה.",
  },
  "trail-making": {
    step: 1,
    next: "/patient/cube",
    prev: "/",
    taskKey: "trailMaking",
    incompleteMessage: "יש להשלים את הציור לפני מעבר למשימה הבאה.",
  },
  cube: {
    step: 2,
    next: "/patient/clock",
    prev: "/patient/trail-making",
    taskKey: "cube",
    incompleteMessage: "יש להשלים את ציור הקובייה לפני מעבר למשימה הבאה.",
  },
  clock: {
    step: 3,
    next: "/patient/naming",
    prev: "/patient/cube",
    taskKey: "clock",
    incompleteMessage: "יש להשלים את ציור השעון לפני מעבר למשימה הבאה.",
  },
  naming: {
    step: 4,
    next: "/patient/memory",
    prev: "/patient/clock",
    taskKey: "naming",
    incompleteMessage: "יש לבחור תשובה לכל שלושת פריטי השיום.",
  },
  memory: {
    step: 5,
    next: "/patient/digit-span",
    prev: "/patient/naming",
    taskKey: "memory",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  "digit-span": {
    step: 6,
    next: "/patient/vigilance",
    prev: "/patient/memory",
    taskKey: "digitSpan",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  vigilance: {
    step: 7,
    next: "/patient/serial7",
    prev: "/patient/digit-span",
    taskKey: "vigilance",
    incompleteMessage: "יש לבצע לפחות הקשה אחת במשימת הקשב לפני מעבר למשימה הבאה.",
  },
  serial7: {
    step: 8,
    next: "/patient/language",
    prev: "/patient/vigilance",
    taskKey: "serial7",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  language: {
    step: 9,
    next: "/patient/abstraction",
    prev: "/patient/serial7",
    taskKey: "language",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  abstraction: {
    step: 10,
    next: "/patient/delayed-recall",
    prev: "/patient/language",
    taskKey: "abstraction",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  "delayed-recall": {
    step: 11,
    next: "/patient/orientation",
    prev: "/patient/abstraction",
    taskKey: "delayedRecall",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  orientation: {
    step: 12,
    next: "/patient/end",
    prev: "/patient/delayed-recall",
    taskKey: "orientation",
    incompleteMessage: "יש להקליט תשובה לפני סיום המבדק.",
  },
  end: {
    step: 12,
    next: "/patient/welcome",
    prev: "/patient/orientation",
  },
};

export const patientTaskTotalSteps = 12;

function hasStrokeEvidence(data: unknown): boolean {
  const strokes = (data as { strokes?: unknown })?.strokes;
  return Array.isArray(strokes) && strokes.some((stroke) => Array.isArray(stroke) && stroke.length > 0);
}

function hasAudioEvidence(data: unknown): boolean {
  const audio = data as { audioId?: unknown; audioStoragePath?: unknown } | null | undefined;
  return Boolean(
    (typeof audio?.audioStoragePath === "string" && audio.audioStoragePath.length > 0) ||
      (typeof audio?.audioId === "string" && audio.audioId.length > 0),
  );
}

function taskHasEvidence(taskKey: PatientTaskKey | undefined, tasks: Record<string, unknown>): boolean {
  if (!taskKey) return true;
  const taskData = tasks[taskKey];
  if (taskData && typeof taskData === "object" && !Array.isArray(taskData) && (taskData as { skipped?: unknown }).skipped === true) {
    return true;
  }

  switch (taskKey) {
    case "trailMaking":
    case "cube":
    case "clock":
      return hasStrokeEvidence(tasks[taskKey]);
    case "naming": {
      const answers = (tasks.naming as { answers?: unknown })?.answers;
      return Boolean(answers && typeof answers === "object" && Object.keys(answers).length >= 3);
    }
    case "vigilance":
      return Number((tasks.vigilance as { tapped?: unknown })?.tapped ?? 0) > 0;
    default:
      return hasAudioEvidence(tasks[taskKey]);
  }
}

export function getPatientStepConfig(pathname: string): PatientStepConfig {
  const currentPath = pathname.split("/").pop() ?? "patient";
  return STEP_CONFIG[currentPath] ?? STEP_CONFIG.patient;
}

export function patientTaskHasEvidence(taskKey: PatientTaskKey | undefined, tasks: Record<string, unknown>): boolean {
  return taskHasEvidence(taskKey, tasks);
}
