import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepProvider, type KeepProviderProps, useKeepContext } from "@keepkit/core/react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

type Meta = { title: string };
const first: KeepItem<Meta> = { id: "a", savedAt: 1, updatedAt: 1, meta: { title: "A" } };
const second: KeepItem<Meta> = { id: "b", savedAt: 2, updatedAt: 2, meta: { title: "B" } };

function createStorage(initial: KeepItem<Meta>[] = []) {
  const items = new Map(initial.map((item) => [item.id, item]));
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [...items.values()],
    set: vi.fn(async (item: KeepItem<Meta>) => void items.set(item.id, item)),
    remove: vi.fn(async (id: string) => void items.delete(id)),
    clear: async () => void items.clear(),
  };
  return { items, storage };
}

async function renderProvider(props: KeepProviderProps<Meta>) {
  const hook = renderHook(() => useKeepContext<Meta>(), {
    wrapper: ({ children }) => <KeepProvider {...props}>{children}</KeepProvider>,
  });
  await waitFor(() => expect(hook.result.current.isHydrated).toBe(true));
  return hook;
}

test.each(["save", "after", "after-rejection", "change", "change-rejection"])(
  "keeps committed state after a %s notification fails and continues later notifications",
  async (mode) => {
    const { storage, items } = createStorage();
    const failure = new Error("notification failed");
    const fail = () => {
      throw failure;
    };
    const reject = () => Promise.reject(failure);
    const onError = vi.fn();
    const laterPlugin = vi.fn();
    const onChange = vi.fn(mode === "change" ? fail : mode === "change-rejection" ? reject : () => undefined);
    const props: KeepProviderProps<Meta> = {
      storage,
      onError,
      onChange,
      ...(mode === "save" ? { onSave: fail } : {}),
      plugins: [
        mode === "after" ? { after: fail } : mode === "after-rejection" ? { after: reject } : {},
        { after: laterPlugin },
      ],
    };
    const { result } = await renderProvider(props);

    await act(async () => {
      await expect(result.current.saveItem(first)).resolves.toBeUndefined();
    });
    expect(result.current.items.map((item) => item.id)).toEqual(["a"]);
    expect([...items.keys()]).toEqual(["a"]);
    expect(result.current.lastChange?.action).toBe("save");
    expect(result.current.isMutating).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure, { action: "save", id: "a", phase: "notification" });
    expect(laterPlugin).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.saveItem(second);
    });
    expect(result.current.items.map((item) => item.id).sort()).toEqual(["a", "b"]);
    expect([...items.keys()]).toEqual(["a", "b"]);
  },
);

test("error-handler failures cannot change a committed mutation or stop other error handlers", async () => {
  const { storage, items } = createStorage();
  const failure = new Error("saved callback failed");
  const lastErrorHandler = vi.fn();
  const { result } = await renderProvider({
    storage,
    onSave: () => {
      throw failure;
    },
    onError: () => {
      throw new Error("error handler failed");
    },
    plugins: [
      {
        onError: async () => {
          throw new Error("async error handler failed");
        },
      },
      { onError: lastErrorHandler },
    ],
  });
  await act(async () => {
    await expect(result.current.saveItem(first)).resolves.toBeUndefined();
  });
  expect(result.current.error).toBe(failure);
  expect(result.current.items[0]?.id).toBe("a");
  expect(items.has("a")).toBe(true);
  expect(lastErrorHandler).toHaveBeenCalledWith(failure, { action: "save", id: "a", phase: "notification" });
});

test("before and persistence failures still reject, roll back, and preserve the original cause", async () => {
  const { storage, items } = createStorage();
  const beforeFailure = new Error("before failed");
  const persistFailure = new Error("persist failed");
  const before = vi.fn().mockRejectedValueOnce(beforeFailure);
  const set = vi.fn().mockRejectedValueOnce(persistFailure).mockImplementation(storage.set);
  const { result } = await renderProvider({
    storage: { ...storage, set },
    plugins: [{ before }],
    onError: () => {
      throw new Error("error handler failed");
    },
  });
  await act(async () => {
    await expect(result.current.saveItem(first)).rejects.toBe(beforeFailure);
    await expect(result.current.saveItem(first)).rejects.toBe(persistFailure);
  });
  expect(result.current.items).toEqual([]);
  expect(items.size).toBe(0);
  expect(set).toHaveBeenCalledOnce();
  await act(async () => {
    await result.current.saveItem(second);
  });
  expect(result.current.items[0]?.id).toBe("b");
});

