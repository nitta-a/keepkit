import { readFile } from "node:fs/promises";
import type {
  KeepItem,
  KeepSyncConflict,
  KeepSyncState,
  StorageAdapter,
  SyncCapableStorageAdapter,
} from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { expect, test, vi } from "vitest";
import {
  createKeepKit,
  KeepActiveFiltersSummary,
  KeepAnnouncements,
  KeepArchiveButton,
  KeepBackup,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepCollectionFilter,
  KeepCollectionSelect,
  KeepEmptyState,
  KeepErrorBoundary,
  KeepItemCard,
  KeepItemCardSkeleton,
  KeepItemCheckbox,
  KeepItemStatusBadge,
  KeepKitProvider,
  KeepLayout,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepPinButton,
  KeepProvider,
  KeepPruneStaleButton,
  KeepQuickEditor,
  KeepReorderableList,
  KeepSavePopover,
  KeepSearchInput,
  KeepSortSelect,
  KeepStaleNotice,
  KeepStatus,
  KeepSyncRecoveryDialog,
  KeepSyncStatusBanner,
  KeepTagEditor,
  KeepTagFilter,
  KeepThemeProvider,
  KeepTourBar,
  KeepUiProvider,
  KeepUndo,
  KeepWorkspace,
  mergeProps,
  useKeepCollections,
  useKeepToastFeedback,
} from "../src/index";

type Meta = { title: string };

const item: KeepItem<Meta> = {
  id: "ui-interaction-item",
  savedAt: 1,
  updatedAt: 1,
  targetType: "article",
  meta: { title: "Interaction item" },
  note: "old note",
};

const secondItem: KeepItem<Meta> = {
  ...item,
  id: "ui-interaction-item-2",
  meta: { title: "Second interaction item" },
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

test("toggles the UI button from keyboard and propagates asChild state attributes", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage()}>
      <KeepButton item={item} asChild>
        {(state) => <a href="/saved">{String(state.isSaved)}</a>}
      </KeepButton>
    </KeepProvider>,
  );

  const link = await screen.findByRole("button", { name: "Save article: Interaction item" });
  expect(link.getAttribute("aria-pressed")).toBe("false");
  expect(link.getAttribute("aria-busy")).toBe("false");
  fireEvent.keyDown(link, { key: "Enter" });
  await waitFor(() => expect(link.textContent).toContain("true"));
  expect(link.getAttribute("aria-pressed")).toBe("true");

  fireEvent.keyDown(link, { key: " " });
  await waitFor(() => expect(link.textContent).toContain("false"));
});

test("archives, pins, moves, and filters items through the public UI controls", async () => {
  const saved = { ...item, collectionId: "reading" };
  const storage = createStorage([saved, { ...secondItem, collectionId: "work" }]);
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepArchiveButton item={saved} />
      <KeepPinButton item={saved} />
      <KeepCollectionSelect item={saved} collectionLabels={{ reading: "Reading" }} />
      <KeepCollectionFilter collectionLabels={{ reading: "Reading", work: "Work" }} />
    </KeepProvider>,
  );
  const archive = await screen.findByRole("button", { name: "Archive" });
  fireEvent.click(archive);
  await waitFor(() => expect(archive.getAttribute("data-archived")).toBe("true"));
  const pin = screen.getByRole("button", { name: "Pin" });
  fireEvent.click(pin);
  await waitFor(() => expect(pin.getAttribute("data-pinned")).toBe("true"));
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[0], { target: { value: "work" } });
  await waitFor(async () =>
    expect((await storage.getAll()).find((entry) => entry.id === saved.id)?.collectionId).toBe("work"),
  );
  expect(screen.getAllByRole("option", { name: "work" }).length).toBeGreaterThan(0);
});

test("opens save popover after a new save and debounces quick note editing", async () => {
  const storage = createStorage();
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepSavePopover item={{ id: item.id, meta: item.meta }} editorProps={{ debounceMs: 10 }} />
    </KeepProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Save item" }));
  expect(await screen.findByRole("dialog")).not.toBeNull();
  const note = screen.getByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "quick note" } });
  await waitFor(async () => expect((await storage.getAll())[0]?.note).toBe("quick note"));
});

test("labels the save popover, focuses its editor, flushes on Escape, and restores trigger focus", async () => {
  const storage = createStorage();
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepSavePopover item={{ id: item.id, meta: item.meta }} editorProps={{ debounceMs: 0 }} />
    </KeepProvider>,
  );

  const trigger = await screen.findByRole("button", { name: "Save item" });
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);

  const dialog = await screen.findByRole("dialog", { name: "Edit saved item" });
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
  const note = screen.getByRole("textbox", { name: "Note" });
  await waitFor(() => expect(document.activeElement).toBe(note));
  const saveButton = dialog.querySelector<HTMLElement>('[data-keep-action="save-quick-edit"]');
  expect(saveButton).not.toBeNull();
  if (!saveButton) throw new Error("Expected the quick editor save button");
  saveButton.focus();
  expect(fireEvent.keyDown(saveButton, { key: "Tab" })).toBe(true);
  fireEvent.change(note, { target: { value: "saved before close" } });
  expect(note.closest("form")?.getAttribute("data-save-status")).toBe("dirty");
  fireEvent.keyDown(dialog, { key: "Escape" });

  await waitFor(async () => expect((await storage.getAll())[0]?.note).toBe("saved before close"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("flushes a controlled save popover when focus moves outside", async () => {
  const storage = createStorage();
  const onOpenChange = vi.fn();

  function ControlledPopover() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <KeepSavePopover
          item={{ id: item.id, meta: item.meta }}
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
          editorProps={{ debounceMs: 0 }}
        />
        <button type="button">Outside</button>
      </>
    );
  }

  render(
    <KeepProvider<Meta> storage={storage}>
      <ControlledPopover />
    </KeepProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Save item" }));
  const note = await screen.findByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "outside save" } });
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onOpenChange).toHaveBeenCalledWith(true);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect((await storage.getAll())[0]?.note).toBe("outside save");
});

test("keeps the save popover open and announces an editor failure", async () => {
  let items: KeepItem<Meta>[] = [];
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [...items],
    set: async (nextItem) => {
      if (nextItem.note) throw new Error("Could not save the note");
      items = [nextItem];
    },
    remove: async () => undefined,
    clear: async () => undefined,
  };
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepSavePopover item={{ id: item.id, meta: item.meta }} editorProps={{ debounceMs: 0 }} />
    </KeepProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Save item" }));
  const note = await screen.findByRole("textbox", { name: "Note" });
  fireEvent.change(note, { target: { value: "will fail" } });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  expect((await screen.findByRole("alert")).textContent).toContain("Could not save the note");
  expect(screen.getByRole("dialog")).not.toBeNull();
  expect(note.closest("form")?.getAttribute("data-save-status")).toBe("error");
});

test("serializes quick editor flushes and persists the latest draft", async () => {
  let storedItem = item;
  let releaseFirstSave: (() => void) | undefined;
  let saveCount = 0;
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [storedItem],
    set: async (nextItem) => {
      saveCount += 1;
      if (saveCount === 1) await new Promise<void>((resolve) => (releaseFirstSave = resolve));
      storedItem = nextItem;
    },
    remove: async () => undefined,
    clear: async () => undefined,
  };
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepQuickEditor item={item} debounceMs={0}>
        {(state) => (
          <>
            <label>
              Draft
              <input value={state.note} onChange={(event) => state.setNote(event.currentTarget.value)} />
            </label>
            <button type="button" onClick={() => void state.flush()}>
              Flush
            </button>
            <output data-testid="quick-save-status">{state.saveStatus}</output>
          </>
        )}
      </KeepQuickEditor>
    </KeepProvider>,
  );

  const draft = await screen.findByRole("textbox", { name: "Draft" });
  fireEvent.change(draft, { target: { value: "first draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Flush" }));
  await waitFor(() => expect(screen.getByTestId("quick-save-status").textContent).toBe("saving"));
  fireEvent.change(draft, { target: { value: "latest draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Flush" }));
  releaseFirstSave?.();

  await waitFor(() => expect(storedItem.note).toBe("latest draft"));
  expect(screen.getByTestId("quick-save-status").textContent).toBe("saved");
  expect(saveCount).toBe(2);
});

