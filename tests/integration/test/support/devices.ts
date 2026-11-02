import type { KeepItem, KeepSyncState, RemoteSyncDriver, SyncCapableStorageAdapter } from "@keepkit/core/core";
import { LocalStorageAdapter, LocalStorageSyncQueueAdapter, SyncStorageAdapter } from "@keepkit/core/storage";
import { createMemoryStorage } from "./memory-storage.ts";

export type ArticleMeta = { title: string };

export const ITEMS_KEY = "keepkit:items";
export const QUEUE_KEY = "keepkit:sync-queue";

export type Device = {
  readonly storage: Storage;
  readonly adapter: SyncStorageAdapter<ArticleMeta>;
};

export type DeviceOptions = {
  clientId: string;
  remote: RemoteSyncDriver<ArticleMeta>;
  /** Reuse a previous device's storage to simulate an application restart. */
  storage?: Storage;
  maxRetries?: number;
  itemPullMode?: "merge" | "snapshot";
};

/** Creates a browser-like client whose items and durable queue live in one Web Storage instance. */
export function createDevice({
  clientId,
  remote,
  storage = createMemoryStorage(),
  maxRetries,
  itemPullMode,
}: DeviceOptions): Device {
  const local = new LocalStorageAdapter<ArticleMeta>({ key: ITEMS_KEY, storage });
  const queue = new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage });
  const now = createClock();
  const adapter = new SyncStorageAdapter<ArticleMeta>({
    local,
    remote,
    queue,
    clientId,
    now,
    ...(maxRetries === undefined ? {} : { maxRetries }),
    ...(itemPullMode === undefined ? {} : { itemPullMode }),
  });
  return { storage, adapter };
}

/** A monotonically increasing clock so operation metadata never depends on wall-clock time. */
export function createClock(start = 1_700_000_000_000): () => number {
  let current = start;
  return () => {
    current += 1;
    return current;
  };
}

export function article(id: string, title: string, updatedAt: number): KeepItem<ArticleMeta> {
  return { id, savedAt: updatedAt, updatedAt, meta: { title } };
}

export async function editArticle(
  adapter: SyncCapableStorageAdapter<ArticleMeta>,
  id: string,
  title: string,
  updatedAt: number,
): Promise<void> {
  const current = (await adapter.getAll()).find((item) => item.id === id);
  if (!current) throw new Error(`Cannot edit missing item "${id}".`);
  await adapter.set({ ...current, meta: { title }, updatedAt });
}

/** Projects items to `[id, title, revision]` rows sorted by ID for readable assertions. */
export function summarize(items: readonly KeepItem<Record<string, unknown>>[]): unknown[][] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id)).map(toSummaryRow);
}

function toSummaryRow({ id, meta, revision }: KeepItem<Record<string, unknown>>): unknown[] {
  return [id, meta.title, revision];
}

/** Resolves once the adapter reaches the expected state; the timeout only guards against hangs. */
export function waitForSyncState<TMeta>(
  adapter: SyncCapableStorageAdapter<TMeta>,
  predicate: (state: KeepSyncState<TMeta>) => boolean,
  timeoutMs = 5_000,
): Promise<KeepSyncState<TMeta>> {
  const current = adapter.getSyncState();
  if (predicate(current)) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for sync state; last state: ${JSON.stringify(adapter.getSyncState())}`));
    }, timeoutMs);
    const unsubscribe = adapter.subscribeSync(() => {
      const state = adapter.getSyncState();
      if (!predicate(state)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(state);
    });
  });
}