test("plugin error methods retain their receiver", async () => {
  const { storage } = createStorage();
  const plugin = {
    errorCount: 0,
    onError() {
      this.errorCount += 1;
    },
  };
  const { result } = await renderProvider({
    storage,
    plugins: [plugin],
    onSave: () => {
      throw new Error("notification failed");
    },
  });
  await act(async () => {
    await result.current.saveItem(first);
  });
  expect(plugin.errorCount).toBe(1);
});

test("batch notifications continue after failure and undo remains available", async () => {
  const { storage, items } = createStorage([first, second]);
  const onRemove = vi.fn(() => {
    throw new Error("remove notification failed");
  });
  const onTagsUpdate = vi.fn(() => {
    throw new Error("tag notification failed");
  });
  const onUndo = vi.fn(() => {
    throw new Error("undo notification failed");
  });
  const onChange = vi.fn<NonNullable<KeepProviderProps<Meta>["onChange"]>>();
  const { result } = await renderProvider({ storage, onRemove, onTagsUpdate, onUndo, onChange });
  await act(async () => {
    await result.current.updateTagsBatch(["a", "b"], ["new"]);
    await result.current.removeItemsWithUndo(["a", "b"]);
  });
  expect(onTagsUpdate).toHaveBeenCalledTimes(2);
  expect(onRemove).toHaveBeenCalledTimes(2);
  expect(items.size).toBe(0);
  expect(result.current.undo.canUndo).toBe(true);
  await act(async () => {
    await result.current.undoLastRemoval();
  });
  expect(result.current.items.map((item) => item.id).sort()).toEqual(["a", "b"]);
  expect([...items.values()].every((item) => item.tags?.[0] === "new")).toBe(true);
  expect(result.current.undo.canUndo).toBe(false);
  expect(onUndo).toHaveBeenCalledOnce();
  expect(onChange.mock.calls.map(([change]) => change.action)).toEqual(["updateTagsBatch", "removeBatch", "undo"]);
});

test("revalidation does not restore persisted changes after a notification fails", async () => {
  const { storage, items } = createStorage([first, second]);
  const onError = vi.fn();
  const onChange = vi.fn();
  const laterPlugin = vi.fn();
  const { result } = await renderProvider({
    storage,
    onError,
    onChange,
    onRemove: () => {
      throw new Error("remove notification failed");
    },
    plugins: [
      {
        after: () => {
          throw new Error("after notification failed");
        },
      },
      { after: laterPlugin },
    ],
  });
  await act(async () => {
    await result.current.revalidateItems(async (item) => (item.id === "b" ? "private" : "expired"), {
      removeStatuses: ["private"],
    });
  });
  expect([...items.keys()]).toEqual(["a"]);
  expect(result.current.items.map((item) => item.id)).toEqual(["a"]);
  expect(result.current.items[0]?.status).toBe("expired");
  expect(result.current.lastChange?.action).toBe("revalidate");
  expect(onError).toHaveBeenCalledTimes(2);
  expect(laterPlugin).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenCalledOnce();
});

test.each(["none", "read-only", "no-remove"])(
  "rejects collection CRUD for %s storage before changing metadata or item membership",
  async (capability) => {
    const original = { ...first, collectionId: "reading" };
    const { storage, items } = createStorage([original]);
    const setCollection = vi.fn(async () => undefined);
    const partialStorage: StorageAdapter<Meta> = {
      ...storage,
      ...(capability !== "none" ? { getCollections: async () => [{ id: "reading", name: "Reading" }] } : {}),
      ...(capability === "no-remove" ? { setCollection } : {}),
    };
    const onError = vi.fn();
    const { result } = await renderProvider({ storage: partialStorage, onError });
    const originalCollections = result.current.collections;
    await act(async () => {
      await expect(result.current.createCollection("new", "New")).rejects.toThrow("collection persistence");
      await expect(result.current.renameCollection("reading", "Changed")).rejects.toThrow("collection persistence");
      await expect(result.current.removeCollection("reading")).rejects.toThrow("collection persistence");
    });
    expect(result.current.collections).toEqual(originalCollections);
    expect(items.get("a")).toEqual(original);
    expect(storage.set).not.toHaveBeenCalled();
    expect(setCollection).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(3);
    await act(async () => {
      await result.current.saveItem(second);
      await result.current.removeItem("b");
    });
    expect([...items.keys()]).toEqual(["a"]);
  },
);
