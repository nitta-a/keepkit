import { type KeepItem, orderKeepItems } from "@keepkit/core/core";

/** Keep items outside the reordered subset in their current positions. */
export function reorderVisibleItems<TMeta>(
  source: readonly KeepItem<TMeta>[],
  orderedIds: readonly string[],
): string[] {
  const existingIds = new Set(source.map((item) => item.id));
  const reorderedIds = new Set<string>();
  for (const id of orderedIds) {
    if (!existingIds.has(id)) throw new Error(`Cannot reorder unknown Keep item "${id}".`);
    if (reorderedIds.has(id)) throw new Error(`Cannot reorder Keep items with duplicate id "${id}".`);
    reorderedIds.add(id);
  }
  let index = 0;
  return orderKeepItems(source).map((item) => {
    if (!reorderedIds.has(item.id)) return item.id;
    const id = orderedIds[index++];
    if (id === undefined) throw new Error("Keep item reorder is incomplete.");
    return id;
  });
}
