import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import {
  KeepArchiveUndo,
  KeepCollection,
  KeepCollectionManager,
  KeepItemCard,
  KeepItemCheckbox,
  KeepList,
  KeepProvider,
  KeepQuickEditor,
  KeepUiProvider,
  KeepUndo,
} from "../src/index";

type Meta = { title: string };
const first: KeepItem<Meta> = {
  id: "first",
  savedAt: 1,
  updatedAt: 1,
  meta: { title: "First article" },
  note: "Keep this",
};
const second: KeepItem<Meta> = { ...first, id: "second", meta: { title: "Second article" }, savedAt: 2 };
function fieldValue(element: HTMLElement) {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLOptionElement
  )
    return element.value;
  throw new Error("Expected a form field");
}
function checked(element: HTMLElement) {
  if (element instanceof HTMLInputElement) return element.checked;
  throw new Error("Expected an input");
}
function storage(initial = [first, second]) {
  let items = [...initial];
  let collections = [{ id: "reading", name: "読書" }];
  const adapter: StorageAdapter<Meta> = {
    getAll: async () => items,
    set: async (item) => {
      items = [...items.filter((entry) => entry.id !== item.id), item];
    },
    remove: async (id) => {
      items = items.filter((entry) => entry.id !== id);
    },
    clear: async () => {
      items = [];
    },
    getCollections: async () => collections,
    setCollection: async (collection) => {
      collections = [...collections.filter((entry) => entry.id !== collection.id), collection];
    },
    removeCollection: async (id) => {
      collections = collections.filter((entry) => entry.id !== id);
    },
  };
  return { adapter, items: () => items, collections: () => collections };
}

test("archive undo restores an item and permits retry after a failed write", async () => {
  const { adapter, items } = storage([first]);
  const persist = adapter.set;
  render(
    <KeepProvider storage={adapter}>
      <KeepCollection features={{ archive: true }} />
      <KeepArchiveUndo />
    </KeepProvider>,
  );
  await screen.findByText(first.meta.title);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  const undo = await screen.findByRole("button", { name: "Undo" });
  expect(items()[0]?.archived).toBe(true);
  expect(undo.closest('[role="status"]')?.textContent).toContain(first.meta.title);
  adapter.set = async () => {
    throw new Error("Write failed");
  };
  fireEvent.click(undo);
  expect((await screen.findAllByRole("alert")).some((element) => element.textContent?.includes("Write failed"))).toBe(
    true,
  );
  expect(items()[0]?.archived).toBe(true);
  adapter.set = persist;
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(items()[0]?.archived).toBe(false));
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

test("archive undo does not cross to another storage with the same item id", async () => {
  const firstStorage = storage([first]);
  const other = { ...first, archived: true, meta: { title: "Other account" } };
  const secondStorage = storage([other]);
  function ScopeTitle() {
    const { items } = useKeepContext<Meta>();
    return <output data-testid="scope-title">{items[0]?.meta.title}</output>;
  }
  const tree = (adapter: StorageAdapter<Meta>) => (
    <KeepProvider storage={adapter}>
      <ScopeTitle />
      <KeepCollection features={{ archive: true }} />
      <KeepArchiveUndo />
    </KeepProvider>
  );
  const view = render(tree(firstStorage.adapter));
  await screen.findByRole("heading", { name: first.meta.title });
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await screen.findByRole("button", { name: "Undo" });
  view.rerender(tree(secondStorage.adapter));
  await waitFor(() => expect(screen.getByTestId("scope-title").textContent).toBe("Other account"));
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(secondStorage.items()[0]?.archived).toBe(true);
});

test("archive undo is cleared when the storage scope changes", async () => {
  let source: KeepItem<Meta>[] = [first];
  let scopeListener: () => void = () => {};
  const adapter: StorageAdapter<Meta> & { subscribeScope: (listener: () => void) => () => void } = {
    getAll: async () => [...source],
    set: async (value) => {
      source = [value];
    },
    remove: async () => {},
    clear: async () => {},
    subscribeScope: (listener) => {
      scopeListener = listener;
      return () => {};
    },
  };
  function ScopeTitle() {
    const { items } = useKeepContext<Meta>();
    return <output data-testid="scope-title">{items[0]?.meta.title}</output>;
  }
  render(
    <KeepProvider storage={adapter}>
      <ScopeTitle />
      <KeepCollection features={{ archive: true }} />
      <KeepArchiveUndo />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: first.meta.title });
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await screen.findByRole("button", { name: "Undo" });
  source = [{ ...first, archived: true, meta: { title: "Other scope" } }];
  act(() => scopeListener());
  await waitFor(() => expect(screen.getByTestId("scope-title").textContent).toBe("Other scope"));
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(source[0]?.archived).toBe(true);
});

