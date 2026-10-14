import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import type { KeepRecoveryInspection, KeepStorageRecovery } from "@keepkit/core/storage";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type MouseEvent, useState } from "react";
import { expect, test, vi } from "vitest";
import {
  KeepBulkActions,
  type KeepBulkActionsState,
  KeepCollection,
  KeepFallbackRecovery,
  KeepItemCard,
  type KeepItemCardLinkProps,
  KeepProvider,
  KeepUiProvider,
  KeepUndo,
} from "../src/index";

type Meta = { title: string };
const first: KeepItem<Meta> = {
  id: "first",
  meta: { title: "First article" },
  tags: ["read"],
  savedAt: 1,
  updatedAt: 1,
};
const second: KeepItem<Meta> = { ...first, id: "second", meta: { title: "Second article" } };

function createStorage(initial = [first, second]) {
  let items = [...initial];
  const removeMany = vi.fn(async (ids: string[]) => {
    items = items.filter((item) => !ids.includes(item.id));
  });
  const storage: StorageAdapter<Meta> = {
    getAll: async () => [...items],
    set: async (item) => {
      items = [...items.filter((current) => current.id !== item.id), item];
    },
    setMany: async (next) => {
      const nextIds = new Set(next.map((item) => item.id));
      items = [...items.filter((item) => !nextIds.has(item.id)), ...next];
    },
    remove: async (id) => {
      items = items.filter((item) => item.id !== id);
    },
    removeMany,
    clear: async () => {
      items = [];
    },
  };
  return { storage, removeMany };
}

test("explicit Link shares router attributes, suppresses nested anchors and tags, and records one open", async () => {
  const { storage } = createStorage([first]);
  const set = vi.spyOn(storage, "set");
  const open = vi.fn((_item: KeepItem<Meta>, event: MouseEvent<HTMLElement>) => event.preventDefault());
  function RouterLink(props: KeepItemCardLinkProps) {
    return (
      <a
        {...props}
        href={props.href}
        data-router="yes"
        onClick={(event) => {
          event.preventDefault();
          props.onClick?.(event);
        }}
      />
    );
  }
  render(
    <KeepProvider storage={storage}>
      <KeepItemCard item={first} href="https://example.com/read" linkComponent={RouterLink} trackOpen onOpen={open}>
        <KeepItemCard.Link aria-label="Read article">
          <KeepItemCard.Content />
          <KeepItemCard.Link>
            <span>Nested static region</span>
          </KeepItemCard.Link>
        </KeepItemCard.Link>
        <KeepItemCard.Tags />
        <KeepItemCard.Actions>
          <button type="button">Outside action</button>
        </KeepItemCard.Actions>
      </KeepItemCard>
    </KeepProvider>,
  );
  const link = await screen.findByRole("link", { name: "Read article" });
  expect(link.getAttribute("data-router")).toBe("yes");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer");
  expect(link.querySelector("a, ul, button")).toBeNull();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("list", { name: "Tags" }).closest("a")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Outside action" }));
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(link);
  await waitFor(() => expect(set).toHaveBeenCalledOnce());
  expect(open).toHaveBeenCalledOnce();
});

test("explicit Link exposes an unavailable region without navigation or opening", async () => {
  const open = vi.fn();
  render(
    <KeepProvider storage={createStorage([first]).storage}>
      <KeepItemCard item={{ ...first, status: "private" }} href="/private" trackOpen onOpen={open}>
        <KeepItemCard.Link aria-label="Private region">
          <KeepItemCard.Title />
        </KeepItemCard.Link>
      </KeepItemCard>
    </KeepProvider>,
  );
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByLabelText("Private region").getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(screen.getByText("First article"));
  expect(open).not.toHaveBeenCalled();
});

