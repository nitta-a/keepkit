import {
  type KeepItem,
  KeepStorageAccessError,
  KeepStorageError,
  type KeepStorageOperation,
  KeepStorageParseError,
  KeepStorageQuotaError,
  type StorageAdapter,
} from "../types";

export const DEFAULT_STORAGE_KEY = "keepkit:items";

export type LocalStorageAdapterOptions = {
  key?: string;
  storage?: Storage;
};

export type IndexedDBAdapterOptions = {
  databaseName?: string;
  dbName?: string;
  /** Alias for databaseName, useful when switching from LocalStorageAdapter. */
  key?: string;
  storeName?: string;
  version?: number;
  indexedDB?: IDBFactory;
};

export const DEFAULT_INDEXEDDB_DATABASE = "keepkit";
export const DEFAULT_INDEXEDDB_STORE = "items";

export type StorageAdapterFactoryOptions<TMeta = Record<string, unknown>> = {
  getAll: () => KeepItem<TMeta>[] | Promise<KeepItem<TMeta>[]>;
  set: (item: KeepItem<TMeta>) => void | Promise<void>;
  setMany?: (items: KeepItem<TMeta>[]) => void | Promise<void>;
  remove: (id: string) => void | Promise<void>;
  removeMany?: (ids: string[]) => void | Promise<void>;
  clear: () => void | Promise<void>;
  merge?: (localItems: KeepItem<TMeta>[]) => KeepItem<TMeta>[] | Promise<KeepItem<TMeta>[]>;
  subscribe?: (listener: () => void) => undefined | (() => void);
  storageKey?: string;
};

/** Adapt sync or async persistence functions to the StorageAdapter contract. */
export function createStorageAdapter<TMeta = Record<string, unknown>>(
  options: StorageAdapterFactoryOptions<TMeta>,
): StorageAdapter<TMeta> {
  const merge = options.merge;
  const subscribe = options.subscribe;
  const setMany = options.setMany;
  const removeMany = options.removeMany;
  return {
    getAll: async () => options.getAll(),
    set: async (item) => options.set(item),
    ...(setMany ? { setMany: async (items: KeepItem<TMeta>[]) => setMany(items) } : {}),
    remove: async (id) => options.remove(id),
    ...(removeMany ? { removeMany: async (ids: string[]) => removeMany(ids) } : {}),
    clear: async () => options.clear(),
    ...(merge ? { merge: async (items: KeepItem<TMeta>[]) => merge(items) } : {}),
    ...(subscribe
      ? {
          subscribe: (listener: () => void) => subscribe(listener) ?? (() => undefined),
        }
      : {}),
    ...(options.storageKey ? { storageKey: options.storageKey } : {}),
  };
}

/** An async StorageAdapter backed by browser localStorage. */
export class LocalStorageAdapter<TMeta = Record<string, unknown>> implements StorageAdapter<TMeta> {
  public readonly storageKey: string;
  private readonly storage: Storage | undefined;

  constructor(options: LocalStorageAdapterOptions = {}) {
    this.storageKey = options.key ?? DEFAULT_STORAGE_KEY;
    this.storage = options.storage ?? getBrowserStorage();
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    if (!this.storage) return [];

    let raw: string | null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch (cause) {
      throw new KeepStorageAccessError({
        operation: "getAll",
        storageKey: this.storageKey,
        cause,
      });
    }

    if (!raw) return [];

    try {
      const value: unknown = JSON.parse(raw);
      if (!isKeepItemArray(value)) {
        throw new KeepStorageParseError({
          operation: "getAll",
          storageKey: this.storageKey,
        });
      }
      return value as KeepItem<TMeta>[];
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageParseError({
        operation: "getAll",
        storageKey: this.storageKey,
        cause,
      });
    }
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    await this.setMany([item]);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    const current = await this.getAll();
    const byId = new Map(current.map((item) => [item.id, item]));
    for (const item of items) byId.set(item.id, item);
    this.write([...byId.values()], "set");
  }

  async remove(id: string): Promise<void> {
    await this.removeMany([id]);
  }

  async removeMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const items = await this.getAll();
    this.write(
      items.filter((item) => !idSet.has(item.id)),
      "remove",
    );
  }

  async clear(): Promise<void> {
    if (!this.storage) return;
    try {
      this.storage.removeItem(this.storageKey);
    } catch (cause) {
      throw new KeepStorageAccessError({
        operation: "clear",
        storageKey: this.storageKey,
        cause,
      });
    }
  }

  async merge(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    const remoteItems = await this.getAll();
    const byId = new Map(remoteItems.map((item) => [item.id, item]));

    for (const localItem of localItems) {
      const remoteItem = byId.get(localItem.id);
      if (!remoteItem || localItem.updatedAt > remoteItem.updatedAt) {
        byId.set(localItem.id, localItem);
      }
    }

    const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    this.write(merged, "merge");
    return merged;
  }

  subscribe(listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== this.storageKey) return;
      listener();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }

  private write(items: KeepItem<TMeta>[], operation: KeepStorageOperation): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(items));
    } catch (cause) {
      if (isQuotaExceededError(cause)) {
        throw new KeepStorageQuotaError({
          operation,
          storageKey: this.storageKey,
          cause,
        });
      }
      throw new KeepStorageAccessError({
        operation,
        storageKey: this.storageKey,
        cause,
      });
    }
  }
}

