import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import {
  createKeepKit,
  KeepButton,
  type KeepListOptions,
  KeepProvider,
  useKeepContext,
  useKeepItem,
  useKeepList,
} from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MouseEvent } from "react";
import { expect, test, vi } from "vitest";

type Meta = { title: string; kind?: string };

const itemA: KeepItem<Meta> = {
  id: "a",
  savedAt: 10,
  updatedAt: 10,
  targetType: "article",
  note: "Alpha note",
  tags: ["read", "work"],
  meta: { title: "Alpha article", kind: "guide" },
};

const itemB: KeepItem<Meta> = {
  id: "b",
  savedAt: 20,
  updatedAt: 20,
  targetType: "product",
  tags: ["work"],
  meta: { title: "Beta product", kind: "tool" },
};

const itemC: KeepItem<Meta> = {
  id: "c",
  savedAt: 30,
  updatedAt: 15,
  targetType: "article",
  tags: ["later"],
  meta: { title: "Gamma article", kind: "reference" },
};

function createMemoryStorage(initialItems: KeepItem<Meta>[] = [], withBatch = true) {
  let items = [...initialItems];
  let listener: (() => void) | undefined;
  const calls = {
    set: 0,
    setMany: 0,
    remove: 0,
    removeMany: 0,
    clear: 0,
  };
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [...items],
    set: async (item) => {
      calls.set += 1;
      items = [...items.filter((current) => current.id !== item.id), item];
    },
    remove: async (id) => {
      calls.remove += 1;
      items = items.filter((item) => item.id !== id);
    },
    clear: async () => {
      calls.clear += 1;
      items = [];
    },
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
  if (withBatch) {
    storage.setMany = async (nextItems) => {
      calls.setMany += 1;
      for (const item of nextItems) {
        items = [...items.filter((current) => current.id !== item.id), item];
      }
    };
    storage.removeMany = async (ids) => {
      calls.removeMany += 1;
      const idSet = new Set(ids);
      items = items.filter((item) => !idSet.has(item.id));
    };
  }
  return {
    storage,
    calls,
    getItems: () => items,
    notify: () => listener?.(),
  };
}

function ActionProbe() {
  const context = useKeepContext<Meta>();
  const item = useKeepItem<Meta>("a");
  const list = useKeepList<Meta>();
  return (
    <>
      <output data-testid="actions-items">{list.items.map((entry) => entry.id).join(",")}</output>
      <output data-testid="actions-tags">{item.item?.tags?.join(",") ?? ""}</output>
      <output data-testid="actions-note">{item.item?.note ?? ""}</output>
      <output data-testid="actions-error">{context.error ? "error" : ""}</output>
      <button onClick={() => void context.saveItem({ ...itemA, id: "d", updatedAt: 40 })} type="button">
        save
      </button>
      <button onClick={() => void context.updateNote("a", "  trimmed note  ")} type="button">
        note
      </button>
      <button onClick={() => void context.updateNote("a", "   ")} type="button">
        clear-note
      </button>
      <button onClick={() => void context.updateTags("a", [" x ", "x", " y "])} type="button">
        tags
      </button>
      <button onClick={() => void list.updateTagsBatch(["a", "b"], ["batch"])} type="button">
        batch-tags
      </button>
      <button onClick={() => void list.addTagsBatch(["a", "b"], [" extra ", "batch"])} type="button">
        add-tags
      </button>
      <button onClick={() => void list.removeTagsBatch(["a", "b"], ["batch"])} type="button">
        remove-tags
      </button>
      <button onClick={() => void item.remove()} type="button">
        remove-one
      </button>
      <button onClick={() => void list.removeBatch(["a", "b", "missing"])} type="button">
        remove-many
      </button>
      <button onClick={() => void list.clear()} type="button">
        clear
      </button>
    </>
  );
}

