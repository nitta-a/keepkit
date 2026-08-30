import type { KeepItem, StorageAdapter } from "../types";

export const DEFAULT_STORAGE_KEY = "keepkit:items";

export type LocalStorageAdapterOptions = {
  key?: string;
  storage?: Storage;
};

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
    } catch {
      return [];
    }

    if (!raw) return [];

    try {
      const value: unknown = JSON.parse(raw);
      return isKeepItemArray(value) ? (value as KeepItem<TMeta>[]) : [];
    } catch {
      return [];
    }
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    const items = await this.getAll();
    const index = items.findIndex((current) => current.id === item.id);
    const next = [...items];
    if (index === -1) next.push(item);
    else next[index] = item;
    this.write(next);
  }

  async remove(id: string): Promise<void> {
    const items = await this.getAll();
    this.write(items.filter((item) => item.id !== id));
  }

  async clear(): Promise<void> {
    if (!this.storage) return;
    this.storage.removeItem(this.storageKey);
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
    this.write(merged);
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

  private write(items: KeepItem<TMeta>[]): void {
    if (!this.storage) return;
    this.storage.setItem(this.storageKey, JSON.stringify(items));
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
        typeof item.updatedAt === "number" &&
        "meta" in item,
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
