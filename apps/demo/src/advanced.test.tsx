import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepButton, KeepProvider, useKeepContext, useKeepShortcut } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { expect, test, vi } from "vitest";

type Meta = { title: string; valid?: boolean };

const item: KeepItem<Meta> = {
  id: "item",
  savedAt: 1,
  updatedAt: 1,
  targetType: "article",
  note: "old note",
  tags: ["old"],
  meta: { title: "Item", valid: true },
};

function createMemoryStorage(initial: KeepItem<Meta>[] = []) {
  let items = [...initial];
  let listener: (() => void) | undefined;
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [...items],
    set: async (next) => {
      items = [...items.filter((current) => current.id !== next.id), next];
    },
    remove: async (id) => {
      items = items.filter((current) => current.id !== id);
    },
    clear: async () => {
      items = [];
    },
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
  return { storage, getItems: () => items, notify: () => listener?.() };
}

test("normalizes saves and reports schema failures through provider callbacks", async () => {
  const testStorage = createMemoryStorage();
  const onError = vi.fn();
  const schema = {
    parse: (value: unknown) => {
      const meta = value as Meta;
      if (!meta.valid) throw new Error("invalid metadata");
      return { ...meta, title: meta.title.trim() };
    },
  };
  function Probe() {
    const { saveItem, items, error } = useKeepContext<Meta>();
    return (
      <>
        <output data-testid="saved">{items[0] ? `${items[0].meta.title}|${items[0].tags?.join(",")}` : ""}</output>
        <output data-testid="error">{error ? "error" : ""}</output>
        <button
          onClick={() =>
            void saveItem({
              ...item,
              meta: { title: "  Trimmed  ", valid: true },
              tags: [" x ", "x", " "],
              updatedAt: 2,
            })
          }
          type="button"
        >
          valid-save
        </button>
        <button
          onClick={() =>
            void saveItem({
              ...item,
              meta: { title: "bad", valid: false },
              updatedAt: 3,
            }).catch(() => undefined)
          }
          type="button"
        >
          invalid-save
        </button>
      </>
    );
  }
  render(
    <KeepProvider storage={testStorage.storage} schema={schema} onError={onError}>
      <Probe />
    </KeepProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "valid-save" }));
  await waitFor(() => expect(screen.getByTestId("saved")).toHaveTextContent("Trimmed|x"));
  fireEvent.click(screen.getByRole("button", { name: "invalid-save" }));
  await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("error"));
  expect(onError).toHaveBeenCalledWith(expect.any(Error), { action: "save", id: "item" });
  expect(testStorage.getItems()[0]?.meta.title).toBe("Trimmed");
});

test("drops invalid hydrated items and reports rejected change handlers to plugins", async () => {
  const invalidItem = { ...item, id: "invalid", meta: { title: "Invalid", valid: false } };
  const testStorage = createMemoryStorage([item, invalidItem]);
  const invalidItems: string[] = [];
  const onError = vi.fn();
  const pluginError = vi.fn();
  const onChange = vi.fn(async () => {
    throw new Error("change handler failed");
  });
  function Probe() {
    const { items, updateNote } = useKeepContext<Meta>();
    return (
      <>
        <output data-testid="ids">{items.map((entry) => entry.id).join(",")}</output>
        <button onClick={() => void updateNote("item", "new note")} type="button">
          update
        </button>
      </>
    );
  }
  render(
    <KeepProvider
      storage={testStorage.storage}
      schema={{
        parse: (value) => {
          const meta = value as Meta;
          if (!meta.valid) throw new Error("invalid");
          return meta;
        },
      }}
      invalidItemPolicy="drop"
      onInvalidItem={(_error, entry) => invalidItems.push(entry.id)}
      onChange={onChange}
      onError={onError}
      plugins={[{ onError: pluginError }]}
    >
      <Probe />
    </KeepProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("item"));
  expect(invalidItems).toEqual(["invalid"]);
  fireEvent.click(screen.getByRole("button", { name: "update" }));
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error), { action: "updateNote", id: "item" }));
  expect(pluginError).toHaveBeenCalledWith(expect.any(Error), { action: "updateNote", id: "item" });
});