test("confirmation captures off-page selections, cancellation writes nothing, and confirmed deletion can be undone", async () => {
  const { storage, removeMany } = createStorage();
  render(
    <KeepProvider storage={storage}>
      <KeepBulkActions
        confirmRemoval
        defaultSelectedIds={[first.id, second.id]}
        query={{ pagination: { page: 1, pageSize: 1 } }}
      />
      <KeepUndo />
    </KeepProvider>,
  );
  await screen.findByText("First article");
  const trigger = screen.getByRole("button", { name: "Delete selected" });
  fireEvent.click(trigger);
  const confirmation = screen.getByRole("dialog", { name: "Confirm removal" });
  expect(confirmation.textContent).toContain("2 selected");
  expect(document.activeElement).toBe(within(confirmation).getByRole("button", { name: "Delete selected" }));
  fireEvent.keyDown(confirmation, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(removeMany).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete selected" }));
  await waitFor(() => expect(removeMany).toHaveBeenCalledWith([first.id, second.id]));
  expect(removeMany).toHaveBeenCalledOnce();
  expect(await storage.getAll()).toEqual([]);
  fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
  await waitFor(async () => expect((await storage.getAll()).map((item) => item.id)).toEqual([first.id, second.id]));
});

test("confirmation is canceled if selection, selection scope, query, or provider storage changes", async () => {
  const { storage, removeMany } = createStorage();
  const renderBulk = (search?: string, selectedIds = [first.id], nextStorage = storage) => (
    <KeepProvider storage={nextStorage}>
      <KeepBulkActions confirmRemoval selectedIds={selectedIds} query={{ search }} />
    </KeepProvider>
  );
  const view = render(renderBulk());
  await screen.findByText("First article");
  const request = () => fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  request();
  view.rerender(renderBulk(undefined, [second.id]));
  expect(screen.queryByRole("dialog")).toBeNull();
  request();
  fireEvent.change(screen.getByRole("combobox", { name: "Selection scope" }), { target: { value: "all" } });
  expect(screen.queryByRole("dialog")).toBeNull();
  request();
  view.rerender(renderBulk("Second", [second.id]));
  expect(screen.queryByRole("dialog")).toBeNull();
  request();
  view.rerender(renderBulk("Second", [second.id], createStorage().storage));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(removeMany).not.toHaveBeenCalled();
});

test("confirmation preserves equivalent Date bounds and cancels when a Date search condition changes", async () => {
  const { storage, removeMany } = createStorage();
  const renderBulk = (from: number) => (
    <KeepProvider storage={storage}>
      <KeepBulkActions
        confirmRemoval
        selectedIds={[first.id]}
        query={{ savedBetween: [new Date(from), new Date(5)] }}
      />
    </KeepProvider>
  );
  const view = render(renderBulk(0));
  await screen.findByText("First article");
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  view.rerender(renderBulk(0));
  expect(screen.getByRole("dialog", { name: "Confirm removal" })).toBeTruthy();
  view.rerender(renderBulk(1));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(removeMany).not.toHaveBeenCalled();
});

test("changing account scope on the same adapter revokes confirmation even after hydration completes", async () => {
  const { storage, removeMany } = createStorage();
  const listeners = new Set<() => void>();
  let currentScope = { userId: "first-user" };
  let items = [{ ...first, scope: currentScope }];
  const scopedStorage = {
    ...storage,
    get scope() {
      return currentScope;
    },
    getAll: async () => items,
    subscribeScope: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  let current: KeepBulkActionsState<Meta> | undefined;
  render(
    <KeepProvider storage={scopedStorage}>
      <KeepBulkActions<Meta> confirmRemoval selectedIds={[first.id]}>
        {(state) => {
          current = state;
          return <p>{state.items[0]?.meta.title}</p>;
        }}
      </KeepBulkActions>
    </KeepProvider>,
  );
  await screen.findByText("First article");
  await act(async () => current?.requestRemoval());
  const oldConfirmation = current;
  expect(oldConfirmation?.removalConfirmation?.count).toBe(1);
  await act(async () => {
    currentScope = { userId: "second-user" };
    items = [{ ...first, scope: currentScope, meta: { title: "Other account article" } }];
    for (const listener of listeners) listener();
  });
  await screen.findByText("Other account article");
  expect(current?.removalConfirmation).toBeNull();
  await act(async () => oldConfirmation?.confirmRemoval());
  expect(removeMany).not.toHaveBeenCalled();
});

test("render-prop cancellation immediately revokes confirmation before the next render", async () => {
  const { storage, removeMany } = createStorage();
  let current: KeepBulkActionsState<Meta> | undefined;
  render(
    <KeepProvider storage={storage}>
      <KeepBulkActions<Meta> confirmRemoval selectedIds={[first.id]}>
        {(state) => {
          current = state;
          return null;
        }}
      </KeepBulkActions>
    </KeepProvider>,
  );
  await waitFor(() => expect(current?.items).toHaveLength(2));
  await act(async () => current?.requestRemoval());
  const oldConfirmation = current;
  await act(async () => {
    oldConfirmation?.cancelRemoval();
    await oldConfirmation?.confirmRemoval();
  });
  expect(removeMany).not.toHaveBeenCalled();
  expect(current?.removalConfirmation).toBeNull();
});

test("render props expose confirmation and guard double confirmation while allowing failure retry", async () => {
  const { storage, removeMany } = createStorage();
  removeMany.mockRejectedValueOnce(new Error("Temporary failure"));
  let current: KeepBulkActionsState<Meta> | undefined;
  function Actions() {
    const [selectedIds, setSelectedIds] = useState([first.id]);
    return (
      <KeepBulkActions<Meta> confirmRemoval selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds}>
        {(state) => {
          current = state;
          return (
            <button type="button" onClick={() => void state.requestRemoval()}>
              Request removal
            </button>
          );
        }}
      </KeepBulkActions>
    );
  }
  render(
    <KeepProvider storage={storage}>
      <Actions />
    </KeepProvider>,
  );
  await waitFor(() => expect(current?.items).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "Request removal" }));
  await waitFor(() => expect(current?.removalConfirmation?.ids).toEqual([first.id]));
  await current?.confirmRemoval().catch(() => undefined);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Temporary failure"));
  expect(current?.removalConfirmation?.ids).toEqual([first.id]);
  const retryOne = current?.confirmRemoval();
  const retryTwo = current?.confirmRemoval();
  await Promise.all([retryOne, retryTwo]);
  await waitFor(() => expect(current?.removalConfirmation).toBeNull());
  expect(removeMany).toHaveBeenCalledTimes(2);
});

