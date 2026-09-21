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
import { normalizeUiTags, type RenderProp, renderRoot } from "../../foundation/shared";
import { useKeepUiLabels, useUiLabel, useUiLabelVisibility } from "../../foundation/ui-context";

export type KeepActiveFiltersSummaryProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> & {
  ref?: Ref<HTMLElement> | { readonly current: unknown };
  query?: KeepListQuery<TMeta>;
  search?: string;
  tags?: readonly string[];
  collection?: string;
  collectionLabel?: string;
  activity?: KeepListQuery<TMeta>["activity"];
  activityLabel?: string;
  archiveScope?: KeepListQuery<TMeta>["archiveScope"];
  archiveScopeLabel?: string;
  totalCount?: number;
  onSearchChange?: (value: string) => void;
  onTagChange?: (tag: string) => void;
  onCollectionChange?: (collectionId?: string) => void;
  onActivityChange?: (activity?: KeepListQuery<TMeta>["activity"]) => void;
  onArchiveScopeChange?: (scope: NonNullable<KeepListQuery<TMeta>["archiveScope"]>) => void;
  onClear?: () => void;
  children?: ReactNode | RenderProp<KeepActiveFiltersSummaryState>;
  asChild?: boolean;
};

export type KeepActiveFiltersSummaryState = {
  search: string;
  tags: string[];
  collection?: string;
  activity?: KeepListQuery["activity"];
  archiveScope?: KeepListQuery["archiveScope"];
  totalCount?: number;
  hasFilters: boolean;
  clear: () => void;
  removeSearch: () => void;
  removeTag: (tag: string) => void;
  removeCollection: () => void;
  removeActivity: () => void;
  removeArchiveScope: () => void;
};

