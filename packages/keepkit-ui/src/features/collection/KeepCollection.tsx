"use client";

import type { KeepItem, KeepListQuery, KeepUrlSyncOptions } from "@keepkit/core/core";
import { KeepErrorBoundary, type KeepErrorBoundaryProps } from "@keepkit/core/react";
import type { HTMLAttributes, ReactNode } from "react";
import type { KeepUrlAdapter } from "../../adapters/url-sync";
import { type RenderProp, resolveContent } from "../../foundation/shared";
import { KeepBulkActions } from "../actions/KeepBulkActions";
import type { KeepItemCardProps } from "../item/KeepItemCard";
import { KeepActiveFiltersSummary } from "../query/KeepActiveFiltersSummary";
import { KeepCollectionFilter } from "../query/KeepCollectionFilter";
import { KeepTagFilter } from "../query/KeepTagFilter";
import { KeepPagination, KeepSearchInput, KeepSortSelect } from "../query/query-controls";
import { useKeepCollection } from "./hooks/useKeepCollection";
import { KeepList, type KeepListState } from "./KeepList";

export type KeepCollectionFeature =
  | "search"
  | "sort"
  | "pagination"
  | "tagFilter"
  | "collectionFilter"
  | "bulkActions"
  | "tags"
  | "pin"
  | "archive";
export type KeepLayoutPreset = "list" | "grid" | "compact" | "auto";

export type KeepCollectionProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  pageSize?: number;
  layout?: KeepLayoutPreset;
  urlSync?: boolean | KeepUrlSyncOptions;
  urlAdapter?: KeepUrlAdapter;
  features?: Partial<Record<KeepCollectionFeature, boolean>>;
  collectionLabels?: Record<string, string>;
  renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
  itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
  loading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  /** Alias for `loading`. When neither is provided, KeepList renders skeleton cards. */
  renderLoading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  loadingCount?: number;
  activeFilters?: ReactNode | RenderProp<KeepListState<TMeta>>;
  empty?: ReactNode | RenderProp<KeepListState<TMeta>>;
  error?: ReactNode | RenderProp<KeepListState<TMeta>>;
  fallback?: KeepErrorBoundaryProps["fallback"];
  onBoundaryError?: KeepErrorBoundaryProps["onError"];
  boundaryResetKey?: unknown;
};

/** A batteries-included collection with query controls and accessible status feedback. */
export function KeepCollection<TMeta = Record<string, unknown>>(props: KeepCollectionProps<TMeta>) {
  const { fallback, onBoundaryError, boundaryResetKey, ...collectionProps } = props;
  const content = <KeepCollectionContent<TMeta> {...collectionProps} />;
  if (fallback === undefined && onBoundaryError === undefined) return content;
  return (
    <KeepErrorBoundary fallback={fallback} onError={onBoundaryError} resetKey={boundaryResetKey}>
      {content}
    </KeepErrorBoundary>
  );
}

function KeepCollectionContent<TMeta = Record<string, unknown>>({
  query = {},
  pageSize = 20,
  layout = "list",
  urlSync = false,
  urlAdapter,
  features,
  collectionLabels,
  renderItem,
  itemCardProps,
  loading,
  renderLoading,
  loadingCount,
  activeFilters,
  empty,
  error,
  className,
  ...rootProps
}: Omit<KeepCollectionProps<TMeta>, "fallback" | "onBoundaryError" | "boundaryResetKey">) {
  const view = useKeepCollection<TMeta>({ query, pageSize, urlSync, urlAdapter, features });
  const resolvedItemCardProps = {
    ...itemCardProps,
    showTags: itemCardProps?.showTags ?? view.enabled.tags,
    showPinButton: itemCardProps?.showPinButton ?? view.enabled.pin,
    showArchiveButton: itemCardProps?.showArchiveButton ?? view.enabled.archive,
  };

  return (
    <section
      {...rootProps}
      className={className}
      data-keepkit="collection"
      data-layout={layout}
      aria-busy={view.list.isLoading || view.list.isMutating || rootProps["aria-busy"]}
      data-state={getCollectionState(view.list)}
      data-loading={view.list.isLoading || view.list.isMutating ? "true" : undefined}
    >
      <div>
        {view.enabled.search ? <KeepSearchInput value={view.searchValue} onValueChange={view.setSearchValue} /> : null}
        {view.enabled.sort ? <KeepSortSelect value={view.sortValue} onValueChange={view.setSortValue} /> : null}
        {view.enabled.tagFilter ? (
          <KeepTagFilter<TMeta> query={query} value={view.activeTags[0]} onValueChange={view.setTag} />
        ) : null}
        {view.enabled.collectionFilter ? (
          <KeepCollectionFilter
            value={view.activeCollection}
            onValueChange={view.setCollection}
            collectionLabels={collectionLabels}
          />
        ) : null}
      </div>
      {activeFilters === undefined ? (
        <KeepActiveFiltersSummary<TMeta>
          search={view.searchValue}
          tags={view.activeTags}
          onSearchChange={view.setSearchValue}
          onTagChange={view.removeTag}
          onClear={view.clearFilters}
        />
      ) : (
        resolveContent(activeFilters, view.list)
      )}
      <KeepList<TMeta>
        query={view.resolvedQuery}
        renderItem={renderItem}
        itemCardProps={resolvedItemCardProps}
        layout={layout}
        loading={loading}
        renderLoading={renderLoading}
        loadingCount={loadingCount}
        onClearFilters={view.clearFilters}
        empty={view.list.totalCount === 0 && view.allState.totalCount > 0 ? undefined : empty}
        error={error}
      />
      {view.enabled.pagination ? (
        <KeepPagination
          totalCount={view.list.totalCount}
          pageSize={view.resolvedPageSize}
          page={view.list.page}
          onPageChange={view.setPage}
        />
      ) : null}
      {view.enabled.bulkActions ? <KeepBulkActions<TMeta> query={view.resolvedQuery} /> : null}
    </section>
  );
}

function getCollectionState<TMeta>(list: KeepListState<TMeta>): "loading" | "error" | "empty" | "ready" {
  if (list.error && list.items.length === 0) return "error";
  if (list.isLoading && !list.isHydrated) return "loading";
  if (list.isHydrated && list.items.length === 0) return "empty";
  return "ready";
}
