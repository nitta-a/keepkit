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
  organization?: KeepListQuery<TMeta>["organization"];
  savedBetween?: KeepListQuery<TMeta>["savedBetween"];
  activity?: KeepListQuery<TMeta>["activity"];
  activityLabel?: string;
  archiveScope?: KeepListQuery<TMeta>["archiveScope"];
  archiveScopeLabel?: string;
  totalCount?: number;
  onSearchChange?: (value: string) => void;
  onTagChange?: (tag: string) => void;
  onCollectionChange?: (collectionId?: string) => void;
  onOrganizationChange?: (organization?: KeepListQuery<TMeta>["organization"]) => void;
  onSavedBetweenChange?: (range?: KeepListQuery<TMeta>["savedBetween"]) => void;
  onActivityChange?: (activity?: KeepListQuery<TMeta>["activity"]) => void;
  onArchiveScopeChange?: (scope: NonNullable<KeepListQuery<TMeta>["archiveScope"]>) => void;
  onClear?: () => void;
  onReset?: () => void;
  canReset?: boolean;
  children?: ReactNode | RenderProp<KeepActiveFiltersSummaryState>;
  asChild?: boolean;
};

export type KeepActiveFiltersSummaryState = {
  search: string;
  tags: string[];
  collection?: string;
  organization?: KeepListQuery["organization"];
  savedBetween?: KeepListQuery["savedBetween"];
  activity?: KeepListQuery["activity"];
  archiveScope?: KeepListQuery["archiveScope"];
  totalCount?: number;
  hasFilters: boolean;
  clear: () => void;
  removeSearch: () => void;
  removeTag: (tag: string) => void;
  removeCollection: () => void;
  removeOrganization: (field: "collection" | "tags" | "note") => void;
  removeSavedBetween: () => void;
  removeActivity: () => void;
  removeArchiveScope: () => void;
  reset: () => void;
};

type ActivityFilterKey = "opened" | "inactiveForMs" | "lastOpenedBefore" | "lastOpenedAfter";
type ActivityFilter = { key: ActivityFilterKey; label: string };

