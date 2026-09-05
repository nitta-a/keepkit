"use client";

import type { KeepItem, KeepListQuery, KeepUrlSyncOptions } from "@keepkit/core/core";
import { KeepErrorBoundary, type KeepErrorBoundaryProps } from "@keepkit/core/react";
import { type HTMLAttributes, type ReactNode, useEffect, useId, useState } from "react";
import type { KeepUrlAdapter } from "../../adapters/url-sync";
import { hasRenderableContent, type RenderProp, resolveContent } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";
import { KeepBulkActions } from "../actions/KeepBulkActions";
import type { KeepItemCardProps } from "../item/KeepItemCard";
import { KeepActiveFiltersSummary } from "../query/KeepActiveFiltersSummary";
import { type KeepArchiveScope, KeepArchiveScopeSelect } from "../query/KeepArchiveScopeSelect";
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
export type KeepCollectionToolbarVariant = "plain" | "panel";
export type KeepCollectionToolbarLayout = "flat" | "grouped";
export type KeepCollectionToolbarGroup = "toolbarStart" | "query" | "filters" | "toolbarEnd";
export type KeepCollectionToolbarContent<TMeta = Record<string, unknown>> =
  | ReactNode
  | RenderProp<KeepListState<TMeta>>;
export type KeepCollectionSlots<TMeta = Record<string, unknown>> = {
  toolbarStart?: KeepCollectionToolbarContent<TMeta>;
  toolbarEnd?: KeepCollectionToolbarContent<TMeta>;
};

