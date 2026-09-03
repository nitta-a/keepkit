import type { KeepListQuery, KeepUrlSyncOptions } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { useMemo, useState } from "react";
import { type KeepUrlAdapter, useKeepUrlSync } from "../../../adapters/url-sync";
import { sortToValue } from "../../../foundation/shared";
import type { KeepSortValue } from "../../query/query-controls";
import type { KeepCollectionFeature } from "../KeepCollection";

type KeepCollectionOptions<TMeta> = {
  query: KeepListQuery<TMeta>;
  pageSize: number;
  urlSync: boolean | KeepUrlSyncOptions;
  urlAdapter: KeepUrlAdapter | undefined;
  features: Partial<Record<KeepCollectionFeature, boolean>> | undefined;
};

export function useKeepCollection<TMeta>({
  query,
  pageSize,
  urlSync,
  urlAdapter,
  features,
}: KeepCollectionOptions<TMeta>) {
  const enabled = {
    search: true,
    sort: true,
    pagination: true,
    tagFilter: false,
    bulkActions: false,
    ...features,
  };
  const [searchValue, setSearchValue] = useState(query.search?.query ?? "");
  const [sort, setSort] = useState(query.sort ?? { by: "updatedAt" as const, direction: "desc" as const });
  const [tag, setTag] = useState<string | undefined>(query.tags?.[0]);
  const [page, setPage] = useState(query.pagination?.page ?? 1);
  const resolvedPageSize = query.pagination?.pageSize ?? pageSize;
  const resolvedQuery = useMemo<KeepListQuery<TMeta>>(
    () => ({
      ...query,
      search: enabled.search ? { ...query.search, query: searchValue } : query.search,
      sort: enabled.sort ? sort : query.sort,
      tags: tag ? [...new Set([...(query.tags ?? []), tag])] : query.tags,
      pagination: enabled.pagination ? { ...query.pagination, page, pageSize: resolvedPageSize } : query.pagination,
    }),
    [enabled.pagination, enabled.search, enabled.sort, page, query, resolvedPageSize, searchValue, sort, tag],
  );
  useKeepUrlSync({
    enabled: Boolean(urlSync),
    query: resolvedQuery,
    onQueryChange: (nextOrUpdater) => {
      const next = typeof nextOrUpdater === "function" ? nextOrUpdater(resolvedQuery) : nextOrUpdater;
      setSearchValue(next.search?.query ?? "");
      setSort(next.sort ?? { by: "updatedAt", direction: "desc" });
      setTag(next.tags?.[0]);
      setPage(next.pagination?.page ?? 1);
    },
    options: typeof urlSync === "object" ? urlSync : {},
    adapter: urlAdapter,
  });
  const list = useKeepList<TMeta>(resolvedQuery);

  return {
    enabled,
    searchValue,
    sortValue: sortToValue(sort),
    tag,
    resolvedPageSize,
    resolvedQuery,
    list,
    setSearchValue: (value: string) => {
      setSearchValue(value);
      setPage(1);
    },
    setSortValue: (_value: KeepSortValue, nextSort: NonNullable<KeepListQuery["sort"]>) => {
      setSort(nextSort);
      setPage(1);
    },
    setTag: (value?: string) => {
      setTag(value);
      setPage(1);
    },
    setPage,
  };
}