test.each(["inline", "separate"] as const)(
  "Collection forwards opt-in removal confirmation to %s controls",
  async (variant) => {
    const { storage, removeMany } = createStorage([first]);
    render(
      <KeepUiProvider locale="ja">
        <KeepProvider storage={storage}>
          <KeepCollection
            confirmRemoval
            bulkActionsVariant={variant}
            features={{ bulkActions: true, search: false, sort: false, tagFilter: false, collectionFilter: false }}
          />
        </KeepProvider>
      </KeepUiProvider>,
    );
    await screen.findByText("First article");
    if (variant === "inline") fireEvent.click(screen.getByRole("button", { name: "保存アイテムを選択" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: variant === "inline" ? "表示中のページ" : "保存アイテムを選択" }),
    );
    if (variant === "inline") fireEvent.click(screen.getByText("その他"));
    fireEvent.click(screen.getByRole("button", { name: "選択項目を削除" }));
    expect(screen.getByRole("dialog", { name: "削除の確認" }).textContent).toContain("選択した項目を削除しますか？");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "キャンセル" }));
    expect(removeMany).not.toHaveBeenCalled();
  },
);

function createRecovery() {
  const snapshot = {
    items: [first],
    collections: [],
    memberships: [],
    capabilities: { collections: false, memberships: false },
    capturedAt: 1,
  };
  const key = "item:first";
  const alternate = { ...first, meta: { title: "Alternate title" } };
  const inspect = vi.fn(
    async (options?: { selections?: Record<string, string> }): Promise<KeepRecoveryInspection<Meta>> => {
      const choice = options?.selections?.[key];
      return {
        token: "review-token",
        sources: [
          { id: "primary", label: "primary", snapshot },
          { id: "fallback", label: "fallback", snapshot: { ...snapshot, items: [alternate] } },
        ],
        rows: [
          {
            key,
            kind: "item",
            id: first.id,
            candidates: [
              { source: "primary", value: first },
              { source: "fallback", value: alternate },
            ],
            conflict: true,
            selectedSource: choice,
          },
        ],
        issues: choice ? [] : ["unresolved-conflict:first"],
        operations: [{ type: "setItems", items: choice === "fallback" ? [alternate] : [first] }],
        backups: [],
      };
    },
  );
  const apply = vi.fn(async (_options: { token: string; selections: Record<string, string> }) => ({
    status: "applied" as const,
    pendingOperations: 0,
  }));
  const retry = vi.fn(async () => ({ status: "applied" as const, pendingOperations: 0 }));
  const recovery: KeepStorageRecovery<Meta> = {
    getState: () => ({
      source: "primary",
      pendingOperations: 0,
      snapshotStale: false,
      capturedAt: 1,
      repairSupported: true,
    }),
    subscribe: () => () => undefined,
    inspect,
    apply,
    retry,
  };
  return { recovery, inspect, apply, retry, key };
}

