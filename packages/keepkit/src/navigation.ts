import type { KeepItem } from "./types";

export type KeepNavigationState<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  currentIndex: number;
  currentPosition: number | null;
  currentItem: KeepItem<TMeta> | null;
  hasNext: boolean;
  hasPrev: boolean;
  nextItem: KeepItem<TMeta> | null;
  prevItem: KeepItem<TMeta> | null;
};

/** Return items in their persisted custom order, leaving legacy items stable. */
export function orderKeepItems<TMeta>(items: readonly KeepItem<TMeta>[]): KeepItem<TMeta>[] {
  if (!items.some((item) => item.order !== undefined)) return [...items];
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = left.item.order;
      const rightOrder = right.item.order;
      if (leftOrder === undefined && rightOrder !== undefined) return 1;
      if (leftOrder !== undefined && rightOrder === undefined) return -1;
      if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

/** Derive the previous/current/next view for a list and an item id or index. */
export function getKeepNavigationState<TMeta = Record<string, unknown>>(
  source: readonly KeepItem<TMeta>[],
  current?: string | number,
): KeepNavigationState<TMeta> {
  const items = orderKeepItems(source);
  const currentIndex =
    typeof current === "number"
      ? Number.isInteger(current) && current >= 0 && current < items.length
        ? current
        : -1
      : current === undefined
        ? -1
        : items.findIndex((item) => item.id === current);
  const currentItem = currentIndex >= 0 ? (items[currentIndex] ?? null) : null;
  return {
    items,
    currentIndex,
    currentPosition: currentIndex >= 0 ? currentIndex + 1 : null,
    currentItem,
    hasNext: currentIndex >= 0 && currentIndex < items.length - 1,
    hasPrev: currentIndex > 0,
    nextItem: currentIndex >= 0 ? (items[currentIndex + 1] ?? null) : null,
    prevItem: currentIndex > 0 ? (items[currentIndex - 1] ?? null) : null,
  };
}

/** Apply a partial or complete id order and assign stable zero-based positions. */
export function reorderKeepItems<TMeta = Record<string, unknown>>(
  source: readonly KeepItem<TMeta>[],
  orderedIds: readonly string[],
): KeepItem<TMeta>[] {
  const byId = new Map(source.map((item) => [item.id, item]));
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!byId.has(id)) throw new Error(`Cannot reorder unknown Keep item "${id}".`);
    if (seen.has(id)) throw new Error(`Cannot reorder Keep items with duplicate id "${id}".`);
    seen.add(id);
  }
  const current = orderKeepItems(source);
  const sequence = [...orderedIds, ...current.map((item) => item.id).filter((id) => !seen.has(id))];
  return sequence.map((id, order) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Cannot reorder unknown Keep item "${id}".`);
    return { ...item, order };
  });
}

/** Move one item within the current custom/legacy order. */
export function moveKeepItem<TMeta = Record<string, unknown>>(
  source: readonly KeepItem<TMeta>[],
  id: string,
  targetIndex: number,
): KeepItem<TMeta>[] {
  const items = orderKeepItems(source);
  const currentIndex = items.findIndex((item) => item.id === id);
  if (currentIndex < 0) throw new Error(`Cannot move unknown Keep item "${id}".`);
  if (!Number.isInteger(targetIndex)) throw new Error("Keep item targetIndex must be an integer.");
  const nextIndex = Math.min(Math.max(0, targetIndex), items.length - 1);
  const [item] = items.splice(currentIndex, 1);
  items.splice(nextIndex, 0, item);
  return reorderKeepItems(
    items,
    items.map((entry) => entry.id),
  );
}
