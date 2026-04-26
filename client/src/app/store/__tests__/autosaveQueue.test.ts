import { describe, expect, it } from 'vitest';
import {
  clearAutosaveQueueForSession,
  loadAutosaveQueue,
  queuedSavesForSession,
  removeQueuedTaskSave,
  updateQueuedTaskSave,
  upsertQueuedTaskSave,
} from '../autosaveQueue';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('autosaveQueue', () => {
  it('upserts by session and task so repeated drawing saves keep only the latest payload', () => {
    const storage = new MemoryStorage();

    const first = upsertQueuedTaskSave({
      sessionId: 'session-1',
      linkToken: 'token-1',
      taskName: 'clock',
      taskType: 'moca-clock',
      rawData: { strokes: [[{ x: 1, y: 1 }]] },
      imageBase64: 'data:image/png;base64,first',
    }, storage);

    const second = upsertQueuedTaskSave({
      sessionId: 'session-1',
      linkToken: 'token-1',
      taskName: 'clock',
      taskType: 'moca-clock',
      rawData: { strokes: [[{ x: 2, y: 2 }]] },
      imageBase64: 'data:image/png;base64,second',
    }, storage);

    const queue = loadAutosaveQueue(storage);
    expect(queue).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(queue[0]).toEqual(expect.objectContaining({
      id: first.id,
      rawData: { strokes: [[{ x: 2, y: 2 }]] },
      imageBase64: 'data:image/png;base64,second',
      status: 'pending',
    }));
  });

  it('does not remove a queue item when a newer update replaced the in-flight payload', () => {
    const storage = new MemoryStorage();
    const first = upsertQueuedTaskSave({
      sessionId: 'session-1',
      linkToken: 'token-1',
      taskName: 'naming',
      taskType: 'moca-naming',
      rawData: { answers: { 'item-1': 'סוס' } },
    }, storage);

    const second = upsertQueuedTaskSave({
      sessionId: 'session-1',
      linkToken: 'token-1',
      taskName: 'naming',
      taskType: 'moca-naming',
      rawData: { answers: { 'item-1': 'סוס', 'item-2': 'נמר', 'item-3': 'ברווז' } },
    }, storage);

    expect(removeQueuedTaskSave(first.id, first.version, storage)).toBe(false);
    expect(loadAutosaveQueue(storage)).toHaveLength(1);

    expect(removeQueuedTaskSave(second.id, second.version, storage)).toBe(true);
    expect(loadAutosaveQueue(storage)).toHaveLength(0);
  });

  it('tracks retry status and can clear one session without touching another', () => {
    const storage = new MemoryStorage();
    const first = upsertQueuedTaskSave({
      sessionId: 'session-1',
      linkToken: 'token-1',
      taskName: 'naming',
      taskType: 'moca-naming',
      rawData: { answers: {} },
    }, storage);
    upsertQueuedTaskSave({
      sessionId: 'session-2',
      linkToken: 'token-2',
      taskName: 'clock',
      taskType: 'moca-clock',
      rawData: { strokes: [] },
    }, storage);

    updateQueuedTaskSave(first.id, { status: 'error', attempts: 2, lastError: 'offline' }, storage);
    expect(queuedSavesForSession('session-1', storage)[0]).toEqual(expect.objectContaining({
      status: 'error',
      attempts: 2,
      lastError: 'offline',
    }));

    clearAutosaveQueueForSession('session-1', storage);
    expect(queuedSavesForSession('session-1', storage)).toHaveLength(0);
    expect(queuedSavesForSession('session-2', storage)).toHaveLength(1);
  });
});
