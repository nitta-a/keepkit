import { withLocalStorageWriteLock } from "../persistence/write-lock";

export type KeepCourseProgress = {
  kind: "course";
  courseId: string;
  currentItemId?: string;
  updatedAt: number;
};

export type KeepItemProgress = {
  kind: "item";
  itemId: string;
  audioPositionMs?: number;
  /** App-defined heading ID or legacy numeric offset. */
  readingPosition?: number | string;
  audioId?: string;
  language?: string;
  contentVersion?: string;
  updatedAt: number;
};

export type KeepProgressRecord = KeepCourseProgress | KeepItemProgress;

export type KeepProgressCompatibility = {
  language?: string;
  contentVersion?: string;
  audioId?: string;
};

export interface KeepProgressStorage {
  getAll(): Promise<KeepProgressRecord[]>;
  getCourse(courseId: string): Promise<KeepCourseProgress | undefined>;
  getItem(itemId: string, compatibility?: KeepProgressCompatibility): Promise<KeepItemProgress | undefined>;
  saveCourse(courseId: string, currentItemId?: string): Promise<KeepCourseProgress>;
  saveItem(
    itemId: string,
    progress: Omit<KeepItemProgress, "kind" | "itemId" | "updatedAt">,
  ): Promise<KeepItemProgress>;
  set(record: KeepProgressRecord): Promise<void>;
  resetCourse(courseId: string): Promise<void>;
  resetItem(itemId: string): Promise<void>;
  clear(): Promise<void>;
}

export type LocalStorageProgressOptions = {
  key?: string;
  storage?: Storage;
  now?: () => number;
};

export const DEFAULT_KEEP_PROGRESS_KEY = "keepkit:progress";

/** Stores course and reader progress independently of saved items and open history. */
export class LocalStorageKeepProgressStorage implements KeepProgressStorage {
  private readonly key: string;
  private readonly storage: Storage | undefined;
  private readonly now: () => number;

  constructor(options: LocalStorageProgressOptions = {}) {
    this.key = options.key ?? DEFAULT_KEEP_PROGRESS_KEY;
    this.storage = options.storage ?? getBrowserStorage();
    this.now = options.now ?? Date.now;
  }

  async getAll(): Promise<KeepProgressRecord[]> {
    const raw = this.readRaw();
    if (raw === null) return [];
    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
    } catch (cause) {
      throw new KeepProgressStorageError("KeepKit progress data is not valid JSON.", this.key, cause);
    }
    if (!Array.isArray(value) || !value.every(isProgressRecord)) {
      throw new KeepProgressStorageError("KeepKit progress data is invalid.", this.key);
    }
    return value.map((record) => ({ ...record }));
  }

  async getCourse(courseId: string): Promise<KeepCourseProgress | undefined> {
    const id = normalizeId(courseId, "course");
    const record = (await this.getAll()).find((entry) => entry.kind === "course" && entry.courseId === id);
    return record?.kind === "course" ? record : undefined;
  }

  async getItem(itemId: string, compatibility?: KeepProgressCompatibility): Promise<KeepItemProgress | undefined> {
    const id = normalizeId(itemId, "item");
    const record = (await this.getAll()).find((entry) => entry.kind === "item" && entry.itemId === id);
    if (record?.kind !== "item") return undefined;
    if (!isProgressCompatible(record, compatibility)) return undefined;
    return record;
  }

  async saveCourse(courseId: string, currentItemId?: string): Promise<KeepCourseProgress> {
    const id = normalizeId(courseId, "course");
    return this.withWriteLock(async () => {
      const records = await this.getAll();
      const previous = records.find((entry) => entry.kind === "course" && entry.courseId === id);
      const record: KeepCourseProgress = {
        kind: "course",
        courseId: id,
        ...(currentItemId?.trim() ? { currentItemId: currentItemId.trim() } : {}),
        updatedAt: Math.max(this.now(), (previous?.updatedAt ?? -1) + 1),
      };
      this.writeRecords([
        ...records.filter((entry) => getProgressIdentity(entry) !== getProgressIdentity(record)),
        record,
      ]);
      return record;
    });
  }

  async saveItem(
    itemId: string,
    progress: Omit<KeepItemProgress, "kind" | "itemId" | "updatedAt">,
  ): Promise<KeepItemProgress> {
    const id = normalizeId(itemId, "item");
    return this.withWriteLock(async () => {
      const records = await this.getAll();
      const previous = records.find((entry) => entry.kind === "item" && entry.itemId === id);
      const record: KeepItemProgress = {
        ...previous,
        ...progress,
        kind: "item",
        itemId: id,
        ...(progress.audioId !== undefined
          ? progress.audioId.trim()
            ? { audioId: progress.audioId.trim() }
            : { audioId: undefined }
          : {}),
        updatedAt: Math.max(this.now(), (previous?.updatedAt ?? -1) + 1),
      };
      const normalized = normalizeProgressRecord(record);
      if (normalized.kind !== "item") throw new TypeError("KeepKit progress record is invalid.");
      this.writeRecords([
        ...records.filter((entry) => getProgressIdentity(entry) !== getProgressIdentity(normalized)),
        normalized,
      ]);
      return normalized;
    });
  }

  async set(record: KeepProgressRecord): Promise<void> {
    await this.withWriteLock(async () => {
      const normalized = normalizeProgressRecord(record);
      const records = await this.getAll();
      const identity = getProgressIdentity(normalized);
      const previous = records.find((entry) => getProgressIdentity(entry) === identity);
      const resolved = previous && previous.updatedAt > normalized.updatedAt ? previous : normalized;
      this.writeRecords([...records.filter((entry) => getProgressIdentity(entry) !== identity), resolved]);
    });
  }

  async resetCourse(courseId: string): Promise<void> {
    const id = normalizeId(courseId, "course");
    await this.withWriteLock(async () =>
      this.writeRecords((await this.getAll()).filter((entry) => entry.kind !== "course" || entry.courseId !== id)),
    );
  }

  async resetItem(itemId: string): Promise<void> {
    const id = normalizeId(itemId, "item");
    await this.withWriteLock(async () =>
      this.writeRecords((await this.getAll()).filter((entry) => entry.kind !== "item" || entry.itemId !== id)),
    );
  }

  async clear(): Promise<void> {
    await this.withWriteLock(async () => this.writeRecords([]));
  }

  private readRaw(): string | null {
    try {
      return this.storage?.getItem(this.key) ?? null;
    } catch (cause) {
      throw new KeepProgressStorageError("KeepKit could not read progress data.", this.key, cause);
    }
  }

  private writeRecords(records: KeepProgressRecord[]): void {
    if (!this.storage) {
      throw new KeepProgressStorageError("KeepKit cannot persist progress without browser storage.", this.key);
    }
    try {
      this.storage.setItem(this.key, JSON.stringify(records));
    } catch (cause) {
      throw new KeepProgressStorageError("KeepKit could not write progress data.", this.key, cause);
    }
  }

  private withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.storage) return operation();
    return withLocalStorageWriteLock(
      this.key,
      operation,
      new KeepProgressStorageError("KeepKit needs the Web Locks API to safely update progress across tabs.", this.key),
    );
  }
}

