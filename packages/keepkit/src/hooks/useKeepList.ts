import { useCallback, useMemo } from "react";
import { useKeepStore } from "../KeepProvider";
import type { KeepItem } from "../types";
import { useKeepStoreSelector } from "./useKeepStoreSelector";

export type KeepListOptions<TMeta = Record<string, unknown>> = {
  targetType?: string;
  tag?: string;
  tags?: string[];
  sort?: {
    by: "savedAt" | "updatedAt";
    direction?: "asc" | "desc";
  };
  searchQuery?: string;
  sortBy?: "savedAt" | "updatedAt";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  filter?: (item: KeepItem<TMeta>) => boolean;
};

export type UseKeepListResult<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  totalCount: number;
  tags: string[];
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
};

export function useKeepList<TMeta = Record<string, unknown>>(
  options: KeepListOptions<TMeta> = {},
): UseKeepListResult<TMeta> {
  const { store, actions } = useKeepStore<TMeta>();
  const selector = useMemo(() => {
    let previousFiltered: KeepItem<TMeta>[] | undefined;
    let previousResult: { items: KeepItem<TMeta>[]; totalCount: number } | undefined;
    return (state: { items: KeepItem<TMeta>[] }) => {
      const filtered = state.items.filter(
        (item) =>
          (options.targetType === undefined || item.targetType === options.targetType) &&
          (options.tag === undefined || item.tags?.includes(options.tag) === true) &&
          (options.tags === undefined || options.tags.every((tag) => item.tags?.includes(tag))) &&
          matchesSearch(item, options.searchQuery) &&
          (options.filter === undefined || options.filter(item)),
      );
      const sortBy = options.sortBy ?? options.sort?.by;
      const direction = (options.order ?? options.sort?.direction) === "asc" ? 1 : -1;
      const sorted = sortBy
        ? [...filtered].sort((a, b) => (a[sortBy] - b[sortBy]) * direction)
        : filtered;
      const totalCount = sorted.length;
      const offset = Math.max(0, options.offset ?? 0);
      const items =
        options.limit === undefined
          ? sorted.slice(offset)
          : sorted.slice(offset, offset + Math.max(0, options.limit));
      if (
        previousResult &&
        previousResult.totalCount === totalCount &&
        previousFiltered?.length === items.length &&
        previousFiltered.every((item, index) => item === items[index])
      ) {
        return previousResult;
      }
      previousFiltered = items;
      previousResult = { items, totalCount };
      return previousResult;
    };
  }, [
    options.filter,
    options.limit,
    options.offset,
    options.order,
    options.searchQuery,
    options.sort,
    options.sortBy,
    options.tag,
    options.tags,
    options.targetType,
  ]);
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
  const addTagsBatch = useCallback(
    (ids: string[], tags: string[]) => actions.addTagsBatch(ids, tags),
    [actions],
  );
  const removeTagsBatch = useCallback(
    (ids: string[], tags: string[]) => actions.removeTagsBatch(ids, tags),
    [actions],
  );

  return {
    items,
    totalCount,
    tags,
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
  };
}

function matchesSearch<TMeta>(item: KeepItem<TMeta>, searchQuery?: string): boolean {
  if (!searchQuery?.trim()) return true;
  const needle = searchQuery.trim().toLocaleLowerCase();
  let metaText = "";
  try {
    metaText = JSON.stringify(item.meta) ?? "";
  } catch {
    metaText = String(item.meta);
  }
  return `${item.note ?? ""} ${metaText}`.toLocaleLowerCase().includes(needle);
}