export type KeepCollectionProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  pageSize?: number;
  layout?: KeepLayoutPreset;
  /** Opts into the theme-backed toolbar surface. */
  toolbarVariant?: KeepCollectionToolbarVariant;
  /** Groups host actions, query controls, and filters into labelled regions. */
  toolbarLayout?: KeepCollectionToolbarLayout;
  slots?: KeepCollectionSlots<TMeta>;
  urlSync?: boolean | KeepUrlSyncOptions;
  urlAdapter?: KeepUrlAdapter;
  /** Enables the built-in active/archived/all scope selector and query state. */
  archiveScope?: KeepArchiveScope;
  onArchiveScopeChange?: (scope: KeepArchiveScope) => void;
  /** Enables the built-in drag and keyboard reorder list. */
  reorderable?: boolean;
  onReorder?: (items: KeepItem<TMeta>[]) => void | Promise<void>;
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
  toolbarVariant = "plain",
  toolbarLayout = "flat",
  urlSync = false,
  urlAdapter,
  archiveScope,
  onArchiveScopeChange,
  reorderable = false,
  onReorder,
  features,
  slots,
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
  const view = useKeepCollection<TMeta>({ query, pageSize, urlSync, urlAdapter, features, archiveScope });
  const [reorderUndoIds, setReorderUndoIds] = useState<string[] | null>(null);
  const reorderUndoLabel = useUiLabel("undoReorder");
  const handleReorder = async (orderedIds: string[]) => {
    const previousIds = view.list.items.map((item) => item.id);
    await view.list.reorder(orderedIds);
    const itemsById = new Map(view.list.items.map((item) => [item.id, item]));
    const orderedItems = orderedIds.flatMap((id) => {
      const item = itemsById.get(id);
      return item ? [item] : [];
    });
    setReorderUndoIds(previousIds);
    await onReorder?.(orderedItems);
  };
  useEffect(() => {
    if (!reorderUndoIds) return;
    const timer = window.setTimeout(() => setReorderUndoIds(null), 5000);
    return () => window.clearTimeout(timer);
  }, [reorderUndoIds]);
  const undoReorder = async () => {
    if (!reorderUndoIds) return;
    const previous = reorderUndoIds;
    setReorderUndoIds(null);
    await view.list.reorder(previous);
  };
  const resolvedItemCardProps = {
    ...itemCardProps,
    showTags: itemCardProps?.showTags ?? view.enabled.tags,
    showPinButton: itemCardProps?.showPinButton ?? view.enabled.pin,
    showArchiveButton: itemCardProps?.showArchiveButton ?? view.enabled.archive,
  };
  const toolbarId = useId();
  const structuredToolbar =
    toolbarLayout === "grouped" ||
    toolbarVariant === "panel" ||
    slots?.toolbarStart !== undefined ||
    slots?.toolbarEnd !== undefined;
  const hasQueryControls = view.enabled.search || view.enabled.sort;
  const hasFilterControls = view.enabled.tagFilter || view.enabled.collectionFilter || archiveScope !== undefined;
  const queryControls = hasQueryControls ? (
    <>
      {view.enabled.search ? <KeepSearchInput value={view.searchValue} onValueChange={view.setSearchValue} /> : null}
      {view.enabled.sort ? <KeepSortSelect value={view.sortValue} onValueChange={view.setSortValue} /> : null}
    </>
  ) : null;
  const filterControls = hasFilterControls ? (
    <>
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
      {archiveScope !== undefined ? (
        <KeepArchiveScopeSelect
          value={view.archiveScope}
          onValueChange={(next) => {
            view.setArchiveScope(next);
            onArchiveScopeChange?.(next);
          }}
        />
      ) : null}
    </>
  ) : null;
  const toolbarStartLabel = useUiLabel("toolbarStart");
  const toolbarQueryLabel = useUiLabel("toolbarQuery");
  const toolbarFiltersLabel = useUiLabel("toolbarFilters");
  const toolbarEndLabel = useUiLabel("toolbarEnd");
  const toolbarStartContent = slots?.toolbarStart === undefined ? null : resolveContent(slots.toolbarStart, view.list);
  const toolbarEndContent = slots?.toolbarEnd === undefined ? null : resolveContent(slots.toolbarEnd, view.list);
  const hasToolbarContent =
    hasQueryControls ||
    hasFilterControls ||
    hasRenderableContent(toolbarStartContent) ||
    hasRenderableContent(toolbarEndContent);
  const renderToolbarGroup = (group: KeepCollectionToolbarGroup, content: ReactNode, label: string): ReactNode => {
    if (!hasRenderableContent(content)) return null;
    const labelId = `${toolbarId}-${group}`;
    return (
      <fieldset
        data-keepkit="collection-toolbar-group"
        data-group={group}
        // biome-ignore lint/a11y/noRedundantRoles: Keep the explicit role in the public grouped-toolbar contract.
        role="group"
        aria-labelledby={labelId}
      >
        <legend id={labelId} data-keepkit="collection-toolbar-label">
          {label}
        </legend>
        <div data-keepkit="collection-toolbar-content">{content}</div>
      </fieldset>
    );
  };
  const toolbar = !structuredToolbar ? (
    <div>
      {queryControls}
      {filterControls}
    </div>
  ) : !hasToolbarContent ? null : (
    <div data-keepkit="collection-toolbar" data-variant={toolbarVariant} data-layout={toolbarLayout}>
      {renderToolbarGroup("toolbarStart", toolbarStartContent, toolbarStartLabel)}
      {renderToolbarGroup("query", queryControls, toolbarQueryLabel)}
      {renderToolbarGroup("filters", filterControls, toolbarFiltersLabel)}
      {renderToolbarGroup("toolbarEnd", toolbarEndContent, toolbarEndLabel)}
    </div>
  );

  return (
    <section
      {...rootProps}
      className={className}
      data-keepkit="collection"
      data-layout={layout}
      data-toolbar-variant={toolbarVariant !== "plain" ? toolbarVariant : undefined}
      data-toolbar-layout={toolbarLayout !== "flat" ? toolbarLayout : undefined}
      aria-busy={view.list.isLoading || view.list.isMutating || rootProps["aria-busy"]}
      data-state={getCollectionState(view.list)}
      data-loading={view.list.isLoading || view.list.isMutating ? "true" : undefined}
    >
      {toolbar}
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
        reorderable={reorderable}
        onReorder={reorderable ? handleReorder : undefined}
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
      {reorderable && reorderUndoIds ? (
        <div data-keepkit="reorder-feedback" role="status" aria-live="polite">
          <button type="button" data-keep-action="undo-reorder" onClick={() => void undoReorder()}>
            {reorderUndoLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function getCollectionState<TMeta>(list: KeepListState<TMeta>): "loading" | "error" | "empty" | "ready" {
  if (list.error && list.items.length === 0) return "error";
  if (list.isLoading && !list.isHydrated) return "loading";
  if (list.isHydrated && list.items.length === 0) return "empty";
  return "ready";
}