test("runs Provider actions, callbacks, plugins, and batch storage paths", async () => {
  const testStorage = createMemoryStorage([itemA, itemB]);
  const events: unknown[][] = [];
  const pluginEvents: string[][] = [];
  const onSave = vi.fn((item) => events.push(["save", item.id]));
  const onRemove = vi.fn((item) => events.push(["remove", item.id]));
  const onNoteUpdate = vi.fn((id, note) => events.push(["note", id, note]));
  const onTagsUpdate = vi.fn((id, tags) => events.push(["tags", id, tags?.join(",")]));
  const plugin = {
    before: vi.fn(async (context) => {
      pluginEvents.push(["before", context.action]);
    }),
    after: vi.fn(async (context) => {
      pluginEvents.push(["after", context.action]);
    }),
  };

  render(
    <KeepProvider<Meta>
      storage={testStorage.storage}
      onSave={onSave}
      onRemove={onRemove}
      onNoteUpdate={onNoteUpdate}
      onTagsUpdate={onTagsUpdate}
      plugins={[plugin]}
    >
      <ActionProbe />
    </KeepProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("actions-items")).toHaveTextContent("a,b"));

  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.getByTestId("actions-items")).toHaveTextContent("d,b,a"));
  fireEvent.click(screen.getByRole("button", { name: "note" }));
  await waitFor(() => expect(screen.getByTestId("actions-note")).toHaveTextContent("trimmed note"));
  fireEvent.click(screen.getByRole("button", { name: "clear-note" }));
  await waitFor(() => expect(screen.getByTestId("actions-note")).toHaveTextContent(""));
  fireEvent.click(screen.getByRole("button", { name: "tags" }));
  await waitFor(() => expect(screen.getByTestId("actions-tags")).toHaveTextContent("x,y"));
  fireEvent.click(screen.getByRole("button", { name: "batch-tags" }));
  await waitFor(() => expect(testStorage.calls.setMany).toBe(1));
  fireEvent.click(screen.getByRole("button", { name: "add-tags" }));
  await waitFor(() => expect(screen.getByTestId("actions-tags")).toHaveTextContent("batch,extra"));
  fireEvent.click(screen.getByRole("button", { name: "remove-tags" }));
  await waitFor(() => expect(screen.getByTestId("actions-tags")).toHaveTextContent("extra"));
  fireEvent.click(screen.getByRole("button", { name: "remove-one" }));
  await waitFor(() => expect(screen.getByTestId("actions-items")).not.toHaveTextContent("a"));
  fireEvent.click(screen.getByRole("button", { name: "remove-many" }));
  await waitFor(() => expect(screen.getByTestId("actions-items")).toHaveTextContent("d"));
  fireEvent.click(screen.getByRole("button", { name: "clear" }));
  await waitFor(() => expect(screen.getByTestId("actions-items")).toHaveTextContent(""));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "d" }));
  expect(onNoteUpdate).toHaveBeenCalledWith("a", "trimmed note");
  expect(onNoteUpdate).toHaveBeenCalledWith("a", undefined);
  expect(onTagsUpdate).toHaveBeenCalled();
  expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  expect(testStorage.calls.setMany).toBeGreaterThan(0);
  expect(testStorage.calls.removeMany).toBe(1);
  expect(pluginEvents.map(([phase, action]) => `${phase}:${action}`)).toEqual(
    expect.arrayContaining(["before:save", "after:save", "before:clear", "after:clear"]),
  );
});

function ListProbe({ options }: { options: KeepListOptions<Meta> }) {
  const list = useKeepList<Meta>(options);
  return (
    <>
      <output data-testid="list-ids">{list.items.map((item) => item.id).join(",")}</output>
      <output data-testid="list-total">{list.totalCount}</output>
      <output data-testid="list-tags">{list.tags.join(",")}</output>
      <output data-testid="list-hydrated">{String(list.isHydrated)}</output>
      <button onClick={() => void list.removeBatch(["b"])} type="button">
        list-remove
      </button>
      <button onClick={() => void list.updateTagsBatch(["a", "c"], ["selected"])} type="button">
        list-update
      </button>
      <button onClick={() => void list.refresh()} type="button">
        list-refresh
      </button>
    </>
  );
}

