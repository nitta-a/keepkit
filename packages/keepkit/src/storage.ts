import type { FavoriteItem, FavoriteStorage } from "./types";

export const DEFAULT_STORAGE_KEY = "keepkit:favorites";

export type LocalStorageAdapterOptions = {
  key?: string;
  storage?: Storage;
};

/** A FavoriteStorage implementation backed by browser localStorage. */
export class LocalStorageAdapter implements FavoriteStorage {
  private readonly key: string;
  private readonly storage: Storage | undefined;

  constructor(options: LocalStorageAdapterOptions = {}) {
    this.key = options.key ?? DEFAULT_STORAGE_KEY;
    this.storage = options.storage ?? getBrowserStorage();
  }

  async getAll(): Promise<FavoriteItem[]> {
    if (!this.storage) return [];

    const raw = this.storage.getItem(this.key);
    if (!raw) return [];

    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value) ? (value as FavoriteItem[]) : [];
    } catch {
      return [];
    }
  }

  async add(item: FavoriteItem): Promise<void> {
    const items = await this.getAll();
    this.write([...items, item]);
  }

  async update(id: string, item: Partial<FavoriteItem>): Promise<void> {
    const items = await this.getAll();
    const index = items.findIndex((favorite) => favorite.id === id);
    if (index === -1) return;

    const current = items[index];
    items[index] = {
      ...current,
      ...item,
      id: current.id,
      resourceId: current.resourceId,
      createdAt: current.createdAt,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    };
    this.write(items);
  }

  async remove(id: string): Promise<void> {
    const items = await this.getAll();
    this.write(items.filter((favorite) => favorite.id !== id));
  }

  private write(items: FavoriteItem[]): void {
    this.storage?.setItem(this.key, JSON.stringify(items));
  }
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
