import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepProvider } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { DemoMeta } from "./main";
import { SaveLink } from "./SaveLink";

const existing: KeepItem<DemoMeta> = {
  id: "reference-guide",
  savedAt: 10,
  updatedAt: 20,
  targetType: "article",
  tags: ["Reference"],
  note: "Use in next project",
  collectionId: "work",
  pinned: true,
  meta: {
    title: "Original title",
    url: "https://example.com/guide",
    image: "https://example.com/guide.jpg",
    description: "Original description",
  },
};

function createStorage(initial: KeepItem<DemoMeta>[] = []) {
  let items = [...initial];
  const storage: StorageAdapter<DemoMeta> = {
    getAll: async () => [...items],
    getCollections: async () => [{ id: "work", name: "Work research" }],
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

async function renderForm(storage: StorageAdapter<DemoMeta>, onSaved = vi.fn(), onCancel = vi.fn()) {
  render(
    <KeepProvider<DemoMeta> storage={storage}>
      <SaveLink onSaved={onSaved} onCancel={onCancel} />
    </KeepProvider>,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Save link" })).toBeEnabled());
  return { onSaved, onCancel };
}

function enterLink(url = "https://example.com/guide", title = "A useful guide") {
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: title } });
  fireEvent.change(screen.getByRole("textbox", { name: "URL" }), { target: { value: url } });
}

