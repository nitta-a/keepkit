import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KeepButton,
  KeepEmptyState,
  KeepItemCard,
  KeepList,
  KeepNoteEditor,
  KeepStatus,
  KeepTagFilter,
} from "../dist/index.js";

test("publishes the complete UI component set", () => {
  assert.equal(typeof KeepButton, "function");
  assert.equal(typeof KeepList, "function");
  assert.equal(typeof KeepItemCard, "function");
  assert.equal(typeof KeepTagFilter, "function");
  assert.equal(typeof KeepNoteEditor, "function");
  assert.equal(typeof KeepEmptyState, "function");
  assert.equal(typeof KeepStatus, "function");
});
