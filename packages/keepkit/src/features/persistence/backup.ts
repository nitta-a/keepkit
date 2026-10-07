import type {
  KeepCollectionDefinition,
  KeepCollectionMembership,
  KeepInvalidItemPolicy,
  KeepItem,
  KeepSchema,
  StorageAdapter,
  SyncScope,
} from "../items/types";
import { isKeepCollectionDefinition, isKeepCollectionMembership, isKeepItem, isRecord } from "./helpers";
import { mergeKeepItems } from "./migration";
import { validateKeepItem } from "./schema";

export const KEEP_BACKUP_FORMAT = "keepkit";
export const KEEP_BACKUP_VERSION = 2;

export type KeepBackupV1<TMeta = Record<string, unknown>> = {
  format: typeof KEEP_BACKUP_FORMAT;
  version: 1;
  exportedAt: number;
  items: KeepItem<TMeta>[];
};

export type KeepBackupV2<TMeta = Record<string, unknown>> = {
  format: typeof KEEP_BACKUP_FORMAT;
  version: typeof KEEP_BACKUP_VERSION;
  exportedAt: number;
  items: KeepItem<TMeta>[];
  collections: KeepCollectionDefinition[];
  memberships: KeepCollectionMembership[];
  /** Scopes represented by the records in this backup. Omitted by early v2 backups. */
  scopes?: SyncScope[];
};

export type KeepBackup<TMeta = Record<string, unknown>> = KeepBackupV1<TMeta> | KeepBackupV2<TMeta>;

type ParsedKeepBackup<TMeta> = Omit<KeepBackupV2<TMeta>, "version"> & { version: 1 | typeof KEEP_BACKUP_VERSION };

export type ImportItemsOptions<TMeta = unknown> = {
  mode?: "replace" | "merge";
  schema?: KeepSchema<TMeta>;
  invalidItemPolicy?: KeepInvalidItemPolicy;
  onInvalidItem?: (error: unknown, item: KeepItem<unknown>) => void;
  /** Resolves a same-ID collection name collision when merging. Defaults to the backup name. */
  collectionNameConflict?: "backup" | "existing";
};

export type KeepBackupDataType = "items" | "collections" | "memberships";
export type KeepBackupAppliedCounts = { items: number; collections: number; memberships: number };

