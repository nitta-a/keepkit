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
  | "tags"
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
  | "undo"
  | "undoAvailable"
  | "selectionScope"
  | "currentPage"
  | "searchResults"
  | "allItems"
  | "statusAvailable"
  | "noteSavedMessage"
  | "exportData"
  | "importData"
  | "importMode"
  | "merge"
  | "replace"
  | "importedCount"
  | "failedCount"
  | "storageQuotaError"
  | "statusExpired"
  | "statusRemoved"
  | "statusDeleted"
  | "statusPrivate"
  | "statusUnknown";

export type KeepUiLabels = Partial<Record<KeepUiLabelKey, string>>;

export type KeepUiLabelContext = {
  locale?: string;
  labels: Readonly<Record<KeepUiLabelKey, string>>;
  customLabels?: KeepUiLabels;
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
  tags: "Tags",
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
  undo: "Undo",
  undoAvailable: "Item removed. Undo?",
  selectionScope: "Selection scope",
  currentPage: "Current page",
  searchResults: "Current search results",
  allItems: "All saved items",
  statusAvailable: "Available",
  noteSavedMessage: "Note saved.",
  exportData: "Export JSON",
  importData: "Import JSON",
  importMode: "Import mode",
  merge: "Merge",
  replace: "Replace",
  importedCount: "items imported",
  failedCount: "items failed",
  storageQuotaError: "Storage is full. Free space and try again.",
  statusExpired: "Expired",
  statusRemoved: "Removed",
  statusDeleted: "Deleted",
  statusPrivate: "Private",
  statusUnknown: "Unavailable",
};

export const KEEP_LOCALE_LABELS: Record<string, KeepUiLabels> = {
  ja: {
    save: "保存",
    saved: "保存済み",
    remove: "削除",
    loading: "読み込み中…",
    saving: "保存中…",
    syncing: "同期中…",
    allTags: "すべて",
    filterTags: "保存アイテムをタグで絞り込む",
    note: "メモ",
    saveNote: "メモを保存",
    loadingItems: "保存アイテムを読み込み中…",
    errorItems: "保存アイテムを読み込めませんでした。",
    noItems: "保存されたアイテムはありません。",
    search: "保存アイテムを検索",
    sort: "保存アイテムを並べ替え",
    newest: "新しい順",
    oldest: "古い順",
    savedNewest: "保存日時の新しい順",
    savedOldest: "保存日時の古い順",
    updatedNewest: "更新日時の新しい順",
    updatedOldest: "更新日時の古い順",
    previousPage: "前のページ",
    nextPage: "次のページ",
    pagination: "ページネーション",
    page: "ページ",
    selectItems: "保存アイテムを選択",
    selectedCount: "件を選択中",
    deleteSelected: "選択項目を削除",
    undo: "元に戻す",
    undoAvailable: "アイテムを削除しました。元に戻しますか？",
    selectionScope: "選択範囲",
    currentPage: "表示中のページ",
    searchResults: "現在の検索結果全体",
    allItems: "すべての保存アイテム",
    tags: "タグ",
    statusAvailable: "利用可能",
    tagsToApply: "適用するタグ",
    applyTags: "タグを適用",
  },
  ko: {
    save: "저장",
    saved: "저장됨",
    remove: "삭제",
    loading: "로드 중…",
    saving: "저장 중…",
    syncing: "동기화 중…",
    noItems: "저장된 항목이 없습니다.",
    search: "저장된 항목 검색",
    sort: "저장된 항목 정렬",
    previousPage: "이전 페이지",
    nextPage: "다음 페이지",
    pagination: "페이지 매김",
    page: "페이지",
    undo: "실행 취소",
    undoAvailable: "항목을 삭제했습니다. 실행 취소할까요?",
    selectionScope: "선택 범위",
    currentPage: "현재 페이지",
    searchResults: "현재 검색 결과 전체",
    allItems: "모든 저장 항목",
    tags: "태그",
  },
  "zh-CN": {
    save: "保存",
    saved: "已保存",
    remove: "删除",
    loading: "加载中…",
    saving: "保存中…",
    syncing: "同步中…",
    noItems: "没有已保存的项目。",
    search: "搜索已保存项目",
    sort: "排序已保存项目",
    previousPage: "上一页",
    nextPage: "下一页",
    pagination: "分页",
    page: "页",
    undo: "撤销",
    undoAvailable: "项目已删除。要撤销吗？",
    selectionScope: "选择范围",
    currentPage: "当前页",
    searchResults: "当前搜索结果",
    allItems: "全部已保存项目",
    tags: "标签",
  },
  "zh-TW": {
    save: "儲存",
    saved: "已儲存",
    remove: "刪除",
    loading: "載入中…",
    saving: "儲存中…",
    syncing: "同步中…",
    noItems: "沒有已儲存的項目。",
    search: "搜尋已儲存項目",
    sort: "排序已儲存項目",
    previousPage: "上一頁",
    nextPage: "下一頁",
    undo: "復原",
    undoAvailable: "項目已刪除。要復原嗎？",
    selectionScope: "選取範圍",
    currentPage: "目前頁面",
    searchResults: "目前搜尋結果",
    allItems: "所有已儲存項目",
    tags: "標籤",
  },
};

KEEP_LOCALE_LABELS.zh = KEEP_LOCALE_LABELS["zh-CN"];

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
    const localeKey = locale?.toLowerCase() ?? "en";
    const dictionary = KEEP_LOCALE_LABELS[localeKey] ?? KEEP_LOCALE_LABELS[localeKey.split("-")[0]] ?? {};
    const resolved = { ...DEFAULT_LABELS, ...dictionary, ...labels };
    return { locale, labels: resolved, customLabels: labels, labelResolver };
  }, [labelResolver, labels, locale]);
  return <KeepUiLabelsContext.Provider value={value}>{children}</KeepUiLabelsContext.Provider>;
}

export function useKeepUiLabels(): KeepUiLabelContext {
  return useContext(KeepUiLabelsContext);
}

export function useUiLabel(key: KeepUiLabelKey, override?: string): string {
  const context = useKeepUiLabels();
  return (
    override ??
    context.customLabels?.[key] ??
    context.labelResolver?.(key, { locale: context.locale }) ??
    context.labels[key]
  );
}

export function getKeepLocaleLabels(locale?: string): KeepUiLabels {
  const key = locale?.toLowerCase() ?? "en";
  return { ...(KEEP_LOCALE_LABELS[key] ?? KEEP_LOCALE_LABELS[key.split("-")[0]] ?? {}) };
}