test("removes individual active filters and clears all filters", () => {
  function FilterProbe() {
    const [search, setSearch] = useState("react");
    const [tags, setTags] = useState(["read", "work"]);
    return (
      <>
        <KeepActiveFiltersSummary
          search={search}
          tags={tags}
          onSearchChange={setSearch}
          onTagChange={(tag) => setTags((current) => current.filter((value) => value !== tag))}
          onClear={() => {
            setSearch("");
            setTags([]);
          }}
        />
        <output data-testid="filter-state">{`${search}|${tags.join(",")}`}</output>
      </>
    );
  }

  render(
    <KeepUiProvider locale="ja">
      <FilterProbe />
    </KeepUiProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "read を解除" }));
  expect(screen.getByTestId("filter-state").textContent).toBe("react|work");
  fireEvent.click(screen.getByRole("button", { name: "すべての条件をクリア" }));
  expect(screen.getByTestId("filter-state").textContent).toBe("|");
  expect(screen.queryByRole("button", { name: "すべての条件をクリア" })).toBeNull();
});

test("moves focus to the adjacent chip after removal and falls back to search", async () => {
  function FilterFocusProbe() {
    const [search, setSearch] = useState("react");
    const [tags, setTags] = useState(["read", "work"]);
    return (
      <KeepActiveFiltersSummary
        search={search}
        tags={tags}
        onSearchChange={setSearch}
        onTagChange={(tag) => setTags((current) => current.filter((value) => value !== tag))}
      />
    );
  }

  render(
    <KeepUiProvider locale="ja">
      <KeepSearchInput data-testid="filter-search" />
      <FilterFocusProbe />
    </KeepUiProvider>,
  );

  const readChip = screen.getByRole("button", { name: "read を解除" });
  const workChip = screen.getByRole("button", { name: "work を解除" });
  fireEvent.keyDown(workChip, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(readChip);
  fireEvent.keyDown(readChip, { key: "ArrowRight" });
  expect(document.activeElement).toBe(workChip);

  fireEvent.click(readChip);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "work を解除" })));

  fireEvent.click(screen.getByRole("button", { name: "work を解除" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "react を解除" })));

  fireEvent.click(screen.getByRole("button", { name: "react を解除" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("filter-search")));
});

test("renders a context-aware filtered empty state and clears the query", async () => {
  function FilteredList() {
    const [search, setSearch] = useState("missing");
    return (
      <KeepList
        query={{ search: { query: search } }}
        onClearFilters={() => setSearch("")}
        itemCardProps={{ showSaveButton: false }}
      />
    );
  }

  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <FilteredList />
    </KeepProvider>,
  );

  expect(await screen.findByRole("heading", { name: "No matching items found." })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(await screen.findByRole("heading", { name: "Interaction item" })).not.toBeNull();
});

test("merges slot classes, styles, ARIA values, and chained click handlers", () => {
  const calls: string[] = [];
  const childClick = () => calls.push("child");
  const parentClick = () => calls.push("parent");
  const merged = mergeProps(
    { className: "child", style: { color: "red" }, "aria-label": "Child", onClick: childClick },
    { className: "parent", style: { backgroundColor: "blue" }, "aria-label": undefined, onClick: parentClick },
  );

  expect(merged.className).toBe("child parent");
  expect(merged.style).toEqual({ color: "red", backgroundColor: "blue" });
  expect(merged["aria-label"]).toBe("Child");
  (merged.onClick as () => void)();
  expect(calls).toEqual(["child", "parent"]);
});

test("composes callback and object refs for slots and asChild controls", async () => {
  const childRef = createRef<HTMLElement>();
  const parentRef = createRef<HTMLElement>();
  const merged = mergeProps({ ref: childRef }, { ref: parentRef });
  const element = document.createElement("div");
  (merged.ref as (value: HTMLElement | null) => void)(element);
  expect(childRef.current).toBe(element);
  expect(parentRef.current).toBe(element);
  const callbackRef = vi.fn<(value: HTMLElement | null) => void>();
  const callbackMerged = mergeProps({ ref: callbackRef }, {});
  (callbackMerged.ref as (value: HTMLElement | null) => void)(element);
  expect(callbackRef).toHaveBeenCalledWith(element);

  const buttonChildRef = createRef<HTMLAnchorElement>();
  const buttonParentRef = createRef<HTMLAnchorElement>();
  render(
    <KeepProvider<Meta> storage={createStorage()}>
      <KeepButton item={item} asChild ref={buttonParentRef}>
        <a href="/saved" ref={buttonChildRef}>
          Save
        </a>
      </KeepButton>
    </KeepProvider>,
  );
  const link = await screen.findByRole("button", { name: "Save article: Interaction item" });
  expect(buttonChildRef.current).toBe(link);
  expect(buttonParentRef.current).toBe(link);

  const listChildRef = createRef<HTMLDivElement>();
  const listParentRef = createRef<HTMLDivElement>();
  render(
    <KeepProvider<Meta> storage={createStorage()}>
      <KeepList asChild ref={listParentRef}>
        <div ref={listChildRef} />
      </KeepList>
    </KeepProvider>,
  );
  const list = await screen.findByRole("group");
  expect(listChildRef.current).toBe(list);
  expect(listParentRef.current).toBe(list);
});

test("renders semantic shortcut hints in tour and note actions", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepTourBar initialIndex={0} keyboardShortcuts showShortcutHint />
      <KeepNoteEditor item={item} showShortcutHint />
    </KeepProvider>,
  );

  await screen.findByText("1 / 2");
  expect(screen.getByRole("button", { name: "Next page" }).querySelectorAll("kbd")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Save note" }).querySelector("kbd")?.textContent).toBe("Ctrl");
  expect(screen.getByRole("button", { name: "Save note" }).querySelectorAll("kbd")).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "Save note" }).querySelector('[data-keepkit="shortcut-hint"]'),
  ).not.toBeNull();
});

test("scopes theme options and supports icon-only save buttons", async () => {
  function SaveIcon({ className }: { className?: string }) {
    return <svg data-testid="save-icon" className={className} aria-hidden="true" />;
  }

  render(
    <KeepThemeProvider
      theme="compact"
      mode="dark"
      density="compact"
      highContrast
      reducedMotion
      variables={{ "--keep-card-gap": "2rem" }}
      data-testid="theme"
    >
      <KeepProvider<Meta> storage={createStorage()}>
        <KeepButton item={item} iconOnly icons={{ save: SaveIcon }} data-testid="icon-button" />
      </KeepProvider>
    </KeepThemeProvider>,
  );

  const theme = screen.getByTestId("theme");
  expect(theme.className).toContain("keep-theme--compact");
  expect(theme.getAttribute("data-mode")).toBe("dark");
  expect(theme.getAttribute("data-density")).toBe("compact");
  expect(theme.getAttribute("data-high-contrast")).toBe("true");
  expect(theme.getAttribute("data-reduced-motion")).toBe("true");
  expect(theme.style.getPropertyValue("--keep-card-gap")).toBe("2rem");
  const button = await screen.findByTestId("icon-button");
  expect(button.getAttribute("data-keepkit")).toBe("button");
  expect(button.getAttribute("data-keep-action")).toBe("toggle-save");
  expect(button.getAttribute("data-has-custom-icon")).toBe("true");
  expect(button.getAttribute("aria-label")).toBe("Save item");
  expect(screen.getByTestId("save-icon")).not.toBeNull();
  expect(button.textContent).toBe("");
});

