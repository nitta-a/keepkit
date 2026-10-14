import type { KeepItem, KeepSavedView, KeepSavedViewStorage, StorageAdapter } from "@keepkit/core/core";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { type MouseEvent, useState } from "react";
import { expect, test, vi } from "vitest";
import {
  KeepItemCard,
  type KeepItemCardLinkProps,
  KeepProvider,
  KeepReorderableList,
  KeepSavedViews,
  KeepSaveViewButton,
  KeepUiProvider,
  useKeepSavedViews,
} from "../src/index";

type Meta = { title: string };

const item: KeepItem<Meta> = {
  id: "card-example",
  meta: { title: "Card example" },
  savedAt: 1,
  updatedAt: 1,
  tags: ["reading"],
};

function createStorage(initialItems: KeepItem<Meta>[] = [item]): StorageAdapter<Meta> {
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

function createSavedViewStorage(): KeepSavedViewStorage<Meta> {
  const views = new Map<string, KeepSavedView<Meta>>();
  return {
    getAll: async () => [...views.values()],
    get: async (id) => views.get(id),
    set: async (view) => {
      views.set(view.id, view);
    },
    remove: async (id) => {
      views.delete(id);
    },
  };
}

test("keeps card links separate from custom tags, actions, and the edit form without requiring CSS", async () => {
  const storage = createStorage();
  const onOpen = vi.fn((_item: KeepItem<Meta>, event: MouseEvent<HTMLElement>) => event.preventDefault());
  render(
    <KeepProvider<Meta> storage={storage}>
      <KeepItemCard
        item={item}
        href="/articles/card-example"
        linkTarget="card"
        trackOpen
        onOpen={onOpen}
        showEditButton
        showPinButton
        showArchiveButton
        getImageProps={() => ({ src: "/preview.png", alt: "Preview" })}
        renderTags={() => <button type="button">Filter reading</button>}
      />
    </KeepProvider>,
  );

  const link = await screen.findByRole("link");
  expect(link.tagName).toBe("A");
  expect(link.getAttribute("href")).toBe("/articles/card-example");
  expect(link.querySelector("button, input, select, textarea, a")).toBeNull();
  expect(link.contains(screen.getByRole("img", { name: "Preview" }))).toBe(true);
  expect(link.contains(screen.getByRole("button", { name: "Filter reading" }))).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Filter reading" }));
  fireEvent.click(screen.getByRole("button", { name: "Pin" }));
  await waitFor(async () => expect((await storage.getAll())[0]?.pinned).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await waitFor(async () => expect((await storage.getAll())[0]?.archived).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Edit saved item" }));
  const editor = screen.getByRole("dialog");
  expect(link.contains(editor)).toBe(false);
  expect(link.querySelector("button, input, select, textarea")).toBeNull();
  expect(onOpen).not.toHaveBeenCalled();
  expect((await storage.getAll())[0]?.lastOpenedAt).toBeUndefined();

  fireEvent.click(link);
  expect(onOpen).toHaveBeenCalledOnce();
  await waitFor(async () => expect((await storage.getAll())[0]?.lastOpenedAt).toEqual(expect.any(Number)));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  await waitFor(async () => expect(await storage.getAll()).toEqual([]));
  expect(onOpen).toHaveBeenCalledOnce();
});

test("preserves custom links and neutral asChild roots while keeping custom images outside the link", async () => {
  function CustomLink(props: KeepItemCardLinkProps) {
    return <a {...props} data-testid="custom-link" />;
  }
  render(
    <KeepProvider<Meta> storage={createStorage()}>
      <KeepItemCard
        item={item}
        href="https://example.com/article"
        linkTarget="card"
        linkComponent={CustomLink}
        asChild
        getImageProps={() => ({ src: "/preview.png", alt: "Preview" })}
        renderImage={() => <button type="button">Open custom image</button>}
      >
        <article aria-label="Saved article" />
      </KeepItemCard>
    </KeepProvider>,
  );

  const link = await screen.findByTestId("custom-link");
  expect(screen.getByRole("article", { name: "Saved article" }).contains(link)).toBe(true);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer");
  expect(link.contains(screen.getByRole("button", { name: "Open custom image" }))).toBe(false);
  expect(link.querySelector("button, a")).toBeNull();
});

test("does not wrap custom card children or render output in a link", async () => {
  const onOpen = vi.fn();
  render(
    <KeepProvider<Meta> storage={createStorage()}>
      <KeepItemCard item={item} href="/compound" linkTarget="card" onOpen={onOpen}>
        <KeepItemCard.Content>
          <KeepItemCard.Title />
          <button type="button">Custom content action</button>
        </KeepItemCard.Content>
        <KeepItemCard.Actions />
      </KeepItemCard>
      <KeepItemCard
        item={item}
        href="/render"
        linkTarget="card"
        render={() => <button type="button">Render action</button>}
      />
      <KeepItemCard item={item} href="/children" linkTarget="card">
        {() => <button type="button">Children action</button>}
      </KeepItemCard>
    </KeepProvider>,
  );

  expect((await screen.findByRole("link", { name: "Card example" })).getAttribute("href")).toBe("/compound");
  for (const name of ["Custom content action", "Render action", "Children action"]) {
    const action = screen.getByRole("button", { name });
    expect(action.closest("a")).toBeNull();
    fireEvent.click(action);
  }
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(onOpen).not.toHaveBeenCalled();
});

test("does not link unavailable cards in card mode", async () => {
  render(
    <KeepProvider<Meta> storage={createStorage()}>
      <KeepItemCard item={{ ...item, status: "expired" }} href="/expired" linkTarget="card" />
    </KeepProvider>,
  );
  expect(await screen.findByText("Expired")).not.toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText("Card example").closest('[aria-disabled="true"]')).not.toBeNull();
});

test("announces committed keyboard reorders, keeps focus, and releases the grab on Escape", async () => {
  const onReorder = vi.fn();
  function ReorderingList() {
    const [items, setItems] = useState([{ id: "first" }, { id: "second" }]);
    return (
      <KeepReorderableList
        items={items}
        itemLabel={(entry) => entry.id}
        onReorder={(ids) => {
          onReorder(ids);
          setItems(ids.map((id) => ({ id })));
        }}
        renderItem={(entry, state) => (
          <button type="button" {...state.dragHandleProps}>
            {entry.id}
          </button>
        )}
      />
    );
  }
  render(<ReorderingList />);

  const handle = screen.getByRole("button", { name: "second" });
  handle.focus();
  fireEvent.keyDown(handle, { key: " " });
  fireEvent.keyDown(handle, { key: "ArrowUp" });
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("second: Moved to position 1/2"));
  expect(document.activeElement).toBe(handle);
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["second", "first"]);
  fireEvent.keyDown(handle, { key: "Escape" });
  expect(handle.getAttribute("aria-grabbed")).toBe("false");
  expect(document.activeElement).toBe(handle);
  expect(onReorder).toHaveBeenCalledOnce();
});