test("recovery comparison is read-only and requires a resolved, reviewed choice before one apply", async () => {
  const { recovery, inspect, apply, key } = createRecovery();
  render(<KeepFallbackRecovery recovery={recovery} />);
  expect(inspect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  const select = await screen.findByRole("combobox", { name: "Saved items: first" });
  expect(document.activeElement).toBe(select);
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(select, { target: { value: "fallback" } });
  fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(false),
  );
  const confirm = screen.getByRole("button", { name: "Apply reviewed changes" });
  expect(document.activeElement).toBe(confirm);
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await screen.findByText("Recovery completed.");
  expect(apply).toHaveBeenCalledExactlyOnceWith({ token: "review-token", selections: { [key]: "fallback" } });
});

test("recovery invalidates review after a choice change and a rejected stale confirmation", async () => {
  const { recovery, apply } = createRecovery();
  apply.mockRejectedValueOnce(new Error("Recovery data changed"));
  render(<KeepFallbackRecovery recovery={recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  const select = await screen.findByRole("combobox");
  fireEvent.change(select, { target: { value: "primary" } });
  fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(false),
  );
  fireEvent.change(select, { target: { value: "fallback" } });
  expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply reviewed changes" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Something went wrong."));
  expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(true);
});

test("state-only recovery displays localized status and never offers repair", () => {
  const inspect = vi.fn();
  const recovery: KeepStorageRecovery<Meta> = {
    getState: () => ({ source: "fallback", pendingOperations: 2, snapshotStale: true, repairSupported: false }),
    subscribe: () => () => undefined,
    inspect,
  };
  render(
    <KeepUiProvider locale="ja">
      <KeepFallbackRecovery recovery={recovery} />
    </KeepUiProvider>,
  );
  expect(screen.getByRole("region", { name: "保存データの復旧" })).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("復旧用スナップショットが古い可能性があります。")).toBeTruthy();
  expect(inspect).not.toHaveBeenCalled();
});

