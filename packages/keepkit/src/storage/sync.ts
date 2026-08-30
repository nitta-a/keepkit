import type {
  KeepConflictResolver,
  KeepItem,
  KeepSyncState,
  RemoteSyncDriver,
  StorageAdapter,
  SyncCapableStorageAdapter,
  SyncOperation,
  SyncQueueAdapter,
} from "../types";

export type LocalStorageSyncQueueOptions = {
  key?: string;
  storage?: Storage;
};

export type IndexedDBSyncQueueOptions = {
  databaseName?: string;
  storeName?: string;
  version?: number;
  indexedDB?: IDBFactory;
};

export type SyncStorageAdapterOptions<TMeta = Record<string, unknown>> = {
  local: StorageAdapter<TMeta>;
  remote: RemoteSyncDriver<TMeta>;
  queue?: SyncQueueAdapter<TMeta>;
  queueKey?: string;
  queueDatabaseName?: string;
  clientId?: string;
  now?: () => number;
  resolveConflict?: KeepConflictResolver<TMeta>;
};

export const DEFAULT_SYNC_QUEUE_KEY = "keepkit:sync-queue";
export const DEFAULT_SYNC_QUEUE_DATABASE = "keepkit-sync";
export const DEFAULT_SYNC_QUEUE_STORE = "sync-queue";

export class LocalStorageSyncQueueAdapter<TMeta = Record<string, unknown>>
  implements SyncQueueAdapter<TMeta>
{
  private readonly key: string;
  private readonly storage: Storage | undefined;

  constructor(options: LocalStorageSyncQueueOptions = {}) {
    this.key = options.key ?? DEFAULT_SYNC_QUEUE_KEY;
    this.storage = options.storage ?? getBrowserStorage();
  }

  async getAll(): Promise<SyncOperation<TMeta>[]> {
    if (!this.storage) return [];
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch (cause) {
      throw Object.assign(new Error("KeepKit sync queue contains invalid JSON."), { cause });
    }
    if (!Array.isArray(value) || !value.every(isSyncOperation)) {
      throw new Error("KeepKit sync queue contains invalid operations.");
    }
    return value as SyncOperation<TMeta>[];
  }

  async setMany(operations: SyncOperation<TMeta>[]): Promise<void> {
    if (!this.storage) return;
    this.storage.setItem(this.key, JSON.stringify(operations));
  }

  async remove(operationIds: string[]): Promise<void> {
    const ids = new Set(operationIds);
    const current = await this.getAll();
    await this.setMany(current.filter((operation) => !ids.has(operation.operationId)));
  }

  async clear(): Promise<void> {
    this.storage?.removeItem(this.key);
  }
}

export class IndexedDBSyncQueueAdapter<TMeta = Record<string, unknown>>
  implements SyncQueueAdapter<TMeta>
{
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly version: number;
  private readonly indexedDB: IDBFactory | undefined;
  private databasePromise: Promise<IDBDatabase | undefined> | undefined;

  constructor(options: IndexedDBSyncQueueOptions = {}) {
    this.databaseName = options.databaseName ?? DEFAULT_SYNC_QUEUE_DATABASE;
    this.storeName = options.storeName ?? DEFAULT_SYNC_QUEUE_STORE;
    this.version = options.version ?? 1;
    this.indexedDB = options.indexedDB ?? getBrowserIndexedDB();
  }

  async getAll(): Promise<SyncOperation<TMeta>[]> {
    const database = await this.open();
    if (!database) return [];
    const transaction = database.transaction(this.storeName, "readonly");
    const value: unknown = await requestToPromise(transaction.objectStore(this.storeName).getAll());
    if (!Array.isArray(value) || !value.every(isSyncOperation)) {
      throw new Error("KeepKit sync queue contains invalid operations.");
    }
    return value as SyncOperation<TMeta>[];
  }

  async setMany(operations: SyncOperation<TMeta>[]): Promise<void> {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    for (const operation of operations) store.put(operation);
    await transactionToPromise(transaction);
  }

  async remove(operationIds: string[]): Promise<void> {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    for (const operationId of new Set(operationIds)) store.delete(operationId);
    await transactionToPromise(transaction);
  }

  async clear(): Promise<void> {
    const database = await this.open();
    if (!database) return;
    const transaction = database.transaction(this.storeName, "readwrite");
    transaction.objectStore(this.storeName).clear();
    await transactionToPromise(transaction);
  }

  private open(): Promise<IDBDatabase | undefined> {
    if (!this.indexedDB) return Promise.resolve(undefined);
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try {
          request = this.indexedDB?.open(this.databaseName, this.version) as IDBOpenDBRequest;
        } catch (cause) {
          reject(cause);
          return;
        }
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(this.storeName)) {
            request.result.createObjectStore(this.storeName, { keyPath: "operationId" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(request.error ?? new Error("IndexedDB open was blocked."));
      });
    }
    return this.databasePromise.catch((cause) => {
      this.databasePromise = undefined;
      throw cause;
    });
  }
}

