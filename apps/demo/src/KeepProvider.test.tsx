import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepProvider, useKeepContext } from "@keepkit/core/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

type Meta = { title: string };

const itemA: KeepItem<Meta> = {
  id: "a",
  savedAt: 1,
  updatedAt: 1,
  meta: { title: "A" },
};

const itemB: KeepItem<Meta> = {
  id: "b",
  savedAt: 2,
  updatedAt: 2,
  meta: { title: "B" },
};

function createGatedStorage() {
  let items: KeepItem<Meta>[] = [];
  const pending: Array<{
    item: KeepItem<Meta>;
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [...items],
    set: (item) =>
      new Promise<void>((resolve, reject) => {
        pending.push({ item, resolve, reject });
      }).then(() => {
        items = [...items.filter((current) => current.id !== item.id), item];
      }),
    remove: async (id) => {
      items = items.filter((item) => item.id !== id);
    },
    clear: async () => {
      items = [];
    },
  };

  return {
    storage,
    pending,
    releaseNext(error?: unknown) {
      const request = pending.shift();
      if (!request) throw new Error("No pending storage request.");
      if (error) request.reject(error);
      else request.resolve();
    },
    getItems: () => items,
  };
}

function Probe() {
  const { isHydrated, isMutating, items, saveItem } = useKeepContext<Meta>();
  const save = (item: KeepItem<Meta>) => void saveItem(item).catch(() => undefined);

  return (
    <>
      <output data-testid="hydrated">{String(isHydrated)}</output>
      <output data-testid="mutating">{String(isMutating)}</output>
      <output data-testid="items">{items.map((item) => item.id).join(",")}</output>
      <button onClick={() => save(itemA)} type="button">
        save-a
      </button>
      <button onClick={() => save(itemB)} type="button">
        save-b
      </button>
    </>
  );
}

function renderProvider() {
  const testStorage = createGatedStorage();
  render(
    <KeepProvider<Meta> storage={testStorage.storage}>
      <Probe />
    </KeepProvider>,
  );
  return testStorage;
}

test("exposes hydration state and serializes mutations", async () => {
  const testStorage = renderProvider();

  await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));

  fireEvent.click(screen.getByRole("button", { name: "save-a" }));
  await waitFor(() => expect(screen.getByTestId("items")).toHaveTextContent("a"));
  fireEvent.click(screen.getByRole("button", { name: "save-b" }));

  expect(testStorage.pending).toHaveLength(1);
  expect(screen.getByTestId("items")).toHaveTextContent("a");

  testStorage.releaseNext();
  await waitFor(() => expect(testStorage.pending).toHaveLength(1));
  testStorage.releaseNext();
  await waitFor(() => expect(screen.getByTestId("items")).toHaveTextContent("b,a"));
  await waitFor(() => expect(screen.getByTestId("mutating")).toHaveTextContent("false"));
  expect(testStorage.getItems()).toHaveLength(2);
});

test("rolls back only the failed mutation and preserves queued work", async () => {
  const testStorage = renderProvider();
  await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));

  fireEvent.click(screen.getByRole("button", { name: "save-a" }));
  fireEvent.click(screen.getByRole("button", { name: "save-b" }));
  await waitFor(() => expect(testStorage.pending).toHaveLength(1));

  testStorage.releaseNext(new Error("write failed"));
  await waitFor(() => expect(testStorage.pending).toHaveLength(1));
  testStorage.releaseNext();

  await waitFor(() => expect(screen.getByTestId("items")).toHaveTextContent("b"));
  expect(screen.getByTestId("items")).not.toHaveTextContent("a");
  expect(testStorage.getItems().map((item) => item.id)).toEqual(["b"]);
});

test("renders an injected initial snapshot while storage hydrates", () => {
  const storage: StorageAdapter<Meta> = {
    getAll: () => new Promise<KeepItem<Meta>[]>(() => undefined),
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
  };

  render(
    <KeepProvider<Meta> storage={storage} initialItems={[itemA]}>
      <Probe />
    </KeepProvider>,
  );

  expect(screen.getByTestId("items")).toHaveTextContent("a");
});
