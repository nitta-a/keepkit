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
  search?: {
    query: string;
    mode?: "and" | "or";
    tokenize?: boolean;
    fields?: Array<"note" | "meta" | "tags">;
  };
  sortBy?: "savedAt" | "updatedAt";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  filter?: (item: KeepItem<TMeta>) => boolean;
  filterFn?: (item: KeepItem<TMeta>) => boolean;
  savedBetween?: readonly [Date | number, Date | number];
};

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
  };
}

export type QueryKeepItemsResult<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  totalCount: number;
  tagCounts: Record<string, number>;
};

/** Apply the same filtering and pagination rules as useKeepList without React. */
export function queryKeepItems<TMeta = Record<string, unknown>>(
  source: KeepItem<TMeta>[],
  options: KeepListOptions<TMeta> = {},
): QueryKeepItemsResult<TMeta> {
  const filtered = source.filter((item) => {
    const [from, to] = options.savedBetween ?? [];
    const savedAt = item.savedAt;
    const lowerBound = from === undefined ? undefined : toTimestamp(from);
    const upperBound = to === undefined ? undefined : toTimestamp(to);
    return (
      (options.targetType === undefined || item.targetType === options.targetType) &&
      (options.tag === undefined || item.tags?.includes(options.tag) === true) &&
      (options.tags === undefined || options.tags.every((tag) => item.tags?.includes(tag))) &&
      (lowerBound === undefined || savedAt >= lowerBound) &&
      (upperBound === undefined || savedAt <= upperBound) &&
      matchesSearch(item, options.searchQuery, options.search) &&
      (options.filter?.(item) ?? true) &&
      (options.filterFn?.(item) ?? true)
    );
  });
  const tagCounts = getTagCounts(filtered);
  const sortBy = options.sortBy ?? options.sort?.by;
  const direction = (options.order ?? options.sort?.direction) === "asc" ? 1 : -1;
  const sorted = sortBy
    ? [...filtered].sort((a, b) => (a[sortBy] - b[sortBy]) * direction)
    : filtered;
  const offset = Math.max(0, options.offset ?? 0);
  const items =
    options.limit === undefined
      ? sorted.slice(offset)
      : sorted.slice(offset, offset + Math.max(0, options.limit));
  return { items, totalCount: sorted.length, tagCounts };
}

export function getTagCounts<TMeta = Record<string, unknown>>(
  items: KeepItem<TMeta>[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function matchesSearch<TMeta>(
  item: KeepItem<TMeta>,
  searchQuery?: string,
  search?: KeepListOptions<TMeta>["search"],
): boolean {
  const query = search?.query ?? searchQuery;
  if (!query?.trim()) return true;
  const fields = search?.fields ?? ["note", "meta", "tags"];
  const values = fields.map((field) => {
    if (field === "note") return item.note ?? "";
    if (field === "tags") return (item.tags ?? []).join(" ");
    try {
      return JSON.stringify(item.meta) ?? "";
    } catch {
      return String(item.meta);
    }
  });
  const text = values.join(" ").toLocaleLowerCase();
  if (!search) return text.includes(query.trim().toLocaleLowerCase());
  const normalized = query.trim().toLocaleLowerCase();
  const needles =
    search.tokenize === false ? [normalized] : normalized.split(/\s+/).filter(Boolean);
  const matches = needles.map((needle) => text.includes(needle));
  return search.mode === "or" ? matches.some(Boolean) : matches.every(Boolean);
}

function toTimestamp(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
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
