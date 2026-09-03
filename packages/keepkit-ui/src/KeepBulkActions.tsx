"use client";

import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import type { HTMLAttributes, ReactNode } from "react";
import { useKeepBulkActions } from "./hooks/useKeepBulkActions";
import { KeepItemCheckbox } from "./KeepItemCheckbox";
import { getMetaTitle, type RenderProp } from "./shared";

export { isAllSelected, toggleSelectAll } from "./hooks/useKeepBulkActions";

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
  const { state, selected, isLoading, labels } = useKeepBulkActions<TMeta>({
    query,
    controlledSelectedIds,
    defaultSelectedIds,
    onSelectedIdsChange,
    onCompleted,
    controlledScope,
    onSelectionScopeChange,
  });
  const body = render
    ? render(state)
    : typeof children === "function"
      ? children(state)
      : (children ?? (
          <>
            <fieldset>
              <legend>{labels.selectItems}</legend>
              <label>
                {labels.selectionScope}
                <select
                  data-keep-action="select-scope"
                  value={state.selectionScope}
                  onChange={(event) => state.setSelectionScope(event.currentTarget.value as KeepSelectionScope)}
                >
                  <option value="page">{labels.currentPage}</option>
                  <option value="query">{labels.searchResults}</option>
                  <option value="all">{labels.allItems}</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  data-keep-action="select-all"
                  checked={state.allSelected}
                  onChange={state.toggleAll}
                  aria-label={labels.selectItems}
                />
                {state.selectedIds.length} {labels.selectedCount}
              </label>
              {state.items.map((item) => (
                <span key={item.id}>
                  <KeepItemCheckbox
                    item={item}
                    checked={selected.has(item.id)}
                    onCheckedChange={() => state.toggle(item.id)}
                  />
                  {renderItem ? renderItem(item, selected.has(item.id)) : (getMetaTitle(item.meta) ?? item.id)}
                </span>
              ))}
            </fieldset>
            <button
              type="button"
              data-keep-action="delete-selected"
              onClick={() => void state.remove()}
              disabled={state.selectedIds.length === 0 || state.isMutating}
            >
              {labels.deleteSelected}
            </button>
            <label>
              {labels.tags}
              <input
                data-keep-action="edit-tags"
                value={state.tagsInput}
                onChange={(event) => state.setTagsInput(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              data-keep-action="apply-tags"
              onClick={() => void state.updateTags()}
              disabled={state.selectedIds.length === 0 || state.isMutating}
            >
              {labels.applyTags}
            </button>
          </>
        ));
  return (
    <section
      {...props}
      data-keepkit="bulk-actions"
      aria-busy={state.isMutating || props["aria-busy"]}
      data-state={state.selectedIds.length > 0 ? "selected" : "idle"}
      data-loading={isLoading || state.isMutating ? "true" : undefined}
    >
      {body}
    </section>
  );
}
