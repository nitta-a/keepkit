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
  allSelected: boolean;
  tagsInput: string;
  setTagsInput: (value: string) => void;
  toggle: (id: string) => void;
  toggleAll: () => void;
  remove: () => Promise<void>;
  updateTags: () => Promise<void>;
  isMutating: boolean;
};

export type KeepBulkActionsProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  renderItem?: (item: KeepItem<TMeta>, selected: boolean) => ReactNode;
  onCompleted?: (action: "remove" | "tags", ids: string[]) => void;
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
  render,
  children,
  ...props
}: KeepBulkActionsProps<TMeta>) {
  const selectItemsLabel = useUiLabel("selectItems");
  const selectedCountLabel = useUiLabel("selectedCount");
  const deleteSelectedLabel = useUiLabel("deleteSelected");
  const tagsLabel = useUiLabel("tagsToApply");
  const applyTagsLabel = useUiLabel("applyTags");
  const list = useKeepList<TMeta>(query);
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
  const allSelected = list.items.length > 0 && list.items.every((item) => selected.has(item.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : list.items.map((item) => item.id));
  const remove = async () => {
    const ids = [...selectedIds];
    await list.removeBatch(ids);
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
    items: list.items,
    selectedIds,
    selectedCount: selectedIds.length,
    allSelected,
    tagsInput,
    setTagsInput,
    toggle,
    toggleAll,
    remove,
    updateTags,
    isMutating: list.isMutating,
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
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={selectItemsLabel} />
                {selectedIds.length} {selectedCountLabel}
              </label>
              {list.items.map((item) => (
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
    <section {...props} aria-busy={list.isMutating || props["aria-busy"]}>
      {body}
    </section>
  );
}