test("publishes all layout presets through stable data attributes", async () => {
  render(
    <>
      <KeepLayout layout="list" data-testid="layout-list" />
      <KeepLayout layout="grid" data-testid="layout-grid" />
      <KeepLayout layout="compact" data-testid="layout-compact" />
      <KeepLayout layout="auto" data-testid="layout-auto" />
    </>,
  );

  expect(screen.getByTestId("layout-list").getAttribute("data-layout")).toBe("list");
  expect(screen.getByTestId("layout-grid").getAttribute("data-layout")).toBe("grid");
  expect(screen.getByTestId("layout-compact").getAttribute("data-layout")).toBe("compact");
  expect(screen.getByTestId("layout-auto").getAttribute("data-layout")).toBe("auto");
});

test("renders the requested number of layout-matched skeleton cards while loading", () => {
  const storage: StorageAdapter<Meta> = {
    ...createStorage(),
    getAll: () => new Promise(() => undefined),
  };
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepList layout="grid" loadingCount={4} data-testid="loading-list" />
    </KeepProvider>,
  );

  expect(screen.getByTestId("loading-list").getAttribute("aria-busy")).toBe("true");
  const skeletons = document.querySelectorAll('[data-keepkit="card-skeleton"]');
  expect(skeletons).toHaveLength(4);
  expect(Array.from(skeletons).every((skeleton) => skeleton.getAttribute("data-layout") === "grid")).toBe(true);
  expect(screen.getByRole("status").textContent).toBe("Loading saved items…");
});

test("renders six skeleton cards by default", () => {
  const storage: StorageAdapter<Meta> = {
    ...createStorage(),
    getAll: () => new Promise(() => undefined),
  };
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepList layout="compact" data-testid="default-loading-list" />
    </KeepProvider>,
  );

  expect(screen.getByTestId("default-loading-list").querySelectorAll('[data-keepkit="card-skeleton"]')).toHaveLength(6);
});

test("publishes the standalone skeleton primitive", () => {
  render(<KeepItemCardSkeleton layout="compact" data-testid="skeleton" />);
  expect(screen.getByTestId("skeleton").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByTestId("skeleton").querySelectorAll("[data-skeleton-part]")).toHaveLength(5);
});

test("navigates a saved tour with progress, links, and keyboard shortcuts", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepTourBar initialIndex={0} keyboardShortcuts backHref="/saved" />
    </KeepProvider>,
  );

  await waitFor(() => expect(screen.getByText("1 / 2")).not.toBeNull());
  expect(screen.getByRole("button", { name: "Previous page" }).getAttribute("disabled")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Next page" }).getAttribute("disabled")).toBeNull();
  fireEvent.keyDown(window, { key: "j" });
  await waitFor(() => expect(screen.getByText("2 / 2")).not.toBeNull());
});

test("previews the adjacent item title without changing navigation labels", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepTourBar initialIndex={0} />
    </KeepProvider>,
  );

  await waitFor(() => expect(screen.getByText("1 / 2")).not.toBeNull());
  const nextButton = screen.getByRole("button", { name: "Next page" });
  expect(nextButton.getAttribute("aria-describedby")).not.toBeNull();
  expect(screen.getByText("Next page: Second interaction item")).not.toBeNull();
  expect(screen.queryByText("Previous page:")).toBeNull();
});

test("renders a tour URL action for router or link integration", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepTourBar initialIndex={0} nextHref="/saved/second" />
    </KeepProvider>,
  );

  await waitFor(() => expect(screen.getByText("1 / 2")).not.toBeNull());
  expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe("/saved/second");
});

test("derives tour item links and reports host navigation callbacks", async () => {
  const onNavigate = vi.fn();
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepTourBar
        initialIndex={0}
        getItemHref={(entry) => `/saved/${entry.id}`}
        getBackHref={() => "/saved"}
        onNavigate={onNavigate}
      />
    </KeepProvider>,
  );

  const next = await screen.findByRole("link", { name: "Next page" });
  expect(next.getAttribute("href")).toBe(`/saved/${secondItem.id}`);
  fireEvent.click(next);
  expect(onNavigate).toHaveBeenCalledWith("next", secondItem);
  expect(screen.getByRole("link", { name: "All saved items" }).getAttribute("href")).toBe("/saved");
});

test("reorders items with keyboard handles and reports the new id order", () => {
  const onReorder = vi.fn();
  render(
    <KeepReorderableList
      items={[item, secondItem]}
      onReorder={onReorder}
      renderItem={(entry, state) => <span {...state.dragHandleProps}>{entry.meta.title}</span>}
    />,
  );

  fireEvent.keyDown(screen.getByRole("button", { name: "Move item 2" }), { key: "ArrowUp" });
  expect(onReorder).toHaveBeenCalledWith([secondItem.id, item.id]);
});

test("supports Space grab and release on reorder handles", () => {
  const onReorder = vi.fn();
  render(
    <KeepReorderableList
      items={[item, secondItem]}
      onReorder={onReorder}
      renderItem={(entry, state) => <span {...state.dragHandleProps}>{entry.meta.title}</span>}
    />,
  );

  const handle = screen.getByRole("button", { name: "Move item 1" });
  fireEvent.keyDown(handle, { key: " " });
  expect(handle.getAttribute("aria-grabbed")).toBe("true");
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(onReorder).toHaveBeenCalledWith([secondItem.id, item.id]);
  fireEvent.keyDown(handle, { key: " " });
  expect(handle.getAttribute("aria-grabbed")).toBe("false");
});

test("integrates reorder handles and undo into KeepCollection", async () => {
  const onReorder = vi.fn();
  const storage = createStorage([item, secondItem]);
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepCollection reorderable onReorder={onReorder} features={{ search: false, sort: false, pagination: false }} />
    </KeepProvider>,
  );

  const secondHandle = await screen.findByRole("button", { name: "Move item 2" });
  fireEvent.keyDown(secondHandle, { key: "ArrowUp" });
  await waitFor(() => expect(onReorder).toHaveBeenCalledWith([secondItem, item]));
  const undo = await screen.findByRole("button", { name: "Undo reorder" });
  fireEvent.click(undo);
  await waitFor(async () =>
    expect(
      (await storage.getAll()).sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((entry) => entry.id),
    ).toEqual([item.id, secondItem.id]),
  );
});

test("derives collection candidates through the core hook and binds them to the editor", async () => {
  function CollectionsProbe() {
    const collections = useKeepCollections<Meta>({ orderBy: "count" });
    return (
      <output data-testid="collections">
        {collections.map((collection) => `${collection.id}:${collection.count}`).join(",")}
      </output>
    );
  }

  render(
    <KeepProvider<Meta>
      storage={createStorage([
        { ...item, collectionId: "reading" },
        { ...secondItem, collectionId: "reading" },
      ])}
    >
      <CollectionsProbe />
      <KeepQuickEditor item={item} debounceMs={0} />
    </KeepProvider>,
  );

  await waitFor(() => expect(screen.getByTestId("collections").textContent).toBe("reading:2"));
  expect(screen.getByRole("option", { name: "reading" })).not.toBeNull();
});

test("provides the standard edit dialog from KeepItemCard", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepItemCard item={item} showEditButton />
    </KeepProvider>,
  );

  const edit = await screen.findByRole("button", { name: "Edit saved item" });
  expect(edit.getAttribute("data-keep-action")).toBe("edit");
  expect(edit.getAttribute("aria-haspopup")).toBe("dialog");
  fireEvent.click(edit);
  expect(await screen.findByRole("dialog", { name: "Edit saved item" })).not.toBeNull();
  expect(screen.getByRole("textbox", { name: "Note" })).not.toBeNull();
});

