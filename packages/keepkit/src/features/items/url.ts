import type { KeepListQuery } from "./query";

export type KeepUrlParamNames = {
  search: string;
  tags: string;
  sort: string;
  page: string;
  archived: string;
  archiveScope: string;
  collection: string;
  pinnedFirst: string;
  activityOpened?: string;
  lastOpenedBefore?: string;
  lastOpenedAfter?: string;
  inactiveForMs?: string;
  organizationCollection?: string;
  organizationTags?: string;
  organizationNote?: string;
  savedAfter?: string;
  savedBefore?: string;
};

export type KeepUrlSyncOptions = {
  /** Parameters are intentionally short so shared collection URLs stay readable. */
  params?: Partial<KeepUrlParamNames>;
  /** Push is the default so browser back/forward restores collection states. */
  history?: "replace" | "push";
  /** URL to read/write. Defaults to the current browser URL. */
  url?: string;
};

export const DEFAULT_KEEP_URL_PARAMS: Required<KeepUrlParamNames> = {
  search: "q",
  tags: "tag",
  sort: "sort",
  page: "page",
  archived: "archived",
  archiveScope: "archiveScope",
  collection: "collection",
  pinnedFirst: "pinned",
  activityOpened: "opened",
  lastOpenedBefore: "openedBefore",
  lastOpenedAfter: "openedAfter",
  inactiveForMs: "inactiveFor",
  organizationCollection: "collectionState",
  organizationTags: "tagsState",
  organizationNote: "noteState",
  savedAfter: "savedAfter",
  savedBefore: "savedBefore",
};

export type KeepUrlState = Pick<
  KeepListQuery,
  | "search"
  | "tags"
  | "sort"
  | "pagination"
  | "archived"
  | "archiveScope"
  | "collectionId"
  | "pinnedFirst"
  | "activity"
  | "organization"
  | "savedBetween"
>;

/** Convert a list query to stable URLSearchParams without serializing functions or unsupported filters. */
export function encodeKeepListQuery<TMeta = Record<string, unknown>>(
  query: KeepListQuery<TMeta> = {},
  options: Pick<KeepUrlSyncOptions, "params"> = {},
): URLSearchParams {
  const params: Required<KeepUrlParamNames> = { ...DEFAULT_KEEP_URL_PARAMS, ...options.params };
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
  if (query.archiveScope !== undefined) result.set(params.archiveScope, query.archiveScope);
  else if (query.archived !== undefined) result.set(params.archived, query.archived ? "true" : "false");
  if (query.collectionId) result.set(params.collection, query.collectionId);
  for (const [key, value] of [
    [params.organizationCollection, query.organization?.collection],
    [params.organizationTags, query.organization?.tags],
    [params.organizationNote, query.organization?.note],
  ] as const) {
    if (value !== undefined) result.set(key, value);
  }
  if (query.pinnedFirst) result.set(params.pinnedFirst, "true");
  if (query.savedBetween) {
    const [from, to] = query.savedBetween.map((value) => (value instanceof Date ? value.getTime() : value));
    if (Number.isFinite(from) && Number.isFinite(to)) {
      result.set(params.savedAfter, String(from));
      result.set(params.savedBefore, String(to));
    }
  }
  if (query.activity?.opened) result.set(params.activityOpened, query.activity.opened);
  for (const [key, value] of [
    [params.lastOpenedBefore, query.activity?.lastOpenedBefore],
    [params.lastOpenedAfter, query.activity?.lastOpenedAfter],
    [params.inactiveForMs, query.activity?.inactiveForMs],
  ] as const) {
    if (value !== undefined && Number.isFinite(value)) result.set(key, String(value));
  }
  return result;
}

