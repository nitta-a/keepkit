import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepProvider } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vitest";
import { App } from "./App";
import type { DemoMeta } from "./main";

const firstArticle = {
  id: "article-react-server-components",
  targetType: "article",
  meta: {
    title: "A practical guide to React Server Components",
    url: "https://react.dev/reference/rsc/server-components",
    image: "https://example.com/rsc.png",
    description: "A useful reference for understanding where server-rendered UI fits.",
  },
};

const product = {
  id: "product-field-notebook",
  targetType: "product",
  meta: {
    title: "The everyday field notebook",
    url: "https://example.com/products/field-notebook",
    image: "https://example.com/notebook.png",
    description: "A compact notebook for ideas, observations, and plans.",
    price: "$18",
  },
};

function createStorage(initialItems: KeepItem<DemoMeta>[] = []) {
  let items = [...initialItems];
  const storage: StorageAdapter<DemoMeta> = {
    getAll: async () => [...items],
    set: async (item) => {
      items = [...items.filter((current) => current.id !== item.id), item];
    },
    remove: async (id) => {
      items = items.filter((item) => item.id !== id);
    },
    clear: async () => {
      items = [];
    },
  };

  return { storage, getItems: () => items };
}

function toSavedItem(item: typeof firstArticle | typeof product, timestamps = 1) {
  return {
    ...item,
    tags: [item.targetType === "product" ? "Product" : "Article"],
    savedAt: timestamps,
    updatedAt: timestamps,
  } as KeepItem<DemoMeta>;
}

async function findCollectionList() {
  return waitFor(() => {
    const list = document.querySelector('[data-keepkit="list"][data-state="ready"] > ul:not([data-keepkit])');
    if (!(list instanceof HTMLUListElement)) throw new Error("The KeepCollection list was not rendered.");
    return list;
  });
}

function renderDemo(initialItems: KeepItem<DemoMeta>[] = []) {
  const storage = createStorage(initialItems);
  render(
    <KeepProvider<DemoMeta> storage={storage.storage}>
      <App />
    </KeepProvider>,
  );
  return storage;
}

async function findSavedItem(title: string) {
  const item = within(await findCollectionList())
    .getByRole("heading", { name: title })
    .closest("li");
  if (!(item instanceof HTMLLIElement)) throw new Error("The saved item was not rendered.");
  return item;
}

function RevealHarness() {
  const [request, setRequest] = useState<{ requestId: number; itemId: string }>();
  const [statuses, setStatuses] = useState<string[]>([]);
  return (
    <>
      <button type="button" onClick={() => setRequest({ requestId: 1, itemId: firstArticle.id })}>
        Reveal first article
      </button>
      <App
        {...(request ? { revealRequest: request } : {})}
        onRevealResult={(result) => setStatuses((current) => [...current, result.status])}
      />
      <output aria-label="Reveal status">{statuses.join(",")}</output>
    </>
  );
}

test("saves a resource and displays it in the collection", async () => {
  const { getItems } = renderDemo();

  expect(await screen.findByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByText("Save for later")[0]);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Remove saved item" })).toHaveAttribute("aria-pressed", "true");
  });
  expect(within(await findCollectionList()).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(getItems()).toHaveLength(1);
  expect(getItems()[0]?.id).toBe(firstArticle.id);
  expect(getItems()[0]?.note).toBeUndefined();
});

