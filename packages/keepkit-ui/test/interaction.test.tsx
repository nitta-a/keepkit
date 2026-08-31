import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { KeepBulkActions, KeepButton, KeepNoteEditor, KeepProvider, KeepTagEditor } from "../src/index";

type Meta = { title: string };

const item: KeepItem<Meta> = {
  id: "ui-interaction-item",
  savedAt: 1,
  updatedAt: 1,
  targetType: "article",
  meta: { title: "Interaction item" },
  note: "old note",
};

const secondItem: KeepItem<Meta> = {
  ...item,
  id: "ui-interaction-item-2",
  meta: { title: "Second interaction item" },
};

function createStorage(initialItems: KeepItem<Meta>[] = []): StorageAdapter<Meta> {
  let items = [...initialItems];
  return {
    getAll: async () => [...items],
    set: async (nextItem) => {
      items = [...items.filter((current) => current.id !== nextItem.id), nextItem];
    },
    remove: async (id) => {
      items = items.filter((current) => current.id !== id);
    },
    clear: async () => {
      items = [];
    },
  };
}

test("toggles the UI button from keyboard and propagates asChild state attributes", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage()}>
      <KeepButton item={item} asChild>
        {(state) => <a href="/saved">{String(state.isSaved)}</a>}
      </KeepButton>
    </KeepProvider>,
  );

  const link = await screen.findByRole("button", { name: "Save article: Interaction item" });
  expect(link.getAttribute("aria-pressed")).toBe("false");
  expect(link.getAttribute("aria-busy")).toBe("false");
  fireEvent.keyDown(link, { key: "Enter" });
  await waitFor(() => expect(link.textContent).toContain("true"));
  expect(link.getAttribute("aria-pressed")).toBe("true");

  fireEvent.keyDown(link, { key: " " });
  await waitFor(() => expect(link.textContent).toContain("false"));
});

test("debounces note persistence and saves with Ctrl+Enter", async () => {
  const storage = createStorage([item]);
  const onSaved = vi.fn();
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepNoteEditor item={item} debounceMs={20} onSaved={onSaved} />
    </KeepProvider>,
  );

  const editor = await screen.findByRole("textbox", { name: "Note" });
  fireEvent.change(editor, { target: { value: "debounced note" } });
  expect(onSaved).not.toHaveBeenCalled();
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("debounced note"));
  expect((await storage.getAll())[0]?.note).toBe("debounced note");

  fireEvent.change(editor, { target: { value: "keyboard note" } });
  fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("keyboard note"));
});

test("does not add a tag while an IME composition is active", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepTagEditor item={item} />
    </KeepProvider>,
  );

  const input = await screen.findByRole("textbox", { name: "Tags to apply" });
  fireEvent.change(input, { target: { value: "日本語" } });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(screen.queryByText("日本語")).toBeNull();
  expect((input as HTMLInputElement).value).toBe("日本語");

  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByText("日本語")).not.toBeNull();
});

test("exposes visible-item select-all state and toggles all visible items", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepBulkActions
        render={({ isAllSelected, selectedIds, toggleSelectAll }) => (
          <>
            <button type="button" onClick={toggleSelectAll}>
              Toggle visible items
            </button>
            <output>{`${isAllSelected}:${selectedIds.join(",")}`}</output>
          </>
        )}
      />
    </KeepProvider>,
  );

  await screen.findByText("false:");
  fireEvent.click(screen.getByRole("button", { name: "Toggle visible items" }));
  expect(await screen.findByText(`true:${item.id},${secondItem.id}`)).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Toggle visible items" }));
  expect(await screen.findByText("false:")).not.toBeNull();
});