export type ImportItemsResult<TMeta = Record<string, unknown>> = {
  mode: "replace" | "merge";
  imported: number;
  failed: number;
  total: number;
  items: KeepItem<TMeta>[];
  applied: KeepBackupAppliedCounts;
  missingCollectionIds: string[];
  includedData: KeepBackupDataType[];
  scopes: SyncScope[];
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
  readonly applied: KeepBackupAppliedCounts;
  readonly failedStage: "items" | "collections" | "memberships" | "clear" | "validation";
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      mode: "replace" | "merge";
      imported: number;
      failed: number;
      applied?: KeepBackupAppliedCounts;
      failedStage?: "items" | "collections" | "memberships" | "clear" | "validation";
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "KeepBackupImportError";
    this.mode = options.mode;
    this.imported = options.imported;
    this.failed = options.failed;
    this.applied = options.applied ?? { items: options.imported, collections: 0, memberships: 0 };
    this.failedStage = options.failedStage ?? "items";
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** Serialize all adapter data into a versioned JSON backup. */
export async function exportItems<TMeta>(adapter: StorageAdapter<TMeta>): Promise<string> {
  const items = await adapter.getAll();
  const collections = (await adapter.getCollections?.()) ?? [];
  const memberships = (await adapter.getCollectionMemberships?.()) ?? [];
  const backup: KeepBackupV2<TMeta> = {
    format: KEEP_BACKUP_FORMAT,
    version: KEEP_BACKUP_VERSION,
    exportedAt: Date.now(),
    items,
    collections,
    memberships,
    scopes: collectScopes(items, collections, memberships, adapter.scope ? [adapter.scope] : []),
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
  const scopes = collectScopes(backup.items, backup.collections, backup.memberships, backup.scopes);
  if (adapter.scope && scopes.some((scope) => !sameScope(scope, adapter.scope))) {
    throw new KeepBackupImportError("The backup contains data outside the active storage scope.", {
      mode,
      imported: 0,
      failed: backup.items.length + backup.collections.length + backup.memberships.length,
      applied: { items: 0, collections: 0, memberships: 0 },
      failedStage: "validation",
    });
  }
  if (
    (backup.collections.length > 0 &&
      (!adapter.getCollections || !adapter.setCollection || !adapter.removeCollection)) ||
    (backup.memberships.length > 0 &&
      (!adapter.getCollectionMemberships || !adapter.setCollectionMembership || !adapter.removeCollectionMembership))
  ) {
    throw new KeepBackupImportError("The storage adapter cannot restore collection data from this backup.", {
      mode,
      imported: 0,
      failed: backup.items.length + backup.collections.length + backup.memberships.length,
      applied: { items: 0, collections: 0, memberships: 0 },
      failedStage: "validation",
    });
  }
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
  const applied: KeepBackupAppliedCounts = { items: 0, collections: 0, memberships: 0 };
  const missingCollectionIds =
    backup.version === 1
      ? [...new Set(backup.items.flatMap((item) => (item.collectionId ? [item.collectionId] : [])))]
      : [];

  try {
    if (mode === "replace") {
      await adapter.clear();
      await restoreCollections(adapter, [], "replace", "backup", applied);
      await restoreMemberships(adapter, [], "replace", applied);
    }
  } catch (cause) {
    throw new KeepBackupImportError("KeepKit could not clear the data being replaced.", {
      mode,
      imported: applied.items,
      failed: validItems.length + failed,
      applied,
      failedStage: "clear",
      cause,
    });
  }

  for (const item of validItems) {
    try {
      if (mode === "merge") await mergeKeepItems([item], adapter);
      else await adapter.set(item);
      applied.items += 1;
    } catch (cause) {
      throw new KeepBackupImportError(`KeepKit could not restore item ${item.id}.`, {
        mode,
        imported: applied.items,
        failed: validItems.length + failed - applied.items,
        applied,
        failedStage: "items",
        cause,
      });
    }
  }

  try {
    await restoreCollections(adapter, backup.collections, mode, options.collectionNameConflict ?? "backup", applied);
  } catch (cause) {
    throw new KeepBackupImportError("KeepKit could not restore collection definitions.", {
      mode,
      imported: applied.items,
      failed: validItems.length + failed - applied.items,
      applied,
      failedStage: "collections",
      cause,
    });
  }
  try {
    await restoreMemberships(adapter, backup.memberships, mode, applied);
  } catch (cause) {
    throw new KeepBackupImportError("KeepKit could not restore collection memberships.", {
      mode,
      imported: applied.items,
      failed: validItems.length + failed - applied.items,
      applied,
      failedStage: "memberships",
      cause,
    });
  }
  let items: KeepItem<TMeta>[];
  try {
    items = await adapter.getAll();
  } catch (cause) {
    throw new KeepBackupImportError("KeepKit restored the backup but could not read the resulting items.", {
      mode,
      imported: applied.items,
      failed: failed,
      applied,
      failedStage: "items",
      cause,
    });
  }

  return {
    mode,
    imported: applied.items,
    failed,
    total: items.length,
    items,
    applied,
    missingCollectionIds,
    includedData: backup.version === 1 ? ["items"] : ["items", "collections", "memberships"],
    scopes,
  };
}

function parseBackup<TMeta>(data: string | KeepBackup<TMeta>): ParsedKeepBackup<TMeta> {
  let value: unknown = data;
  if (typeof data === "string") {
    try {
      value = JSON.parse(data);
    } catch (cause) {
      throw new KeepBackupParseError("KeepKit backup is not valid JSON.", { cause });
    }
  }

  if (!isRecord(value)) throw new KeepBackupParseError("KeepKit backup must be an object.");
  if (value.format !== KEEP_BACKUP_FORMAT || (value.version !== 1 && value.version !== KEEP_BACKUP_VERSION)) {
    throw new KeepBackupParseError("KeepKit backup format or version is unsupported.");
  }
  if (typeof value.exportedAt !== "number" || !Number.isFinite(value.exportedAt)) {
    throw new KeepBackupParseError("KeepKit backup has an invalid export timestamp.");
  }
  if (!Array.isArray(value.items) || !value.items.every(isKeepItem)) {
    throw new KeepBackupParseError("KeepKit backup contains invalid items.");
  }
  if (value.version === 1) {
    return {
      format: KEEP_BACKUP_FORMAT,
      version: 1,
      exportedAt: value.exportedAt,
      items: value.items as KeepItem<TMeta>[],
      collections: [],
      memberships: [],
      scopes: [],
    };
  }
  if (
    !Array.isArray(value.collections) ||
    !value.collections.every(isKeepCollectionDefinition) ||
    !Array.isArray(value.memberships) ||
    !value.memberships.every(isKeepCollectionMembership)
  ) {
    throw new KeepBackupParseError("KeepKit backup contains invalid collection data.");
  }
  if (value.scopes !== undefined && (!Array.isArray(value.scopes) || !value.scopes.every(isSyncScope))) {
    throw new KeepBackupParseError("KeepKit backup contains invalid scope data.");
  }
  return value as ParsedKeepBackup<TMeta>;
}

function collectScopes(
  items: KeepItem<unknown>[],
  collections: KeepCollectionDefinition[],
  memberships: KeepCollectionMembership[],
  declaredScopes: SyncScope[] = [],
): SyncScope[] {
  const scopes = [
    ...declaredScopes,
    ...[...items, ...collections, ...memberships].flatMap((record) => (record.scope ? [record.scope] : [])),
  ].filter((scope, index, all) => all.findIndex((entry) => sameScope(entry, scope)) === index);
  return scopes.map((scope) => ({ ...scope }));
}

function sameScope(left: SyncScope, right: SyncScope | undefined): boolean {
  return left.userId === right?.userId && left.tenantId === right?.tenantId;
}

function isSyncScope(value: unknown): value is SyncScope {
  return (
    isRecord(value) &&
    (value.userId === undefined || typeof value.userId === "string") &&
    (value.tenantId === undefined || typeof value.tenantId === "string")
  );
}

async function restoreCollections<TMeta>(
  adapter: StorageAdapter<TMeta>,
  collections: KeepCollectionDefinition[],
  mode: "merge" | "replace",
  conflict: "backup" | "existing",
  applied: KeepBackupAppliedCounts,
): Promise<void> {
  if (!adapter.getCollections || !adapter.setCollection || !adapter.removeCollection) return;
  const existing = await adapter.getCollections();
  if (mode === "replace") {
    for (const collection of existing) await adapter.removeCollection(collection.id, collection.scope);
  }
  for (const collection of collections) {
    const current = existing.find(
      (entry) => entry.id === collection.id && sameScope(entry.scope ?? {}, collection.scope),
    );
    const value =
      mode === "merge" && conflict === "existing" && current ? { ...collection, name: current.name } : collection;
    await adapter.setCollection(value);
    applied.collections += 1;
  }
}

async function restoreMemberships<TMeta>(
  adapter: StorageAdapter<TMeta>,
  memberships: KeepCollectionMembership[],
  mode: "merge" | "replace",
  applied: KeepBackupAppliedCounts,
): Promise<void> {
  if (!adapter.getCollectionMemberships || !adapter.setCollectionMembership || !adapter.removeCollectionMembership)
    return;
  if (mode === "replace") {
    const current = await adapter.getCollectionMemberships();
    for (const membership of current) {
      await adapter.removeCollectionMembership(membership.collectionId, membership.itemId, membership.scope);
    }
  }
  for (const membership of memberships) {
    await adapter.setCollectionMembership(membership);
    applied.memberships += 1;
  }
}