/** A local-first adapter that persists remote operations until they are acknowledged. */
export class SyncStorageAdapter<TMeta = Record<string, unknown>>
  implements SyncCapableStorageAdapter<TMeta>
{
  readonly storageKey?: string;
  private readonly local: StorageAdapter<TMeta>;
  private readonly remote: RemoteSyncDriver<TMeta>;
  private readonly queue: SyncQueueAdapter<TMeta>;
  private readonly clientId: string;
  private readonly now: () => number;
  private readonly resolveConflict?: KeepConflictResolver<TMeta>;
  private readonly listeners = new Set<() => void>();
  private readonly dataListeners = new Set<() => void>();
  private queueItems: SyncOperation<TMeta>[] = [];
  private queueLoaded = false;
  private queueLoadPromise: Promise<void> | undefined;
  private flushPromise: Promise<void> | undefined;
  private state: KeepSyncState = { status: "idle", pendingCount: 0, conflictIds: [] };
  private onlineHandler?: () => void;

  constructor(options: SyncStorageAdapterOptions<TMeta>) {
    this.local = options.local;
    this.remote = options.remote;
    this.queue =
      options.queue ??
      (getBrowserIndexedDB()
        ? new IndexedDBSyncQueueAdapter<TMeta>({
            databaseName: options.queueDatabaseName,
          })
        : new LocalStorageSyncQueueAdapter<TMeta>({
            key:
              options.queueKey ??
              `${DEFAULT_SYNC_QUEUE_KEY}:${options.local.storageKey ?? "default"}`,
          }));
    this.clientId = options.clientId ?? createId();
    this.now = options.now ?? Date.now;
    this.resolveConflict = options.resolveConflict;
    this.storageKey = this.local.storageKey;
    if (typeof window !== "undefined") {
      this.onlineHandler = () => void this.flushSync();
      window.addEventListener("online", this.onlineHandler);
    }
  }

  getSyncState = (): KeepSyncState => this.state;

  subscribeSync = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  subscribe = (listener: () => void): (() => void) => {
    this.dataListeners.add(listener);
    const unsubscribeLocal = this.local.subscribe?.(listener) ?? (() => undefined);
    return () => {
      this.dataListeners.delete(listener);
      unsubscribeLocal();
    };
  };

  getAll(): Promise<KeepItem<TMeta>[]> {
    return this.local.getAll();
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    const operation = this.createOperation("upsert", item.id, item);
    await this.enqueueBeforeLocalWrite(operation);
    try {
      await this.local.set(item);
    } catch (cause) {
      await this.removeQueued(operation.operationId);
      throw cause;
    }
    this.notifyDataListeners();
    this.setPendingState();
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    const operations = items.map((item) => this.createOperation("upsert", item.id, item));
    await this.enqueueManyBeforeLocalWrite(operations);
    try {
      if (this.local.setMany) await this.local.setMany(items);
      else for (const item of items) await this.local.set(item);
    } catch (cause) {
      await this.removeQueued(operations.map((operation) => operation.operationId));
      throw cause;
    }
    this.notifyDataListeners();
    this.setPendingState();
  }

  async remove(id: string): Promise<void> {
    const operation = this.createOperation("remove", id);
    await this.enqueueBeforeLocalWrite(operation);
    try {
      await this.local.remove(id);
    } catch (cause) {
      await this.removeQueued(operation.operationId);
      throw cause;
    }
    this.notifyDataListeners();
    this.setPendingState();
  }

  async removeMany(ids: string[]): Promise<void> {
    const operations = [...new Set(ids)].map((id) => this.createOperation("remove", id));
    await this.enqueueManyBeforeLocalWrite(operations);
    try {
      if (this.local.removeMany) await this.local.removeMany(ids);
      else for (const id of ids) await this.local.remove(id);
    } catch (cause) {
      await this.removeQueued(operations.map((operation) => operation.operationId));
      throw cause;
    }
    this.notifyDataListeners();
    this.setPendingState();
  }

  async clear(): Promise<void> {
    const items = await this.local.getAll();
    await this.removeMany(items.map((item) => item.id));
    await this.local.clear();
  }

  async merge(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    const merged = this.local.merge
      ? await this.local.merge(localItems)
      : await mergeLocalItems(localItems, this.local);
    await this.setMany(localItems);
    return merged;
  }

  async flushSync(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.runFlush().finally(() => {
      this.flushPromise = undefined;
    });
    return this.flushPromise;
  }

  dispose(): void {
    if (this.onlineHandler) window.removeEventListener("online", this.onlineHandler);
    this.listeners.clear();
    this.dataListeners.clear();
  }

  private async runFlush(): Promise<void> {
    await this.loadQueue();
    if (!(await this.pullRemote())) return;
    if (this.queueItems.length === 0) {
      this.updateState({ status: "synced", pendingCount: 0, error: undefined });
      return;
    }
    this.updateState({ status: "syncing", error: undefined });
    for (const operation of [...this.queueItems]) {
      try {
        const result = await this.remote.push(operation);
        if (result.type === "conflict") {
          const local = operation.item;
          const resolved = this.resolveConflict
            ? await this.resolveConflict(local, result.remote, {
                operation,
                remoteRevision: result.revision,
              })
            : undefined;
          if (!resolved) {
            this.updateState({
              status: "conflict",
              conflictIds: [...new Set([...this.state.conflictIds, operation.id])],
            });
            continue;
          }
          const retry = this.createOperation("upsert", resolved.id, {
            ...resolved,
            revision: result.revision ?? resolved.revision,
          });
          await this.local.set(retry.item as KeepItem<TMeta>);
          await this.replaceQueued(operation, retry);
          continue;
        }
        if (result.item) {
          await this.local.set({
            ...result.item,
            ...(result.revision ? { revision: result.revision } : {}),
          });
          this.notifyDataListeners();
        }
        await this.removeQueued(operation.operationId);
        this.updateState({
          status: this.queueItems.length > 0 ? "syncing" : "synced",
          lastSyncedAt: this.now(),
          conflictIds: this.state.conflictIds.filter((id) => id !== operation.id),
        });
      } catch (error) {
        this.updateState({ status: "error", error });
        return;
      }
    }
    if (this.queueItems.length === 0) this.updateState({ status: "synced", pendingCount: 0 });
  }

  private createOperation(
    type: SyncOperation<TMeta>["type"],
    id: string,
    item?: KeepItem<TMeta>,
  ): SyncOperation<TMeta> {
    return {
      operationId: `${this.clientId}:${this.now()}:${createId()}`,
      type,
      id,
      ...(item ? { item } : {}),
      createdAt: this.now(),
      ...(item?.revision ? { baseRevision: item.revision } : {}),
    };
  }

  private async enqueueBeforeLocalWrite(operation: SyncOperation<TMeta>): Promise<void> {
    await this.enqueueManyBeforeLocalWrite([operation]);
  }

  private async enqueueManyBeforeLocalWrite(operations: SyncOperation<TMeta>[]): Promise<void> {
    await this.loadQueue();
    const next = [...this.queueItems];
    for (const operation of operations) {
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index]?.id !== operation.id) continue;
        next.splice(index, 1);
      }
      next.push(operation);
    }
    await this.persistQueue(next);
    this.updateState({ status: "pending", pendingCount: this.queueItems.length });
  }

  private async loadQueue(): Promise<void> {
    if (this.queueLoaded) return;
    if (!this.queueLoadPromise) {
      this.queueLoadPromise = this.queue.getAll().then((items) => {
        this.queueItems = items;
        this.queueLoaded = true;
      });
    }
    await this.queueLoadPromise;
  }

  private async persistQueue(next: SyncOperation<TMeta>[]): Promise<void> {
    const previousIds = new Set(this.queueItems.map((operation) => operation.operationId));
    const nextIds = new Set(next.map((operation) => operation.operationId));
    const removed = [...previousIds].filter((id) => !nextIds.has(id));
    if (removed.length > 0) await this.queue.remove(removed);
    if (next.length > 0) await this.queue.setMany(next);
    this.queueItems = next;
  }

  private async removeQueued(operationIds: string | string[]): Promise<void> {
    await this.loadQueue();
    const ids = new Set(typeof operationIds === "string" ? [operationIds] : operationIds);
    await this.queue.remove([...ids]);
    this.queueItems = this.queueItems.filter((operation) => !ids.has(operation.operationId));
    this.setPendingState();
  }

  private async replaceQueued(
    previous: SyncOperation<TMeta>,
    next: SyncOperation<TMeta>,
  ): Promise<void> {
    await this.persistQueue(
      this.queueItems.map((operation) =>
        operation.operationId === previous.operationId ? next : operation,
      ),
    );
    this.setPendingState();
  }

  private setPendingState(): void {
    this.updateState({
      status: this.queueItems.length > 0 ? "pending" : "synced",
      pendingCount: this.queueItems.length,
    });
  }

  private async pullRemote(): Promise<boolean> {
    if (!this.remote.pull) return true;
    try {
      const remoteItems = await this.remote.pull();
      const pendingIds = new Set(this.queueItems.map((operation) => operation.id));
      const localItems = await this.local.getAll();
      const localById = new Map(localItems.map((item) => [item.id, item]));
      const incoming = remoteItems.filter((item) => {
        const current = localById.get(item.id);
        return !pendingIds.has(item.id) && (!current || item.updatedAt >= current.updatedAt);
      });
      if (incoming.length === 0) return true;
      if (this.local.setMany) await this.local.setMany(incoming);
      else for (const item of incoming) await this.local.set(item);
      this.notifyDataListeners();
      return true;
    } catch (error) {
      this.updateState({ status: "error", error });
      return false;
    }
  }

  private notifyDataListeners(): void {
    for (const listener of this.dataListeners) listener();
  }

  private updateState(next: Partial<KeepSyncState>): void {
    this.state = {
      ...this.state,
      ...next,
      pendingCount: next.pendingCount ?? this.queueItems.length,
    };
    for (const listener of this.listeners) listener();
  }
}

async function mergeLocalItems<TMeta>(
  localItems: KeepItem<TMeta>[],
  target: StorageAdapter<TMeta>,
): Promise<KeepItem<TMeta>[]> {
  const remoteItems = await target.getAll();
  const byId = new Map(remoteItems.map((item) => [item.id, item]));
  for (const item of localItems) {
    const current = byId.get(item.id);
    if (!current || item.updatedAt > current.updatedAt) byId.set(item.id, item);
  }
  const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  if (target.setMany) await target.setMany(merged);
  else for (const item of merged) await target.set(item);
  return merged;
}

function isSyncOperation(value: unknown): value is SyncOperation {
  if (!isRecord(value)) return false;
  return (
    typeof value.operationId === "string" &&
    (value.type === "upsert" || value.type === "remove") &&
    typeof value.id === "string" &&
    typeof value.createdAt === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function getBrowserIndexedDB(): IDBFactory | undefined {
  if (typeof indexedDB === "undefined") return undefined;
  return indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}