test("removal Undo reports the restored item after another item changes and allows retry", async () => {
  const saved = storage([first, second]);
  const feedback = vi.fn();
  function Controls() {
    const context = useKeepContext<Meta>();
    return (
      <>
        <span>{context.isHydrated ? "ready" : "loading"}</span>
        <button type="button" onClick={() => void context.removeItemWithUndo(first.id)}>
          Remove first
        </button>
        <button type="button" onClick={() => void context.updateNote(second.id, "changed")}>
          Edit second
        </button>
        <KeepUndo />
      </>
    );
  }
  render(
    <KeepUiProvider<Meta> onFeedback={feedback}>
      <KeepProvider storage={saved.adapter}>
        <Controls />
      </KeepProvider>
    </KeepUiProvider>,
  );
  await screen.findByText("ready");
  fireEvent.click(screen.getByRole("button", { name: "Remove first" }));
  await screen.findByRole("button", { name: "Undo" });
  fireEvent.click(screen.getByRole("button", { name: "Edit second" }));
  await waitFor(() => expect(saved.items().find((entry) => entry.id === second.id)?.note).toBe("changed"));
  const persist = saved.adapter.set;
  saved.adapter.set = async () => {
    throw new Error("Undo write failed");
  };
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Undo write failed");
  expect(saved.items().map((entry) => entry.id)).toEqual([second.id]);
  saved.adapter.set = persist;
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() =>
    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({ type: "item-restored", item: expect.objectContaining({ id: first.id }) }),
    ),
  );
  expect(
    saved
      .items()
      .map((entry) => entry.id)
      .sort(),
  ).toEqual([first.id, second.id]);
});

test("batch removal Undo reports exactly the restored items after another item changes", async () => {
  const third = { ...first, id: "third", meta: { title: "Third article" } };
  const saved = storage([first, second, third]);
  const feedback = vi.fn();
  function Controls() {
    const context = useKeepContext<Meta>();
    return (
      <>
        <span>{context.isHydrated ? "ready" : "loading"}</span>
        <button type="button" onClick={() => void context.removeItemsWithUndo([first.id, second.id])}>
          Remove two
        </button>
        <button type="button" onClick={() => void context.updateNote(third.id, "changed")}>
          Edit third
        </button>
        <KeepUndo />
      </>
    );
  }
  render(
    <KeepUiProvider<Meta> onFeedback={feedback}>
      <KeepProvider storage={saved.adapter}>
        <Controls />
      </KeepProvider>
    </KeepUiProvider>,
  );
  await screen.findByText("ready");
  fireEvent.click(screen.getByRole("button", { name: "Remove two" }));
  await screen.findByRole("button", { name: "Undo" });
  fireEvent.click(screen.getByRole("button", { name: "Edit third" }));
  await waitFor(() => expect(saved.items().find((entry) => entry.id === third.id)?.note).toBe("changed"));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(feedback).toHaveBeenCalledWith(expect.objectContaining({ type: "item-restored" })));
  const event = feedback.mock.calls.find(([value]) => value.type === "item-restored")?.[0];
  expect(event?.items.map((entry: KeepItem<Meta>) => entry.id).sort()).toEqual([first.id, second.id]);
  expect(
    saved
      .items()
      .map((entry) => entry.id)
      .sort(),
  ).toEqual([first.id, second.id, third.id]);
  expect(saved.items().find((entry) => entry.id === third.id)?.note).toBe("changed");
});

