import type { KeepItem, KeepListQuery, KeepUrlSyncOptions } from "@keepkit/core/core";
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
};

export function useKeepCollection<TMeta>({
  query,
  pageSize,
  urlSync,
  urlAdapter,
  features,
  archiveScope,
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
  const [sort, setSort] = useState(query.sort ?? { by: "updatedAt" as const, direction: "desc" as const });
  const [activeTags, setActiveTags] = useState<string[]>(query.tags ?? []);
  const [activeCollection, setActiveCollection] = useState<string | undefined>(query.collectionId);
  const [activeActivity, setActiveActivity] = useState(query.activity);
  const [activeOrganization, setActiveOrganization] = useState(query.organization);
  const [activeSavedBetween, setActiveSavedBetween] = useState(query.savedBetween);
  const [page, setPage] = useState(query.pagination?.page ?? 1);
  const initialArchiveScope = archiveScope ?? query.archiveScope ?? scopeFromArchived(query.archived);
  const [activeArchiveScope, setActiveArchiveScope] = useState<KeepArchiveScope>(initialArchiveScope);
  useEffect(() => {
    if (archiveScope !== undefined) setActiveArchiveScope(archiveScope);
  }, [archiveScope]);
  const resolvedPageSize = queryOverride.pagination?.pageSize ?? query.pagination?.pageSize ?? pageSize;
  const resolvedQuery = useMemo<KeepListQuery<TMeta>>(
    () => ({
      ...query,
      ...queryOverride,
      activity: activeActivity,
      organization: activeOrganization,
      savedBetween: activeSavedBetween,
      archiveScope: activeArchiveScope,
      archived: activeArchiveScope === "active" ? false : activeArchiveScope === "archived" ? true : undefined,
      search: enabled.search ? { ...query.search, query: searchValue } : query.search,
      sort: enabled.sort ? sort : query.sort,
      tags: activeTags.length > 0 ? activeTags : undefined,
      collectionId: activeCollection && activeCollection !== "__uncategorized__" ? activeCollection : undefined,
      filter:
        activeCollection === "__uncategorized__"
          ? (item) => item.collectionId === undefined && (query.filter?.(item) ?? true)
          : query.filter,
      pagination: enabled.pagination ? { ...query.pagination, page, pageSize: resolvedPageSize } : query.pagination,
    }),
    [
      activeCollection,
      activeActivity,
      activeOrganization,
      activeSavedBetween,
      activeTags,
      enabled.pagination,
      enabled.search,
      enabled.sort,
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
      setQueryOverride(next);
      setSearchValue(next.search?.query ?? "");
      setSort(next.sort ?? { by: "updatedAt", direction: "desc" });
      setActiveTags(next.tags ?? []);
      setActiveCollection(next.collectionId);
      setActiveActivity(next.activity);
      setActiveOrganization(next.organization);
      setActiveSavedBetween(next.savedBetween);
      setActiveArchiveScope(next.archiveScope ?? scopeFromArchived(next.archived));
      setPage(next.pagination?.page ?? 1);
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
      if (query.targetType !== undefined && target.targetType !== query.targetType) return "excluded";
      if (query.filter && !query.filter(target)) return "excluded";
      const candidates = allState.items
        .filter(
          (item) =>
            (query.targetType === undefined || item.targetType === query.targetType) &&
            (!query.filter || query.filter(item)),
        )
        .filter((item) => (target.archived === true ? item.archived === true : item.archived !== true))
        .sort((a, b) => compareItems(a, b, sort, query.pinnedFirst));
      const index = candidates.findIndex((item) => item.id === itemId);
      if (index < 0) return "excluded";
      setSearchValue("");
      setActiveTags([]);
      setActiveCollection(undefined);
      setActiveArchiveScope(target.archived === true ? "archived" : "active");
      setPage(Math.floor(index / resolvedPageSize) + 1);
      return "visible";
    },
    [allState.items, query, resolvedPageSize, sort],
  );

  return {
    enabled,
    searchValue,
    sortValue: sortToValue(sort),
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
    setTag: (value?: string) => {
      setActiveTags(value ? [value] : []);
      setPage(1);
    },
    setCollection: (value?: string) => {
      setActiveCollection(value);
      setPage(1);
    },
    setActivity: (value?: KeepListQuery<TMeta>["activity"]) => {
      setActiveActivity(value);
      setPage(1);
    },
    setOrganization: (value?: KeepListQuery<TMeta>["organization"]) => {
      setActiveOrganization(value);
      setPage(1);
    },
    setSavedBetween: (value?: KeepListQuery<TMeta>["savedBetween"]) => {
      setActiveSavedBetween(value);
      setPage(1);
    },
    applyQuery: (next: KeepListQuery<TMeta>) => {
      setQueryOverride(next);
      setSearchValue(next.search?.query ?? "");
      setSort(next.sort ?? { by: "updatedAt", direction: "desc" });
      setActiveTags(next.tags ?? []);
      setActiveCollection(next.collectionId);
      setActiveActivity(next.activity);
      setActiveOrganization(next.organization);
      setActiveSavedBetween(next.savedBetween);
      setActiveArchiveScope(next.archiveScope ?? scopeFromArchived(next.archived));
      setPage(next.pagination?.page ?? 1);
    },
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
      setActiveOrganization(query.organization);
      setActiveSavedBetween(undefined);
      setActiveArchiveScope("active");
      setPage(1);
    },
    resetFilters: () => {
      setQueryOverride({});
      setSearchValue(query.search?.query ?? "");
      setSort(query.sort ?? { by: "updatedAt", direction: "desc" });
      setActiveTags(query.tags ?? []);
      setActiveCollection(query.collectionId);
      setActiveActivity(query.activity);
      setActiveOrganization(query.organization);
      setActiveSavedBetween(query.savedBetween);
      setActiveArchiveScope(initialArchiveScope);
      setPage(query.pagination?.page ?? 1);
    },
    canReset: hasInitialFilterState(query, initialArchiveScope),
    setPage,
    reveal,
  };
}

function hasInitialFilterState<TMeta>(query: KeepListQuery<TMeta>, archiveScope: KeepArchiveScope): boolean {
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
      (query.sort && (query.sort.by !== "updatedAt" || query.sort.direction !== "desc")),
  );
}

function compareItems<TMeta>(
  a: KeepItem<TMeta>,
  b: KeepItem<TMeta>,
  sort: NonNullable<KeepListQuery<TMeta>["sort"]>,
  pinnedFirst?: boolean,
): number {
  if (pinnedFirst && a.pinned !== b.pinned) return a.pinned === true ? -1 : 1;
  const aValue = sort.by === "savedAt" ? a.savedAt : sort.by === "updatedAt" ? a.updatedAt : a.lastOpenedAt;
  const bValue = sort.by === "savedAt" ? b.savedAt : sort.by === "updatedAt" ? b.updatedAt : b.lastOpenedAt;
  const direction = sort.direction === "asc" ? 1 : -1;
  if (aValue === undefined && bValue === undefined) return 0;
  if (aValue === undefined) return 1;
  if (bValue === undefined) return -1;
  return (aValue - bValue) * direction;
}

function scopeFromArchived(archived?: boolean): KeepArchiveScope {
  return archived === true ? "archived" : "active";
}