test("filters the collection by resource type", async () => {
  const { storage } = renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  const collection = await findCollectionList();

  expect(within(collection).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  expect(document.getElementById("collection-filters")).toHaveAttribute("data-filters-open", "false");

  fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  expect(document.getElementById("collection-filters")).toHaveAttribute("data-filters-open", "true");
  fireEvent.click(screen.getByRole("button", { name: /Product/ }));

  await waitFor(() => {
    expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
    expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
  });
  expect(await storage.getAll()).toHaveLength(2);
});

test("reveals a saved item after a filter hides it", async () => {
  const { storage } = createStorage([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  render(
    <KeepProvider<DemoMeta> storage={storage}>
      <RevealHarness />
    </KeepProvider>,
  );
  const collection = await findCollectionList();
  fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  fireEvent.click(screen.getByRole("button", { name: /Product/ }));
  await waitFor(() => expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Reveal first article" }));
  await waitFor(() => {
    expect(screen.getByLabelText("Reveal status")).toHaveTextContent("visible");
    expect(
      within(document.querySelector('[data-keepkit="list"][data-state="ready"]') as HTMLElement).getByRole("heading", {
        name: firstArticle.meta.title,
      }),
    ).toBeInTheDocument();
  });
});

test("reveals an item outside the current scope once and preserves subsequent navigation", async () => {
  const { storage } = createStorage([toSavedItem(firstArticle), { ...toSavedItem(product, 2), pinned: true }]);
  render(
    <KeepProvider<DemoMeta> storage={storage}>
      <RevealHarness />
    </KeepProvider>,
  );
  await findCollectionList();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: "Pinned" }));
  expect(within(await findCollectionList()).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Reveal first article" }));
  expect(await findSavedItem(firstArticle.meta.title)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Reveal status")).toHaveTextContent(/^visible$/));
  expect(screen.getByRole("heading", { level: 1, name: "All saves" })).toBeInTheDocument();

  fireEvent.click(within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: "Pinned" }));
  const collection = await findCollectionList();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Pinned" })).toBeInTheDocument();
  expect(screen.getByLabelText("Reveal status")).toHaveTextContent(/^visible$/);
});

test("reveals an archived item in Archive without replaying after navigation", async () => {
  const { storage } = createStorage([{ ...toSavedItem(firstArticle), archived: true }, toSavedItem(product, 2)]);
  render(
    <KeepProvider<DemoMeta> storage={storage}>
      <RevealHarness />
    </KeepProvider>,
  );
  expect(within(await findCollectionList()).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Reveal first article" }));
  expect(await findSavedItem(firstArticle.meta.title)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Reveal status")).toHaveTextContent(/^visible$/));
  expect(screen.getByRole("heading", { level: 1, name: "Archive" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "All saves" }));
  const collection = await findCollectionList();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "All saves" })).toBeInTheDocument();
  expect(screen.getByLabelText("Reveal status")).toHaveTextContent(/^visible$/);
});

test("adds and saves a note for an existing resource", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle)]);

  const savedItem = await findSavedItem(firstArticle.meta.title);
  expect(within(savedItem).queryByRole("textbox", { name: "Note" })).not.toBeInTheDocument();
  fireEvent.click(within(savedItem).getByRole("button", { name: "Add note" }));
  const input = within(savedItem).getByRole("textbox", { name: "Note" });
  fireEvent.change(input, { target: { value: "Read this later" } });
  fireEvent.click(within(savedItem).getByRole("button", { name: "Save note" }));

  await waitFor(() => {
    expect(input).toHaveValue("Read this later");
    expect(input.closest("form")).toHaveAttribute("data-state", "clean");
  });
  expect(getItems()[0]?.note).toBe("Read this later");
});

test("manages selected items with removal and Undo instead of clearing the collection", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  await findCollectionList();

  fireEvent.click(screen.getByRole("button", { name: "Manage items" }));
  expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: firstArticle.meta.title }));
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Manage items" })).toBeInTheDocument();
    expect(getItems().map((item) => item.id)).toEqual([product.id]);
  });

  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() =>
    expect(
      getItems()
        .map((item) => item.id)
        .sort(),
    ).toEqual([firstArticle.id, product.id].sort()),
  );
  expect(within(await findCollectionList()).getByText(firstArticle.meta.title)).toBeInTheDocument();
});