test("disables repeated removal Undo while a restore is saving", async () => {
  const saved = storage([first]);
  const persist = saved.adapter.set;
  let finish: (() => void) | undefined;
  const write = vi.fn(async (item: KeepItem<Meta>) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await persist(item);
  });
  saved.adapter.set = write;
  function Controls() {
    const context = useKeepContext<Meta>();
    return (
      <>
        <span>{context.isHydrated ? "ready" : "loading"}</span>
        <button type="button" onClick={() => void context.removeItemWithUndo(first.id)}>
          Remove first
        </button>
        <KeepUndo />
      </>
    );
  }
  render(
    <KeepProvider storage={saved.adapter}>
      <Controls />
    </KeepProvider>,
  );
  await screen.findByText("ready");
  fireEvent.click(screen.getByRole("button", { name: "Remove first" }));
  const undo = await screen.findByRole("button", { name: "Undo" });
  fireEvent.click(undo);
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(write).toHaveBeenCalledTimes(1);
  await act(async () => finish?.());
  await waitFor(() => expect(saved.items().map((entry) => entry.id)).toEqual([first.id]));
});

test("collapsible filters retain their selection and leave the active filter removable", async () => {
  const { adapter } = storage([{ ...first, tags: ["research"] }, second]);
  render(
    <KeepProvider storage={adapter}>
      <KeepCollection collapsibleFilters features={{ tagFilter: true, savedViews: true }} />
    </KeepProvider>,
  );
  await screen.findByText(first.meta.title);
  const toggle = screen.getByRole("button", { name: "Filters" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  fireEvent.click(
    within(screen.getByRole("group", { name: "Filter saved items by tag" })).getByRole("button", { name: /research/ }),
  );
  await waitFor(() => expect(screen.queryByText(second.meta.title)).toBeNull());
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("navigation", { name: "Saved Views" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "research Remove" }));
  expect(await screen.findByText(second.meta.title)).not.toBeNull();
});

test("inline selection survives an equivalent query from a parent rerender", async () => {
  const { adapter } = storage([first, second]);
  const renderCollection = (pinnedFirst: boolean) => (
    <KeepProvider storage={adapter}>
      <KeepCollection bulkActionsVariant="inline" features={{ bulkActions: true }} query={{ pinnedFirst }} />
    </KeepProvider>
  );
  const view = render(renderCollection(false));
  await screen.findByText(first.meta.title);
  fireEvent.click(screen.getByRole("button", { name: "Select saved items" }));
  fireEvent.click(screen.getByRole("checkbox", { name: first.meta.title }));
  expect(checked(screen.getByRole("checkbox", { name: first.meta.title }))).toBe(true);
  view.rerender(renderCollection(false));
  expect(checked(screen.getByRole("checkbox", { name: first.meta.title }))).toBe(true);
  view.rerender(renderCollection(true));
  await waitFor(() => expect(checked(screen.getByRole("checkbox", { name: first.meta.title }))).toBe(false));
});

test("reading cards use explicit links, notes and registered names without stealing initial focus", async () => {
  const saved = { ...first, collectionId: "reading" };
  const { adapter, items } = storage([saved]);
  const { container } = render(
    <KeepProvider storage={adapter}>
      {/* biome-ignore lint/a11y/noAutofocus: The fixture detects focus stolen during card mounting. */}
      <button type="button" autoFocus>
        Outside
      </button>
      <KeepItemCard item={saved} presentation="reading" href="https://example.com/article" trackOpen />
      <KeepItemCard item={second} presentation="reading" />
    </KeepProvider>,
  );
  await screen.findByText("読書");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Outside" }));
  expect(screen.getByText("example.com")).not.toBeNull();
  expect(container.querySelector('[data-keepkit="card"] [data-keepkit="button"]')).toBeNull();
  expect(container.querySelector('[data-keep-card-part="media"]')).toBeNull();
  expect(screen.queryByRole("link", { name: second.meta.title })).toBeNull();
  const card = container.querySelector('[data-keepkit="card"]');
  if (!(card instanceof HTMLElement)) throw new Error("Missing card");
  fireEvent.click(within(card).getByRole("button", { name: "Edit saved item" }));
  const note = within(card).getByRole("textbox", { name: "Note" });
  expect(document.activeElement).toBe(note);
  fireEvent.change(note, { target: { value: "New note" } });
  fireEvent.click(within(card).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(items()[0]?.note).toBe("New note"));
  await waitFor(() =>
    expect(document.activeElement).toBe(within(card).getByRole("button", { name: "Edit saved item" })),
  );
  fireEvent.click(within(card).getByRole("link", { name: first.meta.title }));
  await waitFor(() => expect(items()[0]?.lastOpenedAt).toEqual(expect.any(Number)));
});

test("Japanese collection creation keeps the name and rejects duplicate names", async () => {
  const saved = storage([]);
  render(
    <KeepProvider storage={saved.adapter}>
      <KeepCollectionManager allowCreate />
    </KeepProvider>,
  );
  const input = await screen.findByRole("textbox", { name: "Create collection" });
  fireEvent.change(input, { target: { value: "仕事" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(saved.collections().some((collection) => collection.name === "仕事")).toBe(true));
  expect(saved.collections().find((collection) => collection.name === "仕事")?.id).toMatch(/^collection-/);
  fireEvent.change(input, { target: { value: "仕事" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect((await screen.findByRole("alert")).textContent).toContain("already exists");
  expect(saved.collections()).toHaveLength(2);
});

test("a standalone editor allows Tab out and resolves current collection names", async () => {
  const saved = storage([first]);
  render(
    <KeepProvider storage={saved.adapter}>
      <KeepQuickEditor item={first} />
      <button type="button">After</button>
    </KeepProvider>,
  );
  expect(fieldValue(await screen.findByRole("option", { name: "読書" }))).toBe("reading");
  expect(fireEvent.keyDown(screen.getByRole("button", { name: "Save with note" }), { key: "Tab" })).toBe(true);
});

test("failed Done retains the draft and dialog, then Escape retries and restores focus", async () => {
  const saved = storage([first]);
  const set = vi.spyOn(saved.adapter, "set").mockRejectedValueOnce(new Error("Disk unavailable"));
  render(
    <KeepProvider storage={saved.adapter}>
      <KeepItemCard item={first} presentation="reading" />
    </KeepProvider>,
  );
  await screen.findByRole("button", { name: "Edit saved item" });
  fireEvent.click(screen.getByRole("button", { name: "Edit saved item" }));
  const note = screen.getByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "Still here" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Disk unavailable");
  expect(fieldValue(note)).toBe("Still here");
  expect(screen.getByRole("dialog")).not.toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));
  fireEvent.keyDown(note, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(saved.items()[0]?.note).toBe("Still here");
  expect(set).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit saved item" }));
});

test("controlled list selection also reaches custom item renderers", async () => {
  function List() {
    const [selectedIds, onSelectedIdsChange] = useState<string[]>([]);
    return (
      <KeepList<Meta>
        selection={{ selectedIds, onSelectedIdsChange }}
        renderItem={(item, _state, selection) => (
          <li key={item.id}>
            <KeepItemCheckbox item={item} {...selection} />
            {item.meta.title}
          </li>
        )}
      />
    );
  }
  render(
    <KeepProvider storage={storage().adapter}>
      <List />
    </KeepProvider>,
  );
  const checkbox = await screen.findByRole("checkbox", { name: first.meta.title });
  fireEvent.click(checkbox);
  expect(checked(checkbox)).toBe(true);
  fireEvent.click(checkbox);
  expect(checked(checkbox)).toBe(false);
});

test("inline selection stays in the visible rows, resets on search and page changes, and supports Undo", async () => {
  const saved = storage();
  const { container } = render(
    <KeepProvider storage={saved.adapter}>
      <KeepCollection<Meta> pageSize={1} bulkActionsVariant="inline" features={{ bulkActions: true }} />
      <KeepUndo />
    </KeepProvider>,
  );
  const select = await screen.findByRole("button", { name: "Select saved items" });
  await waitFor(() => expect(select.hasAttribute("disabled")).toBe(false));
  fireEvent.click(select);
  const checkbox = screen.getByRole("checkbox", { name: first.meta.title });
  expect(checkbox.closest("li")?.querySelector('[data-keepkit="card"]')).toBeTruthy();
  expect(container.querySelector('[data-keepkit="bulk-actions"]')).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Select saved items — Current page" }));
  expect(screen.getByRole("status").textContent).toBe("1 selected");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("0 selected"));
  fireEvent.click(screen.getByRole("checkbox", { name: second.meta.title }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search saved items", exact: true }), {
    target: { value: "First" },
  });
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("0 selected"));
  fireEvent.click(screen.getByRole("checkbox", { name: first.meta.title }));
  fireEvent.click(screen.getByText("More"));
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  await waitFor(() => expect(saved.items().map((item) => item.id)).toEqual([second.id]));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(saved.items()).toHaveLength(2));
});

test("failed bulk operations retain selection and can be retried", async () => {
  const saved = storage([first]);
  vi.spyOn(saved.adapter, "set").mockRejectedValueOnce(new Error("Cannot write"));
  render(
    <KeepProvider storage={saved.adapter}>
      <KeepCollection<Meta> bulkActionsVariant="inline" features={{ bulkActions: true }} />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: first.meta.title });
  fireEvent.click(screen.getByRole("button", { name: "Select saved items" }));
  fireEvent.click(screen.getByRole("checkbox", { name: first.meta.title }));
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Cannot write");
  expect(checked(screen.getByRole("checkbox", { name: first.meta.title }))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() => expect(saved.items()[0]?.archived).toBe(true));
  expect(screen.getByRole("status").textContent).toBe("0 selected");
});

test.each(["Pin", "Unpin", "Add tags", "Remove tags", "Apply tags", "Move selected items"])(
  "inline selection applies %s and clears only after success",
  async (operation) => {
    const saved = storage([{ ...first, pinned: true, tags: ["Existing", "Old"] }]);
    render(
      <KeepProvider storage={saved.adapter}>
        <KeepCollection<Meta> bulkActionsVariant="inline" features={{ bulkActions: true }} />
      </KeepProvider>,
    );
    await screen.findByRole("heading", { name: first.meta.title });
    fireEvent.click(screen.getByRole("button", { name: "Select saved items" }));
    fireEvent.click(screen.getByRole("checkbox", { name: first.meta.title }));
    if (operation === "Move selected items") {
      fireEvent.change(screen.getByRole("combobox", { name: "Collection" }), { target: { value: "reading" } });
    } else {
      fireEvent.click(screen.getByText("More"));
      if (operation === "Apply tags" || operation === "Add tags")
        fireEvent.change(screen.getByRole("textbox", { name: "Tags to apply" }), {
          target: { value: "Reference, Work" },
        });
      if (operation === "Remove tags")
        fireEvent.change(screen.getByRole("textbox", { name: "Tags to apply" }), {
          target: { value: "Old" },
        });
    }
    fireEvent.click(screen.getByRole("button", { name: operation }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("0 selected"));
    if (operation === "Pin") expect(saved.items()[0]?.pinned).toBe(true);
    if (operation === "Unpin") expect(saved.items()[0]?.pinned).toBe(false);
    if (operation === "Add tags") expect(saved.items()[0]?.tags).toEqual(["Existing", "Old", "Reference", "Work"]);
    if (operation === "Remove tags") expect(saved.items()[0]?.tags).toEqual(["Existing"]);
    if (operation === "Apply tags") expect(saved.items()[0]?.tags).toEqual(["Reference", "Work"]);
    if (operation === "Move selected items") expect(saved.items()[0]?.collectionId).toBe("reading");
  },
);

test("collection creation failure retains the Japanese name for retry", async () => {
  const saved = storage([]);
  vi.spyOn(saved.adapter, "setCollection").mockRejectedValueOnce(new Error("Cannot create collection"));
  render(
    <KeepProvider storage={saved.adapter}>
      <KeepCollectionManager allowCreate />
    </KeepProvider>,
  );
  const input = await screen.findByRole("textbox", { name: "Create collection" });
  fireEvent.change(input, { target: { value: "仕事" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Cannot create collection");
  expect(fieldValue(input)).toBe("仕事");
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(saved.collections().some((entry) => entry.name === "仕事")).toBe(true));
});

test("pending bulk operations cannot run twice", async () => {
  const saved = storage([first]);
  let finish: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = saved.adapter.remove;
  const remove = vi.spyOn(saved.adapter, "remove").mockImplementationOnce(async (id) => {
    await gate;
    await original(id);
  });
  render(
    <KeepProvider storage={saved.adapter}>
      <KeepCollection<Meta> bulkActionsVariant="inline" features={{ bulkActions: true }} />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: first.meta.title });
  fireEvent.click(screen.getByRole("button", { name: "Select saved items" }));
  fireEvent.click(screen.getByRole("checkbox", { name: first.meta.title }));
  fireEvent.click(screen.getByText("More"));
  const button = screen.getByRole("button", { name: "Delete selected" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  expect(button.closest("fieldset")?.disabled).toBe(true);
  finish();
  await waitFor(() => expect(saved.items()).toHaveLength(0));
});
