import type { KeepListQuery, KeepUrlSyncOptions } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { useEffect, useMemo, useState } from "react";
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
    ...features,
  };
  const [searchValue, setSearchValue] = useState(query.search?.query ?? "");
  const [sort, setSort] = useState(query.sort ?? { by: "updatedAt" as const, direction: "desc" as const });
  const [activeTags, setActiveTags] = useState<string[]>(query.tags ?? []);
  const [activeCollection, setActiveCollection] = useState<string | undefined>(query.collectionId);
  const [page, setPage] = useState(query.pagination?.page ?? 1);
  const [activeArchiveScope, setActiveArchiveScope] = useState<KeepArchiveScope>(
    archiveScope ?? query.archiveScope ?? scopeFromArchived(query.archived),
  );
  useEffect(() => {
    if (archiveScope !== undefined) setActiveArchiveScope(archiveScope);
  }, [archiveScope]);
  const resolvedPageSize = query.pagination?.pageSize ?? pageSize;
  const resolvedQuery = useMemo<KeepListQuery<TMeta>>(
    () => ({
      ...query,
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
      activeTags,
      enabled.pagination,
      enabled.search,
      enabled.sort,
      page,
      query,
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
      setSearchValue(next.search?.query ?? "");
      setSort(next.sort ?? { by: "updatedAt", direction: "desc" });
      setActiveTags(next.tags ?? []);
      setActiveCollection(next.collectionId);
      setActiveArchiveScope(next.archiveScope ?? scopeFromArchived(next.archived));
      setPage(next.pagination?.page ?? 1);
    },
    options: typeof urlSync === "object" ? urlSync : {},
    adapter: urlAdapter,
  });
  const list = useKeepList<TMeta>(resolvedQuery);
  const allState = useKeepList<TMeta>({ archiveScope: "all" });

  return {
    enabled,
    searchValue,
    sortValue: sortToValue(sort),
    activeTags,
    activeCollection,
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
    setArchiveScope: (value: KeepArchiveScope) => {
      setActiveArchiveScope(value);
      setPage(1);
    },
    removeTag: (tagToRemove: string) => {
      setActiveTags((current) => current.filter((tag) => tag !== tagToRemove));
      setPage(1);
    },
    clearFilters: () => {
      setSearchValue("");
      setActiveTags([]);
      setActiveCollection(undefined);
      setPage(1);
    },
    setPage,
  };
}

function scopeFromArchived(archived?: boolean): KeepArchiveScope {
  return archived === true ? "archived" : "active";
}
