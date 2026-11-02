import type { StorageAdapter } from "@keepkit/core/core";
import { KeepButton, KeepProvider, useKeepShortcut } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

const item = {
  id: "render-props-item",
  targetType: "article",
  meta: { title: "Render props item" },
};

function createStorage(): StorageAdapter<typeof item.meta> {
  let saved = false;
  return {
    getAll: async () => (saved ? [{ ...item, savedAt: 1, updatedAt: 1 }] : []),
    set: async () => {
      saved = true;
    },
    remove: async () => {
      saved = false;
    },
    clear: async () => {
      saved = false;
    },
  };
}

test("supports render props and asChild while toggling", async () => {
  render(
    <KeepProvider storage={createStorage()}>
      <KeepButton item={item} asChild>
        {(state) => (
          <a href="/saved" data-testid="save-link">
            {String(state.isSaved)}
          </a>
        )}
      </KeepButton>
    </KeepProvider>,
  );

  const link = await screen.findByTestId("save-link");
  expect(link).toHaveTextContent("false");
  fireEvent.click(link);
  await waitFor(() => expect(link).toHaveTextContent("true"));
  expect(link).toHaveAttribute("aria-pressed", "true");
  expect(link).toHaveAttribute("aria-label", "Remove article: Render props item");
  expect(link).toHaveAttribute("role", "button");
  expect(link).toHaveAttribute("tabindex", "0");
});

test("supports localized state-dependent accessible labels", async () => {
  render(
    <KeepProvider storage={createStorage()}>
      <KeepButton item={item} savedAriaLabel="保存から外す" unsavedAriaLabel="保存する" />
    </KeepProvider>,
  );

  const button = await screen.findByRole("button", { name: "保存する" });
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAccessibleName("保存から外す"));
});

test("binds a shortcut and ignores editable controls", async () => {
  const testStorage = createStorage();
  function ShortcutProbe() {
    useKeepShortcut({
      key: "k",
      modifier: "meta",
      item: { id: "shortcut-item", targetType: "article", meta: { title: "Shortcut item" } },
    });
    return <input aria-label="Editor" />;
  }

  render(
    <KeepProvider storage={testStorage}>
      <ShortcutProbe />
    </KeepProvider>,
  );
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Editor" }), {
    key: "k",
    metaKey: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await testStorage.getAll()).toHaveLength(0);

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  await waitFor(async () => expect(await testStorage.getAll()).toHaveLength(1));
});

test("prevents saving until the existing item is loaded", async () => {
  let resolveRead: (items: Array<typeof item & { savedAt: number; updatedAt: number; note: string }>) => void =
    () => {};
  const read = new Promise<Array<typeof item & { savedAt: number; updatedAt: number; note: string }>>((resolve) => {
    resolveRead = resolve;
  });
  const existing = { ...item, savedAt: 1, updatedAt: 1, note: "keep this note" };
  let writes = 0;
  const storage: StorageAdapter<typeof item.meta> = {
    getAll: () => read,
    set: async () => {
      writes += 1;
    },
    remove: async () => {},
    clear: async () => {},
  };
  render(
    <KeepProvider storage={storage}>
      <KeepButton item={item} />
    </KeepProvider>,
  );
  const button = screen.getByRole("button", { name: "Save item" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  resolveRead([existing]);
  await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
  expect(writes).toBe(0);
  expect(await storage.getAll()).toEqual([existing]);
});

test("prevents navigation when an anchor is used as a save button", async () => {
  render(
    <KeepProvider storage={createStorage()}>
      <KeepButton item={item} asChild>
        <a href="/saved">Save</a>
      </KeepButton>
    </KeepProvider>,
  );
  const link = screen.getByRole("button");
  await waitFor(() => expect(link).toHaveAttribute("aria-disabled", "false"));
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  fireEvent(link, event);
  expect(event.defaultPrevented).toBe(true);
  await waitFor(() => expect(link).toHaveAttribute("aria-pressed", "true"));
});
