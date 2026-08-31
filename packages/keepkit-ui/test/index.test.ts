import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createKeepKit,
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
  KeepKitProvider,
  KeepLayout,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepSearchInput,
  KeepSortSelect,
  KeepStatus,
  KeepTagEditor,
  KeepTagFilter,
  KeepUiProvider,
  KeepUndo,
  toggleSelectAll,
} from "../dist/index.js";

test("publishes the complete UI component set", () => {
  assert.equal(typeof KeepButton, "function");
  assert.equal(typeof KeepAnnouncements, "function");
  assert.equal(typeof KeepBackup, "function");
  assert.equal(typeof KeepAnnouncer, "function");
  assert.equal(typeof KeepBulkActions, "function");
  assert.equal(typeof KeepList, "function");
  assert.equal(typeof KeepItemCard, "function");
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
  assert.equal(typeof KeepTagEditor, "function");
  assert.equal(typeof KeepUiProvider, "function");
  assert.equal(typeof KeepKitProvider, "function");
  assert.equal(typeof KeepCollection, "function");
  assert.equal(typeof createKeepKit, "function");
});

test("select-all helpers operate on visible items and preserve hidden selections", () => {
  const items = [{ id: "visible-1" }, { id: "visible-2" }];
  assert.equal(isAllSelected(items, ["hidden", "visible-1", "visible-2"]), true);
  assert.deepEqual(toggleSelectAll(items, ["hidden"]), ["hidden", "visible-1", "visible-2"]);
  assert.deepEqual(toggleSelectAll(items, ["hidden", "visible-1", "visible-2"]), ["hidden"]);
  assert.equal(isAllSelected([], []), false);
});