test("switches KeepCollection archive scopes and keeps all items available", async () => {
  const archived = { ...secondItem, archived: true };
  render(
    <KeepProvider<Meta> storage={createStorage([item, archived])}>
      <KeepCollection archiveScope="all" features={{ search: false, sort: false, pagination: false }} />
    </KeepProvider>,
  );

  const scope = await screen.findByRole("combobox", { name: "Archive scope" });
  await waitFor(() => expect(screen.getByRole("heading", { name: "Interaction item" })).not.toBeNull());
  expect(screen.getByRole("heading", { name: "Second interaction item" })).not.toBeNull();
  fireEvent.change(scope, { target: { value: "archived" } });
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Interaction item" })).toBeNull());
  expect(screen.getByRole("heading", { name: "Second interaction item" })).not.toBeNull();
});

test("shows the active drop insertion line while dragging", () => {
  const onReorder = vi.fn();
  render(
    <KeepReorderableList
      items={[item, secondItem]}
      onReorder={onReorder}
      renderItem={(entry, state) => <span {...state.dragHandleProps}>{entry.meta.title}</span>}
    />,
  );

  fireEvent.dragStart(screen.getByRole("button", { name: "Move item 1" }));
  const target = screen.getAllByRole("listitem")[1];
  fireEvent.dragOver(target, { clientY: 1 });
  expect(target.getAttribute("data-drop-target")).toBe("before");
  expect(onReorder).not.toHaveBeenCalled();
});

test("persists provider reorder actions and exposes the custom order in list state", async () => {
  function ReorderProbe() {
    const { items, reorderItems } = useKeepContext<Meta>();
    return (
      <>
        <button type="button" onClick={() => void reorderItems([secondItem.id, item.id])}>
          Reorder
        </button>
        <output data-testid="ordered-items">{items.map((entry) => entry.id).join(",")}</output>
      </>
    );
  }

  const storage = createStorage([item, secondItem]);
  render(
    <KeepProvider<Meta> storage={storage}>
      <ReorderProbe />
    </KeepProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId("ordered-items").textContent).toBe("ui-interaction-item,ui-interaction-item-2"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reorder" }));
  await waitFor(() =>
    expect(screen.getByTestId("ordered-items").textContent).toBe("ui-interaction-item-2,ui-interaction-item"),
  );
  expect(
    (await storage.getAll()).sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((entry) => entry.id),
  ).toEqual([secondItem.id, item.id]);
});

test("emits localized feedback payloads when an item is saved and removed", async () => {
  const onFeedback = vi.fn();
  render(
    <KeepUiProvider<Meta> locale="ja" onFeedback={onFeedback}>
      <KeepProvider<Meta> storage={createStorage([secondItem])}>
        <KeepButton item={{ id: item.id, targetType: item.targetType, meta: item.meta }} />
        <KeepItemCard item={secondItem} showSaveButton={false} />
      </KeepProvider>
    </KeepUiProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Save item" }));
  await waitFor(() =>
    expect(onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "item-saved",
        item: expect.objectContaining({ id: item.id }),
        message: "アイテムを保存しました。",
      }),
    ),
  );

  fireEvent.click(screen.getByRole("button", { name: "削除" }));
  await waitFor(() =>
    expect(onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "item-removed",
        item: expect.objectContaining({ id: secondItem.id }),
        message: "アイテムを削除しました。",
        undo: expect.any(Function),
      }),
    ),
  );
  const removedEvent = onFeedback.mock.calls.map(([event]) => event).find((event) => event.type === "item-removed");
  if (!removedEvent || !("undo" in removedEvent)) throw new Error("The removal feedback did not expose undo.");
  await removedEvent.undo();
  expect(onFeedback).toHaveBeenCalledWith(
    expect.objectContaining({ type: "item-restored", item: expect.objectContaining({ id: secondItem.id }) }),
  );
});

test("adapts removal feedback to a toast action", async () => {
  const showToast = vi.fn();

  function ToastExample() {
    const onFeedback = useKeepToastFeedback<Meta>(showToast);
    return (
      <KeepUiProvider<Meta> onFeedback={onFeedback}>
        <KeepProvider<Meta> storage={createStorage([item])}>
          <KeepItemCard item={item} showSaveButton={false} />
        </KeepProvider>
      </KeepUiProvider>
    );
  }

  render(<ToastExample />);
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      "Item removed.",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo", onClick: expect.any(Function) }) }),
    ),
  );
});

test("keeps compound card parts complete and accessible", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepItemCard
        item={{ ...item, tags: ["read"] }}
        href="/items/compound"
        getImageProps={() => ({ src: "/compound.png", alt: "Compound preview" })}
      >
        <KeepItemCard.Media data-testid="compound-media" />
        <KeepItemCard.Content data-testid="compound-content">
          <KeepItemCard.Title />
          <KeepItemCard.Tags />
        </KeepItemCard.Content>
        <KeepItemCard.Actions data-testid="compound-actions" />
      </KeepItemCard>
    </KeepProvider>,
  );

  expect(await screen.findByRole("img", { name: "Compound preview" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "Interaction item" }).tagName).toBe("H3");
  expect(screen.getByRole("link", { name: "Interaction item" }).getAttribute("href")).toBe("/items/compound");
  expect(screen.getByRole("list", { name: "Tags" }).textContent).toContain("read");
  expect(screen.getByRole("button", { name: "Remove Interaction item" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Remove" }).getAttribute("data-keep-action")).toBe("remove-item");
  expect(screen.getByTestId("compound-media").getAttribute("data-keep-card-part")).toBe("media");
  expect(screen.getByTestId("compound-content").getAttribute("data-keep-card-part")).toBe("content");
  expect(screen.getByTestId("compound-actions").getAttribute("data-keep-card-part")).toBe("actions");
});

test("composes save, pin, archive, and remove card action slots without changing default actions", async () => {
  const storage = createStorage([item]);
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepItemCard item={item}>
        <KeepItemCard.Content />
        <KeepItemCard.Actions>
          <KeepItemCard.Save data-testid="card-save-slot" />
          <KeepItemCard.Pin />
          <KeepItemCard.Archive />
          <KeepItemCard.Remove data-testid="card-remove-slot">Remove now</KeepItemCard.Remove>
        </KeepItemCard.Actions>
      </KeepItemCard>
    </KeepProvider>,
  );

  expect((await screen.findByTestId("card-save-slot")).getAttribute("data-keep-action")).toBe("toggle-save");
  expect(screen.getByTestId("card-remove-slot").getAttribute("data-keep-action")).toBe("remove-item");
  const pin = screen.getByRole("button", { name: "Pin" });
  fireEvent.click(pin);
  await waitFor(() => expect(pin.getAttribute("aria-pressed")).toBe("true"));
  const archive = screen.getByRole("button", { name: "Archive" });
  fireEvent.click(archive);
  await waitFor(() => expect(archive.getAttribute("aria-pressed")).toBe("true"));
  fireEvent.click(screen.getByRole("button", { name: "Remove now" }));
  await waitFor(async () => expect(await storage.getAll()).toEqual([]));
});

test("highlights literal, case-insensitive search matches in card titles and content", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepList query={{ search: { query: "INTERACTION" } }} itemCardProps={{ showSaveButton: false }} />
    </KeepProvider>,
  );

  const heading = await screen.findByRole("heading", { name: "Interaction item" });
  const highlight = heading.querySelector('mark.keep-highlight[data-highlight="true"]');
  expect(highlight?.textContent).toBe("Interaction");
  expect(highlight?.className).toBe("keep-highlight");
});

