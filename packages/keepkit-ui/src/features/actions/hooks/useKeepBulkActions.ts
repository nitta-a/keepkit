import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import { useKeepCollections, useKeepList } from "@keepkit/core/react";
import { useRef, useState } from "react";
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
  } = options;
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
  const run = async (operation: (ids: string[]) => Promise<void>) => {
    if (pendingRef.current || list.isMutating || selectedIds.length === 0) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await operation([...selectedIds]);
      setSelectedIds([]);
    } catch (cause) {
      setError(cause);
      throw cause;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const remove = () =>
    run(async (ids) => {
      await list.removeBatchWithUndo(ids);
      onCompleted?.("remove", ids);
    });
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
    remove,
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
