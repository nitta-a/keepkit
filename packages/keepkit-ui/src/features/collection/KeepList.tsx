"use client";

import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import { KeepErrorBoundary, type KeepErrorBoundaryProps, type UseKeepListResult } from "@keepkit/core/react";
import { type HTMLAttributes, isValidElement, type ReactNode, type Ref } from "react";
import {
  composeRefs,
  KeepSearchQueryProvider,
  type RenderProp,
  renderRoot,
  resolveContent,
} from "../../foundation/shared";
import { KeepItemCard, type KeepItemCardProps, KeepItemCardSkeleton } from "../item/KeepItemCard";
import { KeepEmptyState } from "../status/KeepEmptyState";
import { useKeepListView } from "./hooks/useKeepListView";
import { useRovingTabIndex } from "./hooks/useRovingTabIndex";
import type { KeepLayoutPreset } from "./KeepCollection";
import { KeepReorderableList } from "./KeepReorderableList";

export type KeepListState<TMeta = Record<string, unknown>> = UseKeepListResult<TMeta>;

export type KeepListProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  ref?: Ref<HTMLElement> | { readonly current: unknown };
  query?: KeepListQuery<TMeta>;
  children?: ReactNode | RenderProp<KeepListState<TMeta>>;
  renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
  loading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  /** Alias for `loading`. When neither is provided, layout-matched skeletons are rendered. */
  renderLoading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  loadingCount?: number;
  empty?: ReactNode | RenderProp<KeepListState<TMeta>>;
  error?: ReactNode | RenderProp<KeepListState<TMeta>>;
  onClearFilters?: () => void;
  itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
  layout?: KeepLayoutPreset;
  reorderable?: boolean;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  asChild?: boolean;
  fallback?: KeepErrorBoundaryProps["fallback"];
  onBoundaryError?: KeepErrorBoundaryProps["onError"];
  boundaryResetKey?: unknown;
};

/** A list primitive with built-in loading, empty, error, and removal states. */
export function KeepList<TMeta = Record<string, unknown>>(props: KeepListProps<TMeta>) {
  const { fallback, onBoundaryError, boundaryResetKey, ...listProps } = props;
  const content = <KeepListContent<TMeta> {...listProps} />;
  if (fallback === undefined && onBoundaryError === undefined) return content;
  return (
    <KeepErrorBoundary fallback={fallback} onError={onBoundaryError} resetKey={boundaryResetKey}>
      {content}
    </KeepErrorBoundary>
  );
}

function KeepListContent<TMeta = Record<string, unknown>>({
  query,
  children,
  renderItem,
  loading,
  renderLoading,
  loadingCount = 6,
  empty,
  error: errorContent,
  onClearFilters,
  itemCardProps,
  layout = "list",
  reorderable = false,
  onReorder,
  asChild = false,
  onKeyDown,
  onFocusCapture,
  className,
  ...rootProps
}: KeepListProps<TMeta>) {
  const view = useKeepListView<TMeta>(query);
  const roving = useRovingTabIndex<HTMLDivElement>();
  const { state } = view;
  const body = getListBody(state, {
    children,
    renderItem,
    loading: renderLoading !== undefined ? renderLoading : loading,
    loadingCount,
    loadingLabel: view.labels.loading,
    empty,
    error: errorContent ?? view.labels.error,
    onClearFilters,
    allItemCount: view.allState.totalCount,
    query,
    itemCardProps,
    layout,
    reorderable,
    onReorder,
    reorder: state.reorder,
  });
  return renderRoot(
    asChild,
    asChild && isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "data-keepkit": "list",
      "data-layout": layout,
      "aria-busy": state.isLoading || rootProps["aria-busy"],
      "data-state": getListState(state),
      "data-loading": state.isLoading ? "true" : undefined,
      "data-roving-tabindex": "true",
      role: rootProps.role ?? "group",
      ref: composeRefs(roving.ref as Ref<HTMLElement>, rootProps.ref as Ref<HTMLElement>),
      onKeyDown: (event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) roving.onKeyDown(event);
      },
      onFocusCapture: (event) => {
        onFocusCapture?.(event);
        if (!event.defaultPrevented) roving.onFocusCapture(event);
      },
    },
    <KeepSearchQueryProvider query={query?.search?.query}>{body}</KeepSearchQueryProvider>,
    "KeepList",
  );
}