test("highlights CJK text and regex punctuation literally", async () => {
  const bracketItem = { ...item, id: "bracket-item", meta: { title: "[test] 日本語" } };
  const plusItem = { ...item, id: "plus-item", meta: { title: "a+b 日本語" } };
  render(
    <KeepProvider<Meta> storage={createStorage([bracketItem, plusItem])}>
      <KeepItemCard item={bracketItem} highlightQuery="[test]" showSaveButton={false} />
      <KeepItemCard item={plusItem} highlightQuery="a+b" showSaveButton={false} />
    </KeepProvider>,
  );

  const bracketHeading = await screen.findByRole("heading", { name: "[test] 日本語" });
  const plusHeading = await screen.findByRole("heading", { name: "a+b 日本語" });
  expect(bracketHeading.querySelector("mark.keep-highlight")?.textContent).toBe("[test]");
  expect(plusHeading.querySelector("mark.keep-highlight")?.textContent).toBe("a+b");
});

test("publishes stable card contracts for clamped titles and reserved media space", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepItemCard item={item} showSaveButton={false} />
    </KeepProvider>,
  );

  const title = await screen.findByRole("heading", { name: "Interaction item" });
  expect(title.getAttribute("data-line-clamp")).toBe("2");
  expect(title.closest('[data-keep-card-part="media"]')).toBeNull();
  expect(document.querySelector('[data-keep-card-part="media"]')?.getAttribute("data-aspect-ratio")).toBe("1/1");
});

test("replaces failed card media with a custom fallback and exposes media status", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepItemCard
        item={item}
        showSaveButton={false}
        getImageProps={() => ({ src: "/broken.png", alt: "Broken preview" })}
      >
        <KeepItemCard.Media data-testid="media" fallback={<span data-testid="media-fallback">No preview</span>} />
        <KeepItemCard.Content />
        <KeepItemCard.Actions />
      </KeepItemCard>
    </KeepProvider>,
  );

  const media = await screen.findByTestId("media");
  expect(media.getAttribute("data-media-status")).toBe("loading");
  const image = media.querySelector("img");
  if (!image) throw new Error("The card image was not rendered.");
  fireEvent.load(image);
  expect(media.getAttribute("data-media-status")).toBe("loaded");
  fireEvent.error(image);
  await waitFor(() => expect(media.getAttribute("data-media-status")).toBe("error"));
  expect(media.querySelector("img")).toBeNull();
  expect(screen.getByTestId("media-fallback").textContent).toBe("No preview");
});

test("moves focus between list cards with roving tabindex keys", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepList data-testid="roving-list" itemCardProps={{ showSaveButton: false }} />
    </KeepProvider>,
  );

  const list = await screen.findByTestId("roving-list");
  await waitFor(() => expect(list.querySelectorAll('[data-keepkit="card"]')).toHaveLength(2));
  const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-keepkit="card"]'));
  await waitFor(() => expect(cards[0]?.tabIndex).toBe(0));

  cards[0]?.focus();
  fireEvent.keyDown(cards[0] as HTMLElement, { key: "ArrowRight" });
  expect(document.activeElement).toBe(cards[1]);
  expect(cards[0]?.tabIndex).toBe(-1);
  expect(cards[1]?.tabIndex).toBe(0);

  fireEvent.keyDown(cards[1] as HTMLElement, { key: "Home" });
  expect(document.activeElement).toBe(cards[0]);
  fireEvent.keyDown(cards[0] as HTMLElement, { key: "End" });
  expect(document.activeElement).toBe(cards[1]);
});

test("applies roving tabindex to cards placed directly in KeepLayout", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepLayout data-testid="roving-layout">
        <KeepItemCard item={item} showSaveButton={false} />
        <KeepItemCard item={secondItem} showSaveButton={false} />
      </KeepLayout>
    </KeepProvider>,
  );

  const layout = await screen.findByTestId("roving-layout");
  const cards = Array.from(layout.querySelectorAll<HTMLElement>('[data-keepkit="card"]'));
  await waitFor(() => expect(cards[0]?.tabIndex).toBe(0));
  cards[1]?.focus();
  fireEvent.keyDown(cards[1] as HTMLElement, { key: "ArrowUp" });
  expect(document.activeElement).toBe(cards[0]);
});

test("ships dark-mode and reduced-motion CSS contracts", async () => {
  const cssText = (
    await Promise.all(
      [
        "../src/styles/base.css",
        "../src/styles/button.css",
        "../src/styles/collection.css",
        "../src/styles/sync.css",
      ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
    )
  ).join("\n");

  expect(cssText).toContain("prefers-color-scheme: dark");
  expect(cssText).toContain("prefers-reduced-motion: reduce");
  expect(cssText).toContain("--keep-primary");
  expect(cssText).toContain("--keep-icon-size");
  expect(cssText).toContain("--keep-control-gap");
  expect(cssText).toContain("--keep-shadow");
  expect(cssText).toContain("--keep-success");
  expect(cssText).toContain("--keep-warning");
  expect(cssText).toContain("mask: var(--keep-action-icon)");
  expect(cssText).toContain('[data-keep-action="search"]');
  expect(cssText).toContain('[data-keep-action="toggle-pin"]');
  expect(cssText).toContain('[data-keep-action="toggle-archive"]');
  expect(cssText).toContain('[data-keepkit="quick-editor"]');
  expect(cssText).toContain('[data-keep-popover-panel="true"]');
  expect(cssText).toContain('[data-keep-card-part="collection-badge"]');
  expect(cssText).toContain(":focus-visible");
  expect(cssText).toContain(".dark");
  expect(cssText).toContain("keep-theme--high-contrast");
  expect(cssText).toContain("keep-theme--ocean");
  expect(cssText).toContain("keep-theme--forest");
  expect(cssText).toContain("keep-theme--sunset");
  expect(cssText).toContain("keep-theme--lavender");
  expect(cssText).toContain("@media (max-width: 48rem)");
  expect(cssText).toContain("flex: 0 0 auto;");
  expect(cssText).toContain("container-type: inline-size");
  expect(cssText).toContain("container-name: keepkit-layout");
  expect(cssText).toContain("@container keepkit-layout");
  expect(cssText).toContain("keepkit-skeleton-pulse");
  expect(cssText).toContain('[data-keep-action="delete-selected"]');
  expect(cssText).toContain("background: transparent;");
  expect(cssText).toContain("background: color-mix(in srgb, var(--keep-destructive) 8%, var(--keep-card));");
  expect(cssText).toContain('[data-keepkit="button"][data-state="error"]');
  expect(cssText).toContain("background: var(--keep-destructive);");
});

test("keeps the Tailwind v4 bridge scoped and composable", async () => {
  const path = "../src/tailwind.css";
  const cssText = await readFile(new URL(path, import.meta.url), "utf8");

  expect(cssText).toContain('@import "./theme.css" layer(components);');
  expect(cssText).toContain("--keep-border: var(--color-border, #d7dee8);");
  expect(cssText).toContain("--keep-primary: var(--color-primary, #2563eb);");
  expect(cssText).toContain("--color-keep-background: var(--keep-background);");
  expect(cssText).not.toContain("--color-background: var(--keep-background)");
  expect(cssText).toContain("@custom-variant dark");
});

test("selects color presets through the theme parameter", () => {
  const { rerender } = render(
    <KeepThemeProvider theme="ocean" data-testid="palette">
      Ocean
    </KeepThemeProvider>,
  );

  const palette = screen.getByTestId("palette");
  expect(palette.getAttribute("data-keep-theme")).toBe("ocean");
  expect(palette.className).toContain("keep-theme--ocean");

  rerender(
    <KeepThemeProvider theme="forest" data-testid="palette">
      Forest
    </KeepThemeProvider>,
  );
  expect(palette.getAttribute("data-keep-theme")).toBe("forest");
  expect(palette.className).toContain("keep-theme--forest");
});

test("debounces note persistence and saves with Ctrl+Enter", async () => {
  const storage = createStorage([item]);
  const onSaved = vi.fn();
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepNoteEditor item={item} debounceMs={20} onSaved={onSaved} />
    </KeepProvider>,
  );

  const editor = await screen.findByRole("textbox", { name: "Note" });
  fireEvent.change(editor, { target: { value: "debounced note" } });
  expect(onSaved).not.toHaveBeenCalled();
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("debounced note"));
  expect((await storage.getAll())[0]?.note).toBe("debounced note");

  fireEvent.change(editor, { target: { value: "keyboard note" } });
  fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("keyboard note"));
});

