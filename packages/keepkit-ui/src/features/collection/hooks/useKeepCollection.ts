import { type KeepListQuery, type KeepUrlSyncOptions, queryKeepItems } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type KeepUrlAdapter, useKeepUrlSync } from "../../../adapters/url-sync";
import { sortToValue } from "../../../foundation/shared";
import type { KeepArchiveScope } from "../../query/KeepArchiveScopeSelect";
import type { KeepSortValue } from "../../query/query-controls";
import type { KeepCollectionFeature } from "../KeepCollection";

type KeepCollectionOptions<TMeta> = {
  query: KeepListQuery<TMeta>;
  pageSize: number;
  urlSync: boolean | KeepUrlSyncOptions;
  urlAdapter: KeepUrlAdapter | undefined;
  features: Partial<Record<KeepCollectionFeature, boolean>> | undefined;
  archiveScope: KeepArchiveScope | undefined;
  reorderable: boolean;
};

const DEFAULT_SORT = { by: "updatedAt", direction: "desc" } as const;
const UNCATEGORIZED = "__uncategorized__";

export function useKeepCollection<TMeta>({
  query,
  pageSize,
  urlSync,
  urlAdapter,
  features,
  archiveScope,
  reorderable,
}: KeepCollectionOptions<TMeta>) {
  const enabled = {
    search: true,
    sort: true,
    pagination: true,
    tagFilter: false,
    collectionFilter: false,
    bulkActions: false,
    tags: true,
    pin: false,
    archive: false,
    note: false,
    savedViews: false,
    ...features,
  };
  const [searchValue, setSearchValue] = useState(query.search?.query ?? "");
  const [queryOverride, setQueryOverride] = useState<KeepListQuery<TMeta>>({});
  const defaultSort = reorderable || !enabled.sort ? undefined : DEFAULT_SORT;
  const [sort, setSort] = useState<KeepListQuery<TMeta>["sort"]>(query.sort ?? defaultSort);
  const [activeTags, setActiveTags] = useState<string[]>(query.tags ?? []);
  const [activeCollection, setActiveCollection] = useState<string | undefined>(getCollectionValue(query));
  const [activeActivity, setActiveActivity] = useState(query.activity);
  const [activeOrganization, setActiveOrganization] = useState(query.organization);
  const [activeSavedBetween, setActiveSavedBetween] = useState(query.savedBetween);
  const [page, setPage] = useState(query.pagination?.page ?? 1);
  const initialArchiveScope = archiveScope ?? query.archiveScope ?? scopeFromArchived(query.archived);
  const [activeArchiveScope, setActiveArchiveScope] = useState<KeepArchiveScope>(initialArchiveScope);
  const applyQuery = useCallback(
    (next: KeepListQuery<TMeta>) => {
      setQueryOverride(next);
      setSearchValue(next.search?.query ?? "");
      setSort(next.sort ?? defaultSort);
      setActiveTags(next.tags ?? []);
      setActiveCollection(getCollectionValue(next));
      setActiveActivity(next.activity);
      setActiveOrganization(next.organization);
      setActiveSavedBetween(next.savedBetween);
      setActiveArchiveScope(next.archiveScope ?? scopeFromArchived(next.archived));
      setPage(next.pagination?.page ?? 1);
    },
    [defaultSort],
  );
  useEffect(() => {
    if (archiveScope !== undefined) setActiveArchiveScope(archiveScope);
  }, [archiveScope]);
  const defaultPageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 20;
  const requestedPageSize = queryOverride.pagination?.pageSize ?? query.pagination?.pageSize ?? defaultPageSize;
  const resolvedPageSize = Number.isFinite(requestedPageSize)
    ? Math.max(1, Math.floor(requestedPageSize))
    : defaultPageSize;
  const resolvedQuery = useMemo<KeepListQuery<TMeta>>(
    () => ({
      ...query,
      ...queryOverride,
      targetType: query.targetType ?? queryOverride.targetType,
      activity: activeActivity,
      organization: activeOrganization,
      savedBetween: activeSavedBetween,
      archiveScope: activeArchiveScope,
      archived: activeArchiveScope === "active" ? false : activeArchiveScope === "archived" ? true : undefined,
      search: { ...query.search, ...queryOverride.search, query: searchValue },
      sort,
      tags: activeTags.length > 0 ? activeTags : undefined,
      collectionId: activeCollection && activeCollection !== UNCATEGORIZED ? activeCollection : undefined,
      filter: query.filter,
      pagination:
        enabled.pagination || query.pagination || queryOverride.pagination
          ? { ...query.pagination, ...queryOverride.pagination, page, pageSize: resolvedPageSize }
          : undefined,
    }),
    [
      activeCollection,
      activeActivity,
      activeOrganization,
      activeSavedBetween,
      activeTags,
      enabled.pagination,
      page,
      query,
      queryOverride,
      resolvedPageSize,
      searchValue,
      sort,
      activeArchiveScope,
    ],
  );
  useKeepUrlSync({
    enabled: Boolean(urlSync),
    query: resolvedQuery,
    onQueryChange: (nextOrUpdater) => {
      const next = typeof nextOrUpdater === "function" ? nextOrUpdater(resolvedQuery) : nextOrUpdater;
      applyQuery(next);
    },
    options: typeof urlSync === "object" ? urlSync : {},
    adapter: urlAdapter,
  });
  const list = useKeepList<TMeta>(resolvedQuery);
  const allState = useKeepList<TMeta>({ archiveScope: "all" });

  const reveal = useCallback(
    (itemId: string): "visible" | "not-found" | "excluded" => {
      const target = allState.items.find((item) => item.id === itemId);
      if (!target) return "not-found";
      const nextQuery: KeepListQuery<TMeta> = {
        ...resolvedQuery,
        targetType: query.targetType,
        filter: query.filter,
        search: { ...resolvedQuery.search, query: "" },
        tags: undefined,
        collectionId: undefined,
        activity: undefined,
        organization: undefined,
        savedBetween: undefined,
        archiveScope: target.archived === true ? "archived" : "active",
        archived: target.archived === true,
      };
      const candidates = queryKeepItems(allState.items, { ...nextQuery, pagination: undefined }).items;
      const index = candidates.findIndex((item) => item.id === itemId);
      if (index < 0) return "excluded";
      const pageSize = nextQuery.pagination ? Math.max(1, resolvedPageSize) : Math.max(1, candidates.length);
      const nextPage = Math.floor(index / pageSize) + 1;
      applyQuery({
        ...nextQuery,
        ...(nextQuery.pagination ? { pagination: { ...nextQuery.pagination, page: nextPage } } : {}),
      });
      return "visible";
    },
    [allState.items, applyQuery, query, resolvedPageSize, resolvedQuery],
  );

  return {
    enabled,
    searchValue,
    sortValue: sort === undefined ? ("manual" as const) : sortToValue(sort),
    activeTags,
    activeCollection,
    activity: activeActivity,
    archiveScope: activeArchiveScope,
    resolvedPageSize,
    resolvedQuery,
    list,
    allState,
    setSearchValue: (value: string) => {
      setSearchValue(value);
      setPage(1);
    },
    setSortValue: (_value: KeepSortValue, nextSort: NonNullable<KeepListQuery["sort"]>) => {
      setSort(nextSort);
      setPage(1);
    },
    setManualSort: () => {
      setSort(undefined);
      setPage(1);
    },
    setTag: (value?: string) => {
      setActiveTags(value ? [value] : []);
      setPage(1);
    },
    setCollection: (value?: string) => {
      setActiveCollection(value);
      setActiveOrganization((current) => {
        if (value === UNCATEGORIZED) return { ...current, collection: "unassigned" };
        if (current?.collection !== "unassigned") return current;
        const { collection: _collection, ...organization } = current;
        return organization.tags || organization.note ? organization : undefined;
      });
      setPage(1);
    },
    setActivity: (value?: KeepListQuery<TMeta>["activity"]) => {
      setActiveActivity(value);
      setPage(1);
    },
    setOrganization: (value?: KeepListQuery<TMeta>["organization"]) => {
      setActiveOrganization(value);
      setActiveCollection((current) => {
        if (value?.collection === "unassigned") return UNCATEGORIZED;
        return current === UNCATEGORIZED ? undefined : current;
      });
      setPage(1);
    },
    setSavedBetween: (value?: KeepListQuery<TMeta>["savedBetween"]) => {
      setActiveSavedBetween(value);
      setPage(1);
    },
    applyQuery,
    setArchiveScope: (value: KeepArchiveScope) => {
      setActiveArchiveScope(value);
      setPage(1);
    },
    removeTag: (tagToRemove: string) => {
      setActiveTags((current) => current.filter((tag) => tag !== tagToRemove));
      setPage(1);
    },
    clearFilters: () => {
      setQueryOverride({});
      setSearchValue("");
      setActiveTags([]);
      setActiveCollection(undefined);
      setActiveActivity(undefined);
      setActiveOrganization(undefined);
      setActiveSavedBetween(undefined);
      setActiveArchiveScope("active");
      setPage(1);
    },
    resetFilters: () => applyQuery({ ...query, archiveScope: initialArchiveScope }),
    canReset: hasInitialFilterState(query, initialArchiveScope, reorderable),
    setPage,
    reveal,
  };
}

function hasInitialFilterState<TMeta>(
  query: KeepListQuery<TMeta>,
  archiveScope: KeepArchiveScope,
  reorderable: boolean,
): boolean {
  return Boolean(
    query.search?.query?.trim() ||
      query.tags?.length ||
      query.collectionId ||
      query.activity ||
      query.organization ||
      query.pinnedFirst ||
      query.savedBetween ||
      archiveScope !== "active" ||
      (query.pagination?.page !== undefined && query.pagination.page !== 1) ||
      (query.sort && (reorderable || query.sort.by !== "updatedAt" || query.sort.direction !== "desc")),
  );
}

function getCollectionValue<TMeta>(query: KeepListQuery<TMeta>): string | undefined {
  return query.collectionId ?? (query.organization?.collection === "unassigned" ? UNCATEGORIZED : undefined);
}

function scopeFromArchived(archived?: boolean): KeepArchiveScope {
  return archived === true ? "archived" : "active";
}