/** Reject stale reader offsets when the selected language or content revision changed. */
export function isProgressCompatible(record: KeepItemProgress, compatibility?: KeepProgressCompatibility): boolean {
  if (record.language !== undefined && record.language !== compatibility?.language) return false;
  if (record.contentVersion !== undefined && record.contentVersion !== compatibility?.contentVersion) return false;
  if (compatibility?.language !== undefined && record.language !== compatibility.language) return false;
  if (compatibility?.contentVersion !== undefined && record.contentVersion !== compatibility.contentVersion)
    return false;
  if (record.audioId !== undefined && record.audioId !== compatibility?.audioId) return false;
  if (compatibility?.audioId !== undefined && record.audioId !== compatibility.audioId) return false;
  return true;
}

export class KeepProgressStorageError extends Error {
  readonly storageKey: string;
  readonly cause?: unknown;

  constructor(message: string, storageKey: string, cause?: unknown) {
    super(message);
    this.name = "KeepProgressStorageError";
    this.storageKey = storageKey;
    this.cause = cause;
  }
}

function isProgressRecord(value: unknown): value is KeepProgressRecord {
  if (
    !isRecord(value) ||
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt) ||
    value.updatedAt < 0
  )
    return false;
  if (value.kind === "course") {
    return (
      typeof value.courseId === "string" &&
      value.courseId.length > 0 &&
      (value.currentItemId === undefined || typeof value.currentItemId === "string")
    );
  }
  if (value.kind !== "item") return false;
  return (
    typeof value.itemId === "string" &&
    value.itemId.length > 0 &&
    (value.audioPositionMs === undefined ||
      (typeof value.audioPositionMs === "number" &&
        Number.isFinite(value.audioPositionMs) &&
        value.audioPositionMs >= 0)) &&
    (value.readingPosition === undefined ||
      (typeof value.readingPosition === "number" &&
        Number.isFinite(value.readingPosition) &&
        value.readingPosition >= 0) ||
      (typeof value.readingPosition === "string" && value.readingPosition.trim().length > 0)) &&
    (value.audioId === undefined || (typeof value.audioId === "string" && value.audioId.length > 0)) &&
    (value.language === undefined || typeof value.language === "string") &&
    (value.contentVersion === undefined || typeof value.contentVersion === "string")
  );
}

function normalizeProgressRecord(record: KeepProgressRecord): KeepProgressRecord {
  if (!isProgressRecord(record)) throw new TypeError("KeepKit progress record is invalid.");
  if (record.kind === "course") {
    return {
      kind: "course",
      courseId: normalizeId(record.courseId, "course"),
      ...(record.currentItemId?.trim() ? { currentItemId: record.currentItemId.trim() } : {}),
      updatedAt: record.updatedAt,
    };
  }
  return {
    kind: "item",
    itemId: normalizeId(record.itemId, "item"),
    ...(record.audioPositionMs !== undefined ? { audioPositionMs: record.audioPositionMs } : {}),
    ...(record.readingPosition !== undefined ? { readingPosition: record.readingPosition } : {}),
    ...(record.audioId !== undefined ? { audioId: record.audioId } : {}),
    ...(record.language !== undefined ? { language: record.language } : {}),
    ...(record.contentVersion !== undefined ? { contentVersion: record.contentVersion } : {}),
    updatedAt: record.updatedAt,
  };
}

function getProgressIdentity(record: KeepProgressRecord): string {
  return record.kind === "course" ? `course:${record.courseId}` : `item:${record.itemId}`;
}

function normalizeId(value: string, kind: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`KeepKit ${kind} ids must not be empty.`);
  return normalized;
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
