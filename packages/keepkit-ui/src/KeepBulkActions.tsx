"use client";

import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { type HTMLAttributes, type ReactNode, useState } from "react";
import { KeepItemCheckbox } from "./KeepItemCheckbox";
import { getMetaTitle, normalizeUiTags, type RenderProp } from "./shared";
import { useUiLabel } from "./ui-context";

export type KeepBulkActionsState<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  selectedIds: string[];
  selectedCount: number;
  isAllSelected: boolean;
  allSelected: boolean;
  tagsInput: string;
  setTagsInput: (value: string) => void;
  toggle: (id: string) => void;
  toggleSelectAll: () => void;
  toggleAll: () => void;
  remove: () => Promise<void>;
  updateTags: () => Promise<void>;
  isMutating: boolean;
  selectionScope: KeepSelectionScope;
  setSelectionScope: (scope: KeepSelectionScope) => void;
};

export type KeepSelectionScope = "page" | "query" | "all";

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

export type KeepBulkActionsProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  renderItem?: (item: KeepItem<TMeta>, selected: boolean) => ReactNode;
  onCompleted?: (action: "remove" | "tags", ids: string[]) => void;
  selectionScope?: KeepSelectionScope;
  onSelectionScopeChange?: (scope: KeepSelectionScope) => void;
  render?: RenderProp<KeepBulkActionsState<TMeta>>;
  children?: ReactNode | RenderProp<KeepBulkActionsState<TMeta>>;
};

/** Selects visible items and performs one storage operation for the whole selection. */
export function KeepBulkActions<TMeta = Record<string, unknown>>({
  query,
  selectedIds: controlledSelectedIds,
  defaultSelectedIds = [],
  onSelectedIdsChange,
  renderItem,
  onCompleted,
  selectionScope: controlledScope,
  onSelectionScopeChange,
  render,
  children,
  ...props
}: KeepBulkActionsProps<TMeta>) {
  const selectItemsLabel = useUiLabel("selectItems");
  const selectedCountLabel = useUiLabel("selectedCount");
  const deleteSelectedLabel = useUiLabel("deleteSelected");
  const tagsLabel = useUiLabel("tagsToApply");
  const applyTagsLabel = useUiLabel("applyTags");
  const selectionScopeLabel = useUiLabel("selectionScope");
  const currentPageLabel = useUiLabel("currentPage");
  const searchResultsLabel = useUiLabel("searchResults");
  const allItemsLabel = useUiLabel("allItems");
  const list = useKeepList<TMeta>(query);
  const queryList = useKeepList<TMeta>(query ? { ...query, pagination: undefined } : { pagination: undefined });
  const allList = useKeepList<TMeta>({ pagination: undefined });
  const [uncontrolledScope, setUncontrolledScope] = useState<KeepSelectionScope>(controlledScope ?? "page");
  const selectionScope = controlledScope ?? uncontrolledScope;
  const setSelectionScope = (scope: KeepSelectionScope) => {
    if (controlledScope === undefined) setUncontrolledScope(scope);
    onSelectionScopeChange?.(scope);
  };
  const targetItems =
    selectionScope === "page" ? list.items : selectionScope === "query" ? queryList.items : allList.items;
  const [uncontrolledSelectedIds, setUncontrolledSelectedIds] = useState(defaultSelectedIds);
  const selectedIds = controlledSelectedIds ?? uncontrolledSelectedIds;
  const selected = new Set(selectedIds);
  const [tagsInput, setTagsInput] = useState("");
  const setSelectedIds = (ids: string[]) => {
    if (controlledSelectedIds === undefined) setUncontrolledSelectedIds(ids);
    onSelectedIdsChange?.(ids);
  };
  const toggle = (id: string) =>
    setSelectedIds(selected.has(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id]);
  const allSelected = isAllSelected(targetItems, selectedIds);
  const toggleAll = () => setSelectedIds(toggleSelectAll(targetItems, selectedIds));
  const remove = async () => {
    const ids = [...selectedIds];
    await list.removeBatchWithUndo(ids);
    onCompleted?.("remove", ids);
    setSelectedIds([]);
  };
  const updateTags = async () => {
    const ids = [...selectedIds];
    await list.updateTagsBatch(ids, normalizeUiTags(tagsInput.split(",")));
    onCompleted?.("tags", ids);
    setSelectedIds([]);
  };
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
    isMutating: list.isMutating,
    selectionScope,
    setSelectionScope,
  };
  const body = render
    ? render(state)
    : typeof children === "function"
      ? children(state)
      : (children ?? (
          <>
            <fieldset>
              <legend>{selectItemsLabel}</legend>
              <label>
                {selectionScopeLabel}
                <select
                  value={selectionScope}
                  onChange={(event) => setSelectionScope(event.currentTarget.value as KeepSelectionScope)}
                >
                  <option value="page">{currentPageLabel}</option>
                  <option value="query">{searchResultsLabel}</option>
                  <option value="all">{allItemsLabel}</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={selectItemsLabel} />
                {selectedIds.length} {selectedCountLabel}
              </label>
              {targetItems.map((item) => (
                <span key={item.id}>
                  <KeepItemCheckbox
                    item={item}
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                  />
                  {renderItem ? renderItem(item, selected.has(item.id)) : (getMetaTitle(item.meta) ?? item.id)}
                </span>
              ))}
            </fieldset>
            <button type="button" onClick={() => void remove()} disabled={selectedIds.length === 0 || list.isMutating}>
              {deleteSelectedLabel}
            </button>
            <label>
              {tagsLabel}
              <input value={tagsInput} onChange={(event) => setTagsInput(event.currentTarget.value)} />
            </label>
            <button
              type="button"
              onClick={() => void updateTags()}
              disabled={selectedIds.length === 0 || list.isMutating}
            >
              {applyTagsLabel}
            </button>
          </>
        ));
  return (
    <section
      {...props}
      data-keepkit="bulk-actions"
      aria-busy={list.isMutating || props["aria-busy"]}
      data-state={selectedIds.length > 0 ? "selected" : "idle"}
      data-loading={list.isLoading || list.isMutating ? "true" : undefined}
    >
      {body}
    </section>
  );
}
