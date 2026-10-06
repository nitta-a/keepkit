export type KeepHistoryEntry = {
  itemId: string;
  lastViewedAt: number;
};

export type KeepViewingRecord = {
  id: string;
  itemId: string;
  viewedAt: number;
  note?: string;
};

export interface KeepHistoryStorage {
  getAll(): Promise<KeepHistoryEntry[]>;
  getLimit(): Promise<number>;
  setLimit(limit: number): Promise<void>;
  record(itemId: string, viewedAt?: number): Promise<KeepHistoryEntry[]>;
  remove(itemId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface KeepViewingRecordStorage {
  getAll(itemId?: string): Promise<KeepViewingRecord[]>;
  set(record: KeepViewingRecord): Promise<void>;
  add(itemId: string, options?: { viewedAt?: number; note?: string }): Promise<KeepViewingRecord>;
  remove(id: string): Promise<void>;
  removeForItem(itemId: string): Promise<void>;
  clear(): Promise<void>;
}

export type LocalStorageActivityOptions = {
  key?: string;
  storage?: Storage;
  maxEntries?: number;
  now?: () => number;
  createId?: () => string;
};

export const DEFAULT_KEEP_HISTORY_KEY = "keepkit:view-history";
export const DEFAULT_KEEP_VIEWING_RECORDS_KEY = "keepkit:viewing-records";
export const DEFAULT_KEEP_HISTORY_LIMIT = 100;

/** Local history of opened guides. It never reads or mutates saved items. */
export class LocalStorageKeepHistoryStorage implements KeepHistoryStorage {
  private readonly key: string;
  private readonly limitKey: string;
  private readonly storage: Storage | undefined;
  private readonly initialLimit: number;
  private readonly now: () => number;

  constructor(options: LocalStorageActivityOptions = {}) {
    this.key = options.key ?? DEFAULT_KEEP_HISTORY_KEY;
    this.limitKey = `${this.key}:limit`;
    this.storage = options.storage ?? getBrowserStorage();
    this.initialLimit = normalizeLimit(options.maxEntries ?? DEFAULT_KEEP_HISTORY_LIMIT);
    this.now = options.now ?? Date.now;
  }

  async getAll(): Promise<KeepHistoryEntry[]> {
    return (await this.read<KeepHistoryEntry[]>(this.key, isHistoryEntryArray, "history")).sort(
      (left, right) => right.lastViewedAt - left.lastViewedAt,
    );
  }

  async getLimit(): Promise<number> {
    if (!this.storage) return this.initialLimit;
    const raw = this.readRaw(this.limitKey, "history-limit");
    if (raw === null) return this.initialLimit;
    const parsed: unknown = parseJson(raw, this.limitKey, "history-limit");
    if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < 1) {
      throw new KeepActivityStorageError("KeepKit history limit is invalid.", this.limitKey);
    }
    return parsed;
  }

  async setLimit(limit: number): Promise<void> {
    const normalized = normalizeLimit(limit);
    this.writeRaw(this.limitKey, JSON.stringify(normalized), "history-limit");
    const entries = await this.getAll();
    await this.writeEntries(entries.slice(0, normalized));
  }

  async record(itemId: string, viewedAt = this.now()): Promise<KeepHistoryEntry[]> {
    const normalizedId = normalizeId(itemId);
    assertTimestamp(viewedAt);
    const entries = await this.getAll();
    const previous = entries.find((entry) => entry.itemId === normalizedId);
    const next = [
      { itemId: normalizedId, lastViewedAt: Math.max(previous?.lastViewedAt ?? 0, viewedAt) },
      ...entries.filter((entry) => entry.itemId !== normalizedId),
    ]
      .sort((left, right) => right.lastViewedAt - left.lastViewedAt)
      .slice(0, await this.getLimit());
    await this.writeEntries(next);
    return cloneHistoryEntries(next);
  }

  async remove(itemId: string): Promise<void> {
    const normalizedId = normalizeId(itemId);
    await this.writeEntries((await this.getAll()).filter((entry) => entry.itemId !== normalizedId));
  }

  async clear(): Promise<void> {
    this.writeRaw(this.key, "[]", "history");
  }

  private async writeEntries(entries: KeepHistoryEntry[]): Promise<void> {
    this.writeRaw(this.key, JSON.stringify(entries), "history");
  }

  private async read<T>(key: string, validate: (value: unknown) => value is T, label: string): Promise<T> {
    const raw = this.readRaw(key, label);
    if (raw === null) return [] as T;
    const value = parseJson(raw, key, label);
    if (!validate(value)) throw new KeepActivityStorageError(`KeepKit ${label} data is invalid.`, key);
    return value;
  }

  private readRaw(key: string, label: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch (cause) {
      throw new KeepActivityStorageError(`KeepKit could not read ${label} data.`, key, cause);
    }
  }

  private writeRaw(key: string, value: string, label: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch (cause) {
      throw new KeepActivityStorageError(`KeepKit could not write ${label} data.`, key, cause);
    }
  }
}

/** Explicit user-reported viewing events, kept separate from open history and saved items. */
export class LocalStorageKeepViewingRecordStorage implements KeepViewingRecordStorage {
  private readonly key: string;
  private readonly storage: Storage | undefined;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(options: LocalStorageActivityOptions = {}) {
    this.key = options.key ?? DEFAULT_KEEP_VIEWING_RECORDS_KEY;
    this.storage = options.storage ?? getBrowserStorage();
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? createRecordId;
  }

