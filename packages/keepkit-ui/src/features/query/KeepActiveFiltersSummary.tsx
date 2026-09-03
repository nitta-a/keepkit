"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import {
  type HTMLAttributes,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useRef,
} from "react";
import { type RenderProp, renderRoot } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepActiveFiltersSummaryProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> & {
  ref?: Ref<HTMLElement> | { readonly current: unknown };
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
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const filterCount = Number(Boolean(search)) + tags.length;

  function focusChip(index: number): void {
    chipRefs.current[index]?.focus();
  }

  function focusAfterRemoval(index: number, source: HTMLElement): void {
    const summaryRoot = source.closest<HTMLElement>('[data-keepkit="active-filters"]');
    const fallbackScope =
      source.closest<HTMLElement>('[data-keepkit="collection"]') ?? summaryRoot?.parentElement ?? source.parentElement;
    queueMicrotask(() => {
      const nextIndex = index < filterCount - 1 ? index : index - 1;
      const nextChip = nextIndex >= 0 ? chipRefs.current[nextIndex] : null;
      if (nextChip?.isConnected) {
        nextChip.focus();
        return;
      }
      focusFilterFallback(fallbackScope);
    });
  }

  function handleChipKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const nextIndex = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : -1;
    if (nextIndex < 0 || nextIndex >= filterCount || !chipRefs.current[nextIndex]) return;
    event.preventDefault();
    focusChip(nextIndex);
  }

  function removeSearch(event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(0, event.currentTarget);
    onSearchChange?.("");
  }

  function removeTag(tag: string, index: number, event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(index, event.currentTarget);
    onTagChange?.(tag);
  }
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
                    ref={(element) => {
                      chipRefs.current[0] = element;
                    }}
                    onKeyDown={(event) => handleChipKeyDown(event, 0)}
                    onClick={removeSearch}
                  >
                    ×
                  </button>
                </li>
              ) : null}
              {tags.map((tag, tagIndex) => (
                <li key={tag} data-filter-kind="tag">
                  <span data-filter-value="true">{tag}</span>
                  <button
                    type="button"
                    data-keep-action="remove-tag-filter"
                    aria-label={`${tag} ${removeLabel}`}
                    ref={(element) => {
                      chipRefs.current[tagIndex + Number(Boolean(search))] = element;
                    }}
                    onKeyDown={(event) => handleChipKeyDown(event, tagIndex + Number(Boolean(search)))}
                    onClick={(event) => removeTag(tag, tagIndex + Number(Boolean(search)), event)}
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

function focusFilterFallback(scope: HTMLElement | null): void {
  const searchInput = scope?.querySelector<HTMLElement>('[data-keep-action="search"]');
  if (searchInput) {
    searchInput.focus();
    return;
  }

  const listCard = scope?.querySelector<HTMLElement>('[data-keepkit="card"][tabindex="0"]');
  if (listCard) {
    listCard.focus();
    return;
  }

  const list = scope?.querySelector<HTMLElement>('[data-keepkit="list"]');
  if (list) {
    if (!list.hasAttribute("tabindex")) list.tabIndex = -1;
    list.focus();
  }
}
