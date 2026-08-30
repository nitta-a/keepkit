import { useCallback, useMemo } from "react";
import { useKeepStore } from "../KeepProvider";
import { type KeepListOptions, type QueryKeepItemsResult, queryKeepItems } from "../query";
import type { KeepItemRevalidationSummary, KeepItemRevalidator, RevalidateKeepItemsOptions } from "../revalidation";
import type { KeepItem } from "../types";
import { useKeepStoreSelector } from "./useKeepStoreSelector";

export type { KeepListOptions } from "../query";

export type UseKeepListResult<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  totalCount: number;
  tags: string[];
  tagCounts: Record<string, number>;
  isLoading: boolean;
  isHydrated: boolean;
  isMutating: boolean;
  error: unknown | null;
  remove: (id: string) => Promise<void>;
  removeBatch: (ids: string[]) => Promise<void>;
  updateTagsBatch: (ids: string[], tags?: string[]) => Promise<void>;
  addTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  revalidate: (
    revalidator: KeepItemRevalidator<TMeta>,
    options?: RevalidateKeepItemsOptions,
  ) => Promise<KeepItemRevalidationSummary<TMeta>>;
};

export function useKeepList<TMeta = Record<string, unknown>>(
  options: KeepListOptions<TMeta> = {},
): UseKeepListResult<TMeta> {
  const { store, actions } = useKeepStore<TMeta>();
  const {
    filter,
    filterFn,
    limit,
    offset,
    order,
    savedBetween,
    search,
    searchQuery,
    sort,
    sortBy,
    tag,
    tags: queryTags,
    targetType,
  } = options;
  const queryOptions = useMemo<KeepListOptions<TMeta>>(
    () => ({
      filter,
      filterFn,
      limit,
      offset,
      order,
      savedBetween,
      search,
      searchQuery,
      sort,
      sortBy,
      tag,
      tags: queryTags,
      targetType,
    }),
    [
      filter,
      filterFn,
      limit,
      offset,
      order,
      savedBetween,
      search,
      searchQuery,
      sort,
      sortBy,
      tag,
      queryTags,
      targetType,
    ],
  );
  const selector = useMemo(() => {
    let previousResult: QueryKeepItemsResult<TMeta> | undefined;
    return (state: { items: KeepItem<TMeta>[] }) => {
      const next = queryKeepItems(state.items, queryOptions);
      if (
        previousResult &&
        previousResult.totalCount === next.totalCount &&
        sameItems(previousResult.items, next.items) &&
        sameCounts(previousResult.tagCounts, next.tagCounts)
      ) {
        return previousResult;
      }
      previousResult = next;
      return previousResult;
    };
  }, [queryOptions]);
  const query = useKeepStoreSelector(store, selector);
  const tagsSelector = useMemo(() => {
    let previous: string[] | undefined;
    return (state: { items: KeepItem<TMeta>[] }) => {
      const next = [...new Set(state.items.flatMap((item) => item.tags ?? []))].sort();
      if (previous?.length === next.length && previous.every((tag, index) => tag === next[index])) {
        return previous;
      }
      previous = next;
      return next;
    };
  }, []);
  const items = query.items;
  const totalCount = query.totalCount;
  const tagCounts = query.tagCounts;
  const tags = useKeepStoreSelector(store, tagsSelector);
  const isLoading = useKeepStoreSelector(
    store,
    useCallback((state) => state.isLoading, []),
  );
  const isHydrated = useKeepStoreSelector(
    store,
    useCallback((state) => state.isHydrated, []),
  );
  const isMutating = useKeepStoreSelector(
    store,
    useCallback((state) => state.isMutating, []),
  );
  const error = useKeepStoreSelector(
    store,
    useCallback((state) => state.error, []),
  );
  const remove = useCallback((id: string) => actions.removeItem(id), [actions]);
  const removeBatch = useCallback((ids: string[]) => actions.removeItems(ids), [actions]);
  const updateTagsBatch = useCallback(
    (ids: string[], tags?: string[]) => actions.updateTagsBatch(ids, tags),
    [actions],
  );
  const addTagsBatch = useCallback((ids: string[], tags: string[]) => actions.addTagsBatch(ids, tags), [actions]);
  const removeTagsBatch = useCallback((ids: string[], tags: string[]) => actions.removeTagsBatch(ids, tags), [actions]);

  return {
    items,
    totalCount,
    tags,
    tagCounts,
    isLoading,
    isHydrated,
    isMutating,
    error,
    remove,
    removeBatch,
    updateTagsBatch,
    addTagsBatch,
    removeTagsBatch,
    clear: actions.clear,
    refresh: actions.refresh,
    revalidate: actions.revalidateItems,
  };
}

function sameItems<TMeta>(left: KeepItem<TMeta>[], right: KeepItem<TMeta>[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameCounts(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value], index) => {
      const [rightKey, rightValue] = rightEntries[index] ?? [];
      return key === rightKey && value === rightValue;
    })
  );
}
