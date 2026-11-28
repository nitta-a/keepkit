import { KeepProvider } from "@keepkit/core/react";
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { expect, test, vi } from "vitest";
import { KeepSavePopover, type KeepSavePopoverPanelContext } from "../src/features/actions/KeepSavePopover";
import { KeepThemeProvider } from "../src/foundation/theme";

type Meta = { title: string };
const item = { id: "article", meta: { title: "Article" } };

function hostPanel({ panelId, dialogLabel, content, requestClose, state }: KeepSavePopoverPanelContext<Meta>) {
  return (
    <dialog
      open
      id={panelId}
      aria-label={dialogLabel}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) void requestClose();
      }}
    >
      {content}
      <output aria-label="Host draft">{state.note}</output>
      <button type="button" onClick={() => void requestClose()}>
        Dismiss
      </button>
    </dialog>
  );
}

async function saveAndOpen() {
  const trigger = screen.getByRole("button", { name: "Save item" });
  await waitFor(() => expect(trigger.hasAttribute("disabled")).toBe(false));
  fireEvent.click(trigger);
  return { trigger, dialog: await screen.findByRole("dialog") };
}

test("host owns the shell, focus, and Escape while one editor flushes before a controlled dismissal", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "host-dismiss" });
  const onOpenChange = vi.fn();
  function Controlled() {
    const [open, setOpen] = useState(false);
    return (
      <KeepSavePopover
        item={item}
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          setOpen(next);
        }}
        dialogLabel="Host drawer"
        editorProps={{ debounceMs: 0, features: { title: true } }}
        renderPanel={hostPanel}
      >
        Host help
      </KeepSavePopover>
    );
  }
  const { container } = render(
    <KeepProvider storage={storage}>
      <Controlled />
      <button type="button">Outside</button>
    </KeepProvider>,
  );
  const outside = screen.getByRole("button", { name: "Outside" });
  outside.focus();
  const { trigger, dialog } = await saveAndOpen();
  expect(screen.getByRole("dialog", { name: "Host drawer" })).toBe(dialog);
  expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
  expect(container.contains(dialog)).toBe(true);
  expect(within(dialog).getByText("Host help")).not.toBeNull();
  expect(dialog.querySelectorAll("form")).toHaveLength(1);
  fireEvent.pointerDown(outside);
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(document.activeElement).toBe(outside);
  const note = within(dialog).getByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "Pending draft" } });
  expect(within(dialog).getByLabelText("Host draft").textContent).toBe("Pending draft");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), { target: { value: "  New title  " } });

  const gate = Promise.withResolvers<void>();
  const save = storage.set.bind(storage);
  const pending = vi.spyOn(storage, "set").mockImplementationOnce(async (next) => {
    await gate.promise;
    await save(next);
  });
  fireEvent.keyDown(note, { key: "Escape" });
  await waitFor(() => expect(pending).toHaveBeenCalledOnce());
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(onOpenChange.mock.calls).toEqual([[true]]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }));
  gate.resolve();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(await storage.getAll()).toMatchObject([{ note: "Pending draft", meta: { title: "New title" } }]);
  expect(document.activeElement).toBe(outside);
});

test("a failed host close reports false, keeps the draft visible, and allows retry", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "host-retry" });
  const results = vi.fn();
  const onSaveError = vi.fn();
  render(
    <KeepProvider storage={storage}>
      <KeepSavePopover
        item={item}
        editorProps={{ debounceMs: 0, onSaveError }}
        renderPanel={({ panelId, dialogLabel, content, requestClose, triggerRef }) => (
          <dialog open id={panelId} aria-label={dialogLabel}>
            {content}
            <button
              type="button"
              onClick={async () => {
                const closed = await requestClose();
                results(closed);
                if (closed) triggerRef.current?.focus();
              }}
            >
              Done
            </button>
          </dialog>
        )}
      />
    </KeepProvider>,
  );
  const { trigger, dialog } = await saveAndOpen();
  const note = within(dialog).getByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "Retry this" } });
  const failure = new Error("Disk full");
  vi.spyOn(storage, "set").mockRejectedValueOnce(failure);
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Disk full");
  expect(onSaveError).toHaveBeenCalledWith(failure);
  expect(results).toHaveBeenCalledWith(false);
  expect(within(dialog).getByDisplayValue("Retry this")).toBe(note);
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(results).toHaveBeenLastCalledWith(true);
  expect((await storage.getAll())[0]?.note).toBe("Retry this");
  expect(document.activeElement).toBe(trigger);
});