test("saves a canonical link with a note and an existing collection", async () => {
  const { storage, getItems } = createStorage();
  const { onSaved } = await renderForm(storage);
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
  enterLink("  https://EXAMPLE.com:443/guide  ", "  A useful guide  ");
  fireEvent.change(screen.getByRole("textbox", { name: "Note (optional)" }), {
    target: { value: "  Read for Monday  " },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Collection (optional)" }), { target: { value: "work" } });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Link saved to your library.");
  expect(getItems()).toHaveLength(1);
  expect(getItems()[0]).toMatchObject({
    id: "link:https://example.com/guide",
    targetType: "link",
    note: "Read for Monday",
    collectionId: "work",
    meta: { title: "A useful guide", url: "https://example.com/guide", image: "", description: "" },
  });
  expect(onSaved).toHaveBeenCalledWith("link:https://example.com/guide");
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
});

test.each([
  "",
  "not a URL",
  "javascript:alert(1)",
  "data:text/html,hello",
  "ftp://example.com/file",
  "https://user:password@example.com/guide",
])("rejects unsafe or invalid URLs: %s", async (url) => {
  const { storage, getItems } = createStorage();
  const { onSaved } = await renderForm(storage);
  enterLink(url);
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Enter an http or https URL");
  expect(screen.getByRole("textbox", { name: "URL" })).toHaveFocus();
  expect(getItems()).toHaveLength(0);
  expect(onSaved).not.toHaveBeenCalled();
});

test("requires a title and focuses its input", async () => {
  const { storage, getItems } = createStorage();
  await renderForm(storage);
  enterLink("https://example.com/guide", "  ");
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Enter a title");
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
  expect(getItems()).toHaveLength(0);
});

test("resaving an existing URL preserves its identity, saved time, metadata, and organization", async () => {
  const archived = { ...existing, archived: true, lastOpenedAt: 15 };
  const { storage, getItems } = createStorage([archived]);
  const { onSaved } = await renderForm(storage);
  enterLink("https://EXAMPLE.com:443/guide", "Updated title");
  expect(screen.getByRole("textbox", { name: "Note (optional)" })).toHaveValue(existing.note);
  expect(screen.getByRole("combobox", { name: "Collection (optional)" })).toHaveValue("work");
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  await screen.findByRole("status");
  expect(getItems()).toHaveLength(1);
  const { updatedAt, ...original } = archived;
  expect(getItems()[0]).toMatchObject({ ...original, meta: { ...existing.meta, title: "Updated title" } });
  expect(getItems()[0]?.updatedAt).toBeGreaterThan(updatedAt);
  expect(onSaved).toHaveBeenCalledWith(existing.id);
});

test("resaving can explicitly clear the note and move the item back to Inbox", async () => {
  const { storage, getItems } = createStorage([existing]);
  await renderForm(storage);
  enterLink();
  fireEvent.change(screen.getByRole("textbox", { name: "Note (optional)" }), { target: { value: "" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Collection (optional)" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  await screen.findByRole("status");
  expect(getItems()[0]).toMatchObject({ id: existing.id, note: "", tags: existing.tags });
  expect(getItems()[0]).not.toHaveProperty("collectionId");
});

test("changing the URL does not copy the previous link's untouched note or collection", async () => {
  const { storage, getItems } = createStorage([existing]);
  await renderForm(storage);
  enterLink();
  expect(screen.getByRole("textbox", { name: "Note (optional)" })).toHaveValue(existing.note);
  fireEvent.change(screen.getByRole("textbox", { name: "URL" }), { target: { value: "https://example.com/new" } });
  expect(screen.getByRole("textbox", { name: "Note (optional)" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Collection (optional)" })).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  await screen.findByRole("status");
  const added = getItems().find((item) => item.id === "link:https://example.com/new");
  expect(added).not.toHaveProperty("note");
  expect(added).not.toHaveProperty("collectionId");
  expect(getItems().find((item) => item.id === existing.id)).toEqual(existing);
});

test("blocks saving after a library read failure and preserves existing data after retry", async () => {
  const saved = { ...existing, id: "link:https://example.com/guide" };
  const { storage, getItems } = createStorage([saved]);
  let unavailable = true;
  storage.getAll = async () => {
    if (unavailable) throw new Error("Storage could not be read");
    return [...getItems()];
  };
  const set = vi.spyOn(storage, "set");
  const onSaved = vi.fn();
  render(
    <KeepProvider<DemoMeta> storage={storage}>
      <SaveLink onSaved={onSaved} onCancel={vi.fn()} />
    </KeepProvider>,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent("Reload it before saving");
  expect(screen.getByRole("button", { name: "Save link" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  enterLink();
  fireEvent.submit(screen.getByRole("form", { name: "Save a link" }));
  expect(set).not.toHaveBeenCalled();
  expect(getItems()).toEqual([saved]);
  expect(onSaved).not.toHaveBeenCalled();

  unavailable = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry loading library" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save link" })).toBeEnabled());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  enterLink();
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));
  await screen.findByRole("status");
  expect(getItems()).toHaveLength(1);
  expect(getItems()[0]).toMatchObject({
    id: saved.id,
    savedAt: saved.savedAt,
    note: saved.note,
    collectionId: saved.collectionId,
    pinned: saved.pinned,
    tags: saved.tags,
    meta: { image: saved.meta.image, description: saved.meta.description },
  });
});

test("shows persistence failure and keeps the form values for retry", async () => {
  const { storage, getItems } = createStorage();
  const persist = storage.set;
  storage.set = async () => {
    throw new Error("Storage is full");
  };
  const { onSaved } = await renderForm(storage);
  enterLink();
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save this link: Storage is full");
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("A useful guide");
  expect(screen.getByRole("button", { name: "Save link" })).toBeEnabled();
  expect(getItems()).toHaveLength(0);
  expect(onSaved).not.toHaveBeenCalled();
  storage.set = persist;
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));
  await screen.findByRole("status");
  expect(getItems()).toHaveLength(1);
  expect(onSaved).toHaveBeenCalledOnce();
});

test("disables controls while saving and cancels without writing", async () => {
  const { storage } = createStorage();
  let finish: (() => void) | undefined;
  storage.set = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  const { onSaved, onCancel } = await renderForm(storage);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalledOnce();
  enterLink();
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled());
  expect(screen.getByRole("textbox", { name: "URL" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(onSaved).not.toHaveBeenCalled();
  finish?.();
  await screen.findByRole("status");
  expect(onSaved).toHaveBeenCalledOnce();
});