test("filters, searches, sorts, paginates, and exposes list actions", async () => {
  const testStorage = createMemoryStorage([itemA, itemB, itemC]);
  const options = {
    targetType: "article",
    tags: ["read"],
    sort: { by: "savedAt", direction: "asc" as const },
    searchQuery: " ALPHA ",
    limit: 1,
    offset: 0,
    filter: (item: KeepItem<Meta>) => item.meta.kind === "guide",
  } satisfies KeepListOptions<Meta>;
  const view = render(
    <KeepProvider<Meta> storage={testStorage.storage}>
      <ListProbe options={options} />
    </KeepProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("list-hydrated")).toHaveTextContent("true"));
  expect(screen.getByTestId("list-ids")).toHaveTextContent("a");
  expect(screen.getByTestId("list-total")).toHaveTextContent("1");
  expect(screen.getByTestId("list-tags")).toHaveTextContent("later,read,work");

  view.rerender(
    <KeepProvider<Meta> storage={testStorage.storage}>
      <ListProbe
        options={{
          tag: "work",
          sortBy: "updatedAt",
          order: "asc",
          offset: -1,
          limit: -1,
        }}
      />
    </KeepProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("list-total")).toHaveTextContent("2"));
  expect(screen.getByTestId("list-ids")).toHaveTextContent("");

  fireEvent.click(screen.getByRole("button", { name: "list-remove" }));
  await waitFor(() => expect(testStorage.getItems().map((item) => item.id)).toEqual(["a", "c"]));
  fireEvent.click(screen.getByRole("button", { name: "list-update" }));
  await waitFor(() => expect(testStorage.calls.setMany).toBe(1));
  fireEvent.click(screen.getByRole("button", { name: "list-refresh" }));
  await waitFor(() => expect(screen.getByTestId("list-hydrated")).toHaveTextContent("true"));
});

test("migrates schema versions and reports refresh errors", async () => {
  const oldItem = { ...itemA, schemaVersion: 1 };
  const testStorage = createMemoryStorage([oldItem]);
  const migrateMeta = vi.fn(async (meta: unknown, from: number, to: number) => ({
    ...(meta as Meta),
    title: `${(meta as Meta).title}-migrated-${from}-${to}`,
  }));
  function MigrationProbe() {
    const { items, error } = useKeepContext<Meta>();
    return (
      <>
        <output data-testid="migration-title">{items[0]?.meta.title ?? ""}</output>
        <output data-testid="migration-error">{error ? "error" : ""}</output>
      </>
    );
  }
  render(
    <KeepProvider<Meta> storage={testStorage.storage} schemaVersion={2} migrateMeta={migrateMeta}>
      <MigrationProbe />
    </KeepProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("migration-title")).toHaveTextContent("Alpha article-migrated-1-2"));
  expect(migrateMeta).toHaveBeenCalledWith(oldItem.meta, 1, 2, oldItem);
  expect(testStorage.calls.setMany).toBe(1);
  expect(testStorage.getItems()[0]?.schemaVersion).toBe(2);
});

test("uses fallback batch persistence and rolls back failed batches", async () => {
  const testStorage = createMemoryStorage([itemA, itemB], false);
  let setCalls = 0;
  const originalSet = testStorage.storage.set;
  testStorage.storage.set = async (item) => {
    setCalls += 1;
    if (setCalls === 2) throw new Error("batch write failed");
    return originalSet(item);
  };
  function FallbackProbe() {
    const { items, updateTagsBatch, removeItems } = useKeepContext<Meta>();
    return (
      <>
        <output data-testid="fallback-items">{items.map((item) => item.tags?.join("/")).join(",")}</output>
        <button onClick={() => void updateTagsBatch(["a", "b"], ["new"]).catch(() => undefined)} type="button">
          fail-update
        </button>
        <button onClick={() => void removeItems(["a", "b"])} type="button">
          fail-remove
        </button>
      </>
    );
  }
  render(
    <KeepProvider<Meta> storage={testStorage.storage}>
      <FallbackProbe />
    </KeepProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("fallback-items")).toHaveTextContent("read/work,work"));
  fireEvent.click(screen.getByRole("button", { name: "fail-update" }));
  await waitFor(() => expect(screen.getByTestId("fallback-items")).toHaveTextContent("read/work,work"));
  expect(
    testStorage
      .getItems()
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => item.tags),
  ).toEqual([itemA.tags, itemB.tags]);
});

