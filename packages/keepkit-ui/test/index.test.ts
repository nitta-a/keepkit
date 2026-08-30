import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createKeepKit,
  KeepAnnouncements,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepEmptyState,
  KeepItemCard,
  KeepItemCheckbox,
  KeepKitProvider,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepSearchInput,
  KeepSortSelect,
  KeepStatus,
  KeepTagEditor,
  KeepTagFilter,
  KeepUiProvider,
} from "../dist/index.js";

test("publishes the complete UI component set", () => {
  assert.equal(typeof KeepButton, "function");
  assert.equal(typeof KeepAnnouncements, "function");
  assert.equal(typeof KeepBulkActions, "function");
  assert.equal(typeof KeepList, "function");
  assert.equal(typeof KeepItemCard, "function");
  assert.equal(typeof KeepItemCheckbox, "function");
  assert.equal(typeof KeepTagFilter, "function");
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