test("navigates the Inbox, pinned, unread, archive, and collection scopes", async () => {
  const readArticle: KeepItem<DemoMeta> = {
    ...toSavedItem(firstArticle, 3),
    id: "read-reference",
    meta: { ...firstArticle.meta, title: "Already read reference" },
    collectionId: "reading",
    lastOpenedAt: 4,
  };
  const archivedArticle: KeepItem<DemoMeta> = {
    ...toSavedItem(firstArticle, 5),
    id: "archived-reference",
    meta: { ...firstArticle.meta, title: "Archived reference" },
    archived: true,
    pinned: true,
  };
  renderDemo([
    toSavedItem(firstArticle),
    { ...toSavedItem(product, 2), pinned: true, collectionId: "shopping" },
    readArticle,
    archivedArticle,
  ]);

  let collection = await findCollectionList();
  expect(within(collection).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  expect(within(collection).getByText(readArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(archivedArticle.meta.title)).not.toBeInTheDocument();

  fireEvent.click(within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: /^Inbox/ }));
  collection = await findCollectionList();
  expect(within(collection).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(product.meta.title)).not.toBeInTheDocument();
  expect(within(collection).queryByText(archivedArticle.meta.title)).not.toBeInTheDocument();

  fireEvent.click(within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: /^Pinned/ }));
  collection = await findCollectionList();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
  expect(within(collection).queryByText(archivedArticle.meta.title)).not.toBeInTheDocument();

  fireEvent.click(within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: /^Unread/ }));
  collection = await findCollectionList();
  expect(within(collection).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(readArticle.meta.title)).not.toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: /^Archive/ }),
  );
  collection = await findCollectionList();
  expect(within(collection).getByText(archivedArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
  expect(within(collection).queryByText(product.meta.title)).not.toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Collections" })).getByRole("button", { name: /^shopping/i }),
  );
  collection = await findCollectionList();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  expect(within(collection).queryByText(archivedArticle.meta.title)).not.toBeInTheDocument();
});

test("switches between grid and list views with accessible pressed states", async () => {
  renderDemo([toSavedItem(firstArticle)]);
  await findCollectionList();

  expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "List view" }));
  expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
  expect(await findSavedItem(firstArticle.meta.title)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
  expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
});

test("creates a collection and edits item tags and collection without exposing the note editor", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle)]);
  await findCollectionList();
  fireEvent.click(screen.getByRole("button", { name: "Manage collections" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Create collection" }), { target: { value: "Reading" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("button", { name: /^Reading/ });
  fireEvent.click(screen.getByRole("button", { name: /^All saves/ }));
  const savedItem = await findSavedItem(firstArticle.meta.title);

  fireEvent.click(within(savedItem).getByRole("button", { name: "Edit details" }));
  expect(within(savedItem).queryByRole("textbox", { name: "Note" })).not.toBeInTheDocument();
  const tags = within(savedItem).getByRole("textbox", { name: "Tags" });
  fireEvent.change(tags, { target: { value: "Article, Research" } });
  fireEvent.change(within(savedItem).getByRole("combobox", { name: "Collection" }), {
    target: { value: "reading" },
  });
  expect(getItems()[0]?.tags).toEqual(["Article"]);
  expect(getItems()[0]?.collectionId).toBeUndefined();

  const editor = tags.closest("form");
  if (!editor) throw new Error("The details editor was not rendered.");
  fireEvent.click(within(editor).getByRole("button", { name: /Save/ }));
  await waitFor(() => {
    expect(getItems()[0]?.tags).toEqual(["Article", "Research"]);
    expect(getItems()[0]?.collectionId).toBe("reading");
  });
});

test("bulk selection acts only on the current filtered scope and can be undone", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  const collection = await findCollectionList();
  fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  fireEvent.click(screen.getByRole("button", { name: /Product/ }));
  await waitFor(() => expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Manage items" }));
  expect(screen.getByRole("checkbox", { name: product.meta.title })).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: firstArticle.meta.title })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Select saved items" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  await waitFor(() => expect(getItems().map((item) => item.id)).toEqual([firstArticle.id]));

  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(getItems()).toHaveLength(2));
  expect(within(await findCollectionList()).getByText(product.meta.title)).toBeInTheDocument();
});

test("can finish managing after the last visible item is archived in bulk", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle)]);
  await findCollectionList();
  fireEvent.click(screen.getByRole("button", { name: "Manage items" }));
  fireEvent.click(screen.getByRole("checkbox", { name: firstArticle.meta.title }));
  fireEvent.click(screen.getByRole("button", { name: "Archive selected items" }));

  await waitFor(() => {
    expect(getItems()[0]?.archived).toBe(true);
    expect(screen.getByRole("button", { name: "Done managing" })).toBeEnabled();
    expect(screen.queryByRole("checkbox", { name: firstArticle.meta.title })).not.toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: "Done managing" }));
  expect(document.getElementById("collection-filters")).toHaveAttribute("data-managing", "false");
  expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Manage items" })).toBeDisabled();

  fireEvent.click(within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: "Archive" }));
  expect(await findSavedItem(firstArticle.meta.title)).toBeInTheDocument();
  expect(getItems()).toHaveLength(1);
});

