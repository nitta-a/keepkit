"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

export type KeepUiLabelKey =
  | "save"
  | "saved"
  | "remove"
  | "loading"
  | "saving"
  | "syncing"
  | "error"
  | "allTags"
  | "filterTags"
  | "note"
  | "saveNote"
  | "noItems"
  | "loadingItems"
  | "errorItems"
  | "search"
  | "sort"
  | "newest"
  | "oldest"
  | "savedNewest"
  | "savedOldest"
  | "updatedNewest"
  | "updatedOldest"
  | "previousPage"
  | "nextPage"
  | "pagination"
  | "page"
  | "selectItems"
  | "selectedCount"
  | "deleteSelected"
  | "tagsToApply"
  | "applyTags"
  | "savedMessage"
  | "removedMessage"
  | "noteSavedMessage";

export type KeepUiLabels = Partial<Record<KeepUiLabelKey, string>>;

export type KeepUiLabelContext = {
  locale?: string;
  labels: Readonly<Record<KeepUiLabelKey, string>>;
  labelResolver?: (key: KeepUiLabelKey, context: { locale?: string }) => string | undefined;
};

export const DEFAULT_LABELS: Record<KeepUiLabelKey, string> = {
  save: "Save",
  saved: "Saved",
  remove: "Remove",
  loading: "Loading…",
  saving: "Saving…",
  syncing: "Syncing…",
  error: "Something went wrong.",
  allTags: "All",
  filterTags: "Filter saved items by tag",
  note: "Note",
  saveNote: "Save note",
  noItems: "No saved items.",
  loadingItems: "Loading saved items…",
  errorItems: "Could not load saved items.",
  search: "Search saved items",
  sort: "Sort saved items",
  newest: "Newest first",
  oldest: "Oldest first",
  savedNewest: "Saved newest first",
  savedOldest: "Saved oldest first",
  updatedNewest: "Updated newest first",
  updatedOldest: "Updated oldest first",
  previousPage: "Previous page",
  nextPage: "Next page",
  pagination: "Pagination",
  page: "Page",
  selectItems: "Select saved items",
  selectedCount: "selected",
  deleteSelected: "Delete selected",
  tagsToApply: "Tags to apply",
  applyTags: "Apply tags",
  savedMessage: "Item saved.",
  removedMessage: "Item removed.",
  noteSavedMessage: "Note saved.",
};

const KeepUiLabelsContext = createContext<KeepUiLabelContext>({ labels: DEFAULT_LABELS });

export type KeepUiProviderProps = {
  labels?: KeepUiLabels;
  locale?: string;
  labelResolver?: KeepUiLabelContext["labelResolver"];
  children?: ReactNode;
};

/** Provides one locale-aware label source to every UI primitive. */
export function KeepUiProvider({ labels, locale, labelResolver, children }: KeepUiProviderProps) {
  const value = useMemo<KeepUiLabelContext>(() => {
    const resolved = { ...DEFAULT_LABELS, ...labels };
    return { locale, labels: resolved, labelResolver };
  }, [labelResolver, labels, locale]);
  return <KeepUiLabelsContext.Provider value={value}>{children}</KeepUiLabelsContext.Provider>;
}

export function useKeepUiLabels(): KeepUiLabelContext {
  return useContext(KeepUiLabelsContext);
}

export function useUiLabel(key: KeepUiLabelKey, override?: string): string {
  const context = useKeepUiLabels();
  return override ?? context.labelResolver?.(key, { locale: context.locale }) ?? context.labels[key];
}
