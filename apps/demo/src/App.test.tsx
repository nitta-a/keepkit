import { type KeepItem, KeepProvider, type StorageAdapter } from "@keepkit/core";
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
    savedAt: timestamps,
    updatedAt: timestamps,
  } as KeepItem<DemoMeta>;
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

  expect(await screen.findByText("Nothing here yet. Save a resource above.")).toBeInTheDocument();
  fireEvent.click(screen.getAllByText("Save for later")[0]);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Remove saved item" })).toHaveAttribute("aria-pressed", "true");
  });
  expect(within(screen.getByRole("list")).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(getItems()).toHaveLength(1);
  expect(getItems()[0]?.id).toBe(firstArticle.id);
});

test("filters the collection by resource type", async () => {
  const { storage } = renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  const collection = await screen.findByRole("list");

  expect(within(collection).getByText(firstArticle.meta.title)).toBeInTheDocument();
  expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Products" }));

  await waitFor(() => {
    expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
    expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
  });
  expect(await storage.getAll()).toHaveLength(2);
});

test("adds and saves a note for an existing resource", async () => {
  const { getItems } = renderDemo([toSavedItem(firstArticle)]);
  await screen.findByRole("list");

  fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
  const input = screen.getByRole("textbox", {
    name: `Edit note for ${firstArticle.meta.title}`,
  });
  fireEvent.change(input, { target: { value: "Read this later" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));

  await waitFor(() => {
    expect(screen.getByText("“Read this later” · Edit note")).toBeInTheDocument();
  });
  expect(getItems()[0]?.note).toBe("Read this later");
});

test("removes an item and clears the remaining collection", async () => {
  renderDemo([toSavedItem(firstArticle), toSavedItem(product, 2)]);
  const collection = await screen.findByRole("list");

  fireEvent.click(screen.getByRole("button", { name: `Remove ${firstArticle.meta.title}` }));
  await waitFor(() => {
    expect(within(collection).queryByText(firstArticle.meta.title)).not.toBeInTheDocument();
    expect(within(collection).getByText(product.meta.title)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(await screen.findByText("Nothing here yet. Save a resource above.")).toBeInTheDocument();
});