/** Lists active query filters with one-tap recovery actions. */
export function KeepActiveFiltersSummary<TMeta = Record<string, unknown>>({
  query,
  search: providedSearch,
  tags: providedTags,
  collection: providedCollection,
  collectionLabel: providedCollectionLabel,
  organization: providedOrganization,
  savedBetween: providedSavedBetween,
  activity: providedActivity,
  activityLabel: providedActivityLabel,
  archiveScope: providedArchiveScope,
  archiveScopeLabel: providedArchiveScopeLabel,
  totalCount,
  onSearchChange,
  onTagChange,
  onCollectionChange,
  onOrganizationChange,
  onSavedBetweenChange,
  onActivityChange,
  onArchiveScopeChange,
  onClear,
  onReset,
  canReset = false,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepActiveFiltersSummaryProps<TMeta>) {
  const search = (providedSearch ?? query?.search?.query ?? "").trim();
  const tags = normalizeUiTags(providedTags ?? query?.tags ?? []);
  const collection = providedCollection ?? query?.collectionId;
  const organization = providedOrganization ?? query?.organization;
  const savedBetween = providedSavedBetween ?? query?.savedBetween;
  const activity = providedActivity ?? query?.activity;
  const activityLabels = {
    neverOpened: useUiLabel("activityNeverOpened"),
    opened: useUiLabel("activityOpened"),
    inactiveSuffix: useUiLabel("activityInactiveSuffix"),
    before: useUiLabel("activityBefore"),
    after: useUiLabel("activityAfter"),
  };
  const { locale } = useKeepUiLabels();
  const formattedActivityFilters = formatActivity(activity, activityLabels, locale);
  const activityFilters =
    providedActivityLabel && formattedActivityFilters.length === 1
      ? [{ ...formattedActivityFilters[0], label: providedActivityLabel }]
      : formattedActivityFilters;
  const hasActivity = activityFilters.length > 0;
  const organizationFilters = organization
    ? (["collection", "tags", "note"] as const).flatMap((field) =>
        organization[field] ? [{ field, value: organization[field] }] : [],
      )
    : [];
  const savedBetweenLabel = savedBetween
    ? savedBetween
        .map((value) => new Date(value instanceof Date ? value.getTime() : value).toLocaleDateString(locale))
        .join(" – ")
    : undefined;
  const archiveScope =
    providedArchiveScope ?? query?.archiveScope ?? (query?.archived === true ? "archived" : "active");
  const hasArchiveScope = archiveScope !== undefined && archiveScope !== "active";
  const hasFilters =
    Boolean(search) ||
    tags.length > 0 ||
    Boolean(collection) ||
    organizationFilters.length > 0 ||
    Boolean(savedBetween) ||
    hasActivity ||
    hasArchiveScope;
  const activeFiltersLabel = useUiLabel("activeFilters");
  const showActiveFiltersLabel = useUiLabelVisibility("activeFilters");
  const clearAllLabel = useUiLabel("clearAllFilters");
  const clearLabel = useUiLabel("clearFilters");
  const resetLabel = useUiLabel("resetFilters");
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
  const resolvedArchiveScopeLabel =
    providedArchiveScopeLabel ?? (archiveScope === undefined ? undefined : archiveLabels[archiveScope]);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const collectionIndex = Number(Boolean(search)) + tags.length;
  const organizationIndex = collectionIndex + Number(Boolean(collection));
  const activityIndex = organizationIndex + organizationFilters.length;
  const savedBetweenIndex = activityIndex + activityFilters.length;
  const archiveScopeIndex = savedBetweenIndex + Number(Boolean(savedBetween));
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
  function removeOrganization(
    field: "collection" | "tags" | "note",
    index: number,
    event: MouseEvent<HTMLButtonElement>,
  ): void {
    focusAfterRemoval(index, event.currentTarget);
    if (!organization) return;
    const next = { ...organization };
    delete next[field];
    onOrganizationChange?.(Object.keys(next).length > 0 ? next : undefined);
  }
  function removeSavedBetween(event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(savedBetweenIndex, event.currentTarget);
    onSavedBetweenChange?.(undefined);
  }
  function removeActivityCondition(key: ActivityFilterKey, index: number, event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(index, event.currentTarget);
    if (!activity) return;
    const next = { ...activity };
    delete next[key];
    onActivityChange?.(Object.keys(next).length > 0 ? next : undefined);
  }
  function removeArchiveScope(event: MouseEvent<HTMLButtonElement>): void {
    focusAfterRemoval(archiveScopeIndex, event.currentTarget);
    onArchiveScopeChange?.("active");
  }
  const state: KeepActiveFiltersSummaryState = {
    search,
    tags,
    collection,
    organization,
    savedBetween,
    activity,
    archiveScope,
    totalCount,
    hasFilters,
    clear: () => onClear?.(),
    removeSearch: () => onSearchChange?.(""),
    removeTag: (tag) => onTagChange?.(tag),
    removeCollection: () => onCollectionChange?.(undefined),
    removeOrganization: (field) => {
      if (!organization) return;
      const next = { ...organization };
      delete next[field];
      onOrganizationChange?.(Object.keys(next).length > 0 ? next : undefined);
    },
    removeSavedBetween: () => onSavedBetweenChange?.(undefined),
    removeActivity: () => onActivityChange?.(undefined),
    removeArchiveScope: () => onArchiveScopeChange?.("active"),
    reset: () => onReset?.(),
  };
  const contentChildren = asChild && isElement(children) ? undefined : children;
  const body =
    typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ??
        (hasFilters || canReset ? (
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
              {organizationFilters.map(({ field, value }, filterIndex) => {
                const index = organizationIndex + filterIndex;
                const label = `${field}: ${value}`;
                return (
                  <li key={`organization-${field}`} data-filter-kind={`organization-${field}`}>
                    <span data-filter-value="true">{label}</span>
                    <button
                      type="button"
                      data-keep-action="remove-organization-filter"
                      aria-label={`${label} ${removeLabel}`}
                      ref={(element) => {
                        chipRefs.current[index] = element;
                      }}
                      onKeyDown={(event) => handleChipKeyDown(event, index)}
                      onClick={(event) => removeOrganization(field, index, event)}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
              {activityFilters.map((filter, filterIndex) => {
                const index = activityIndex + filterIndex;
                return (
                  <li key={filter.key} data-filter-kind={`activity-${filter.key}`}>
                    <span data-filter-value="true">{filter.label}</span>
                    <button
                      type="button"
                      data-keep-action="remove-activity-filter"
                      aria-label={`${filter.label} ${removeLabel}`}
                      ref={(element) => {
                        chipRefs.current[index] = element;
                      }}
                      onKeyDown={(event) => handleChipKeyDown(event, index)}
                      onClick={(event) => removeActivityCondition(filter.key, index, event)}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
              {savedBetweenLabel ? (
                <li data-filter-kind="saved-between">
                  <span data-filter-value="true">{savedBetweenLabel}</span>
                  <button
                    type="button"
                    data-keep-action="remove-saved-between-filter"
                    aria-label={`${savedBetweenLabel} ${removeLabel}`}
                    ref={(element) => {
                      chipRefs.current[savedBetweenIndex] = element;
                    }}
                    onKeyDown={(event) => handleChipKeyDown(event, savedBetweenIndex)}
                    onClick={removeSavedBetween}
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
            {hasFilters ? (
              <button type="button" data-keep-action="clear-filters" onClick={state.clear}>
                {clearAllLabel || clearLabel}
              </button>
            ) : null}
            {canReset ? (
              <button type="button" data-keep-action="reset-filters" onClick={state.reset}>
                {resetLabel}
              </button>
            ) : null}
          </>
        ) : null));

  if (!hasFilters && !canReset && !asChild && contentChildren === undefined) return null;
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
    inactiveSuffix: string;
    before: string;
    after: string;
  },
  locale?: string,
): ActivityFilter[] {
  if (!activity) return [];
  const filters: ActivityFilter[] = [];
  if (activity.opened === "never") filters.push({ key: "opened", label: labels.neverOpened });
  if (activity.opened === "ever") filters.push({ key: "opened", label: labels.opened });
  if (activity.inactiveForMs !== undefined) {
    filters.push({
      key: "inactiveForMs",
      label: `${formatDuration(activity.inactiveForMs, locale)}${isCjkLocale(locale) ? "" : " "}${labels.inactiveSuffix}`,
    });
  }
  if (activity.lastOpenedBefore !== undefined) {
    filters.push({
      key: "lastOpenedBefore",
      label: `${labels.before} ${new Date(activity.lastOpenedBefore).toLocaleDateString(locale)}`,
    });
  }
  if (activity.lastOpenedAfter !== undefined) {
    filters.push({
      key: "lastOpenedAfter",
      label: `${labels.after} ${new Date(activity.lastOpenedAfter).toLocaleDateString(locale)}`,
    });
  }
  return filters;
}

function formatDuration(milliseconds: number, locale?: string): string {
  const absolute = Math.max(1, Math.round(milliseconds));
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const unit = absolute < hour ? "minute" : absolute < day ? "hour" : "day";
  const value =
    unit === "minute"
      ? Math.max(1, Math.round(absolute / (60 * 1000)))
      : unit === "hour"
        ? Math.max(1, Math.round(absolute / hour))
        : Math.max(1, Math.round(absolute / day));
  const formatted = new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(value);
  const compact = isCjkLocale(locale) ? formatted.replace(/\s+/g, "") : formatted;
  return /^ja/i.test(locale ?? "") && unit === "day" ? compact.replace(/日$/, "日間") : compact;
}

function isCjkLocale(locale?: string): boolean {
  return /^(?:ja|ko|zh)/i.test(locale ?? "");
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
