import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import { useKeepCollections, useKeepList, useKeepStore } from "@keepkit/core/react";
import { useEffect, useRef, useState } from "react";
import { normalizeUiTags } from "../../../foundation/shared";
import { useUiLabel } from "../../../foundation/ui-context";
import type { KeepBulkActionsState, KeepSelectionScope } from "../KeepBulkActions";

type KeepBulkActionsOptions<TMeta> = {
  query: KeepListQuery<TMeta> | undefined;
  controlledSelectedIds: string[] | undefined;
  defaultSelectedIds: string[];
  onSelectedIdsChange: ((ids: string[]) => void) | undefined;
  onCompleted: ((action: "remove" | "tags", ids: string[]) => void) | undefined;
  controlledScope: KeepSelectionScope | undefined;
  onSelectionScopeChange: ((scope: KeepSelectionScope) => void) | undefined;
  confirmRemoval?: boolean;
};

/** Returns whether every visible item is selected. Empty lists are never all selected. */
export function isAllSelected<TMeta>(
  items: readonly Pick<KeepItem<TMeta>, "id">[],
  selectedIds: readonly string[],
): boolean {
  if (items.length === 0) return false;
  const selected = new Set(selectedIds);
  return items.every((item) => selected.has(item.id));
}

/** Toggles only the visible items, preserving selections outside the current query or page. */
export function toggleSelectAll<TMeta>(
  items: readonly Pick<KeepItem<TMeta>, "id">[],
  selectedIds: readonly string[],
): string[] {
  const visibleIds = new Set(items.map((item) => item.id));
  if (isAllSelected(items, selectedIds)) return selectedIds.filter((id) => !visibleIds.has(id));
  const nextIds = [...selectedIds];
  for (const item of items) {
    if (!nextIds.includes(item.id)) nextIds.push(item.id);
  }
  return nextIds;
}