test("creating a collection uses a sibling form and commits the selected ID with pending edits", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "host-create" });
  render(
    <KeepProvider storage={storage}>
      <KeepSavePopover
        item={item}
        allowCreateCollection
        editorProps={{ debounceMs: 0, collectionIds: ["work"] }}
        renderPanel={hostPanel}
      />
    </KeepProvider>,
  );
  const { dialog } = await saveAndOpen();
  const collection = within(dialog).getByRole("combobox", { name: "Collection" });
  const name = within(dialog).getByRole("textbox", { name: "Create collection" });
  expect(collection.closest("form")).not.toBe(name.closest("form"));
  expect(dialog.querySelector("form form")).toBeNull();
  const note = within(dialog).getByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "In my new folder" } });
  fireEvent.change(name, { target: { value: "Field Notes" } });
  const create = within(dialog).getByRole("button", { name: "Create" });
  fireEvent.click(create);
  await waitFor(() => expect(within(dialog).getByDisplayValue("Field Notes")).toBe(collection));
  await waitFor(async () =>
    expect(await storage.getAll()).toMatchObject([{ collectionId: "field-notes", note: "In my new folder" }]),
  );
  expect(await storage.getCollections()).toMatchObject([{ id: "field-notes", name: "Field Notes" }]);
  fireEvent.change(name, { target: { value: "Field Notes" } });
  fireEvent.click(create);
  expect((await screen.findByRole("alert")).textContent).toContain("already exists");
  expect(screen.getByRole("dialog")).toBe(dialog);
});

test("a dismissal while creation is pending keeps the panel open on failure and waits for assignment on retry", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "create-race" });
  render(
    <KeepProvider storage={storage}>
      <KeepSavePopover item={item} allowCreateCollection editorProps={{ debounceMs: 0 }} />
    </KeepProvider>,
  );
  const { trigger, dialog } = await saveAndOpen();
  const create = within(dialog).getByRole("button", { name: "Create" });
  const name = within(dialog).getByRole("textbox", { name: "Create collection" });
  fireEvent.change(name, { target: { value: "Reading List" } });
  const gate = Promise.withResolvers<void>();
  const write = vi.spyOn(storage, "setCollection").mockImplementationOnce(() => gate.promise);
  fireEvent.click(create);
  fireEvent.keyDown(name, { key: "Escape" });
  await waitFor(() => expect(write).toHaveBeenCalledOnce());
  gate.reject(new Error("Cannot create"));
  expect((await screen.findByRole("alert")).textContent).toBe("Cannot create");
  expect((await storage.getAll())[0]?.collectionId).toBeUndefined();
  fireEvent.click(create);
  fireEvent.keyDown(name, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await storage.getAll())[0]?.collectionId).toBe("reading-list");
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("hydration and another trigger saving the item do not invoke the host renderer", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "hydrate" });
  await storage.set({ ...item, savedAt: 1, updatedAt: 1 });
  const renderPanel = vi.fn(hostPanel);
  render(
    <KeepProvider storage={storage}>
      <KeepSavePopover item={item} renderPanel={renderPanel} buttonProps={{ "aria-label": "First" }} />
      <KeepSavePopover item={item} buttonProps={{ "aria-label": "Other" }} />
    </KeepProvider>,
  );
  const other = screen.getByRole("button", { name: "Other" });
  await waitFor(() => expect(other.getAttribute("aria-pressed")).toBe("true"));
  fireEvent.click(other);
  await waitFor(() => expect(other.getAttribute("aria-pressed")).toBe("false"));
  fireEvent.click(other);
  expect(await screen.findByRole("dialog")).not.toBeNull();
  expect(renderPanel).not.toHaveBeenCalled();
});