test("supports button labels, disabled state, child handlers, and keyboard activation", async () => {
  const testStorage = createMemoryStorage();
  const childClick = vi.fn((event: ReactMouseEvent<HTMLAnchorElement>) => event.preventDefault());
  const childKeyDown = vi.fn();
  render(
    <KeepProvider storage={testStorage.storage}>
      <KeepButton
        item={{ id: "button", meta: { title: "Button" } }}
        savedLabel="Remove it"
        unsavedLabel="Save it"
        disabled
      />
      <KeepButton item={{ id: "child", targetType: "article", meta: { title: "Child" } }} asChild>
        <a href="/child" data-testid="child" onClick={childClick} onKeyDown={childKeyDown}>
          Child
        </a>
      </KeepButton>
    </KeepProvider>,
  );
  const disabled = screen.getByRole("button", { name: "Save item" });
  expect(disabled).toBeDisabled();
  fireEvent.click(disabled);
  expect(testStorage.getItems()).toEqual([]);

  const child = screen.getByTestId("child");
  await waitFor(() => expect(child).toHaveAttribute("aria-pressed", "false"));
  fireEvent.keyDown(child, { key: "Enter" });
  await waitFor(() => expect(testStorage.getItems()).toHaveLength(1));
  expect(childKeyDown).toHaveBeenCalled();
  expect(child).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(child);
  expect(childClick).toHaveBeenCalled();
  expect(testStorage.getItems()).toHaveLength(1);
  fireEvent.keyDown(child, { key: " " });
  await waitFor(() => expect(testStorage.getItems()).toHaveLength(0));
});

test("supports shortcut actions, modifiers, enablement, editable targets, and trigger errors", async () => {
  const testStorage = createMemoryStorage();
  const onTrigger = vi.fn(() => Promise.reject(new Error("shortcut failed")));
  const onError = vi.fn();
  function Probe() {
    useKeepShortcut({
      key: "s",
      modifier: "ctrl",
      id: "shortcut",
      itemPayload: { meta: { title: "Shortcut" } },
      action: "save",
      onError,
    });
    useKeepShortcut({ key: "x", enabled: false, onTrigger });
    useKeepShortcut({ key: "t", onTrigger, onError, preventDefault: true });
    return <input aria-label="editor" />;
  }
  render(
    <KeepProvider storage={testStorage.storage}>
      <Probe />
    </KeepProvider>,
  );
  const editor = screen.getByRole("textbox", { name: "editor" });
  fireEvent.keyDown(window, { key: "s", ctrlKey: false, metaKey: true });
  fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(testStorage.getItems()).toEqual([]);

  fireEvent.keyDown(window, { key: "s", ctrlKey: true });
  await waitFor(() => expect(testStorage.getItems()).toHaveLength(1));
  fireEvent.keyDown(window, { key: "x" });
  expect(onTrigger).not.toHaveBeenCalled();
  const event = new KeyboardEvent("keydown", { key: "t", cancelable: true });
  window.dispatchEvent(event);
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error)));
  expect(event.defaultPrevented).toBe(true);
});

test("allows shortcuts in editable controls and supports remove action", async () => {
  const testStorage = createMemoryStorage([item]);
  function Probe() {
    useKeepShortcut({ key: "r", id: item.id, action: "remove", allowInEditable: true });
    return <input aria-label="editor" />;
  }
  render(
    <KeepProvider storage={testStorage.storage}>
      <Probe />
    </KeepProvider>,
  );
  fireEvent.keyDown(screen.getByRole("textbox", { name: "editor" }), { key: "r" });
  await waitFor(() => expect(testStorage.getItems()).toEqual([]));
});
