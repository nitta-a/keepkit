"use client";

import { type HTMLAttributes, isValidElement, type ReactNode } from "react";
import { renderRoot } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepEmptyStateVariant = "empty-storage" | "empty-filtered";

export type KeepEmptyStateProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  variant?: KeepEmptyStateVariant;
  onClearFilters?: () => void;
  asChild?: boolean;
};

/** An accessible empty state that distinguishes an empty store from an empty filter result. */
export function KeepEmptyState({
  title,
  description,
  action,
  children,
  variant,
  onClearFilters,
  asChild = false,
  className,
  ...rootProps
}: KeepEmptyStateProps) {
  const resolvedVariant = variant ?? "empty-storage";
  const defaultTitle = useUiLabel(resolvedVariant === "empty-filtered" ? "noFilteredItems" : "noItems");
  const defaultDescription = useUiLabel(
    resolvedVariant === "empty-filtered" ? "noFilteredItemsDescription" : "emptyStorageDescription",
  );
  const clearLabel = useUiLabel("clearFilters");
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = contentChildren ?? (
    <>
      <h2>{title ?? defaultTitle}</h2>
      {description ?? <p>{defaultDescription}</p>}
      {action ??
        (resolvedVariant === "empty-filtered" && onClearFilters ? (
          <button type="button" data-keep-action="clear-filters" onClick={onClearFilters}>
            {clearLabel}
          </button>
        ) : null)}
    </>
  );
  return renderRoot(
    asChild,
    children,
    { ...rootProps, className, "data-keepkit": "empty-state", "data-state": variant ?? "empty" },
    body,
    "KeepEmptyState",
  );
}
