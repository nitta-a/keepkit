import type { KeepItem } from "./types";

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
  const sorted = sortBy ? [...filtered].sort((a, b) => (a[sortBy] - b[sortBy]) * direction) : filtered;
  const offset = Math.max(0, options.offset ?? 0);
  const items =
    options.limit === undefined ? sorted.slice(offset) : sorted.slice(offset, offset + Math.max(0, options.limit));
  return { items, totalCount: sorted.length, tagCounts };
}

export function getTagCounts<TMeta = Record<string, unknown>>(items: KeepItem<TMeta>[]): Record<string, number> {
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
  const needles = search.tokenize === false ? [normalized] : normalized.split(/\s+/).filter(Boolean);
  const matches = needles.map((needle) => text.includes(needle));
  return search.mode === "or" ? matches.some(Boolean) : matches.every(Boolean);
}

function toTimestamp(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}