function getListState<TMeta>(state: KeepListState<TMeta>): "loading" | "error" | "empty" | "ready" {
  if (state.error && state.items.length === 0) return "error";
  if (state.isLoading && !state.isHydrated) return "loading";
  if (state.isHydrated && state.items.length === 0) return "empty";
  return "ready";
}

function getListBody<TMeta>(
  state: KeepListState<TMeta>,
  options: {
    children?: ReactNode | RenderProp<KeepListState<TMeta>>;
    renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
    loading: ReactNode | RenderProp<KeepListState<TMeta>> | undefined;
    loadingCount: number;
    loadingLabel: string;
    empty: ReactNode | RenderProp<KeepListState<TMeta>> | undefined;
    error: ReactNode | RenderProp<KeepListState<TMeta>>;
    onClearFilters?: () => void;
    allItemCount: number;
    query: KeepListQuery<TMeta> | undefined;
    itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
    layout: KeepLayoutPreset;
    reorderable: boolean;
    onReorder?: (orderedIds: string[]) => void | Promise<void>;
    reorder: (orderedIds: string[]) => Promise<void>;
  },
): ReactNode {
  if (state.error && state.items.length === 0) return resolveContent(options.error, state);
  if (state.isLoading && !state.isHydrated) {
    if (options.loading !== undefined) return resolveContent(options.loading, state);
    const count = Number.isFinite(options.loadingCount) ? Math.max(0, Math.floor(options.loadingCount)) : 6;
    return (
      <>
        <span role="status" data-keepkit="loading-label">
          {options.loadingLabel}
        </span>
        <ul data-keepkit="skeleton-list" data-layout={options.layout}>
          {Array.from({ length: count }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static loading placeholders never reorder.
            <li key={index}>
              <KeepItemCardSkeleton layout={options.layout} />
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (state.isHydrated && state.items.length === 0) {
    if (options.empty !== undefined) return resolveContent(options.empty, state);
    return (
      <KeepEmptyState
        variant={options.allItemCount > 0 && hasActiveQueryFilters(options.query) ? "empty-filtered" : "empty-storage"}
        onClearFilters={options.onClearFilters}
      />
    );
  }
  if (typeof options.children === "function") return options.children(state);
  if (options.children !== undefined && !isValidElement(options.children)) return options.children;
  if (options.reorderable) {
    return (
      <KeepReorderableList
        items={state.items}
        onReorder={async (orderedIds) => {
          await options.reorder(orderedIds);
          await options.onReorder?.(orderedIds);
        }}
        renderItem={(item, reorderState) => (
          <>
            <button type="button" {...reorderState.dragHandleProps}>
              ↕
            </button>
            {options.renderItem ? (
              options.renderItem(item, state)
            ) : (
              <KeepItemCard item={item} {...options.itemCardProps} />
            )}
          </>
        )}
        data-layout={options.layout}
      />
    );
  }
  return (
    <ul data-layout={options.layout}>
      {state.items.map((item) =>
        options.renderItem ? (
          options.renderItem(item, state)
        ) : (
          <li key={item.id}>
            <KeepItemCard item={item} {...options.itemCardProps} />
          </li>
        ),
      )}
    </ul>
  );
}

function hasActiveQueryFilters<TMeta>(query: KeepListQuery<TMeta> | undefined): boolean {
  if (!query) return false;
  return Boolean(
    query.search?.query?.trim() ||
      query.tags?.some((tag) => tag.trim()) ||
      query.targetType ||
      query.savedBetween ||
      (query.archiveScope !== undefined && query.archiveScope !== "active") ||
      query.collectionId ||
      query.filter,
  );
}
