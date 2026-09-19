import type { KeepItem, StorageAdapter } from "../items/types";
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