/** An async StorageAdapter backed by IndexedDB, with one object store per adapter. */
export class IndexedDBAdapter<TMeta = Record<string, unknown>> implements StorageAdapter<TMeta> {
  public readonly storageKey: string;
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly version: number;
  private readonly indexedDB: IDBFactory | undefined;
  private databasePromise: Promise<IDBDatabase | undefined> | undefined;

  constructor(options: IndexedDBAdapterOptions = {}) {
    this.databaseName =
      options.databaseName ?? options.dbName ?? options.key ?? DEFAULT_INDEXEDDB_DATABASE;
    this.storeName = options.storeName ?? DEFAULT_INDEXEDDB_STORE;
    this.version = options.version ?? 1;
    this.indexedDB = options.indexedDB ?? getBrowserIndexedDB();
    this.storageKey = `${this.databaseName}:${this.storeName}`;
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    const database = await this.open("getAll");
    if (!database) return [];
    try {
      const transaction = database.transaction(this.storeName, "readonly");
      const value: unknown = await requestToPromise(
        transaction.objectStore(this.storeName).getAll(),
      );
      if (!isKeepItemArray(value)) {
        throw new KeepStorageParseError({ operation: "getAll", storageKey: this.storageKey });
      }
      return value as KeepItem<TMeta>[];
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageAccessError({ operation: "getAll", storageKey: this.storageKey, cause });
    }
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    return this.setMany([item]);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    const database = await this.open("set");
    if (!database) return;
    try {
      const transaction = database.transaction(this.storeName, "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      for (const item of items) objectStore.put(item);
      await transactionToPromise(transaction);
      this.notifySubscribers();
    } catch (cause) {
      if (isQuotaExceededError(cause)) {
        throw new KeepStorageQuotaError({ operation: "set", storageKey: this.storageKey, cause });
      }
      throw new KeepStorageAccessError({ operation: "set", storageKey: this.storageKey, cause });
    }
  }

  async remove(id: string): Promise<void> {
    return this.removeMany([id]);
  }

  async removeMany(ids: string[]): Promise<void> {
    const database = await this.open("remove");
    if (!database) return;
    try {
      const transaction = database.transaction(this.storeName, "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      for (const id of new Set(ids)) objectStore.delete(id);
      await transactionToPromise(transaction);
      this.notifySubscribers();
    } catch (cause) {
      throw new KeepStorageAccessError({ operation: "remove", storageKey: this.storageKey, cause });
    }
  }

  async clear(): Promise<void> {
    const database = await this.open("clear");
    if (!database) return;
    try {
      const transaction = database.transaction(this.storeName, "readwrite");
      transaction.objectStore(this.storeName).clear();
      await transactionToPromise(transaction);
      this.notifySubscribers();
    } catch (cause) {
      throw new KeepStorageAccessError({ operation: "clear", storageKey: this.storageKey, cause });
    }
  }

  async merge(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    try {
      const remoteItems = await this.getAll();
      const byId = new Map(remoteItems.map((item) => [item.id, item]));
      for (const localItem of localItems) {
        const remoteItem = byId.get(localItem.id);
        if (!remoteItem || localItem.updatedAt > remoteItem.updatedAt)
          byId.set(localItem.id, localItem);
      }
      const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
      await this.setMany(merged);
      return merged;
    } catch (cause) {
      if (cause instanceof KeepStorageError) throw cause;
      throw new KeepStorageAccessError({ operation: "merge", storageKey: this.storageKey, cause });
    }
  }

  subscribe(listener: () => void): () => void {
    if (!this.indexedDB || typeof BroadcastChannel === "undefined") return () => undefined;
    const channel = new BroadcastChannel(`keepkit:${this.storageKey}`);
    channel.onmessage = () => listener();
    return () => channel.close();
  }

  private notifySubscribers(): void {
    if (!this.indexedDB || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`keepkit:${this.storageKey}`);
    channel.postMessage({ type: "keepkit:changed" });
    channel.close();
  }

  private open(operation: KeepStorageOperation): Promise<IDBDatabase | undefined> {
    if (!this.indexedDB) return Promise.resolve(undefined);
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try {
          request = this.indexedDB?.open(this.databaseName, this.version) as IDBOpenDBRequest;
        } catch (cause) {
          reject(new KeepStorageAccessError({ operation, storageKey: this.storageKey, cause }));
          return;
        }
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(this.storeName)) {
            request.result.createObjectStore(this.storeName, { keyPath: "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(request.error ?? new Error("IndexedDB open was blocked."));
      });
    }
    return this.databasePromise.catch((cause) => {
      this.databasePromise = undefined;
      if (cause instanceof KeepStorageError) throw cause;
      throw new KeepStorageAccessError({ operation, storageKey: this.storageKey, cause });
    });
  }
}

function isKeepItemArray(value: unknown): value is KeepItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.savedAt === "number" &&
        Number.isFinite(item.savedAt) &&
        typeof item.updatedAt === "number" &&
        Number.isFinite(item.updatedAt) &&
        "meta" in item &&
        (item.targetType === undefined || typeof item.targetType === "string") &&
        (item.note === undefined || typeof item.note === "string") &&
        (item.schemaVersion === undefined ||
          (typeof item.schemaVersion === "number" && Number.isFinite(item.schemaVersion))) &&
        (item.tags === undefined ||
          (Array.isArray(item.tags) && item.tags.every((tag) => typeof tag === "string"))),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isQuotaExceededError(cause: unknown): boolean {
  if (!isRecord(cause)) return false;
  return (
    cause.name === "QuotaExceededError" ||
    cause.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    cause.code === 22 ||
    cause.code === 1014
  );
}
