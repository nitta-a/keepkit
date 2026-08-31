import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { KeepButton, KeepNoteEditor, KeepProvider } from "../src/index";

type Meta = { title: string };

const item: KeepItem<Meta> = {
  id: "ui-interaction-item",
  savedAt: 1,
  updatedAt: 1,
  targetType: "article",
  meta: { title: "Interaction item" },
  note: "old note",
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
