export type QueuedTaskSaveStatus = "pending" | "syncing" | "error";

export interface QueuedTaskSave {
  id: string;
  sessionId: string;
  linkToken: string;
  taskName: string;
  taskType: string;
  rawData: unknown;
  imageBase64?: string;
  createdAt: string;
  updatedAt: string;
  version?: string;
  attempts: number;
  status: QueuedTaskSaveStatus;
  lastError?: string;
}

export interface NewQueuedTaskSave {
  sessionId: string;
  linkToken: string;
  taskName: string;
  taskType: string;
  rawData: unknown;
  imageBase64?: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const AUTOSAVE_QUEUE_KEY = "moca_assessment_autosave_queue_v1";

function queueStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function queueItemId(sessionId: string, taskName: string): string {
  return `${sessionId}:${taskName}`;
}

function queueItemVersion(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isQueuedTaskSave(value: unknown): value is QueuedTaskSave {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<QueuedTaskSave>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.linkToken === "string" &&
    typeof candidate.taskName === "string" &&
    typeof candidate.taskType === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.attempts === "number" &&
    ["pending", "syncing", "error"].includes(candidate.status ?? "")
  );
}

export function loadAutosaveQueue(storage?: StorageLike): QueuedTaskSave[] {
  const target = queueStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(AUTOSAVE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedTaskSave);
  } catch {
    return [];
  }
}

function writeAutosaveQueue(queue: QueuedTaskSave[], storage?: StorageLike): void {
  const target = queueStorage(storage);
  if (!target) return;
  target.setItem(AUTOSAVE_QUEUE_KEY, JSON.stringify(queue));
}

export function queuedSavesForSession(sessionId: string, storage?: StorageLike): QueuedTaskSave[] {
  return loadAutosaveQueue(storage).filter((item) => item.sessionId === sessionId);
}

export function upsertQueuedTaskSave(input: NewQueuedTaskSave, storage?: StorageLike): QueuedTaskSave {
  const queue = loadAutosaveQueue(storage);
  const id = queueItemId(input.sessionId, input.taskName);
  const now = new Date().toISOString();
  const existing = queue.find((item) => item.id === id);
  const item: QueuedTaskSave = {
    id,
    sessionId: input.sessionId,
    linkToken: input.linkToken,
    taskName: input.taskName,
    taskType: input.taskType,
    rawData: input.rawData,
    imageBase64: input.imageBase64 || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: queueItemVersion(),
    attempts: existing?.attempts ?? 0,
    status: "pending",
  };

  writeAutosaveQueue([...queue.filter((queued) => queued.id !== id), item], storage);
  return item;
}

export function updateQueuedTaskSave(
  id: string,
  patch: Partial<Pick<QueuedTaskSave, "attempts" | "status" | "lastError" | "rawData" | "imageBase64">>,
  storage?: StorageLike,
): QueuedTaskSave | null {
  const queue = loadAutosaveQueue(storage);
  let updated: QueuedTaskSave | null = null;
  const next = queue.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...patch,
      updatedAt: patch.status === "pending" ? new Date().toISOString() : item.updatedAt,
    };
    return updated;
  });

  writeAutosaveQueue(next, storage);
  return updated;
}

export function removeQueuedTaskSave(id: string, expectedVersion?: string, storage?: StorageLike): boolean {
  const queue = loadAutosaveQueue(storage);
  const existing = queue.find((item) => item.id === id);
  if (!existing) return false;
  if (expectedVersion && existing.version !== expectedVersion) return false;

  writeAutosaveQueue(queue.filter((item) => item.id !== id), storage);
  return true;
}

export function clearAutosaveQueueForSession(sessionId: string, storage?: StorageLike): void {
  writeAutosaveQueue(loadAutosaveQueue(storage).filter((item) => item.sessionId !== sessionId), storage);
}
