import { type KeepItem, type KeepListQuery, orderKeepItems, type StorageAdapter } from "@keepkit/core/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { type KeepUrlAdapter, useKeepUrlSync } from "../src/adapters/url-sync";
import { reorderVisibleItems } from "../src/features/collection/hooks/reorderVisibleItems";
import { KeepCollection, KeepProvider, KeepSortSelect } from "../src/index";

type Meta = { title: string };

function item(id: string, order: number, fields: Partial<KeepItem<Meta>> = {}): KeepItem<Meta> {
  return { id, order, targetType: "article", savedAt: order + 1, updatedAt: order + 1, meta: { title: id }, ...fields };
}

function createStorage(source: KeepItem<Meta>[]) {
  const items = new Map(source.map((entry) => [entry.id, entry]));
  const setMany = vi.fn(async (entries: KeepItem<Meta>[]) => {
    for (const entry of entries) items.set(entry.id, entry);
  });
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [...items.values()],
    set: async (entry) => void items.set(entry.id, entry),
    setMany,
    remove: async (id) => void items.delete(id),
    clear: async () => items.clear(),
  };
  return { storage, setMany };
}

function visibleTitles(): string[] {
  return screen.queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent ?? "");
}

test("reorders filtered page slots once and restores just those slots with undo", async () => {
  const source = [
    item("A", 0, { tags: ["shown"] }),
    item("Archived", 1, { archived: true, tags: ["shown"] }),
    item("B", 2, { tags: ["shown"] }),
    item("Hidden", 3),
    item("C", 4, { tags: ["shown"] }),
    item("D", 5, { tags: ["shown"] }),
  ];
  const { storage, setMany } = createStorage(source);
  const after = vi.fn();
  const onReorder = vi.fn();
  render(
    <KeepProvider<Meta> storage={storage} plugins={[{ after }]}>
      <KeepCollection<Meta>
        reorderable
        pageSize={2}
        query={{ tags: ["shown"], pagination: { page: 2 } }}
        onReorder={onReorder}
      />
    </KeepProvider>,
  );
  const handle = await screen.findByRole("button", { name: "Move item 2" });
  expect((screen.getByRole("combobox", { name: "Sort saved items" }) as HTMLSelectElement).value).toBe("manual");
  fireEvent.keyDown(handle, { key: "ArrowUp" });
  await waitFor(() => expect(visibleTitles()).toEqual(["D", "C"]));
  await waitFor(() => expect(onReorder).toHaveBeenCalledTimes(1));
  expect(setMany).toHaveBeenCalledTimes(1);
  expect(after).toHaveBeenCalledTimes(1);
  expect(orderKeepItems(await storage.getAll()).map((entry) => entry.id)).toEqual([
    "A",
    "Archived",
    "B",
    "Hidden",
    "D",
    "C",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Undo reorder" }));
  await waitFor(() => expect(visibleTitles()).toEqual(["C", "D"]));
  expect(orderKeepItems(await storage.getAll()).map((entry) => entry.id)).toEqual(source.map((entry) => entry.id));
  expect(setMany).toHaveBeenCalledTimes(2);
});

test("rejects invalid visible orders and leaves the source untouched", () => {
  const source = [item("A", 0), item("B", 1), item("C", 2)];
  expect(reorderVisibleItems(source, ["C", "A"])).toEqual(["C", "B", "A"]);
  expect(() => reorderVisibleItems(source, ["A", "A"])).toThrow(/duplicate/);
  expect(() => reorderVisibleItems(source, ["missing"])).toThrow(/unknown/);
  expect(source.map((entry) => entry.id)).toEqual(["A", "B", "C"]);
});

test("reports failed reorder undo without an unhandled rejection and allows retry", async () => {
  const { storage, setMany } = createStorage([item("A", 0), item("B", 1)]);
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepCollection reorderable />
    </KeepProvider>,
  );
  fireEvent.keyDown(await screen.findByRole("button", { name: "Move item 2" }), { key: "ArrowUp" });
  await waitFor(() => expect(visibleTitles()).toEqual(["B", "A"]));
  setMany.mockRejectedValueOnce(new Error("undo persistence failed"));
  fireEvent.click(await screen.findByRole("button", { name: "Undo reorder" }));
  expect((await screen.findByText("Could not save item order.")).getAttribute("role")).toBe("alert");
  expect(visibleTitles()).toEqual(["B", "A"]);
  fireEvent.click(screen.getByRole("button", { name: "Undo reorder" }));
  await waitFor(() => expect(visibleTitles()).toEqual(["A", "B"]));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("preserves dated sort and offers manual order without changing the dated callback", async () => {
  const onValueChange = vi.fn();
  const onManualSort = vi.fn();
  const controls = render(<KeepSortSelect onValueChange={onValueChange} onManualSort={onManualSort} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "manual" } });
  expect(onManualSort).toHaveBeenCalledTimes(1);
  expect(onValueChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "savedAt:asc" } });
  expect(onValueChange).toHaveBeenCalledWith("savedAt:asc", { by: "savedAt", direction: "asc" });
  controls.unmount();

  render(
    <KeepProvider<Meta> storage={createStorage([item("A", 0), item("B", 1)]).storage}>
      <KeepCollection reorderable query={{ sort: { by: "savedAt", direction: "desc" } }} />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: "B" });
  expect(visibleTitles()).toEqual(["B", "A"]);
  expect(screen.queryByRole("button", { name: /Move item/ })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Sort saved items" }), { target: { value: "manual" } });
  expect(await screen.findByRole("button", { name: "Move item 1" })).not.toBeNull();
  expect(visibleTitles()).toEqual(["A", "B"]);
  fireEvent.click(screen.getByRole("button", { name: "Reset to initial filters" }));
  expect(visibleTitles()).toEqual(["B", "A"]);
  expect(screen.queryByRole("button", { name: /Move item/ })).toBeNull();
});