test("does not add a tag while an IME composition is active", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepTagEditor item={item} />
    </KeepProvider>,
  );

  const input = await screen.findByRole("textbox", { name: "Tags to apply" });
  fireEvent.change(input, { target: { value: "日本語" } });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(screen.queryByText("日本語")).toBeNull();
  expect((input as HTMLInputElement).value).toBe("日本語");

  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByText("日本語")).not.toBeNull();
});

test("exposes visible-item select-all state and toggles all visible items", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item, secondItem])}>
      <KeepBulkActions
        render={({ isAllSelected, selectedIds, toggleSelectAll }) => (
          <>
            <button type="button" onClick={toggleSelectAll}>
              Toggle visible items
            </button>
            <output>{`${isAllSelected}:${selectedIds.join(",")}`}</output>
          </>
        )}
      />
    </KeepProvider>,
  );

  await screen.findByText("false:");
  fireEvent.click(screen.getByRole("button", { name: "Toggle visible items" }));
  expect(await screen.findByText(`true:${item.id},${secondItem.id}`)).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Toggle visible items" }));
  expect(await screen.findByText("false:")).not.toBeNull();
});

test("exposes stable data attributes for CSS styling", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepButton item={item} data-testid="button" />
      <KeepButton item={item} disabled data-testid="disabled-button" />
      <KeepItemCard item={item} data-testid="card" />
      <KeepCollection features={{ search: false, sort: false, pagination: false }} data-testid="collection" />
      <KeepTagFilter data-testid="tag-filter" />
      <KeepList data-testid="list" />
      <KeepBulkActions data-testid="bulk" />
      <KeepItemCheckbox item={item} data-testid="checkbox" />
      <KeepNoteEditor item={item} data-testid="note" />
      <KeepTagEditor item={item} data-testid="tag-editor" />
      <KeepSearchInput data-testid="search" />
      <KeepSortSelect data-testid="sort" />
      <KeepPagination totalCount={2} pageSize={1} data-testid="pagination" />
      <KeepStatus data-testid="status" />
      <KeepEmptyState data-testid="empty" />
      <KeepAnnouncements data-testid="announcements" />
    </KeepProvider>,
  );

  await screen.findByRole("heading", { name: "Interaction item" });
  expect(screen.getByTestId("button").getAttribute("data-state")).toBe("saved");
  expect(screen.getByTestId("button").getAttribute("data-keep-action")).toBe("toggle-save");
  expect(screen.getByTestId("disabled-button").getAttribute("data-disabled")).toBe("true");
  expect(screen.getByTestId("card").getAttribute("data-state")).toBe("saved");
  expect(screen.getByTestId("collection").getAttribute("data-state")).toBe("ready");
  expect(screen.getByTestId("tag-filter").getAttribute("data-state")).toBe("all");
  expect(screen.getByTestId("list").getAttribute("data-state")).toBe("ready");
  expect(screen.getByTestId("bulk").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("checkbox").getAttribute("data-state")).toBe("unchecked");
  expect(screen.getByTestId("note").getAttribute("data-state")).toBe("clean");
  expect(screen.getByTestId("tag-editor").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("search").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("sort").getAttribute("data-state")).toBe("selected");
  expect(screen.getByTestId("pagination").getAttribute("data-state")).toBe("active");
  expect(screen.getByTestId("status").getAttribute("data-state")).toBe("idle");
  expect(screen.getByTestId("empty").getAttribute("data-state")).toBe("empty");
  expect(screen.getByTestId("announcements").getAttribute("data-state")).toBe("announcing");
  expect(screen.getByTestId("card").querySelector('[data-keep-action="remove-item"]')).not.toBeNull();
  expect(screen.getByTestId("tag-filter").querySelector('[data-keep-action="filter-all-tags"]')).not.toBeNull();
  expect(screen.getByTestId("bulk").querySelector('[data-keep-action="delete-selected"]')).not.toBeNull();
  expect(screen.getByTestId("checkbox").getAttribute("data-keep-action")).toBe("select-item");
  expect(screen.getByTestId("note").querySelector('[data-keep-action="save-note"]')).not.toBeNull();
  expect(screen.getByTestId("tag-editor").querySelector('[data-keep-action="apply-tags"]')).not.toBeNull();
  expect(screen.getByTestId("search").getAttribute("data-keep-action")).toBe("search");
  expect(screen.getByTestId("sort").getAttribute("data-keep-action")).toBe("sort");
  expect(screen.getByTestId("pagination").querySelector('[data-keep-action="previous-page"]')).not.toBeNull();
  expect(screen.getByTestId("pagination").querySelector('[data-keep-action="next-page"]')).not.toBeNull();
});

test("enables optional pin, archive, and tag card features from collection config", async () => {
  const storage = createStorage([{ ...item, tags: ["read"] }]);
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepCollection
        features={{ search: false, sort: false, pagination: false, pin: true, archive: true, tags: false }}
      />
    </KeepProvider>,
  );

  expect(await screen.findByRole("heading", { name: "Interaction item" })).not.toBeNull();
  expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
  const pin = screen.getByRole("button", { name: "Pin" });
  const archive = screen.getByRole("button", { name: "Archive" });
  expect(pin.getAttribute("aria-pressed")).toBe("false");
  expect(archive.getAttribute("aria-pressed")).toBe("false");

  fireEvent.click(pin);
  await waitFor(() => expect(pin.getAttribute("aria-pressed")).toBe("true"));
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await waitFor(async () => expect((await storage.getAll())[0]?.archived).toBe(true));
});

test("allows explicit item card feature props to override collection defaults", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([{ ...item, tags: ["read"] }])}>
      <KeepCollection
        features={{ search: false, sort: false, pagination: false, pin: true, archive: true, tags: false }}
        itemCardProps={{ showPinButton: false, showArchiveButton: false, showTags: true }}
      />
    </KeepProvider>,
  );

  expect(await screen.findByRole("heading", { name: "Interaction item" })).not.toBeNull();
  expect(screen.getByRole("list", { name: "Tags" }).textContent).toContain("read");
  expect(screen.queryByRole("button", { name: "Pin" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
});

test("links available card titles and blocks unavailable card links", async () => {
  const onOpen = vi.fn();
  render(
    <KeepProvider<Meta> storage={createStorage([item, { ...secondItem, status: "expired" }])}>
      <KeepItemCard item={item} href={(entry) => `/items/${entry.id}`} onOpen={onOpen} linkTargetAttribute="_blank" />
      <KeepItemCard item={{ ...secondItem, status: "expired" }} href="/items/expired" />
    </KeepProvider>,
  );

  const link = await screen.findByRole("link", { name: "Interaction item" });
  expect(screen.getAllByText("1970-01-01")).toHaveLength(2);
  expect(link.getAttribute("href")).toBe("/items/ui-interaction-item");
  expect(link.getAttribute("target")).toBe("_blank");
  fireEvent.click(link);
  expect(onOpen).toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "Second interaction item" })).toBeNull();
  expect(screen.getByText("Expired")).not.toBeNull();
  expect(screen.getByText("Second interaction item").getAttribute("aria-disabled")).toBe("true");
});

