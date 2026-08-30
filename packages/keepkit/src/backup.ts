import { mergeKeepItems } from "./migration";
import type { KeepItem, StorageAdapter } from "./types";

export const KEEP_BACKUP_FORMAT = "keepkit";
export const KEEP_BACKUP_VERSION = 1;

export type KeepBackup<TMeta = Record<string, unknown>> = {
  format: typeof KEEP_BACKUP_FORMAT;
  version: typeof KEEP_BACKUP_VERSION;
  exportedAt: number;
  items: KeepItem<TMeta>[];
};

export type ImportItemsOptions = {
  mode?: "replace" | "merge";
};

export type ImportItemsResult<TMeta = Record<string, unknown>> = {
  mode: "replace" | "merge";
  imported: number;
  failed: number;
  total: number;
  items: KeepItem<TMeta>[];
};

export class KeepBackupParseError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "KeepBackupParseError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export class KeepBackupImportError extends Error {
  readonly mode: "replace" | "merge";
  readonly imported: number;
  readonly failed: number;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      mode: "replace" | "merge";
      imported: number;
      failed: number;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "KeepBackupImportError";
    this.mode = options.mode;
    this.imported = options.imported;
    this.failed = options.failed;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** Serialize all adapter data into a versioned JSON backup. */
export async function exportItems<TMeta>(adapter: StorageAdapter<TMeta>): Promise<string> {
  const backup: KeepBackup<TMeta> = {
    format: KEEP_BACKUP_FORMAT,
    version: KEEP_BACKUP_VERSION,
    exportedAt: Date.now(),
    items: await adapter.getAll(),
  };
  return JSON.stringify(backup, null, 2);
}

/** Validate and restore a backup, either replacing or merging existing data. */
export async function importItems<TMeta>(
  adapter: StorageAdapter<TMeta>,
  data: string | KeepBackup<TMeta>,
  options: ImportItemsOptions = {},
): Promise<ImportItemsResult<TMeta>> {
  const backup = parseBackup<TMeta>(data);
  const mode = options.mode ?? "merge";
  let items: KeepItem<TMeta>[];

  if (mode === "merge") {
    try {
      items = await mergeKeepItems(backup.items, adapter);
    } catch (cause) {
      throw new KeepBackupImportError("KeepKit could not merge the backup.", {
        mode,
        imported: 0,
        failed: backup.items.length,
        cause,
      });
    }
  } else {
    let imported = 0;
    try {
      await adapter.clear();
      for (const item of backup.items) {
        await adapter.set(item);
        imported += 1;
      }
      items = await adapter.getAll();
    } catch (cause) {
      throw new KeepBackupImportError("KeepKit could not replace the stored items.", {
        mode,
        imported,
        failed: backup.items.length - imported,
        cause,
      });
    }
  }

  return { mode, imported: backup.items.length, failed: 0, total: items.length, items };
}

function parseBackup<TMeta>(data: string | KeepBackup<TMeta>): KeepBackup<TMeta> {
  let value: unknown = data;
  if (typeof data === "string") {
    try {
      value = JSON.parse(data);
    } catch (cause) {
      throw new KeepBackupParseError("KeepKit backup is not valid JSON.", { cause });
    }
  }

  if (!isRecord(value)) throw new KeepBackupParseError("KeepKit backup must be an object.");
  if (value.format !== KEEP_BACKUP_FORMAT || value.version !== KEEP_BACKUP_VERSION) {
    throw new KeepBackupParseError("KeepKit backup format or version is unsupported.");
  }
  if (typeof value.exportedAt !== "number" || !Number.isFinite(value.exportedAt)) {
    throw new KeepBackupParseError("KeepKit backup has an invalid export timestamp.");
  }
  if (!Array.isArray(value.items) || !value.items.every(isKeepItem)) {
    throw new KeepBackupParseError("KeepKit backup contains invalid items.");
  }
  return value as KeepBackup<TMeta>;
}

function isKeepItem(value: unknown): value is KeepItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.savedAt === "number" &&
    Number.isFinite(value.savedAt) &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt) &&
    "meta" in value &&
    (value.targetType === undefined || typeof value.targetType === "string") &&
    (value.note === undefined || typeof value.note === "string") &&
    (value.tags === undefined ||
      (Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string")))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
