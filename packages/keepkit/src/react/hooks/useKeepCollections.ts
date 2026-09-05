import { useMemo } from "react";
import type { KeepItem } from "../../features/items/types";
import { useKeepContext } from "../components/KeepProvider";

export type KeepCollectionSummary = {
  id: string;
  name: string;
  count: number;
};

export type UseKeepCollectionsOptions = {
  targetType?: string;
  orderBy?: "name" | "count";
};

export type UseKeepCollectionsResult = KeepCollectionSummary[];

/** Derive de-duplicated collection choices from the provider's complete saved-item snapshot. */
export function useKeepCollections<TMeta = Record<string, unknown>>(
  options: UseKeepCollectionsOptions = {},
): UseKeepCollectionsResult {
  const { items } = useKeepContext<TMeta>();
  const { orderBy = "name", targetType } = options;
  return useMemo(() => {
    const collections = new Map<string, KeepCollectionSummary>();
    for (const item of items) {
      if (targetType !== undefined && item.targetType !== targetType) continue;
      const collection = getCollection(item);
      if (!collection) continue;
      const current = collections.get(collection.id);
      collections.set(collection.id, {
        id: collection.id,
        name: current?.name ?? collection.name,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...collections.values()].sort((left, right) => {
      if (orderBy === "count" && left.count !== right.count) return right.count - left.count;
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });
  }, [items, orderBy, targetType]);
}

function getCollection<TMeta>(item: KeepItem<TMeta>): { id: string; name: string } | undefined {
  const id = item.collectionId?.trim();
  if (id) return { id, name: id };
  if (!isRecord(item.meta)) return undefined;
  const metadata = item.meta.collectionId;
  if (typeof metadata === "string" && metadata.trim()) {
    const normalized = metadata.trim();
    return { id: normalized, name: getCollectionName(item.meta.collection, normalized) };
  }
  if (typeof item.meta.collection === "string" && item.meta.collection.trim()) {
    const normalized = item.meta.collection.trim();
    return { id: normalized, name: normalized };
  }
  if (isRecord(item.meta.collection) && typeof item.meta.collection.id === "string") {
    const normalized = item.meta.collection.id.trim();
    if (!normalized) return undefined;
    return { id: normalized, name: getCollectionName(item.meta.collection, normalized) };
  }
  return undefined;
}

function getCollectionName(value: unknown, fallback: string): string {
  if (isRecord(value) && typeof value.name === "string" && value.name.trim()) return value.name.trim();
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
