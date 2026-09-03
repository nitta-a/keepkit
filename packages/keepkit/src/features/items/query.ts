import { orderKeepItems } from "./navigation";
import type { KeepItem } from "./types";

export type KeepListQuery<TMeta = Record<string, unknown>> = {
  targetType?: string;
  tags?: string[];
  /** Defaults to active (not archived) items; true selects archived items. */
  archived?: boolean;
  collectionId?: string;
  pinnedFirst?: boolean;
  sort?: {
    by: "savedAt" | "updatedAt";
    direction?: "asc" | "desc";
  };
  search?: {
    query?: string;
    mode?: "and" | "or";
    tokenize?: boolean;
    fields?: Array<"note" | "meta" | "tags">;
  };
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  filter?: (item: KeepItem<TMeta>) => boolean;
  savedBetween?: readonly [Date | number, Date | number];
};

export type QueryKeepItemsResult<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  totalCount: number;
  tagCounts: Record<string, number>;
  page: number;
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/** Apply the collection query and one-based pagination without React. */
export function queryKeepItems<TMeta = Record<string, unknown>>(
  source: KeepItem<TMeta>[],
  query: KeepListQuery<TMeta> = {},
): QueryKeepItemsResult<TMeta> {
  const filtered = source.filter((item) => {
    const [from, to] = query.savedBetween ?? [];
    const savedAt = item.savedAt;
    const lowerBound = from === undefined ? undefined : toTimestamp(from);
    const upperBound = to === undefined ? undefined : toTimestamp(to);
    return (
      (query.targetType === undefined || item.targetType === query.targetType) &&
      (query.tags === undefined || query.tags.every((tag) => item.tags?.includes(tag))) &&
      (query.archived === true ? item.archived === true : item.archived !== true) &&
      (query.collectionId === undefined || item.collectionId === query.collectionId) &&
      (lowerBound === undefined || savedAt >= lowerBound) &&
      (upperBound === undefined || savedAt <= upperBound) &&
      matchesSearch(item, query.search) &&
      (query.filter?.(item) ?? true)
    );
  });
  const tagCounts = getTagCounts(filtered);
  const sortBy = query.sort?.by;
  const direction = query.sort?.direction === "asc" ? 1 : -1;
  const sortedBase = sortBy
    ? filtered
        .map((item, index) => ({ item, index }))
        .sort((a, b) => (a.item[sortBy] - b.item[sortBy]) * direction || a.index - b.index)
        .map(({ item }) => item)
    : orderKeepItems(filtered);
  const sorted = query.pinnedFirst
    ? [...sortedBase.filter((item) => item.pinned === true), ...sortedBase.filter((item) => item.pinned !== true)]
    : sortedBase;
  const pageSize = Math.max(1, query.pagination?.pageSize ?? (sorted.length || 1));
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, query.pagination?.page ?? 1), pageCount);
  const offset = (page - 1) * pageSize;

  return {
    items: sorted.slice(offset, offset + pageSize),
    totalCount: sorted.length,
    tagCounts,
    page,
    pageCount,
    hasNextPage: page < pageCount,
    hasPreviousPage: page > 1,
  };
}

export function getTagCounts<TMeta = Record<string, unknown>>(items: KeepItem<TMeta>[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function matchesSearch<TMeta>(item: KeepItem<TMeta>, search?: KeepListQuery<TMeta>["search"]): boolean {
  const query = search?.query;
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
  const normalized = query.trim().toLocaleLowerCase();
  const needles = search?.tokenize === false ? [normalized] : normalized.split(/\s+/).filter(Boolean);
  const matches = needles.map((needle) => text.includes(needle));
  return search?.mode === "or" ? matches.some(Boolean) : matches.every(Boolean);
}

function toTimestamp(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}
