import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createKeepKit,
  getKeepLocaleLabels,
  isAllSelected,
  KeepAnnouncements,
  KeepAnnouncer,
  KeepBackup,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepEmptyState,
  KeepItemCard,
  KeepItemCheckbox,
  KeepItemStatusBadge,
  KeepKitProvider,
  KeepLayout,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepPruneStaleButton,
  KeepSearchInput,
  KeepSortSelect,
  KeepStaleNotice,
  KeepStatus,
  KeepSyncRecoveryDialog,
  KeepSyncStatusBanner,
  KeepTagEditor,
  KeepTagFilter,
  KeepThemeProvider,
  KeepUiProvider,
  KeepUndo,
  toggleSelectAll,
} from "../dist/index.js";
import { keepKitTheme } from "../dist/tailwind.js";

test("publishes the complete UI component set", () => {
  assert.equal(typeof KeepButton, "function");
  assert.equal(typeof KeepAnnouncements, "function");
  assert.equal(typeof KeepBackup, "function");
  assert.equal(typeof KeepAnnouncer, "function");
  assert.equal(typeof KeepBulkActions, "function");
  assert.equal(typeof KeepList, "function");
  assert.equal(typeof KeepItemCard, "function");
  assert.equal(typeof KeepItemStatusBadge, "function");
  assert.equal(typeof KeepItemCheckbox, "function");
  assert.equal(typeof KeepTagFilter, "function");
  assert.equal(typeof KeepLayout, "function");
  assert.equal(typeof KeepUndo, "function");
  assert.equal(typeof KeepNoteEditor, "function");
  assert.equal(typeof KeepPagination, "function");
  assert.equal(typeof KeepSearchInput, "function");
  assert.equal(typeof KeepSortSelect, "function");
  assert.equal(typeof KeepEmptyState, "function");
  assert.equal(typeof KeepStatus, "function");
  assert.equal(typeof KeepPruneStaleButton, "function");
  assert.equal(typeof KeepStaleNotice, "function");
  assert.equal(typeof KeepSyncRecoveryDialog, "function");
  assert.equal(typeof KeepSyncStatusBanner, "function");
  assert.equal(typeof KeepTagEditor, "function");
  assert.equal(typeof KeepUiProvider, "function");
  assert.equal(typeof KeepKitProvider, "function");
  assert.equal(typeof KeepCollection, "function");
  assert.equal(typeof createKeepKit, "function");
  assert.equal(typeof KeepThemeProvider, "function");
  assert.equal(keepKitTheme.colors.primary, "var(--keep-primary)");
  assert.equal(keepKitTheme.colors["card-foreground"], "var(--keep-card-foreground)");
});

test("select-all helpers operate on visible items and preserve hidden selections", () => {
  const items = [{ id: "visible-1" }, { id: "visible-2" }];
  assert.equal(isAllSelected(items, ["hidden", "visible-1", "visible-2"]), true);
  assert.deepEqual(toggleSelectAll(items, ["hidden"]), ["hidden", "visible-1", "visible-2"]);
  assert.deepEqual(toggleSelectAll(items, ["hidden", "visible-1", "visible-2"]), ["hidden"]);
  assert.equal(isAllSelected([], []), false);
});

test("provides complete built-in dictionaries for all supported locales and aliases", () => {
  const locales = [
    "en",
    "ja",
    "ko",
    "zh-Hans",
    "zh-Hant",
    "th",
    "fr",
    "es",
    "pt-BR",
    "it",
    "de",
    "ru",
    "fil",
    "vi",
    "id",
    "ms",
  ];
  const expectedKeys = Object.keys(getKeepLocaleLabels("en")).sort();

  for (const locale of locales) {
    assert.deepEqual(Object.keys(getKeepLocaleLabels(locale)).sort(), expectedKeys, locale);
  }
  assert.equal(getKeepLocaleLabels("zh-CN").save, getKeepLocaleLabels("zh-Hans").save);
  assert.equal(getKeepLocaleLabels("zh-TW").save, getKeepLocaleLabels("zh-Hant").save);
  assert.equal(getKeepLocaleLabels("pt_pt").save, getKeepLocaleLabels("pt-BR").save);
  assert.notEqual(getKeepLocaleLabels("zh-Hans").save, getKeepLocaleLabels("zh-Hant").save);
});