test("keeps the ordinary updated-date default and suppresses handles when pinned items come first", async () => {
  const { storage } = createStorage([item("A", 0), item("B", 1)]);
  const view = render(
    <KeepProvider<Meta> storage={storage}>
      <KeepCollection />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: "B" });
  expect(visibleTitles()).toEqual(["B", "A"]);
  expect(screen.queryByRole("option", { name: "Manual order" })).toBeNull();
  view.unmount();
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepCollection reorderable query={{ pinnedFirst: true }} />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: "A" });
  expect(screen.queryByRole("button", { name: /Move item/ })).toBeNull();
});

test("reveals after hydration, clears compound filters, and uses the actual manual page order", async () => {
  const source = [
    item("A", 0),
    item("Other type", 1, { targetType: "product" }),
    item("B", 2),
    item("Blocked", 3),
    item("D", 4),
  ];
  const onRevealResult = vi.fn();
  render(
    <KeepProvider<Meta> storage={createStorage(source).storage}>
      <KeepCollection<Meta>
        pageSize={2}
        features={{ sort: false }}
        query={{
          targetType: "article",
          filter: (entry) => entry.id !== "Blocked",
          search: { query: "missing" },
          tags: ["missing"],
          collectionId: "missing",
          activity: { opened: "ever" },
          organization: { collection: "assigned", tags: "assigned", note: "assigned" },
          savedBetween: [100, 200],
        }}
        revealRequest={{ requestId: 1, itemId: "D" }}
        onRevealResult={onRevealResult}
      />
    </KeepProvider>,
  );
  expect(await screen.findByRole("heading", { name: "D" })).not.toBeNull();
  expect(visibleTitles()).toEqual(["D"]);
  expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
  expect(onRevealResult).toHaveBeenCalledExactlyOnceWith({ requestId: 1, itemId: "D", status: "visible" });
});

test.each([
  [1.5, "B", ["B"]],
  [Number.NaN, "C", ["C", "D"]],
  [Number.POSITIVE_INFINITY, "C", ["C", "D"]],
])("normalizes page size %s before revealing its target", async (pageSize, itemId, expectedTitles) => {
  const onRevealResult = vi.fn();
  render(
    <KeepProvider<Meta> storage={createStorage([item("A", 0), item("B", 1), item("C", 2), item("D", 3)]).storage}>
      <KeepCollection
        pageSize={2}
        features={{ sort: false }}
        query={{ pagination: { pageSize } }}
        revealRequest={{ requestId: 1, itemId }}
        onRevealResult={onRevealResult}
      />
    </KeepProvider>,
  );
  await waitFor(() => expect(visibleTitles()).toEqual(expectedTitles));
  expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
  expect(onRevealResult).toHaveBeenCalledExactlyOnceWith({ requestId: 1, itemId, status: "visible" });
});

test.each([
  ["Blocked", "excluded"],
  ["Other type", "excluded"],
  ["Missing", "not-found"],
])("reports %s accurately without clearing host constraints", async (itemId, status) => {
  const onRevealResult = vi.fn();
  render(
    <KeepProvider<Meta>
      storage={
        createStorage([item("A", 0), item("Blocked", 1), item("Other type", 2, { targetType: "product" })]).storage
      }
    >
      <KeepCollection<Meta>
        query={{ targetType: "article", filter: (entry) => entry.id !== "Blocked" }}
        revealRequest={{ requestId: 1, itemId }}
        onRevealResult={onRevealResult}
      />
    </KeepProvider>,
  );
  await waitFor(() => expect(onRevealResult).toHaveBeenCalledExactlyOnceWith({ requestId: 1, itemId, status }));
  expect(visibleTitles()).toEqual(["A"]);
});

