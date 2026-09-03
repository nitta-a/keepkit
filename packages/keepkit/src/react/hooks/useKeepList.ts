import { useCallback, useMemo } from "react";
import { type KeepListQuery, type QueryKeepItemsResult, queryKeepItems } from "../../features/items/query";
import type {
  KeepItemRevalidationSummary,
  KeepItemRevalidator,
  RevalidateKeepItemsOptions,
} from "../../features/items/revalidation";
import type { KeepItem } from "../../features/items/types";
import { useKeepStore } from "../components/KeepProvider";
import { useKeepStoreSelector } from "./useKeepStoreSelector";

export type { KeepListQuery } from "../../features/items/query";

export type UseKeepListResult<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  totalCount: number;
  tags: string[];
  tagCounts: Record<string, number>;
  page: number;
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  isMutating: boolean;
  error: unknown | null;
  remove: (id: string) => Promise<void>;
  removeBatch: (ids: string[]) => Promise<void>;
  removeWithUndo: (id: string) => Promise<void>;
  removeBatchWithUndo: (ids: string[]) => Promise<void>;
  updateTagsBatch: (ids: string[], tags?: string[]) => Promise<void>;
  addTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  move: (id: string, targetIndex: number) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  revalidate: (
    revalidator: KeepItemRevalidator<TMeta>,
    options?: RevalidateKeepItemsOptions<TMeta>,
  ) => Promise<KeepItemRevalidationSummary<TMeta>>;
};

export function useKeepList<TMeta = Record<string, unknown>>(
  query: KeepListQuery<TMeta> = {},
): UseKeepListResult<TMeta> {
  const { store, actions } = useKeepStore<TMeta>();
  const { filter, pagination, savedBetween, search, sort, tags, targetType } = query;
  const queryOptions = useMemo<KeepListQuery<TMeta>>(
    () => ({ filter, pagination, savedBetween, search, sort, tags, targetType }),
    [filter, pagination, savedBetween, search, sort, tags, targetType],
  );
  const selector = useMemo(() => {
    let previousResult: QueryKeepItemsResult<TMeta> | undefined;
    return (state: { items: KeepItem<TMeta>[] }) => {
      const next = queryKeepItems(state.items, queryOptions);
      if (previousResult && sameQueryResult(previousResult, next)) return previousResult;
      previousResult = next;
      return previousResult;
    };
  }, [queryOptions]);
  const result = useKeepStoreSelector(store, selector);
  const tagsSelector = useMemo(() => {
    let previous: string[] | undefined;
    return (state: { items: KeepItem<TMeta>[] }) => {
      const next = [...new Set(state.items.flatMap((item) => item.tags ?? []))].sort();
      if (previous?.length === next.length && previous.every((tag, index) => tag === next[index])) return previous;
      previous = next;
      return next;
    };
  }, []);
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
  const allTags = useKeepStoreSelector(store, tagsSelector);
  const remove = useCallback((id: string) => actions.removeItem(id), [actions]);
  const removeBatch = useCallback((ids: string[]) => actions.removeItems(ids), [actions]);
  const removeWithUndo = useCallback((id: string) => actions.removeItemWithUndo(id), [actions]);
  const removeBatchWithUndo = useCallback((ids: string[]) => actions.removeItemsWithUndo(ids), [actions]);
  const updateTagsBatch = useCallback(
    (ids: string[], nextTags?: string[]) => actions.updateTagsBatch(ids, nextTags),
    [actions],
  );
  const addTagsBatch = useCallback(
    (ids: string[], nextTags: string[]) => actions.addTagsBatch(ids, nextTags),
    [actions],
  );
  const removeTagsBatch = useCallback(
    (ids: string[], nextTags: string[]) => actions.removeTagsBatch(ids, nextTags),
    [actions],
  );

  return {
    items: result.items,
    totalCount: result.totalCount,
    tags: allTags,
    tagCounts: result.tagCounts,
    page: result.page,
    pageCount: result.pageCount,
    hasNextPage: result.hasNextPage,
    hasPreviousPage: result.hasPreviousPage,
    isLoading,
    isHydrated,
    isMutating,
    error,
    remove,
    removeBatch,
    removeWithUndo,
    removeBatchWithUndo,
    updateTagsBatch,
    addTagsBatch,
    removeTagsBatch,
    reorder: actions.reorderItems,
    move: actions.moveItem,
    clear: actions.clear,
    refresh: actions.refresh,
    revalidate: actions.revalidateItems,
  };
}

function sameQueryResult<TMeta>(left: QueryKeepItemsResult<TMeta>, right: QueryKeepItemsResult<TMeta>): boolean {
  return (
    left.totalCount === right.totalCount &&
    left.page === right.page &&
    left.pageCount === right.pageCount &&
    left.hasNextPage === right.hasNextPage &&
    left.hasPreviousPage === right.hasPreviousPage &&
    left.items.length === right.items.length &&
    left.items.every((item, index) => item === right.items[index]) &&
    sameCounts(left.tagCounts, right.tagCounts)
  );
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