test("a pending dismissal from a replaced editor cannot close the next editor", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "replace" });
  const second = { ...item, id: "second" };
  await storage.set({ ...second, savedAt: 1, updatedAt: 1 });
  const onOpenChange = vi.fn();
  function Session({ current }: { current: typeof item }) {
    const [open, setOpen] = useState(false);
    return (
      <KeepProvider storage={storage}>
        <KeepSavePopover
          item={current}
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
          renderPanel={hostPanel}
          editorProps={{ debounceMs: 0 }}
        />
      </KeepProvider>
    );
  }
  const view = render(<Session current={item} />);
  const { dialog } = await saveAndOpen();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Note" }), { target: { value: "First draft" } });
  const gate = Promise.withResolvers<void>();
  const save = storage.set.bind(storage);
  const pending = vi.spyOn(storage, "set").mockImplementationOnce(async (next) => {
    await gate.promise;
    await save(next);
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }));
  await waitFor(() => expect(pending).toHaveBeenCalledOnce());
  view.rerender(<Session current={second} />);
  expect(screen.getByRole("dialog")).not.toBe(dialog);
  await act(async () => gate.resolve());
  expect(onOpenChange.mock.calls).toEqual([[true]]);
  expect(screen.getByRole("dialog")).not.toBeNull();
});