test("saves and restores the unassigned filter while preserving organization fields", async () => {
  window.localStorage.removeItem("keepkit:saved-views");
  const { storage } = createStorage([
    item("A", 0, { tags: ["shown"], note: "note" }),
    item("B", 1, { collectionId: "reading", tags: ["shown"], note: "note" }),
    item("No tags", 2, { note: "note" }),
  ]);
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepCollection
        reorderable
        query={{ organization: { tags: "assigned", note: "assigned" } }}
        features={{ collectionFilter: true, savedViews: true }}
      />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: "A" });
  const collection = screen.getByRole("combobox", { name: "Collection" });
  fireEvent.change(collection, { target: { value: "__uncategorized__" } });
  expect(visibleTitles()).toEqual(["A"]);
  fireEvent.change(screen.getByRole("textbox", { name: "View name" }), { target: { value: "Inbox view" } });
  fireEvent.click(screen.getByRole("button", { name: "Save View" }));
  const savedView = await screen.findByRole("button", { name: "Inbox view" });
  const views = JSON.parse(window.localStorage.getItem("keepkit:saved-views") ?? "[]");
  expect(views[0].query.organization).toEqual({ collection: "unassigned", tags: "assigned", note: "assigned" });
  expect(views[0].query.filter).toBeUndefined();
  expect(views[0].query.sort).toBeUndefined();
  fireEvent.change(collection, { target: { value: "reading" } });
  expect(visibleTitles()).toEqual(["B"]);
  fireEvent.change(screen.getByRole("combobox", { name: "Sort saved items" }), { target: { value: "savedAt:desc" } });
  expect(screen.queryByRole("button", { name: /Move item/ })).toBeNull();
  fireEvent.click(savedView);
  await waitFor(() => expect(visibleTitles()).toEqual(["A"]));
  expect((screen.getByRole("combobox", { name: "Sort saved items" }) as HTMLSelectElement).value).toBe("manual");
  expect((collection as HTMLSelectElement).value).toBe("__uncategorized__");
  fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
  expect((collection as HTMLSelectElement).value).toBe("");
  expect(visibleTitles()).toEqual(["A", "B", "No tags"]);
});

test("restores manual sort and the first page when history omits sort and page", async () => {
  let currentUrl = "/items?sort=savedAt%3Adesc&page=2&archiveScope=active&collectionState=unassigned";
  const listeners = new Set<() => void>();
  const adapter: KeepUrlAdapter = {
    getUrl: () => currentUrl,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    navigate: vi.fn((url) => {
      currentUrl = url;
    }),
  };
  render(
    <KeepProvider<Meta> storage={createStorage([item("A", 0), item("B", 1), item("C", 2)]).storage}>
      <KeepCollection reorderable pageSize={1} urlSync urlAdapter={adapter} features={{ collectionFilter: true }} />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: "B" });
  expect((screen.getByRole("combobox", { name: "Collection" }) as HTMLSelectElement).value).toBe("__uncategorized__");
  expect(screen.queryByRole("button", { name: /Move item/ })).toBeNull();
  currentUrl = "/items?archiveScope=active";
  for (const listener of listeners) listener();
  await waitFor(() => expect(visibleTitles()).toEqual(["A"]));
  expect((screen.getByRole("combobox", { name: "Sort saved items" }) as HTMLSelectElement).value).toBe("manual");
  expect((screen.getByRole("combobox", { name: "Collection" }) as HTMLSelectElement).value).toBe("");
  expect(screen.getByRole("button", { name: "Page 1" }).getAttribute("aria-current")).toBe("page");
});

test("skips unchanged URLs and preserves explicit history mode and unrelated URL parts", () => {
  let currentUrl = "/items?lang=ja&archiveScope=active#saved";
  const adapter: KeepUrlAdapter = {
    getUrl: () => currentUrl,
    navigate: vi.fn((url) => {
      currentUrl = url;
    }),
  };
  function Probe({ query }: { query: KeepListQuery }) {
    useKeepUrlSync({ query, adapter, options: { history: "replace" }, onQueryChange: vi.fn() });
    return null;
  }
  const view = render(<Probe query={{ archiveScope: "active" }} />);
  view.rerender(<Probe query={{ archiveScope: "active", search: { query: " " } }} />);
  expect(adapter.navigate).not.toHaveBeenCalled();
  view.rerender(<Probe query={{ archiveScope: "active", search: { query: "reference" } }} />);
  expect(adapter.navigate).toHaveBeenCalledExactlyOnceWith(
    "/items?lang=ja&q=reference&archiveScope=active#saved",
    "replace",
  );
});

test("renders collection creation and toolbar-end content together", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([]).storage}>
      <KeepCollection creatable slots={{ toolbarEnd: <button type="button">Host action</button> }} />
    </KeepProvider>,
  );
  expect(screen.getByRole("button", { name: "Create" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Host action" })).not.toBeNull();
});
