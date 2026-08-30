import {
  type KeepItem,
  KeepStorageAccessError,
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

function isQuotaExceededError(cause: unknown): boolean {
  if (!isRecord(cause)) return false;
  return (
    cause.name === "QuotaExceededError" ||
    cause.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    cause.code === 22 ||
    cause.code === 1014
  );
}