/** Parse a URL into the query fields supported by KeepCollection. Invalid values are ignored. */
export function decodeKeepListQuery(
  input: string | URL | URLSearchParams,
  options: Pick<KeepUrlSyncOptions, "params"> = {},
): KeepUrlState {
  const params: Required<KeepUrlParamNames> = { ...DEFAULT_KEEP_URL_PARAMS, ...options.params };
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
    sortValue?.[0] === "savedAt" || sortValue?.[0] === "updatedAt" || sortValue?.[0] === "lastOpenedAt"
      ? {
          by: sortValue[0],
          direction: sortValue[1] === "asc" ? ("asc" as const) : ("desc" as const),
        }
      : undefined;
  const rawPage = Number(searchParams.get(params.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : undefined;
  const archiveScopeValue = searchParams.get(params.archiveScope);
  const archiveScope =
    archiveScopeValue === "active" || archiveScopeValue === "archived" || archiveScopeValue === "all"
      ? archiveScopeValue
      : undefined;
  const archivedValue = searchParams.get(params.archived);
  const archived =
    archiveScope === "archived" || archivedValue === "true"
      ? true
      : archiveScope === "active" || archivedValue === "false"
        ? false
        : undefined;
  const collectionId = searchParams.get(params.collection)?.trim() || undefined;
  const organizationCollection = parseOrganizationState(searchParams.get(params.organizationCollection));
  const organizationTags = parseOrganizationState(searchParams.get(params.organizationTags));
  const organizationNote = parseOrganizationState(searchParams.get(params.organizationNote));
  const organization =
    organizationCollection || organizationTags || organizationNote
      ? {
          ...(organizationCollection ? { collection: organizationCollection } : {}),
          ...(organizationTags ? { tags: organizationTags } : {}),
          ...(organizationNote ? { note: organizationNote } : {}),
        }
      : undefined;
  const pinnedFirst = searchParams.get(params.pinnedFirst) === "true" ? true : undefined;
  const parseSavedDate = (name: string): number | undefined => {
    const rawValue = searchParams.get(name);
    if (rawValue === null || rawValue.trim() === "") return undefined;
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : undefined;
  };
  const savedAfter = parseSavedDate(params.savedAfter);
  const savedBefore = parseSavedDate(params.savedBefore);
  const savedBetween =
    savedAfter === undefined || savedBefore === undefined ? undefined : ([savedAfter, savedBefore] as const);
  const activityOpenedValue = searchParams.get(params.activityOpened);
  const activityOpened: "ever" | "never" | undefined =
    activityOpenedValue === "ever" || activityOpenedValue === "never" ? activityOpenedValue : undefined;
  const parseActivityNumber = (name: string): number | undefined => {
    const rawValue = searchParams.get(name);
    if (rawValue === null || rawValue.trim() === "") return undefined;
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : undefined;
  };
  const lastOpenedBefore = parseActivityNumber(params.lastOpenedBefore);
  const lastOpenedAfter = parseActivityNumber(params.lastOpenedAfter);
  const inactiveForMs = parseActivityNumber(params.inactiveForMs);
  const activity =
    activityOpened !== undefined ||
    lastOpenedBefore !== undefined ||
    lastOpenedAfter !== undefined ||
    inactiveForMs !== undefined
      ? {
          ...(activityOpened === undefined ? {} : { opened: activityOpened }),
          ...(lastOpenedBefore === undefined ? {} : { lastOpenedBefore }),
          ...(lastOpenedAfter === undefined ? {} : { lastOpenedAfter }),
          ...(inactiveForMs === undefined ? {} : { inactiveForMs }),
        }
      : undefined;
  return {
    ...(search ? { search: { query: search } } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(sort ? { sort } : {}),
    ...(page ? { pagination: { page } } : {}),
    ...(archived === undefined ? {} : { archived }),
    ...(archiveScope === undefined ? {} : { archiveScope }),
    ...(collectionId ? { collectionId } : {}),
    ...(organization ? { organization } : {}),
    ...(pinnedFirst ? { pinnedFirst } : {}),
    ...(savedBetween ? { savedBetween } : {}),
    ...(activity === undefined ? {} : { activity }),
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
    archived: decoded.archived ?? query.archived,
    archiveScope: decoded.archiveScope ?? query.archiveScope,
    activity: decoded.activity ?? query.activity,
    organization: decoded.organization ?? query.organization,
    savedBetween: decoded.savedBetween ?? query.savedBetween,
  };
}

function parseOrganizationState(value: string | null): "assigned" | "unassigned" | undefined {
  return value === "assigned" || value === "unassigned" ? value : undefined;
}