test("covers useKeepItem errors and KeepButton behavior", async () => {
  const testStorage = createMemoryStorage();
  const toggleError = new Error("toggle failed");
  const failingStorage = {
    ...testStorage.storage,
    set: async () => {
      throw toggleError;
    },
  } satisfies StorageAdapter<Meta>;
  function MissingPayloadProbe() {
    const item = useKeepItem<Meta>("missing");
    async function saveWithoutPayload() {
      try {
        await item.save();
      } catch (error) {
        document.body.dataset.error = (error as Error).message;
      }
    }
    return (
      <button onClick={() => void saveWithoutPayload()} type="button">
        missing-save
      </button>
    );
  }
  render(
    <KeepProvider<Meta> storage={testStorage.storage}>
      <MissingPayloadProbe />
    </KeepProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "missing-save" }));
  await waitFor(() => expect(document.body.dataset.error).toContain("itemPayload is required"));

  const onToggleError = vi.fn();
  const onClick = vi.fn();
  render(
    <KeepProvider<Meta> storage={failingStorage}>
      <KeepButton
        item={{ id: "button", meta: { title: "Button item" } }}
        aria-label="Custom save"
        onClick={onClick}
        onToggleError={onToggleError}
      />
    </KeepProvider>,
  );
  const button = screen.getByRole("button", { name: "Custom save" });
  expect(button).toHaveAttribute("type", "button");
  expect(button).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(button);
  await waitFor(() => expect(onToggleError).toHaveBeenCalledWith(toggleError));
  expect(onClick).toHaveBeenCalled();

  const preventStorage = createMemoryStorage();
  const prevented = vi.fn((event: MouseEvent<HTMLButtonElement>) => event.preventDefault());
  render(
    <KeepProvider<Meta> storage={preventStorage.storage}>
      <KeepButton item={{ id: "prevented", meta: { title: "Prevented" } }} onClick={prevented} />
    </KeepProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(prevented).toHaveBeenCalled();
  expect(preventStorage.getItems()).toEqual([]);
});

test("supports createKeepKit wrappers and asChild", async () => {
  const kit = createKeepKit<Meta>({ schemaVersion: 3 });
  const { KeepProvider: KitProvider, KeepButton: KitButton, useKeepList: useKitList } = kit;
  const testStorage = createMemoryStorage();
  function KitProbe() {
    const list = useKitList();
    return <output data-testid="kit-items">{list.items.map((item) => item.id).join(",")}</output>;
  }
  render(
    <KitProvider storage={testStorage.storage}>
      <KitButton item={{ id: "kit-item", meta: { title: "Kit item" } }} asChild>
        <a href="/saved" data-testid="kit-link">
          Save kit item
        </a>
      </KitButton>
      <KitProbe />
    </KitProvider>,
  );
  const link = screen.getByTestId("kit-link");
  fireEvent.click(link);
  await waitFor(() => expect(screen.getByTestId("kit-items")).toHaveTextContent("kit-item"));
  expect(testStorage.getItems()[0]?.schemaVersion).toBe(3);
  expect(link).toHaveAttribute("aria-pressed", "true");
});

test("throws when hooks are used outside a provider", () => {
  function Outside() {
    useKeepContext();
    return null;
  }
  expect(() => render(<Outside />)).toThrow("Keep hooks must be used inside a KeepProvider");
});