test("committed pending repair leaves no resubmit action and resumes through retry", async () => {
  const { recovery, apply, retry } = createRecovery();
  let pendingOperations = 0;
  recovery.getState = () => ({ source: "fallback", pendingOperations, snapshotStale: false, repairSupported: true });
  apply.mockImplementationOnce(async () => {
    pendingOperations = 1;
    return { status: "pending", pendingOperations: 1 };
  });
  retry.mockImplementationOnce(async () => {
    pendingOperations = 0;
    return { status: "applied", pendingOperations: 0 };
  });
  render(<KeepFallbackRecovery recovery={recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  fireEvent.change(await screen.findByRole("combobox"), { target: { value: "fallback" } });
  fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply reviewed changes" }));
  await screen.findByText("Recovery changes were saved and are waiting to be applied.");
  expect(screen.queryByRole("button", { name: "Apply reviewed changes" })).toBeNull();
  expect(screen.getByRole("button", { name: "Compare saved data" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Recovery completed.");
  expect(apply).toHaveBeenCalledOnce();
  expect(retry).toHaveBeenCalledOnce();
});

test("invalid memberships block recovery apply after preview and cancellation writes nothing", async () => {
  const { recovery, inspect, apply } = createRecovery();
  const validInspect = inspect.getMockImplementation();
  inspect.mockImplementation(async (options) => {
    const result = await validInspect?.(options);
    if (!result) throw new Error("Missing inspection");
    return { ...result, issues: ["invalid-membership:missing/first"] };
  });
  render(<KeepFallbackRecovery recovery={recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  fireEvent.change(await screen.findByRole("combobox"), { target: { value: "primary" } });
  fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
  await waitFor(() => expect(inspect).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(apply).not.toHaveBeenCalled();
});

test("a delayed inspection from a previous recovery scope never appears after changing the capability", async () => {
  const old = createRecovery();
  const current = createRecovery();
  const defaultInspect = old.inspect.getMockImplementation();
  let resolveInspection: ((value: KeepRecoveryInspection<Meta>) => void) | undefined;
  old.inspect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveInspection = resolve;
      }),
  );
  const view = render(<KeepFallbackRecovery recovery={old.recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  view.rerender(<KeepFallbackRecovery recovery={current.recovery} />);
  const inspection = await defaultInspect?.();
  if (!inspection) throw new Error("Missing inspection");
  resolveInspection?.(inspection);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Compare saved data" }).hasAttribute("disabled")).toBe(false),
  );
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(current.inspect).not.toHaveBeenCalled();
  expect(old.apply).not.toHaveBeenCalled();
});

test("changing recovery scope can inspect immediately and an older completion never unlocks its pending request", async () => {
  const old = createRecovery();
  const current = createRecovery();
  const originalInspect = old.inspect.getMockImplementation();
  const inspection = await originalInspect?.();
  if (!inspection) throw new Error("Missing inspection");
  let finishOld: ((value: KeepRecoveryInspection<Meta>) => void) | undefined;
  let finishCurrent: ((value: KeepRecoveryInspection<Meta>) => void) | undefined;
  old.inspect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  current.inspect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCurrent = resolve;
      }),
  );
  const view = render(<KeepFallbackRecovery recovery={old.recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  view.rerender(<KeepFallbackRecovery recovery={current.recovery} />);
  const compare = screen.getByRole("button", { name: "Compare saved data" });
  await waitFor(() => expect(compare.hasAttribute("disabled")).toBe(false));
  fireEvent.click(compare);
  expect(current.inspect).toHaveBeenCalledOnce();
  await act(async () => finishOld?.(inspection));
  expect(compare.hasAttribute("disabled")).toBe(true);
  fireEvent.click(compare);
  expect(current.inspect).toHaveBeenCalledOnce();
  expect(screen.queryByRole("combobox")).toBeNull();
  await act(async () => finishCurrent?.(inspection));
  expect(await screen.findByRole("combobox")).toBeTruthy();
});

test("returning to a previous recovery capability preserves its in-flight guard", async () => {
  const old = createRecovery();
  const current = createRecovery();
  const originalInspect = old.inspect.getMockImplementation();
  const inspection = await originalInspect?.();
  if (!inspection) throw new Error("Missing inspection");
  let finishOld: ((value: KeepRecoveryInspection<Meta>) => void) | undefined;
  let finishCurrent: ((value: KeepRecoveryInspection<Meta>) => void) | undefined;
  old.inspect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  current.inspect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCurrent = resolve;
      }),
  );
  const view = render(<KeepFallbackRecovery recovery={old.recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  view.rerender(<KeepFallbackRecovery recovery={current.recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  view.rerender(<KeepFallbackRecovery recovery={old.recovery} />);
  const compare = screen.getByRole("button", { name: "Compare saved data" });
  expect(compare.hasAttribute("disabled")).toBe(true);
  await act(async () => finishCurrent?.(inspection));
  expect(compare.hasAttribute("disabled")).toBe(true);
  fireEvent.click(compare);
  expect(old.inspect).toHaveBeenCalledOnce();
  await act(async () => finishOld?.(inspection));
  expect(compare.hasAttribute("disabled")).toBe(false);
});

test("retained pre-repair backups remain extractable without reviewing or applying new changes", async () => {
  const { recovery, inspect, apply } = createRecovery();
  const originalInspect = inspect.getMockImplementation();
  const backup = {
    format: "keepkit" as const,
    version: 2 as const,
    exportedAt: 10,
    items: [second],
    collections: [],
    memberships: [],
  };
  inspect.mockImplementation(async (options) => {
    const inspection = await originalInspect?.(options);
    if (!inspection) throw new Error("Missing inspection");
    return { ...inspection, rows: [], issues: [], operations: [], retainedBackups: [backup] };
  });
  render(<KeepFallbackRecovery recovery={recovery} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare saved data" }));
  const historySummary = await screen.findByText("Saved: Backups before repair (1)");
  fireEvent.click(historySummary);
  const history = historySummary.parentElement;
  const raw = history?.querySelector("pre")?.textContent;
  if (!raw) throw new Error("Missing retained backup data");
  expect(JSON.parse(raw)).toEqual(backup);
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
  await screen.findByText("No changes to apply.");
  expect(screen.getByText("Saved: Backups before repair (1)")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Apply reviewed changes" }).hasAttribute("disabled")).toBe(true);
});
