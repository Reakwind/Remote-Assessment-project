export type ReviewTab =
  | "clock"
  | "cube"
  | "trail"
  | "memory"
  | "digitSpan"
  | "vigilance"
  | "serial7"
  | "language"
  | "abstraction"
  | "delayedRecall"
  | "orientation";

export interface StrokePoint {
  x: number;
  y: number;
  time: number;
  pressure: number;
  pointerType: string;
}

export const DRAWING_TAB_TO_TASK_ID: Partial<Record<ReviewTab, string>> = {
  clock: "moca-clock",
  cube: "moca-cube",
  trail: "moca-visuospatial",
};

export const SCORING_TAB_TO_TASK_ID: Partial<Record<ReviewTab, string>> = {
  memory: "moca-memory-learning",
  digitSpan: "moca-digit-span",
  vigilance: "moca-vigilance",
  serial7: "moca-serial-7s",
  language: "moca-language",
  abstraction: "moca-abstraction",
  delayedRecall: "moca-delayed-recall",
  orientation: "moca-orientation-task",
};

export function normalizeStrokes(raw: unknown): StrokePoint[][] {
  const candidate = extractStrokeCandidate(raw);
  if (!Array.isArray(candidate)) return [];
  if (candidate.length === 0) return [];

  if (isPoint(candidate[0])) {
    return [normalizeStroke(candidate)];
  }

  return candidate
    .filter(Array.isArray)
    .map((stroke) => normalizeStroke(stroke))
    .filter((stroke) => stroke.length > 0);
}

function extractStrokeCandidate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  if (Array.isArray(raw)) return raw;

  const record = raw as Record<string, unknown>;
  return record.strokes_data ?? record.strokesData ?? record.strokes ?? raw;
}

function normalizeStroke(rawStroke: unknown[]): StrokePoint[] {
  return rawStroke.filter(isPoint).map((point, index) => ({
    x: Number(point.x),
    y: Number(point.y),
    time: Number.isFinite(Number(point.time)) ? Number(point.time) : index * 16,
    pressure: Number.isFinite(Number(point.pressure)) ? Number(point.pressure) : 0.5,
    pointerType: typeof point.pointerType === "string" ? point.pointerType : "touch",
  }));
}

function isPoint(value: unknown): value is { x: unknown; y: unknown; time?: unknown; pressure?: unknown; pointerType?: unknown } {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}