test("custom editor retains its draft on creation and save failures and retries through the host panel", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "custom-editor" });
  const results = vi.fn();
  function Editor({
    state,
    collections,
    createCollection,
    collectionError,
    isCreatingCollection,
    clearCollectionError,
  }: import("../src/features/actions/KeepSavePopover").KeepSavePopoverEditorContext<Meta>) {
    const [name, setName] = useState("");
    return (
      <div>
        <label>
          Custom note
          <input value={state.note} onChange={(event) => state.setNote(event.target.value)} />
        </label>
        <label>
          Custom collection
          <select
            value={state.collectionId ?? ""}
            onChange={(event) => state.setCollectionId(event.target.value || undefined)}
          >
            <option value="">None</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Custom name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="button" disabled={isCreatingCollection} onClick={() => void createCollection(name)}>
          Create custom
        </button>
        <button type="button" onClick={clearCollectionError}>
          Clear creation error
        </button>
        {collectionError && <p role="alert">{collectionError}</p>}
        {state.error != null && <p role="alert">Save failed</p>}
      </div>
    );
  }
  render(
    <KeepProvider storage={storage}>
      <KeepSavePopover
        item={item}
        allowCreateCollection
        editorProps={{ debounceMs: 0 }}
        renderEditor={(context) => <Editor {...context} />}
        renderPanel={(context) => (
          <dialog open aria-label={context.dialogLabel}>
            {context.content}
            <button type="button" onClick={() => void context.requestClose().then(results)}>
              Close host
            </button>
          </dialog>
        )}
      />
    </KeepProvider>,
  );
  const { dialog } = await saveAndOpen();
  fireEvent.change(within(dialog).getByLabelText("Custom note"), { target: { value: "Draft note" } });
  fireEvent.change(within(dialog).getByLabelText("Custom name"), { target: { value: "Reading" } });
  const gate = Promise.withResolvers<void>();
  const write = vi.spyOn(storage, "setCollection").mockImplementationOnce(() => gate.promise);
  fireEvent.click(within(dialog).getByRole("button", { name: "Create custom" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Close host" }));
  await waitFor(() => expect(write).toHaveBeenCalledOnce());
  gate.reject(new Error("Create failed"));
  expect(await screen.findByText("Create failed")).toBeTruthy();
  await waitFor(() => expect(results).toHaveBeenCalledWith(false));
  expect((within(dialog).getByLabelText("Custom note") as HTMLInputElement).value).toBe("Draft note");
  fireEvent.click(within(dialog).getByRole("button", { name: "Create custom" }));
  await waitFor(async () => expect((await storage.getAll())[0]?.collectionId).toBe("reading"));
  expect((within(dialog).getByLabelText("Custom collection") as HTMLSelectElement).value).toBe("reading");
  fireEvent.change(within(dialog).getByLabelText("Custom collection"), { target: { value: "" } });
  fireEvent.change(within(dialog).getByLabelText("Custom collection"), { target: { value: "reading" } });
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: "Create custom" }).hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Create custom" }));
  expect(await screen.findByText('Collection "Reading" already exists.')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Clear creation error" }));
  fireEvent.change(within(dialog).getByLabelText("Custom note"), { target: { value: "Retry note" } });
  vi.spyOn(storage, "set").mockRejectedValueOnce(new Error("Save failed"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Close host" }));
  await waitFor(() => expect(results).toHaveBeenCalledTimes(2));
  expect(results).toHaveBeenLastCalledWith(false);
  expect((within(dialog).getByLabelText("Custom note") as HTMLInputElement).value).toBe("Retry note");
  fireEvent.click(within(dialog).getByRole("button", { name: "Close host" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await storage.getAll())[0]).toMatchObject({ note: "Retry note", collectionId: "reading" });
});

test("custom creation reports success even if assigning the item fails, and Escape retries the draft", async () => {
  const storage = new LocalStorageAdapter<Meta>({ key: "custom-assignment-retry" });
  const created = vi.fn();
  render(
    <KeepProvider storage={storage}>
      <KeepSavePopover
        item={item}
        allowCreateCollection
        editorProps={{ debounceMs: 0 }}
        renderEditor={({ state, createCollection }) => (
          <div>
            <input aria-label="Custom collection name" defaultValue="Reading" />
            <button type="button" onClick={() => void createCollection("Reading").then(created)}>
              Create custom
            </button>
            <output aria-label="Selected draft">{state.collectionId}</output>
            {state.saveStatus === "error" && <p role="alert">Assignment failed</p>}
          </div>
        )}
      />
    </KeepProvider>,
  );
  const { dialog } = await saveAndOpen();
  const input = within(dialog).getByLabelText("Custom collection name");
  await waitFor(() => expect(document.activeElement).toBe(input));
  vi.spyOn(storage, "set").mockRejectedValueOnce(new Error("Write failed"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Create custom" }));
  await waitFor(() => expect(created).toHaveBeenCalledWith(true));
  expect(await screen.findByText("Assignment failed")).toBeTruthy();
  expect(within(dialog).getByLabelText("Selected draft").textContent).toBe("reading");
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await storage.getAll())[0]?.collectionId).toBe("reading");
});

test("inherits theme in a host portal", async () => {
  render(
    <KeepProvider storage={new LocalStorageAdapter<Meta>({ key: "host-theme" })}>
      <KeepThemeProvider theme="ocean" variables={{ "--keep-primary": "rgb(1, 2, 3)" }}>
        <KeepSavePopover
          item={item}
          renderPanel={({ content }) => createPortal(<div role="dialog">{content}</div>, document.body)}
        />
      </KeepThemeProvider>
    </KeepProvider>,
  );
  const { dialog } = await saveAndOpen();
  const theme = dialog.querySelector<HTMLElement>(".keep-theme--ocean");
  expect(theme).not.toBeNull();
  expect(theme?.style.getPropertyValue("--keep-primary")).toBe("rgb(1, 2, 3)");
  expect(within(dialog).getByRole("textbox", { name: "Note" }).closest(".keep-theme")).toBe(theme);
});
