"use client";

import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import {
  KeepErrorBoundary,
  type KeepErrorBoundaryProps,
  type UseKeepListResult,
  useKeepList,
} from "@keepkit/core/react";
import { type HTMLAttributes, isValidElement, type ReactNode } from "react";
import type { KeepLayoutPreset } from "./KeepCollection";
import { KeepItemCard, type KeepItemCardProps } from "./KeepItemCard";
import { type RenderProp, renderRoot, resolveContent } from "./shared";
import { useUiLabel } from "./ui-context";

export type KeepListState<TMeta = Record<string, unknown>> = UseKeepListResult<TMeta>;

export type KeepListProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  children?: ReactNode | RenderProp<KeepListState<TMeta>>;
  renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
  loading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  empty?: ReactNode | RenderProp<KeepListState<TMeta>>;
  error?: ReactNode | RenderProp<KeepListState<TMeta>>;
  itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
  layout?: KeepLayoutPreset;
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
  empty,
  error: errorContent,
  itemCardProps,
  layout = "list",
  asChild = false,
  className,
  ...rootProps
}: KeepListProps<TMeta>) {
  const defaultLoading = useUiLabel("loadingItems");
  const defaultEmpty = useUiLabel("noItems");
  const defaultError = useUiLabel("errorItems");
  const state = useKeepList<TMeta>(query);
  const body = getListBody(state, {
    children,
    renderItem,
    loading: loading ?? defaultLoading,
    empty: empty ?? defaultEmpty,
    error: errorContent ?? defaultError,
    itemCardProps,
    layout,
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
    },
    body,
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
    loading: ReactNode | RenderProp<KeepListState<TMeta>>;
    empty: ReactNode | RenderProp<KeepListState<TMeta>>;
    error: ReactNode | RenderProp<KeepListState<TMeta>>;
    itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
    layout: KeepLayoutPreset;
  },
): ReactNode {
  if (state.error && state.items.length === 0) return resolveContent(options.error, state);
  if (state.isLoading && !state.isHydrated) return resolveContent(options.loading, state);
  if (state.isHydrated && state.items.length === 0) return resolveContent(options.empty, state);
  if (typeof options.children === "function") return options.children(state);
  if (options.children !== undefined && !isValidElement(options.children)) return options.children;
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
