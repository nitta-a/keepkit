import type { KeepCollectionMembership, KeepItem, StorageAdapter, SyncScope } from "../items/types";
import { mergeKeepItemLists } from "./helpers";

/** Merge anonymous local items into a signed-in or remote adapter. */
export async function mergeKeepItems<TMeta>(
  localItems: KeepItem<TMeta>[],
  target: StorageAdapter<TMeta>,
): Promise<KeepItem<TMeta>[]> {
  if (target.merge) return target.merge(localItems);

  const merged = mergeKeepItemLists(await target.getAll(), localItems);
  await Promise.all(merged.map((item) => target.set(item)));
  return merged;
}

/** Read anonymous items, merge them into the target, then clear the source. */
export async function migrateKeepItems<TMeta>(
  source: StorageAdapter<TMeta>,
  target: StorageAdapter<TMeta>,
): Promise<KeepItem<TMeta>[]> {
  const localItems = await source.getAll();
  const merged = await mergeKeepItems(localItems, target);
  await source.clear();
  return merged;
}

export type LegacyCollectionMigrationResult = {
  migrated: number;
  skipped: number;
  missingCollectionIds: string[];
};

/** Move legacy single-collection item fields into course-specific memberships once. */
export async function migrateLegacyCollectionMemberships<TMeta>(
  storage: StorageAdapter<TMeta>,
): Promise<LegacyCollectionMigrationResult> {
  if (!storage.getCollectionMemberships || !storage.setCollectionMembership) {
    throw new TypeError("The storage adapter does not support collection memberships.");
  }

  const [items, memberships, collections] = await Promise.all([
    storage.getAll(),
    storage.getCollectionMemberships(),
    storage.getCollections?.() ?? Promise.resolve([]),
  ]);
  const existing = new Set(memberships.map(membershipKey));
  const collectionIds = new Set(collections.map((collection) => collectionKey(collection.id, collection.scope)));
  const missingCollectionIds = new Set<string>();
  let migrated = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.collectionId) continue;
    const membership: KeepCollectionMembership = {
      collectionId: item.collectionId,
      itemId: item.id,
      order: item.order ?? 0,
      ...(item.scope ? { scope: item.scope } : {}),
    };
    const key = membershipKey(membership);
    if (!collectionIds.has(collectionKey(item.collectionId, item.scope))) {
      missingCollectionIds.add(item.collectionId);
    }
    if (existing.has(key)) {
      skipped += 1;
      const { collectionId: _legacyCollectionId, ...migratedItem } = item;
      await storage.set(migratedItem);
      continue;
    }
    await storage.setCollectionMembership(membership);
    existing.add(key);
    migrated += 1;
    const { collectionId: _legacyCollectionId, ...migratedItem } = item;
    await storage.set(migratedItem);
  }

  return { migrated, skipped, missingCollectionIds: [...missingCollectionIds] };
}

function membershipKey(membership: KeepCollectionMembership): string {
  return `${membership.scope?.tenantId ?? ""}\u0000${membership.scope?.userId ?? ""}\u0000${membership.collectionId}\u0000${membership.itemId}`;
}

function collectionKey(collectionId: string, scope?: SyncScope): string {
  return `${scope?.tenantId ?? ""}\u0000${scope?.userId ?? ""}\u0000${collectionId}`;
}
