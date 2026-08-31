import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  KeepAnnouncements,
  KeepBackup,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepEmptyState,
  KeepErrorBoundary,
  KeepItemCard,
  KeepItemCheckbox,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepProvider,
  KeepSearchInput,
  KeepSortSelect,
  KeepStatus,
  KeepTagEditor,
  KeepTagFilter,
} from "../src/index";

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

test("exposes stable data attributes for CSS styling", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepButton item={item} data-testid="button" />
      <KeepButton item={item} disabled data-testid="disabled-button" />
      <KeepItemCard item={item} data-testid="card" />
      <KeepCollection features={{ search: false, sort: false, pagination: false }} data-testid="collection" />
      <KeepTagFilter data-testid="tag-filter" />
      <KeepList data-testid="list" />
      <KeepBulkActions data-testid="bulk" />
      <KeepItemCheckbox item={item} data-testid="checkbox" />
      <KeepNoteEditor item={item} data-testid="note" />
      <KeepTagEditor item={item} data-testid="tag-editor" />
      <KeepSearchInput data-testid="search" />
      <KeepSortSelect data-testid="sort" />
      <KeepPagination totalCount={2} pageSize={1} data-testid="pagination" />
      <KeepStatus data-testid="status" />
      <KeepEmptyState data-testid="empty" />
      <KeepAnnouncements data-testid="announcements" />
    </KeepProvider>,
  );

  await screen.findByRole("heading", { name: "Interaction item" });
  expect(screen.getByTestId("button").getAttribute("data-state")).toBe("saved");
  expect(screen.getByTestId("disabled-button").getAttribute("data-disabled")).toBe("true");
  expect(screen.getByTestId("card").getAttribute("data-state")).toBe("saved");
  expect(screen.getByTestId("collection").getAttribute("data-state")).toBe("ready");
  expect(screen.getByTestId("tag-filter").getAttribute("data-state")).toBe("all");
  expect(screen.getByTestId("list").getAttribute("data-state")).toBe("ready");
  expect(screen.getByTestId("bulk").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("checkbox").getAttribute("data-state")).toBe("unchecked");
  expect(screen.getByTestId("note").getAttribute("data-state")).toBe("clean");
  expect(screen.getByTestId("tag-editor").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("search").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("sort").getAttribute("data-state")).toBe("selected");
  expect(screen.getByTestId("pagination").getAttribute("data-state")).toBe("active");
  expect(screen.getByTestId("status").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("empty").getAttribute("data-state")).toBe("empty");
  expect(screen.getByTestId("announcements").getAttribute("data-state")).toBe("announcing");
});

test("links available card titles and blocks unavailable card links", async () => {
  const onOpen = vi.fn();
  render(
    <KeepProvider<Meta> storage={createStorage([item, { ...secondItem, status: "expired" }])}>
      <KeepItemCard item={item} href={(entry) => `/items/${entry.id}`} onOpen={onOpen} linkTargetAttribute="_blank" />
      <KeepItemCard item={{ ...secondItem, status: "expired" }} href="/items/expired" />
    </KeepProvider>,
  );

  const link = await screen.findByRole("link", { name: "Interaction item" });
  expect(link.getAttribute("href")).toBe("/items/ui-interaction-item");
  expect(link.getAttribute("target")).toBe("_blank");
  fireEvent.click(link);
  expect(onOpen).toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "Second interaction item" })).toBeNull();
  expect(screen.getByText("Expired")).not.toBeNull();
});

test("exports and imports JSON backups through the standard UI", async () => {
  const onExport = vi.fn();
  const importedItem = { ...item, id: "imported", meta: { title: "Imported" } };
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepBackup onExport={onExport} />
    </KeepProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
  await waitFor(() => expect(onExport).toHaveBeenCalledWith(expect.stringContaining("ui-interaction-item")));
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("Backup file input was not rendered.");
  const data = JSON.stringify({ format: "keepkit", version: 1, exportedAt: 1, items: [importedItem] });
  fireEvent.change(input, { target: { files: [new File([data], "backup.json", { type: "application/json" })] } });
  expect((await screen.findByRole("status")).textContent).toContain("1 items imported");
});

test("isolates unexpected provider and collection render errors", async () => {
  const providerError = vi.fn();
  function Broken() {
    throw new Error("provider render failure");
  }

  render(
    <KeepProvider<Meta>
      storage={createStorage()}
      fallback={<output data-testid="provider-fallback">Provider fallback</output>}
      onBoundaryError={providerError}
    >
      <Broken />
    </KeepProvider>,
  );

  expect((await screen.findByTestId("provider-fallback")).textContent).toBe("Provider fallback");
  expect(providerError).toHaveBeenCalled();

  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepCollection
        fallback={<output data-testid="collection-fallback">Collection fallback</output>}
        renderItem={() => {
          throw new Error("collection render failure");
        }}
      />
    </KeepProvider>,
  );

  expect((await screen.findByTestId("collection-fallback")).textContent).toBe("Collection fallback");
});

test("publishes the error boundary as a standalone primitive", () => {
  function Broken() {
    throw new Error("standalone render failure");
  }

  render(
    <KeepErrorBoundary fallback={<output data-testid="standalone-fallback">Recovered</output>}>
      <Broken />
    </KeepErrorBoundary>,
  );

  expect(screen.getByTestId("standalone-fallback").textContent).toBe("Recovered");
});
