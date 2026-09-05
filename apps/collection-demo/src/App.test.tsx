import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepProvider } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";
import type { DemoMeta } from "./main";

const savedArticle: KeepItem<DemoMeta> = {
  id: "resource-view-transitions",
  targetType: "article",
  tags: ["Article", "reading"],
  collectionId: "reading",
  savedAt: 1,
  updatedAt: 1,
  meta: {
    title: "View transitions for the web",
    url: "https://example.com/view-transitions",
    description: "A practical reference for adding motion between document states.",
    image: "https://example.com/view-transitions.png",
    collection: "reading",
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

function renderDemo(initialItems: KeepItem<DemoMeta>[] = []) {
  const state = createStorage(initialItems);
  render(
    <KeepProvider<DemoMeta> storage={state.storage}>
      <App />
    </KeepProvider>,
  );
  return state;
}

async function findCollection() {
  return waitFor(() => {
    const collection = document.querySelector('[data-keepkit="list"][data-state="ready"]');
    if (!(collection instanceof HTMLElement)) throw new Error("The collection is not ready.");
    return collection;
  });
}

test("shows the minimal collection and saves a resource", async () => {
  const { getItems } = renderDemo();

  expect(await screen.findByRole("heading", { name: "Nothing saved yet" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Save resource" })[0]);

  await waitFor(() => expect(getItems()).toHaveLength(1));
  expect((await findCollection()).textContent).toContain(savedArticle.meta.title);
});

test("switches to advanced controls without losing saved items", async () => {
  renderDemo([savedArticle]);
  await findCollection();

  fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

  const collection = await findCollection();
  expect(within(collection).getByText(savedArticle.meta.title)).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Archive scope" })).toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Search saved items" })).toBeInTheDocument();
});