test("adds safe defaults for external detail links and exposes removed status", async () => {
  const removedItem = { ...item, id: "removed-item", status: "removed" as const };
  render(
    <KeepProvider<Meta> storage={createStorage([item, removedItem])}>
      <KeepItemCard item={item} href="https://example.com/items/ui-interaction-item" />
      <KeepItemCard item={removedItem} href="/items/removed" />
    </KeepProvider>,
  );

  const externalLink = await screen.findByRole("link", { name: "Interaction item" });
  expect(externalLink.getAttribute("target")).toBe("_blank");
  expect(externalLink.getAttribute("rel")).toBe("noreferrer");
  const removedCard = screen.getByText("Removed").closest('[data-keepkit="card"]');
  expect(removedCard?.getAttribute("data-item-status")).toBe("removed");
  expect(removedCard?.getAttribute("aria-disabled")).toBe("true");
  expect(removedCard?.querySelector('[data-link-disabled="true"]')?.textContent).toBe("Interaction item");
});

test("double-encodes item status with an icon and accessible label", () => {
  render(
    <>
      <KeepItemStatusBadge status="expired" data-testid="expired-status" />
      <KeepItemStatusBadge status="removed" data-testid="removed-status" />
      <KeepItemStatusBadge status="restricted" data-testid="restricted-status" />
    </>,
  );

  expect(screen.getByTestId("expired-status").querySelector('[data-status-icon="clock"]')).not.toBeNull();
  expect(screen.getByTestId("expired-status").textContent).toContain("Expired");
  expect(screen.getByTestId("expired-status").getAttribute("aria-label")).toBe("Expired");
  expect(screen.getByTestId("removed-status").querySelector('[data-status-icon="ban"]')).not.toBeNull();
  expect(screen.getByTestId("removed-status").textContent).toContain("Removed");
  expect(screen.getByTestId("restricted-status").querySelector('[data-status-icon="lock"]')).not.toBeNull();
  expect(screen.getByTestId("restricted-status").textContent).toContain("Private");
  expect(screen.getByTestId("restricted-status").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("offers localized stale-item recovery actions and bulk cleanup", async () => {
  const staleItem = { ...item, id: "stale-item", status: "expired" as const, statusReason: "Source expired" };
  const onRetry = vi.fn().mockResolvedValue(undefined);
  const onFeedback = vi.fn();
  render(
    <KeepUiProvider<Meta> onFeedback={onFeedback}>
      <KeepProvider<Meta> storage={createStorage([staleItem])}>
        <KeepItemStatusBadge status="expired" data-testid="status-badge" />
        <KeepStaleNotice item={staleItem} onRetry={onRetry} />
        <KeepPruneStaleButton />
      </KeepProvider>
    </KeepUiProvider>,
  );

  expect(await screen.findByTestId("status-badge")).not.toBeNull();
  const retryButton = screen.getByRole("button", { name: "Retry" });
  expect(retryButton.getAttribute("data-keep-action")).toBe("retry-item");
  fireEvent.click(retryButton);
  await waitFor(() => expect(onRetry).toHaveBeenCalledWith(staleItem));
  const pruneButton = screen.getByRole("button", { name: "Remove unavailable items (1)" });
  expect(pruneButton.getAttribute("data-keep-action")).toBe("prune-stale");
  fireEvent.click(pruneButton);
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "Remove unavailable items (0)" }) as HTMLButtonElement).disabled).toBe(
      true,
    ),
  );
  expect(onFeedback).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "stale-pruned",
      items: [expect.objectContaining({ id: staleItem.id })],
      undo: expect.any(Function),
    }),
  );
});

test("surfaces sync conflicts and delegates server resolution from the recovery dialog", async () => {
  const onFeedback = vi.fn();
  const notifications = new Set<() => void>();
  const conflict: KeepSyncConflict<Meta> = {
    id: item.id,
    operation: { operationId: "conflict-operation", type: "upsert", id: item.id, item, createdAt: 1 },
    remote: { ...item, note: "server note" },
    revision: "server-revision",
  };
  let syncState: KeepSyncState<Meta> = {
    status: "conflict",
    pendingCount: 1,
    conflictIds: [item.id],
    conflicts: [conflict],
  };
  const storage: SyncCapableStorageAdapter<Meta> = {
    ...createStorage([item]),
    getSyncState: () => syncState,
    subscribeSync: (listener) => {
      notifications.add(listener);
      return () => notifications.delete(listener);
    },
    flushSync: async () => undefined,
    resolveSyncConflict: async () => {
      syncState = { status: "synced", pendingCount: 0, conflictIds: [], conflicts: [] };
      notifications.forEach((listener) => {
        listener();
      });
    },
  };

  render(
    <KeepKitProvider<Meta> storage={storage} onFeedback={onFeedback}>
      <KeepSyncStatusBanner onResolveConflicts={() => undefined} />
      <KeepSyncRecoveryDialog open />
    </KeepKitProvider>,
  );

  expect((await screen.findAllByText("Some changes need conflict resolution.")).length).toBe(2);
  expect(screen.getByLabelText("Local")).not.toBeNull();
  expect(screen.getByLabelText("Remote")).not.toBeNull();
  expect(screen.getByText("old note")).not.toBeNull();
  expect(screen.getByText("server note")).not.toBeNull();
  expect(screen.getAllByText("1970-01-01")).toHaveLength(2);
  const useServerButton = screen.getByRole("button", { name: "Use server" });
  expect(useServerButton.getAttribute("data-keep-action")).toBe("use-server");
  fireEvent.click(useServerButton);
  await waitFor(() => expect(screen.queryByText("Some changes need conflict resolution.")).toBeNull());
  expect(onFeedback).toHaveBeenCalledWith(
    expect.objectContaining({ type: "sync-completed", message: "All changes are synced." }),
  );
});

test("composes collection, management, and sync primitives through workspace presets", async () => {
  const conflict: KeepSyncConflict<Meta> = {
    id: item.id,
    operation: { operationId: "workspace-conflict", type: "upsert", id: item.id, item, createdAt: 1 },
    remote: { ...item, note: "remote workspace note" },
    revision: "workspace-revision",
  };
  const syncState: KeepSyncState<Meta> = {
    status: "conflict",
    pendingCount: 1,
    conflictIds: [item.id],
    conflicts: [conflict],
  };
  const storage: SyncCapableStorageAdapter<Meta> = {
    ...createStorage([item]),
    getSyncState: () => syncState,
    subscribeSync: () => () => undefined,
    flushSync: async () => undefined,
    resolveSyncConflict: async () => undefined,
  };

  const { unmount } = render(
    <KeepKitProvider<Meta> storage={storage}>
      <KeepWorkspace
        preset="sync"
        collectionProps={{ features: { search: false, sort: false, pagination: false } }}
        data-testid="workspace"
      />
    </KeepKitProvider>,
  );

  expect((await screen.findByTestId("workspace")).getAttribute("data-preset")).toBe("sync");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Resolve conflicts" }));
  expect(await screen.findByRole("dialog", { name: "Resolve conflicts" })).not.toBeNull();
  unmount();

  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepWorkspace preset="management" data-testid="management-workspace" />
    </KeepProvider>,
  );
  await screen.findByRole("heading", { name: "Interaction item" });
  expect(screen.getByTestId("management-workspace").querySelector('[data-keepkit="workspace-actions"]')).not.toBeNull();
  expect(screen.getByRole("button", { name: "Pin" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Archive" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Export JSON" })).not.toBeNull();
});

test("exposes the same workspace implementation from createKeepKit and supports slots", async () => {
  const keep = createKeepKit<Meta>({
    storage: createStorage([item]),
    getTitle: (entry) => `Saved: ${entry.meta.title}`,
  });

  const { unmount } = render(
    <keep.Provider>
      <keep.Workspace preset="basic" />
    </keep.Provider>,
  );

  expect(await screen.findByRole("heading", { name: "Saved: Interaction item" })).not.toBeNull();
  expect(screen.queryByRole("textbox", { name: "Search" })).toBeNull();
  unmount();

  render(
    <keep.Provider>
      <keep.Workspace preset="basic" slots={{ before: <p>Workspace header</p>, collection: <p>Custom collection</p> }}>
        {(state) => <output>{`${state.preset}:${state.recoveryOpen}`}</output>}
      </keep.Workspace>
    </keep.Provider>,
  );

  expect(screen.getByText("Workspace header")).not.toBeNull();
  expect(screen.getByText("Custom collection")).not.toBeNull();
  expect(screen.getByText("basic:false")).not.toBeNull();
});

