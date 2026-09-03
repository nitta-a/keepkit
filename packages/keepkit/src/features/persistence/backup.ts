import type { KeepInvalidItemPolicy, KeepItem, KeepSchema, StorageAdapter } from "../items/types";
import { mergeKeepItems } from "./migration";
import { validateKeepItem } from "./schema";

export const KEEP_BACKUP_FORMAT = "keepkit";
export const KEEP_BACKUP_VERSION = 1;

export type KeepBackup<TMeta = Record<string, unknown>> = {
  format: typeof KEEP_BACKUP_FORMAT;
  version: typeof KEEP_BACKUP_VERSION;
  exportedAt: number;
  items: KeepItem<TMeta>[];
};

export type ImportItemsOptions<TMeta = unknown> = {
  mode?: "replace" | "merge";
  schema?: KeepSchema<TMeta>;
  invalidItemPolicy?: KeepInvalidItemPolicy;
  onInvalidItem?: (error: unknown, item: KeepItem<unknown>) => void;
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
  options: ImportItemsOptions<TMeta> = {},
): Promise<ImportItemsResult<TMeta>> {
  const backup = parseBackup<TMeta>(data);
  const mode = options.mode ?? "merge";
  const validItems: KeepItem<TMeta>[] = [];
  let failed = 0;
  for (const item of backup.items) {
    if (!options.schema) {
      validItems.push(item);
      continue;
    }
    try {
      validItems.push(await validateKeepItem(item, options.schema));
    } catch (cause) {
      options.onInvalidItem?.(cause, item);
      if ((options.invalidItemPolicy ?? "error") === "drop") {
        failed += 1;
        continue;
      }
      throw cause;
    }
  }
  let items: KeepItem<TMeta>[];

  if (mode === "merge") {
    try {
      items = await mergeKeepItems(validItems, adapter);
    } catch (cause) {
      throw new KeepBackupImportError("KeepKit could not merge the backup.", {
        mode,
        imported: 0,
        failed: validItems.length + failed,
        cause,
      });
    }
  } else {
    let imported = 0;
    try {
      await adapter.clear();
      for (const item of validItems) {
        await adapter.set(item);
        imported += 1;
      }
      items = await adapter.getAll();
    } catch (cause) {
      throw new KeepBackupImportError("KeepKit could not replace the stored items.", {
        mode,
        imported,
        failed: validItems.length + failed - imported,
        cause,
      });
    }
  }

  return { mode, imported: validItems.length, failed, total: items.length, items };
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
    (value.order === undefined || (typeof value.order === "number" && Number.isFinite(value.order))) &&
    (value.targetType === undefined || typeof value.targetType === "string") &&
    (value.note === undefined || typeof value.note === "string") &&
    (value.schemaVersion === undefined ||
      (typeof value.schemaVersion === "number" && Number.isFinite(value.schemaVersion))) &&
    (value.revision === undefined || typeof value.revision === "string") &&
    (value.metaUpdatedAt === undefined ||
      (typeof value.metaUpdatedAt === "number" && Number.isFinite(value.metaUpdatedAt))) &&
    (value.status === undefined ||
      value.status === "available" ||
      value.status === "expired" ||
      value.status === "removed" ||
      value.status === "deleted" ||
      value.status === "private" ||
      value.status === "unknown") &&
    (value.statusReason === undefined || typeof value.statusReason === "string") &&
    (value.scope === undefined || isSyncScope(value.scope)) &&
    (value.tags === undefined || (Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string")))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSyncScope(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.userId === undefined || typeof value.userId === "string") &&
    (value.tenantId === undefined || typeof value.tenantId === "string")
  );
}
