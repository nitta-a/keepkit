"use client";

import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { type HTMLAttributes, type ReactNode, useMemo, useState } from "react";
import { KeepBulkActions } from "./KeepBulkActions";
import type { KeepItemCardProps } from "./KeepItemCard";
import { KeepList, type KeepListState } from "./KeepList";
import { KeepTagFilter } from "./KeepTagFilter";
import { KeepPagination, KeepSearchInput, KeepSortSelect } from "./query-controls";
import { type RenderProp, sortToValue } from "./shared";

export type KeepCollectionFeature = "search" | "sort" | "pagination" | "tagFilter" | "bulkActions";

export type KeepCollectionProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  pageSize?: number;
  features?: Partial<Record<KeepCollectionFeature, boolean>>;
  renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
  itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
  loading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  empty?: ReactNode | RenderProp<KeepListState<TMeta>>;
  error?: ReactNode | RenderProp<KeepListState<TMeta>>;
};

/** A batteries-included collection with query controls and accessible status feedback. */
export function KeepCollection<TMeta = Record<string, unknown>>({
  query = {},
  pageSize = 20,
  features,
  renderItem,
  itemCardProps,
  loading,
  empty,
  error,
  className,
  ...rootProps
}: KeepCollectionProps<TMeta>) {
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
  const list = useKeepList<TMeta>(resolvedQuery);

  return (
    <section
      {...rootProps}
      className={className}
      aria-busy={list.isLoading || list.isMutating || rootProps["aria-busy"]}
    >
      <div>
        {enabled.search ? (
          <KeepSearchInput
            value={searchValue}
            onValueChange={(value) => {
              setSearchValue(value);
              setPage(1);
            }}
          />
        ) : null}
        {enabled.sort ? (
          <KeepSortSelect
            value={sortToValue(sort)}
            onValueChange={(_value, nextSort) => {
              setSort(nextSort);
              setPage(1);
            }}
          />
        ) : null}
        {enabled.tagFilter ? (
          <KeepTagFilter<TMeta>
            query={query}
            value={tag}
            onValueChange={(value) => {
              setTag(value);
              setPage(1);
            }}
          />
        ) : null}
      </div>
      <KeepList<TMeta>
        query={resolvedQuery}
        renderItem={renderItem}
        itemCardProps={itemCardProps}
        loading={loading}
        empty={empty}
        error={error}
      />
      {enabled.pagination ? (
        <KeepPagination
          totalCount={list.totalCount}
          pageSize={resolvedPageSize}
          page={list.page}
          onPageChange={(nextPage) => setPage(nextPage)}
        />
      ) : null}
      {enabled.bulkActions ? <KeepBulkActions<TMeta> query={resolvedQuery} /> : null}
    </section>
  );
}
