import type { KeepItem, KeepListQuery, StorageAdapter } from "@keepkit/core/core";
import {
  createKeepKit,
  KeepAnnouncements,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepEmptyState,
  KeepItemCheckbox,
  KeepKitProvider,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepProvider,
  KeepSearchInput,
  KeepSortSelect,
  KeepStatus,
  KeepTagEditor,
  KeepTagFilter,
  KeepUiProvider,
} from "@keepkit/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";

type Meta = { title: string; image?: string };

const item: KeepItem<Meta> = {
  id: "ui-item",
  savedAt: 1,
  updatedAt: 1,
  meta: { title: "UI item", image: "/ui-item.png" },
  targetType: "article",
  note: "old note",
  tags: ["work", "read"],
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

test("renders an accessible list, card image, and removes an item", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepList<Meta>
        itemCardProps={{
          getImageProps: (entry, title) =>
            entry.meta.image ? { src: entry.meta.image, alt: String(title) } : undefined,
        }}
      />
    </KeepProvider>,
  );

  expect(await screen.findByRole("heading", { name: "UI item" })).toBeVisible();
  expect(screen.getByRole("img", { name: "UI item" })).toHaveAttribute("src", "/ui-item.png");
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.getByText("No saved items.")).toBeVisible());
});

test("supports shared labels, search, sort, pagination, tag editing, bulk actions, and announcements", async () => {
  const second = { ...item, id: "second", meta: { title: "Second" }, tags: ["read"] };
  const storage = createStorage([item, second]);
  function Controls() {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<KeepListQuery<Meta>["sort"]>();
    const [page, setPage] = useState(1);
    return (
      <>
        <KeepSearchInput value={query} debounceMs={0} onValueChange={setQuery} />
        <KeepSortSelect onValueChange={(_value, nextSort) => setSort(nextSort)} />
        <KeepList<Meta>
          query={{ search: { query }, sort, pagination: { page, pageSize: 1 } }}
          renderItem={(entry) => <p key={entry.id}>{entry.meta.title}</p>}
        />
        <KeepPagination totalCount={2} pageSize={1} page={page} onPageChange={setPage} />
        <KeepNoteEditor item={item} />
        <KeepTagEditor item={item} />
        <KeepBulkActions query={{ pagination: { page: 1, pageSize: 2 } }} />
        <KeepAnnouncements />
      </>
    );
  }
  render(
    <KeepUiProvider
      labels={{
        search: "検索",
        applyTags: "タグ適用",
        savedMessage: "保存しました",
        noteSavedMessage: "ノートを保存しました",
      }}
      locale="ja-JP"
    >
      <KeepProvider<Meta> storage={storage}>
        <Controls />
      </KeepProvider>
    </KeepUiProvider>,
  );
  expect(await screen.findByRole("searchbox", { name: "検索" })).toBeVisible();
  fireEvent.change(screen.getByRole("searchbox", { name: "検索" }), { target: { value: "Second" } });
  expect((await screen.findAllByText("Second"))[0]).toBeVisible();
  const note = screen.getByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "updated" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ノートを保存しました"));
  fireEvent.change(screen.getByRole("searchbox", { name: "検索" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(screen.getAllByText("Second")[0]).toBeVisible());
  fireEvent.click(screen.getByRole("checkbox", { name: "UI item" }));
  fireEvent.change(screen.getAllByRole("textbox", { name: "Tags to apply" })[1], { target: { value: "bulk" } });
  fireEvent.click(screen.getAllByRole("button", { name: "タグ適用" })[1]);
  await waitFor(async () =>
    expect((await storage.getAll()).find((entry) => entry.id === "ui-item")?.tags).toEqual(["bulk"]),
  );
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
});

test("supports tag counts and controlled selection", async () => {
  const onChange = vi.fn();
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepTagFilter<Meta> onValueChange={onChange} />
    </KeepProvider>,
  );

  const work = await screen.findByRole("button", { name: /work/ });
  expect(work).toHaveTextContent("1");
  fireEvent.click(work);
  expect(onChange).toHaveBeenCalledWith("work");
  expect(work).toHaveAttribute("aria-pressed", "true");
});

test("debounces search changes and exposes numbered pagination", async () => {
  const onValueChange = vi.fn();
  const onPageChange = vi.fn();
  render(
    <KeepUiProvider>
      <KeepSearchInput debounceMs={20} onValueChange={onValueChange} />
      <KeepPagination totalCount={30} pageSize={10} page={2} onPageChange={onPageChange} />
      <KeepItemCheckbox item={item} />
    </KeepUiProvider>,
  );

  const search = screen.getByRole("searchbox");
  fireEvent.change(search, { target: { value: "react" } });
  expect(onValueChange).not.toHaveBeenCalledWith("react");
  await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("react"));
  expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
  expect(onPageChange).toHaveBeenCalledWith(3, 20);
  expect(screen.getByRole("checkbox", { name: "UI item" })).toBeVisible();
});

test("removes the last tag with Backspace when the editor input is empty", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepTagEditor item={item} />
    </KeepProvider>,
  );

  const input = await screen.findByRole("textbox", { name: "Tags to apply" });
  fireEvent.keyDown(input, { key: "Backspace" });
  expect(screen.queryByText("read")).not.toBeInTheDocument();
});

test("KeepKitProvider mounts the global polite announcer", async () => {
  render(
    <KeepKitProvider<Meta> storage={createStorage()}>
      <KeepButton item={{ id: item.id, meta: item.meta, targetType: item.targetType }} />
    </KeepKitProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Save item" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Item saved."));
});

test("provides a combined provider and collection workflow", async () => {
  render(
    <KeepKitProvider<Meta> storage={createStorage([item])}>
      <KeepCollection<Meta>
        query={{ targetType: "article", pagination: { pageSize: 10 } }}
        renderItem={(entry) => <p key={entry.id}>{entry.meta.title}</p>}
      />
    </KeepKitProvider>,
  );

  expect(await screen.findByText("UI item")).toBeVisible();
  expect(screen.getByRole("searchbox", { name: "Search saved items" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Pagination" })).toBeVisible();
});

test("creates one typed UI kit with configured storage", async () => {
  const keep = createKeepKit<Meta>({ storage: createStorage([item]), labels: { search: "Find saved items" } });
  render(
    <keep.Provider>
      <keep.Collection query={{ targetType: "article" }} />
    </keep.Provider>,
  );

  expect(await screen.findByRole("searchbox", { name: "Find saved items" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "UI item" })).toBeVisible();
});

test("saves notes and exposes render-prop status state", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepNoteEditor<Meta> item={item} />
      <KeepStatus<Meta> status="syncing">{({ status }) => <span>{status}</span>}</KeepStatus>
      <KeepEmptyState asChild>
        <section data-testid="empty-slot" />
      </KeepEmptyState>
    </KeepProvider>,
  );

  const editor = await screen.findByRole("textbox", { name: "Note" });
  fireEvent.change(editor, { target: { value: "new note" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(editor).toHaveValue("new note"));
  expect(screen.getByRole("status")).toHaveTextContent("syncing");
  expect(screen.getByTestId("empty-slot")).toHaveTextContent("No saved items");
});
