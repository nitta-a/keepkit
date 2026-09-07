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

test("commits quick edits only when the save button is pressed", async () => {
  const { getItems } = renderDemo([savedArticle]);

  fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
  fireEvent.click(await screen.findByRole("button", { name: "Edit saved item" }));

  const tags = await screen.findByRole("textbox", { name: "Tags" });
  fireEvent.change(tags, { target: { value: "Article, work" } });
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(getItems()[0]?.tags).toEqual(savedArticle.tags);

  fireEvent.click(screen.getByRole("button", { name: "Save with note" }));
  await waitFor(() => expect(getItems()[0]?.tags).toEqual(["Article", "work"]));
});

test("creates, renames, and deletes collections", async () => {
  const { getItems } = renderDemo([savedArticle]);

  const nameInput = await screen.findByRole("textbox", { name: "Create collection" });
  fireEvent.change(nameInput, { target: { value: "Favorites" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByText("Favorites")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Rename Favorites" }));
  const renameInput = screen.getByRole("textbox", { name: "Rename: Favorites" });
  fireEvent.change(renameInput, { target: { value: "Starred" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));

  expect(await screen.findByText("Starred")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete Starred" }));
  expect(screen.getByRole("group", { name: "Move its items to Uncategorized?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete collection" }));

  await waitFor(() => expect(screen.queryByText("Starred")).toBeNull());
  expect(getItems()).toHaveLength(1);
});

test("can manage an item-derived collection", async () => {
  const { getItems } = renderDemo([savedArticle]);

  fireEvent.click(await screen.findByRole("button", { name: "Rename reading" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Rename: reading" }), {
    target: { value: "Reading list" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  expect(await screen.findByText("Reading list")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Delete Reading list" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete collection" }));
  await waitFor(() => expect(screen.queryByText("Reading list")).toBeNull());
  expect(getItems()[0]?.collectionId).toBeUndefined();
});
