import type { KeepListQuery } from "./query";

export type KeepUrlParamNames = {
  search: string;
  tags: string;
  sort: string;
  page: string;
  archived: string;
  collection: string;
  pinnedFirst: string;
};

export type KeepUrlSyncOptions = {
  /** Parameters are intentionally short so shared collection URLs stay readable. */
  params?: Partial<KeepUrlParamNames>;
  /** Push is the default so browser back/forward restores collection states. */
  history?: "replace" | "push";
  /** URL to read/write. Defaults to the current browser URL. */
  url?: string;
};

export const DEFAULT_KEEP_URL_PARAMS: KeepUrlParamNames = {
  search: "q",
  tags: "tag",
  sort: "sort",
  page: "page",
  archived: "archived",
  collection: "collection",
  pinnedFirst: "pinned",
};

export type KeepUrlState = Pick<
  KeepListQuery,
  "search" | "tags" | "sort" | "pagination" | "archived" | "collectionId" | "pinnedFirst"
>;

/** Convert a list query to stable URLSearchParams without serializing functions or unsupported filters. */
export function encodeKeepListQuery<TMeta = Record<string, unknown>>(
  query: KeepListQuery<TMeta> = {},
  options: Pick<KeepUrlSyncOptions, "params"> = {},
): URLSearchParams {
  const params = { ...DEFAULT_KEEP_URL_PARAMS, ...options.params };
  const result = new URLSearchParams();
  const search = query.search?.query?.trim();
  if (search) result.set(params.search, search);
  for (const tag of query.tags ?? []) {
    const normalized = tag.trim();
    if (normalized) result.append(params.tags, normalized);
  }
  if (query.sort?.by) result.set(params.sort, `${query.sort.by}:${query.sort.direction ?? "desc"}`);
  const page = query.pagination?.page;
  if (page !== undefined && Number.isFinite(page) && page > 1) result.set(params.page, String(Math.floor(page)));
  if (query.archived !== undefined) result.set(params.archived, query.archived ? "true" : "false");
  if (query.collectionId) result.set(params.collection, query.collectionId);
  if (query.pinnedFirst) result.set(params.pinnedFirst, "true");
  return result;
}

/** Parse a URL into the query fields supported by KeepCollection. Invalid values are ignored. */
export function decodeKeepListQuery(
  input: string | URL | URLSearchParams,
  options: Pick<KeepUrlSyncOptions, "params"> = {},
): KeepUrlState {
  const params = { ...DEFAULT_KEEP_URL_PARAMS, ...options.params };
  const searchParams = input instanceof URLSearchParams ? input : new URL(input, "http://keepkit.invalid").searchParams;
  const search = searchParams.get(params.search)?.trim();
  const tags = [
    ...new Set(
      searchParams
        .getAll(params.tags)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
  const sortValue = searchParams.get(params.sort)?.split(":");
  const sort: KeepListQuery["sort"] =
    sortValue?.[0] === "savedAt" || sortValue?.[0] === "updatedAt"
      ? {
          by: sortValue[0],
          direction: sortValue[1] === "asc" ? ("asc" as const) : ("desc" as const),
        }
      : undefined;
  const rawPage = Number(searchParams.get(params.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : undefined;
  const archivedValue = searchParams.get(params.archived);
  const archived = archivedValue === "true" ? true : archivedValue === "false" ? false : undefined;
  const collectionId = searchParams.get(params.collection)?.trim() || undefined;
  const pinnedFirst = searchParams.get(params.pinnedFirst) === "true" ? true : undefined;
  return {
    ...(search ? { search: { query: search } } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(sort ? { sort } : {}),
    ...(page ? { pagination: { page } } : {}),
    ...(archived === undefined ? {} : { archived }),
    ...(collectionId ? { collectionId } : {}),
    ...(pinnedFirst ? { pinnedFirst } : {}),
  };
}

export function serializeKeepListQuery<TMeta = Record<string, unknown>>(
  query: KeepListQuery<TMeta> = {},
  options: Pick<KeepUrlSyncOptions, "params"> = {},
): string {
  const value = encodeKeepListQuery(query, options).toString();
  return value ? `?${value}` : "";
}

export function mergeKeepListQueryFromUrl<TMeta = Record<string, unknown>>(
  query: KeepListQuery<TMeta>,
  input: string | URL | URLSearchParams,
  options: Pick<KeepUrlSyncOptions, "params"> = {},
): KeepListQuery<TMeta> {
  const decoded = decodeKeepListQuery(input, options);
  return {
    ...query,
    ...decoded,
    search: decoded.search ?? query.search,
    tags: decoded.tags ?? query.tags,
    sort: decoded.sort ?? query.sort,
    pagination: decoded.pagination ? { ...query.pagination, ...decoded.pagination } : query.pagination,
  };
}