test("waits for reorder persistence and catches failures without announcing success", async () => {
  let finish: (() => void) | undefined;
  const onReorder = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender } = render(
    <KeepUiProvider locale="ja">
      <KeepReorderableList
        items={[{ id: "first" }, { id: "second" }]}
        onReorder={onReorder}
        renderItem={(entry, state) => (
          <button type="button" {...state.dragHandleProps}>
            {entry.id}
          </button>
        )}
      />
    </KeepUiProvider>,
  );
  const handle = screen.getByRole("button", { name: "項目を移動 1" });
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(onReorder).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("list").getAttribute("aria-busy")).toBe("true");
  await act(async () => finish?.());
  expect(screen.getByRole("status").textContent).toBe("項目を移動 1: 移動後の位置 2/2");

  rerender(
    <KeepUiProvider locale="ja">
      <KeepReorderableList
        items={[{ id: "first" }, { id: "second" }]}
        onReorder={() => Promise.reject({ reason: "storage unavailable" })}
        renderItem={(entry, state) => (
          <button type="button" {...state.dragHandleProps}>
            {entry.id}
          </button>
        )}
      />
    </KeepUiProvider>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "項目を移動 1" }), { key: "ArrowDown" });
  expect((await screen.findByRole("alert")).textContent).toBe("並び順を保存できませんでした。");
  expect(screen.getByRole("status").textContent).toBe("");
  expect(screen.getByRole("list").getAttribute("aria-busy")).not.toBe("true");
});