export function useKeepBulkActions<TMeta>(options: KeepBulkActionsOptions<TMeta>) {
  const {
    query,
    controlledSelectedIds,
    defaultSelectedIds,
    onSelectedIdsChange,
    onCompleted,
    controlledScope,
    onSelectionScopeChange,
    confirmRemoval = false,
  } = options;
  const { store } = useKeepStore<TMeta>();
  const list = useKeepList<TMeta>(query);
  const queryList = useKeepList<TMeta>(query ? { ...query, pagination: undefined } : { pagination: undefined });
  const allList = useKeepList<TMeta>({ pagination: undefined });
  const collections = useKeepCollections();
  const [uncontrolledScope, setUncontrolledScope] = useState<KeepSelectionScope>(controlledScope ?? "page");
  const selectionScope = controlledScope ?? uncontrolledScope;
  const targetItems =
    selectionScope === "page" ? list.items : selectionScope === "query" ? queryList.items : allList.items;
  const [uncontrolledSelectedIds, setUncontrolledSelectedIds] = useState(defaultSelectedIds);
  const selectedIds = controlledSelectedIds ?? uncontrolledSelectedIds;
  const selected = new Set(selectedIds);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [confirmation, setConfirmation] = useState<{
    ids: string[];
    scope: KeepSelectionScope;
    query: unknown;
    remove: typeof list.removeBatchWithUndo;
  } | null>(null);
  const confirmationRef = useRef<typeof confirmation>(null);
  const confirmationValid = Boolean(
    confirmation &&
      confirmationRef.current === confirmation &&
      confirmation.scope === selectionScope &&
      confirmation.remove === list.removeBatchWithUndo &&
      equalQueryValue(confirmation.ids, selectedIds) &&
      equalQueryValue(confirmation.query, query),
  );
  useEffect(() => {
    if (confirmation && !confirmationValid) {
      confirmationRef.current = null;
      setConfirmation(null);
    }
  }, [confirmation, confirmationValid]);
  useEffect(
    () =>
      store.subscribe(() => {
        if (store.getSnapshot().isHydrated) return;
        confirmationRef.current = null;
        setConfirmation(null);
      }),
    [store],
  );

  const setSelectionScope = (scope: KeepSelectionScope) => {
    if (controlledScope === undefined) setUncontrolledScope(scope);
    onSelectionScopeChange?.(scope);
  };
  const setSelectedIds = (ids: string[]) => {
    if (controlledSelectedIds === undefined) setUncontrolledSelectedIds(ids);
    onSelectedIdsChange?.(ids);
  };
  const toggle = (id: string) =>
    setSelectedIds(selected.has(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id]);
  const allSelected = isAllSelected(targetItems, selectedIds);
  const toggleAll = () => setSelectedIds(toggleSelectAll(targetItems, selectedIds));
  const run = async (operation: (ids: string[]) => Promise<void>, ids = selectedIds) => {
    if (pendingRef.current || list.isMutating || ids.length === 0) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await operation([...ids]);
      setSelectedIds([]);
    } catch (cause) {
      setError(cause);
      throw cause;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const performRemoval = (ids: string[]) =>
    run(async (ids) => {
      await list.removeBatchWithUndo(ids);
      confirmationRef.current = null;
      setConfirmation(null);
      onCompleted?.("remove", ids);
    }, ids);
  const requestRemoval = async () => {
    if (pendingRef.current || list.isMutating || !store.getSnapshot().isHydrated || selectedIds.length === 0) return;
    if (!confirmRemoval) return performRemoval(selectedIds);
    setError(null);
    const nextConfirmation = {
      ids: [...selectedIds],
      scope: selectionScope,
      query: copyQueryValue(query),
      remove: list.removeBatchWithUndo,
    };
    confirmationRef.current = nextConfirmation;
    setConfirmation(nextConfirmation);
  };
  const confirmPendingRemoval = async () => {
    if (!confirmation || !confirmationValid || confirmationRef.current !== confirmation) return;
    await performRemoval(confirmation.ids);
  };
  const updateTags = () =>
    run(async (ids) => {
      await list.updateTagsBatch(ids, normalizeUiTags(tagsInput.split(",")));
      onCompleted?.("tags", ids);
    });
  const moveToCollection = () => run((ids) => list.moveToCollectionBatch(ids, collectionId || undefined));
  const archive = () => run((ids) => list.archiveBatch(ids));
  const unarchive = () => run((ids) => list.unarchiveBatch(ids));
  const pin = () => run((ids) => list.pinBatch(ids));
  const unpin = () => run((ids) => list.unpinBatch(ids));
  const state: KeepBulkActionsState<TMeta> = {
    items: targetItems,
    selectedIds,
    selectedCount: selectedIds.length,
    isAllSelected: allSelected,
    allSelected,
    tagsInput,
    setTagsInput,
    toggle,
    toggleSelectAll: toggleAll,
    toggleAll,
    remove: requestRemoval,
    requestRemoval,
    confirmRemoval: confirmPendingRemoval,
    cancelRemoval: () => {
      if (!pendingRef.current) {
        confirmationRef.current = null;
        setConfirmation(null);
      }
    },
    removalConfirmation:
      confirmationValid && confirmation ? { ids: [...confirmation.ids], count: confirmation.ids.length } : null,
    updateTags,
    collectionId,
    setCollectionId,
    collections,
    moveToCollection,
    archive,
    unarchive,
    pin,
    unpin,
    isMutating: pending || list.isMutating,
    error,
    selectionScope,
    setSelectionScope,
  };

  return {
    state,
    selected,
    isLoading: list.isLoading,
    labels: {
      selectItems: useUiLabel("selectItems"),
      selectedCount: useUiLabel("selectedCount"),
      deleteSelected: useUiLabel("deleteSelected"),
      tags: useUiLabel("tagsToApply"),
      applyTags: useUiLabel("applyTags"),
      selectionScope: useUiLabel("selectionScope"),
      currentPage: useUiLabel("currentPage"),
      searchResults: useUiLabel("searchResults"),
      allItems: useUiLabel("allItems"),
    },
  };
}

function copyQueryValue(value: unknown): unknown {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(copyQueryValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyQueryValue(entry)]));
  }
  return value;
}

function equalQueryValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && Object.is(left.getTime(), right.getTime());
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value]) =>
        Object.getOwnPropertyDescriptor(right, key) !== undefined && equalQueryValue(value, Reflect.get(right, key)),
    )
  );
}
