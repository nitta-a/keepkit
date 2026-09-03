"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import { type HTMLAttributes, isValidElement, type ReactElement, type ReactNode } from "react";
import { type RenderProp, renderRoot } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepActiveFiltersSummaryProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> & {
  query?: KeepListQuery<TMeta>;
  search?: string;
  tags?: readonly string[];
  onSearchChange?: (value: string) => void;
  onTagChange?: (tag: string) => void;
  onClear?: () => void;
  children?: ReactNode | RenderProp<KeepActiveFiltersSummaryState>;
  asChild?: boolean;
};

export type KeepActiveFiltersSummaryState = {
  search: string;
  tags: string[];
  hasFilters: boolean;
  clear: () => void;
  removeSearch: () => void;
  removeTag: (tag: string) => void;
};

/** Lists active search and tag filters with one-tap recovery actions. */
export function KeepActiveFiltersSummary<TMeta = Record<string, unknown>>({
  query,
  search: providedSearch,
  tags: providedTags,
  onSearchChange,
  onTagChange,
  onClear,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepActiveFiltersSummaryProps<TMeta>) {
  const search = (providedSearch ?? query?.search?.query ?? "").trim();
  const tags = normalizeTags(providedTags ?? query?.tags ?? []);
  const hasFilters = Boolean(search) || tags.length > 0;
  const activeFiltersLabel = useUiLabel("activeFilters");
  const clearAllLabel = useUiLabel("clearAllFilters");
  const clearLabel = useUiLabel("clearFilters");
  const removeLabel = useUiLabel("removeFilter");
  const state: KeepActiveFiltersSummaryState = {
    search,
    tags,
    hasFilters,
    clear: () => onClear?.(),
    removeSearch: () => onSearchChange?.(""),
    removeTag: (tag) => onTagChange?.(tag),
  };
  const contentChildren = asChild && isElement(children) ? undefined : children;
  const body =
    typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ??
        (hasFilters ? (
          <>
            <span data-active-filters-label="true">{activeFiltersLabel}</span>
            <ul data-active-filters-list="true">
              {search ? (
                <li data-filter-kind="search">
                  <span data-filter-value="true">{search}</span>
                  <button
                    type="button"
                    data-keep-action="remove-search-filter"
                    aria-label={`${search} ${removeLabel}`}
                    onClick={state.removeSearch}
                  >
                    ×
                  </button>
                </li>
              ) : null}
              {tags.map((tag) => (
                <li key={tag} data-filter-kind="tag">
                  <span data-filter-value="true">{tag}</span>
                  <button
                    type="button"
                    data-keep-action="remove-tag-filter"
                    aria-label={`${tag} ${removeLabel}`}
                    onClick={() => state.removeTag(tag)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" data-keep-action="clear-filters" onClick={state.clear}>
              {clearAllLabel || clearLabel}
            </button>
          </>
        ) : null));

  if (!hasFilters && !asChild && contentChildren === undefined) return null;
  return renderRoot(
    asChild,
    isElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "data-keepkit": "active-filters",
      "data-state": hasFilters ? "active" : "idle",
      "aria-label": rootProps["aria-label"] ?? activeFiltersLabel,
    },
    body,
    "KeepActiveFiltersSummary",
  );
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function isElement(value: unknown): value is ReactElement {
  return isValidElement(value);
}
