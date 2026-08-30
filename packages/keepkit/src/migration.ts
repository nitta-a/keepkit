import type { KeepItem, StorageAdapter } from "./types";

/** Merge anonymous local items into a signed-in or remote adapter. */
export async function mergeKeepItems<TMeta>(
  localItems: KeepItem<TMeta>[],
  target: StorageAdapter<TMeta>,
): Promise<KeepItem<TMeta>[]> {
  if (target.merge) return target.merge(localItems);

  const remoteItems = await target.getAll();
  const byId = new Map(remoteItems.map((item) => [item.id, item]));
  for (const localItem of localItems) {
    const remoteItem = byId.get(localItem.id);
    if (!remoteItem || localItem.updatedAt > remoteItem.updatedAt) {
      byId.set(localItem.id, localItem);
    }
  }

  const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
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
