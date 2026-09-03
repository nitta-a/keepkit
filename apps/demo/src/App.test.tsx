import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepProvider } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
});

test("filters the collection by resource type", async () => {
  const { storage } = renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  const collection = await findCollectionList();

  expect(within(collection).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Product/ }));

  await waitFor(() => {
    expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
    expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
  });
  expect(await storage.getAll()).toHaveLength(2);
});

test("adds and saves a note for an existing resource", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle)]);

  const collection = await findCollectionList();
  const savedItem = within(collection).getByRole("heading", { name: firstArticle.meta.title }).closest("li");
  expect(savedItem).not.toBeNull();
  const input = within(savedItem as HTMLElement).getByRole("textbox", { name: "Note" });
  fireEvent.change(input, { target: { value: "Read this later" } });
  fireEvent.click(within(savedItem as HTMLElement).getByRole("button", { name: "Save note" }));

  await waitFor(() => {
    expect(input).toHaveValue("Read this later");
    expect(input.closest("form")).toHaveAttribute("data-state", "clean");
  });
  expect(getItems()[0]?.note).toBe("Read this later");
});

test("removes an item and clears the remaining collection", async () => {
  renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  const collection = await findCollectionList();

  const firstSavedItem = within(collection).getByRole("heading", { name: firstArticle.meta.title }).closest("li");
  expect(firstSavedItem).not.toBeNull();
  fireEvent.click(within(firstSavedItem as HTMLElement).getByRole("button", { name: "Remove" }));
  await waitFor(() => {
    expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
    expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(await screen.findByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
});
