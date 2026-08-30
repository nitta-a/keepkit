import type { KeepItem, KeepListOptions, StorageAdapter } from "@keepkit/core/core";
import {
  KeepAnnouncements,
  KeepBulkActions,
  KeepEmptyState,
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
    const [sort, setSort] = useState<KeepListOptions<Meta>["sort"]>();
    const [offset, setOffset] = useState(0);
    return (
      <>
        <KeepSearchInput value={query} onValueChange={setQuery} />
        <KeepSortSelect onValueChange={(_value, nextSort) => setSort(nextSort)} />
        <KeepList<Meta>
          options={{ searchQuery: query, sort, limit: 1, offset }}
          renderItem={(entry) => <p key={entry.id}>{entry.meta.title}</p>}
        />
        <KeepPagination totalCount={2} pageSize={1} onPageChange={(_page, nextOffset) => setOffset(nextOffset)} />
        <KeepNoteEditor item={item} />
        <KeepTagEditor item={item} />
        <KeepBulkActions listOptions={{ limit: 2 }} />
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