test("opts into workspace region surfaces without creating frames for empty slots", () => {
  render(
    <KeepWorkspace
      preset="basic"
      surface={{ before: "plain", collection: "panel", children: "compact", after: "panel" }}
      sectionGap="comfortable"
      data-testid="surface-workspace"
      slots={{ before: <p>Workspace header</p>, collection: <p>Custom collection</p>, after: null }}
    >
      {null}
    </KeepWorkspace>,
  );

  const workspace = screen.getByTestId("surface-workspace");
  expect(workspace.getAttribute("data-surface")).toBe("custom");
  expect(workspace.getAttribute("data-section-gap")).toBe("comfortable");
  expect(workspace.querySelectorAll('[data-keepkit="workspace-region"]')).toHaveLength(2);
  expect(workspace.querySelector('[data-region="before"]')?.getAttribute("data-surface")).toBe("plain");
  expect(workspace.querySelector('[data-region="collection"]')?.getAttribute("data-surface")).toBe("panel");
  expect(workspace.querySelector('[data-region="after"]')).toBeNull();
});

test("groups collection toolbar controls and host actions with localized group labels", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepCollection
        toolbarVariant="panel"
        toolbarLayout="grouped"
        archiveScope="all"
        features={{ tagFilter: true, collectionFilter: true, pagination: false }}
        slots={{
          toolbarStart: <button type="button">Start tour</button>,
          toolbarEnd: <button type="button">Select all</button>,
        }}
      />
    </KeepProvider>,
  );

  await screen.findByRole("heading", { name: "Interaction item" });
  const toolbar = document.querySelector('[data-keepkit="collection-toolbar"]');
  if (!toolbar) throw new Error("The grouped collection toolbar was not rendered.");
  expect(toolbar.getAttribute("data-variant")).toBe("panel");
  expect(toolbar.getAttribute("data-layout")).toBe("grouped");
  for (const [group, label] of [
    ["toolbarStart", "Collection actions"],
    ["query", "Search and sort"],
    ["filters", "Filters"],
    ["toolbarEnd", "Additional actions"],
  ]) {
    const element = toolbar.querySelector(`[data-group="${group}"]`);
    expect(element?.getAttribute("role") ?? "group").toBe("group");
    expect(element?.getAttribute("aria-labelledby")).toBe(element?.querySelector("[id]")?.id);
    expect(element?.textContent).toContain(label);
  }
  expect(toolbar.querySelector('[data-group="query"] [data-keep-action="search"]')).not.toBeNull();
  expect(toolbar.querySelector('[data-group="query"] [data-keep-action="sort"]')).not.toBeNull();
  expect(toolbar.querySelector('[data-group="filters"] [data-keep-action="filter-all-tags"]')).not.toBeNull();
  expect(toolbar.querySelector('[data-group="filters"] [data-keep-action="filter-collection"]')).not.toBeNull();
  expect(toolbar.querySelector('[data-group="filters"] [data-keep-action="archive-scope"]')).not.toBeNull();
});

test("exposes independent card and surface theme contracts", async () => {
  render(
    <KeepThemeProvider
      variables={{
        "--keep-card-border": "rgb(1 2 3)",
        "--keep-card-shadow": "none",
        "--keep-surface-border": "rgb(4 5 6)",
        "--keep-surface-background": "rgb(7 8 9)",
      }}
    >
      <KeepProvider<Meta> storage={createStorage([item])}>
        <KeepItemCard item={item} cardVariant="elevated" data-testid="variant-card" />
      </KeepProvider>
    </KeepThemeProvider>,
  );

  const theme = document.querySelector("[data-keep-theme]");
  expect(theme?.getAttribute("style")).toContain("--keep-card-border: rgb(1 2 3)");
  const card = await screen.findByTestId("variant-card");
  expect(card.getAttribute("data-card-variant")).toBe("elevated");
});

test("emits sync failure feedback from the combined provider", async () => {
  const syncError = new Error("offline");
  const syncState: KeepSyncState<Meta> = { status: "error", pendingCount: 1, conflictIds: [], error: syncError };
  const storage: SyncCapableStorageAdapter<Meta> = {
    ...createStorage(),
    getSyncState: () => syncState,
    subscribeSync: () => () => undefined,
    flushSync: async () => undefined,
  };
  const onFeedback = vi.fn();
  render(
    <KeepKitProvider<Meta> storage={storage} onFeedback={onFeedback}>
      <span>child</span>
    </KeepKitProvider>,
  );

  await waitFor(() =>
    expect(onFeedback).toHaveBeenCalledWith({ type: "sync-failed", error: syncError, message: "Sync failed." }),
  );
});

test("exports and imports JSON backups through the standard UI", async () => {
  const onExport = vi.fn();
  const importedItem = { ...item, id: "imported", meta: { title: "Imported" } };
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepBackup onExport={onExport} />
    </KeepProvider>,
  );

  const exportButton = screen.getByRole("button", { name: "Export JSON" });
  expect(exportButton.getAttribute("data-keep-action")).toBe("export-backup");
  fireEvent.click(exportButton);
  await waitFor(() => expect(onExport).toHaveBeenCalledWith(expect.stringContaining("ui-interaction-item")));
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("Backup file input was not rendered.");
  expect(input.getAttribute("data-keep-action")).toBe("select-backup-file");
  const data = JSON.stringify({ format: "keepkit", version: 1, exportedAt: 1, items: [importedItem] });
  fireEvent.change(input, { target: { files: [new File([data], "backup.json", { type: "application/json" })] } });
  expect((await screen.findByRole("status")).textContent).toContain("1 items imported");
});

test("exposes the undo action without changing its accessible label", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepBulkActions />
      <KeepUndo />
    </KeepProvider>,
  );

  fireEvent.click(await screen.findByRole("checkbox", { name: "Interaction item" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  const undoButton = await screen.findByRole("button", { name: "Undo" });
  expect(undoButton.getAttribute("data-keep-action")).toBe("undo");
  const progress = screen.getByRole("progressbar");
  expect(progress.getAttribute("max")).toBe("1");
  expect(Number(progress.getAttribute("value"))).toBeGreaterThan(0);
  expect(progress.getAttribute("aria-valuetext")).toMatch(/5s/);
  expect(document.querySelector('[data-keepkit="undo-countdown"]')?.textContent).toBe("5s");
});

test("isolates unexpected provider and collection render errors", async () => {
  const providerError = vi.fn();
  function Broken() {
    throw new Error("provider render failure");
  }

  render(
    <KeepProvider<Meta>
      storage={createStorage()}
      fallback={<output data-testid="provider-fallback">Provider fallback</output>}
      onBoundaryError={providerError}
    >
      <Broken />
    </KeepProvider>,
  );

  expect((await screen.findByTestId("provider-fallback")).textContent).toBe("Provider fallback");
  expect(providerError).toHaveBeenCalled();

  render(
    <KeepProvider<Meta> storage={createStorage([item])}>
      <KeepCollection
        fallback={<output data-testid="collection-fallback">Collection fallback</output>}
        renderItem={() => {
          throw new Error("collection render failure");
        }}
      />
    </KeepProvider>,
  );

  expect((await screen.findByTestId("collection-fallback")).textContent).toBe("Collection fallback");
});

test("publishes the error boundary as a standalone primitive", () => {
  function Broken() {
    throw new Error("standalone render failure");
  }

  render(
    <KeepErrorBoundary fallback={<output data-testid="standalone-fallback">Recovered</output>}>
      <Broken />
    </KeepErrorBoundary>,
  );

  expect(screen.getByTestId("standalone-fallback").textContent).toBe("Recovered");
});