test("localizes Saved View forms, navigation, and operation names", async () => {
  const storage = createSavedViewStorage();
  const onApply = vi.fn();
  render(
    <KeepUiProvider locale="ja">
      <KeepSaveViewButton<Meta> storage={storage} query={{ search: { query: "reading" } }} />
      <KeepSavedViews<Meta> storage={storage} onApply={onApply} />
    </KeepUiProvider>,
  );
  expect(screen.getByRole("navigation", { name: "保存した検索条件" })).not.toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "検索条件の名前" }), { target: { value: "読むもの" } });
  fireEvent.click(screen.getByRole("button", { name: "検索条件を保存" }));
  fireEvent.click(await screen.findByRole("button", { name: "読むもの" }));
  await waitFor(() => expect(onApply).toHaveBeenCalledWith({ search: { query: "reading" } }));
  fireEvent.click(screen.getByRole("button", { name: "ピン留め 読むもの" }));
  expect(await screen.findByRole("button", { name: "ピン留めを解除 読むもの" })).not.toBeNull();
  fireEvent.click(screen.getByText("名前を変更 読むもの"));
  fireEvent.change(screen.getByRole("textbox", { name: "新しい名前" }), { target: { value: "資料" } });
  fireEvent.click(screen.getByRole("button", { name: "名前を変更" }));
  fireEvent.click(await screen.findByRole("button", { name: "削除 資料" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "資料" })).toBeNull());
});

test("localizes hook validation and preserves errors reported by custom Saved View storage", async () => {
  const storage = createSavedViewStorage();
  const { result } = renderHook(() => useKeepSavedViews(storage), {
    wrapper: ({ children }) => <KeepUiProvider locale="ja">{children}</KeepUiProvider>,
  });
  await expect(result.current.createView(" ", {})).rejects.toThrow("検索条件の名前を入力してください。");
  await expect(result.current.createView("資料", { filter: () => true })).rejects.toThrow(
    "関数によるフィルターを含む検索条件は保存できません。",
  );
  await expect(result.current.createView("資料", { savedBetween: [Number.NaN, 1] })).rejects.toThrow(
    "検索条件の日付には有効な日時を指定してください。",
  );
  let id = "";
  await act(async () => {
    id = (await result.current.createView("資料", {})).id;
  });
  await act(async () => {
    await expect(result.current.updateView(id, { name: " " })).rejects.toThrow("検索条件の名前を入力してください。");
    await expect(result.current.updateView(id, { query: { filter: () => true } })).rejects.toThrow(
      "関数によるフィルターを含む検索条件は保存できません。",
    );
    await expect(result.current.updateView(id, { query: { savedBetween: [0, new Date(Number.NaN)] } })).rejects.toThrow(
      "検索条件の日付には有効な日時を指定してください。",
    );
  });
  expect((await storage.get(id))?.name).toBe("資料");
  const customError = new Error("Tenant storage is read-only.");
  const brokenStorage = {
    ...storage,
    getAll: async () => {
      throw customError;
    },
  };
  render(
    <KeepUiProvider locale="ja">
      <KeepSavedViews storage={brokenStorage} />
    </KeepUiProvider>,
  );
  expect((await screen.findByRole("alert")).textContent).toBe(customError.message);
});

test("uses local labels for unknown Saved View storage failures and supports custom labels", async () => {
  const storage = {
    ...createSavedViewStorage(),
    getAll: () => Promise.reject({ reason: "unavailable" }),
    set: () => Promise.reject({ reason: "read-only" }),
  };
  render(
    <KeepUiProvider locale="ja" labels={{ savedViews: "My queries", saveView: "Remember query" }}>
      <KeepSavedViews storage={storage} />
      <KeepSaveViewButton storage={storage} query={{}} />
    </KeepUiProvider>,
  );
  expect(screen.getByRole("navigation", { name: "My queries" })).not.toBeNull();
  expect((await screen.findByRole("alert")).textContent).toBe("保存した検索条件を読み込めませんでした。");
  fireEvent.change(screen.getByRole("textbox", { name: "検索条件の名前" }), { target: { value: "資料" } });
  fireEvent.click(screen.getByRole("button", { name: "Remember query" }));
  await waitFor(() =>
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "検索条件を保存できませんでした。")).toBe(
      true,
    ),
  );
});