test("opening an unread link updates its activity and count without changing its edit timestamp", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  await findCollectionList();
  const unread = within(screen.getByRole("navigation", { name: "Library" })).getByRole("button", { name: "Unread" });
  expect(within(unread).getByText("2")).toBeInTheDocument();
  fireEvent.click(unread);
  const collection = await findCollectionList();
  const savedItem = await findSavedItem(firstArticle.meta.title);
  const link = within(savedItem).getByRole("link", { name: firstArticle.meta.title });
  link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  fireEvent.click(link);

  await waitFor(() => {
    expect(within(unread).getByText("1")).toBeInTheDocument();
    expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
    expect(getItems().find((item) => item.id === firstArticle.id)).toMatchObject({
      updatedAt: 1,
      savedAt: 1,
      lastOpenedAt: expect.any(Number),
    });
  });
  expect(await findSavedItem(product.meta.title)).toBeInTheDocument();
});

test("opens the link form, saves a personal link, and returns to the library", async () => {
  const { getItems } = renderDemo();
  await screen.findByRole("heading", { name: "Nothing here yet" });
  fireEvent.click(screen.getByRole("button", { name: /^Add a link/ }));

  const form = screen.getByRole("form", { name: "Save a link" });
  expect(within(form).getByRole("textbox", { name: "Title" })).toHaveFocus();
  fireEvent.change(within(form).getByRole("textbox", { name: "Title" }), { target: { value: "Project reference" } });
  fireEvent.change(within(form).getByRole("textbox", { name: "URL" }), {
    target: { value: "https://example.com/reference" },
  });
  fireEvent.click(within(form).getByRole("button", { name: "Save link" }));

  await waitFor(() => expect(getItems()).toHaveLength(1));
  expect(await findSavedItem("Project reference")).toBeInTheDocument();
});

test("resaving an archived URL preserves its identity and reveals it in Archive", async () => {
  const { getItems } = renderDemo([{ ...toSavedItem(firstArticle), archived: true }, toSavedItem(product, 2)]);
  await findCollectionList();
  fireEvent.click(screen.getByRole("button", { name: /^Add a link/ }));
  const form = screen.getByRole("form", { name: "Save a link" });
  fireEvent.change(within(form).getByRole("textbox", { name: "Title" }), {
    target: { value: "Updated archived guide" },
  });
  fireEvent.change(within(form).getByRole("textbox", { name: "URL" }), { target: { value: firstArticle.meta.url } });
  fireEvent.click(within(form).getByRole("button", { name: "Save link" }));

  await waitFor(() => {
    const archivedItem = getItems().find((item) => item.id === firstArticle.id);
    expect(getItems()).toHaveLength(2);
    expect(archivedItem).toMatchObject({ id: firstArticle.id, archived: true, savedAt: 1 });
    expect(archivedItem?.meta.title).toBe("Updated archived guide");
  });
  expect(await findSavedItem("Updated archived guide")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Archive" })).toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Save a link" })).not.toBeInTheDocument();
});

test("opens capture with Ctrl or Meta K while leaving text input shortcuts alone", async () => {
  renderDemo([toSavedItem(firstArticle)]);
  await findCollectionList();
  const search = screen.getByRole("searchbox");
  fireEvent.keyDown(search, { key: "k", ctrlKey: true });
  expect(screen.queryByRole("form", { name: "Save a link" })).not.toBeInTheDocument();

  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(screen.getByRole("form", { name: "Save a link" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("form", { name: "Save a link" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Add a link/ })).toHaveFocus();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(screen.getByRole("form", { name: "Save a link" })).toBeInTheDocument();
});

test("opens storage settings with backup controls and preserves the library", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle)]);
  await findCollectionList();
  expect(screen.queryByRole("button", { name: "Export JSON" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Storage and settings" }));

  expect(screen.getByRole("button", { name: "Export JSON" })).toBeInTheDocument();
  expect(screen.getByText(/stores items in this browser/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^All saves/ }));
  expect(await findSavedItem(firstArticle.meta.title)).toBeInTheDocument();
  expect(getItems()).toHaveLength(1);
});
