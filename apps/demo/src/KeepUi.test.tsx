import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepEmptyState, KeepList, KeepNoteEditor, KeepProvider, KeepStatus, KeepTagFilter } from "@keepkit/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      <KeepList<Meta> itemCardProps={{ getImageUrl: (entry) => entry.meta.image }} />
    </KeepProvider>,
  );

  expect(await screen.findByRole("heading", { name: "UI item" })).toBeVisible();
  expect(screen.getByRole("img", { name: "UI item" })).toHaveAttribute("src", "/ui-item.png");
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.getByText("No saved items.")).toBeVisible());
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