  async getAll(itemId?: string): Promise<KeepViewingRecord[]> {
    const records = await this.readRecords();
    const filtered = itemId === undefined ? records : records.filter((record) => record.itemId === itemId);
    return filtered.sort((left, right) => right.viewedAt - left.viewedAt).map((record) => ({ ...record }));
  }

  async set(record: KeepViewingRecord): Promise<void> {
    const normalized = normalizeViewingRecord(record);
    const records = await this.readRecords();
    this.writeRecords([...records.filter((entry) => entry.id !== normalized.id), normalized]);
  }

  async add(itemId: string, options: { viewedAt?: number; note?: string } = {}): Promise<KeepViewingRecord> {
    const record: KeepViewingRecord = {
      id: this.createId(),
      itemId: normalizeId(itemId),
      viewedAt: options.viewedAt ?? this.now(),
      ...(options.note?.trim() ? { note: options.note.trim() } : {}),
    };
    await this.set(record);
    return { ...record };
  }

  async remove(id: string): Promise<void> {
    this.writeRecords((await this.readRecords()).filter((record) => record.id !== id));
  }

  async removeForItem(itemId: string): Promise<void> {
    const normalizedId = normalizeId(itemId);
    this.writeRecords((await this.readRecords()).filter((record) => record.itemId !== normalizedId));
  }

  async clear(): Promise<void> {
    this.writeRecords([]);
  }

  private async readRecords(): Promise<KeepViewingRecord[]> {
    const raw = this.readRaw();
    if (raw === null) return [];
    const value = parseJson(raw, this.key, "viewing records");
    if (!isViewingRecordArray(value)) {
      throw new KeepActivityStorageError("KeepKit viewing record data is invalid.", this.key);
    }
    return value;
  }

  private readRaw(): string | null {
    try {
      return this.storage?.getItem(this.key) ?? null;
    } catch (cause) {
      throw new KeepActivityStorageError("KeepKit could not read viewing records.", this.key, cause);
    }
  }

  private writeRecords(records: KeepViewingRecord[]): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify(records));
    } catch (cause) {
      throw new KeepActivityStorageError("KeepKit could not write viewing records.", this.key, cause);
    }
  }
}

export class KeepActivityStorageError extends Error {
  readonly storageKey: string;
  readonly cause?: unknown;

  constructor(message: string, storageKey: string, cause?: unknown) {
    super(message);
    this.name = "KeepActivityStorageError";
    this.storageKey = storageKey;
    this.cause = cause;
  }
}

function isHistoryEntryArray(value: unknown): value is KeepHistoryEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.itemId === "string" &&
        entry.itemId.length > 0 &&
        typeof entry.lastViewedAt === "number" &&
        Number.isFinite(entry.lastViewedAt),
    )
  );
}

function isViewingRecordArray(value: unknown): value is KeepViewingRecord[] {
  return Array.isArray(value) && value.every(isViewingRecord);
}

function isViewingRecord(value: unknown): value is KeepViewingRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.itemId === "string" &&
    value.itemId.length > 0 &&
    typeof value.viewedAt === "number" &&
    Number.isFinite(value.viewedAt) &&
    value.viewedAt >= 0 &&
    (value.note === undefined || typeof value.note === "string")
  );
}

function normalizeViewingRecord(record: KeepViewingRecord): KeepViewingRecord {
  const normalized: KeepViewingRecord = {
    id: normalizeId(record.id),
    itemId: normalizeId(record.itemId),
    viewedAt: record.viewedAt,
    ...(record.note?.trim() ? { note: record.note.trim() } : {}),
  };
  assertTimestamp(normalized.viewedAt);
  return normalized;
}

function normalizeId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError("KeepKit item ids must not be empty.");
  return normalized;
}

function normalizeLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError("KeepKit history limit must be a positive integer.");
  return value;
}

function assertTimestamp(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new TypeError("KeepKit timestamps must be non-negative numbers.");
}

function cloneHistoryEntries(entries: KeepHistoryEntry[]): KeepHistoryEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function parseJson(raw: string, key: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new KeepActivityStorageError(`KeepKit ${label} data is not valid JSON.`, key, cause);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function createRecordId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `keepkit-view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