/** Lists active query filters with one-tap recovery actions. */
export function KeepActiveFiltersSummary<TMeta = Record<string, unknown>>({
  query,
  search: providedSearch,
  tags: providedTags,
  collection: providedCollection,
  collectionLabel: providedCollectionLabel,
  activity: providedActivity,
  activityLabel: providedActivityLabel,
  archiveScope: providedArchiveScope,
  archiveScopeLabel: providedArchiveScopeLabel,
  totalCount,
  onSearchChange,
  onTagChange,
  onCollectionChange,
  onActivityChange,
  onArchiveScopeChange,
  onClear,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepActiveFiltersSummaryProps<TMeta>) {
  const search = (providedSearch ?? query?.search?.query ?? "").trim();
  const tags = normalizeUiTags(providedTags ?? query?.tags ?? []);
  const collection = providedCollection ?? query?.collectionId;
  const activity = providedActivity ?? query?.activity;
  const hasActivity = Boolean(activity && Object.keys(activity).length > 0);
  const archiveScope =
    providedArchiveScope ?? query?.archiveScope ?? (query?.archived === true ? "archived" : "active");
  const hasArchiveScope = archiveScope !== undefined && archiveScope !== "active";
  const hasFilters = Boolean(search) || tags.length > 0 || Boolean(collection) || hasActivity || hasArchiveScope;
  const activeFiltersLabel = useUiLabel("activeFilters");
  const showActiveFiltersLabel = useUiLabelVisibility("activeFilters");
  const clearAllLabel = useUiLabel("clearAllFilters");
  const clearLabel = useUiLabel("clearFilters");
  const removeLabel = useUiLabel("removeFilter");
  const uncategorizedLabel = useUiLabel("uncategorized");
  const collectionItemLabel = useUiLabel("collectionItem");
  const collectionItemsLabel = useUiLabel("collectionItems");
  const collectionLabel =
    providedCollectionLabel ?? (collection === "__uncategorized__" ? uncategorizedLabel : collection);
  const archiveLabels = {
    active: useUiLabel("archiveScopeActive"),
    archived: useUiLabel("archiveScopeArchived"),
    all: useUiLabel("archiveScopeAll"),
  };
  const activityLabels = {
    neverOpened: useUiLabel("activityNeverOpened"),
    opened: useUiLabel("activityOpened"),
    inactiveFor: useUiLabel("activityInactiveFor"),
    before: useUiLabel("activityBefore"),
    after: useUiLabel("activityAfter"),
  };
  const { locale } = useKeepUiLabels();
  const resolvedActivityLabel = providedActivityLabel ?? formatActivity(activity, activityLabels, locale);
  const resolvedArchiveScopeLabel =
    providedArchiveScopeLabel ?? (archiveScope === undefined ? undefined : archiveLabels[archiveScope]);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const collectionIndex = Number(Boolean(search)) + tags.length;
  const activityIndex = collectionIndex + Number(Boolean(collection));
  const archiveScopeIndex = activityIndex + Number(hasActivity);
  const filterCount = archiveScopeIndex + Number(hasArchiveScope);

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
  function removeCollection(event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(collectionIndex, event.currentTarget);
    onCollectionChange?.(undefined);
  }
  function removeActivity(event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(activityIndex, event.currentTarget);
    onActivityChange?.(undefined);
  }
  function removeArchiveScope(event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(archiveScopeIndex, event.currentTarget);
    onArchiveScopeChange?.("active");
  }
  const state: KeepActiveFiltersSummaryState = {
    search,
    tags,
    collection,
    activity,
    archiveScope,
    totalCount,
    hasFilters,
    clear: () => onClear?.(),
    removeSearch: () => onSearchChange?.(""),
    removeTag: (tag) => onTagChange?.(tag),
    removeCollection: () => onCollectionChange?.(undefined),
    removeActivity: () => onActivityChange?.(undefined),
    removeArchiveScope: () => onArchiveScopeChange?.("active"),
  };
  const contentChildren = asChild && isElement(children) ? undefined : children;
  const body =
    typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ??
        (hasFilters ? (
          <>
            {showActiveFiltersLabel ? <span data-active-filters-label="true">{activeFiltersLabel}</span> : null}
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
              {collection && collectionLabel ? (
                <li data-filter-kind="collection">
                  <span data-filter-value="true">{collectionLabel}</span>
                  <button
                    type="button"
                    data-keep-action="remove-collection-filter"
                    aria-label={`${collectionLabel} ${removeLabel}`}
                    ref={(element) => {
                      chipRefs.current[collectionIndex] = element;
                    }}
                    onKeyDown={(event) => handleChipKeyDown(event, collectionIndex)}
                    onClick={removeCollection}
                  >
                    ×
                  </button>
                </li>
              ) : null}
              {hasActivity ? (
                <li data-filter-kind="activity">
                  <span data-filter-value="true">{resolvedActivityLabel}</span>
                  <button
                    type="button"
                    data-keep-action="remove-activity-filter"
                    aria-label={`${resolvedActivityLabel} ${removeLabel}`}
                    ref={(element) => {
                      chipRefs.current[activityIndex] = element;
                    }}
                    onKeyDown={(event) => handleChipKeyDown(event, activityIndex)}
                    onClick={removeActivity}
                  >
                    ×
                  </button>
                </li>
              ) : null}
              {hasArchiveScope && resolvedArchiveScopeLabel ? (
                <li data-filter-kind="archive-scope">
                  <span data-filter-value="true">{resolvedArchiveScopeLabel}</span>
                  <button
                    type="button"
                    data-keep-action="remove-archive-scope-filter"
                    aria-label={`${resolvedArchiveScopeLabel} ${removeLabel}`}
                    ref={(element) => {
                      chipRefs.current[archiveScopeIndex] = element;
                    }}
                    onKeyDown={(event) => handleChipKeyDown(event, archiveScopeIndex)}
                    onClick={removeArchiveScope}
                  >
                    ×
                  </button>
                </li>
              ) : null}
            </ul>
            {totalCount !== undefined ? (
              <span data-filter-count="true">
                {totalCount} {totalCount === 1 ? collectionItemLabel : collectionItemsLabel}
              </span>
            ) : null}
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

function formatActivity(
  activity: KeepListQuery["activity"],
  labels: {
    neverOpened: string;
    opened: string;
    inactiveFor: string;
    before: string;
    after: string;
  },
  locale?: string,
): string | undefined {
  if (!activity || Object.keys(activity).length === 0) return undefined;
  if (activity.opened === "never") return labels.neverOpened;
  if (activity.opened === "ever") return labels.opened;
  if (activity.inactiveForMs !== undefined) {
    const days = Math.max(1, Math.round(activity.inactiveForMs / (24 * 60 * 60 * 1000)));
    return `${days}${locale?.toLowerCase().startsWith("ja") ? "" : " "}${labels.inactiveFor}`;
  }
  if (activity.lastOpenedBefore !== undefined) {
    return `${labels.before} ${new Date(activity.lastOpenedBefore).toLocaleDateString(locale)}`;
  }
  if (activity.lastOpenedAfter !== undefined) {
    return `${labels.after} ${new Date(activity.lastOpenedAfter).toLocaleDateString(locale)}`;
  }
  return undefined;
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
