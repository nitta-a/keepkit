import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import {
  KeepCollection,
  KeepCollectionManager,
  KeepItemCard,
  KeepItemCheckbox,
  KeepList,
  KeepProvider,
  KeepQuickEditor,
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
  };
  return { adapter, items: () => items, collections: () => collections };
}

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
  fireEvent.click(screen.getByRole("checkbox", { name: "Current page" }));
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

test.each(["Pin", "Unpin", "Apply tags", "Move selected items"])(
  "inline selection applies %s and clears only after success",
  async (operation) => {
    const saved = storage([{ ...first, pinned: true }]);
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
      if (operation === "Apply tags")
        fireEvent.change(screen.getByRole("textbox", { name: "Tags to apply" }), {
          target: { value: "Reference, Work" },
        });
    }
    fireEvent.click(screen.getByRole("button", { name: operation }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("0 selected"));
    if (operation === "Pin") expect(saved.items()[0]?.pinned).toBe(true);
    if (operation === "Unpin") expect(saved.items()[0]?.pinned).toBe(false);
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
