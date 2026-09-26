import type { KeepItem, StorageAdapter, SyncScope } from "../items/types";

export async function persistKeepItems<TMeta>(storage: StorageAdapter<TMeta>, items: KeepItem<TMeta>[]): Promise<void> {
  if (storage.setMany) {
    await storage.setMany(items);
    return;
  }
  for (const item of items) await storage.set(item);
}

export async function removeKeepItems<TMeta>(storage: StorageAdapter<TMeta>, ids: string[]): Promise<void> {
  if (storage.removeMany) {
    await storage.removeMany(ids);
    return;
  }
  for (const id of ids) await storage.remove(id);
}

export function mergeKeepItemLists<TMeta>(
  remoteItems: KeepItem<TMeta>[],
  localItems: KeepItem<TMeta>[],
): KeepItem<TMeta>[] {
  const byId = new Map(remoteItems.map((item) => [item.id, item]));
  for (const localItem of localItems) {
    const remoteItem = byId.get(localItem.id);
    if (!remoteItem) {
      byId.set(localItem.id, localItem);
      continue;
    }
    const content = localItem.updatedAt > remoteItem.updatedAt ? localItem : remoteItem;
    const lastOpenedAt =
      remoteItem.lastOpenedAt === undefined
        ? localItem.lastOpenedAt
        : localItem.lastOpenedAt === undefined
          ? remoteItem.lastOpenedAt
          : Math.max(remoteItem.lastOpenedAt, localItem.lastOpenedAt);
    byId.set(localItem.id, lastOpenedAt === undefined ? content : { ...content, lastOpenedAt });
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function isKeepItem(value: unknown): value is KeepItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.savedAt === "number" &&
    Number.isFinite(value.savedAt) &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt) &&
    "meta" in value &&
    (value.order === undefined || (typeof value.order === "number" && Number.isFinite(value.order))) &&
    (value.archived === undefined || typeof value.archived === "boolean") &&
    (value.pinned === undefined || typeof value.pinned === "boolean") &&
    (value.lastOpenedAt === undefined ||
      (typeof value.lastOpenedAt === "number" && Number.isFinite(value.lastOpenedAt))) &&
    (value.collectionId === undefined || typeof value.collectionId === "string") &&
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

export function isKeepItemArray(value: unknown): value is KeepItem[] {
  return Array.isArray(value) && value.every(isKeepItem);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSyncScope(value: unknown): value is SyncScope {
  return (
    isRecord(value) &&
    (value.userId === undefined || typeof value.userId === "string") &&
    (value.tenantId === undefined || typeof value.tenantId === "string")
  );
}
