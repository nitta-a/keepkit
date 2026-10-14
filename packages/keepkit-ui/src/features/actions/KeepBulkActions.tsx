"use client";

import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import type { KeepCollectionSummary } from "@keepkit/core/react";
import { type HTMLAttributes, type ReactNode, useRef } from "react";
import { getErrorMessage, getMetaTitle, type RenderProp } from "../../foundation/shared";
import { useUiLabel, useUiLabelVisibility } from "../../foundation/ui-context";
import { useKeepBulkActions } from "./hooks/useKeepBulkActions";
import { KeepItemCheckbox } from "./KeepItemCheckbox";
import { KeepRemovalConfirmation } from "./KeepRemovalConfirmation";

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
  requestRemoval: () => Promise<void>;
  confirmRemoval: () => Promise<void>;
  cancelRemoval: () => void;
  removalConfirmation: { ids: readonly string[]; count: number } | null;
  updateTags: () => Promise<void>;
  collectionId: string;
  setCollectionId: (value: string) => void;
  collections: KeepCollectionSummary[];
  moveToCollection: () => Promise<void>;
  archive: () => Promise<void>;
  unarchive: () => Promise<void>;
  pin: () => Promise<void>;
  unpin: () => Promise<void>;
  isMutating: boolean;
  error: unknown | null;
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
  /** Requires confirmation before removing the full selection, including items on other pages. */
  confirmRemoval?: boolean;
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
  confirmRemoval = false,
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
    confirmRemoval,
  });
  const removalTrigger = useRef<HTMLButtonElement>(null);
  const showSelectItemsLabel = useUiLabelVisibility("selectItems");
  const showSelectionScopeLabel = useUiLabelVisibility("selectionScope");
  const showSelectedCountLabel = useUiLabelVisibility("selectedCount");
  const showTagsLabel = useUiLabelVisibility("tagsToApply");
  const showDeleteLabel = useUiLabelVisibility("deleteSelected");
  const showApplyTagsLabel = useUiLabelVisibility("applyTags");
  const errorLabel = useUiLabel("error");
  const collectionLabel = useUiLabel("moveSelectedCollection");
  const uncategorizedLabel = useUiLabel("uncategorized");
  const moveLabel = useUiLabel("moveSelected");
  const archiveLabel = useUiLabel("archiveSelected");
  const unarchiveLabel = useUiLabel("unarchiveSelected");
  const pinLabel = useUiLabel("pinSelected");
  const unpinLabel = useUiLabel("unpinSelected");
  const body = render
    ? render(state)
    : typeof children === "function"
      ? children(state)
      : (children ?? (
          <>
            <fieldset aria-label={showSelectItemsLabel ? undefined : labels.selectItems}>
              {showSelectItemsLabel ? <legend>{labels.selectItems}</legend> : null}
              <label>
                {showSelectionScopeLabel ? labels.selectionScope : null}
                <select
                  data-keep-action="select-scope"
                  aria-label={showSelectionScopeLabel ? undefined : labels.selectionScope}
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
                {state.selectedIds.length} {showSelectedCountLabel ? labels.selectedCount : null}
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
              ref={removalTrigger}
              type="button"
              data-keep-action="delete-selected"
              aria-label={showDeleteLabel ? undefined : labels.deleteSelected}
              onClick={() => void state.remove().catch(() => undefined)}
              disabled={state.selectedIds.length === 0 || state.isMutating}
            >
              {showDeleteLabel ? labels.deleteSelected : null}
            </button>
            <KeepRemovalConfirmation state={state} triggerRef={removalTrigger} />
            <label>
              {showTagsLabel ? labels.tags : null}
              <input
                data-keep-action="edit-tags"
                aria-label={showTagsLabel ? undefined : labels.tags}
                value={state.tagsInput}
                onChange={(event) => state.setTagsInput(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              data-keep-action="apply-tags"
              aria-label={showApplyTagsLabel ? undefined : labels.applyTags}
              onClick={() => void state.updateTags().catch(() => undefined)}
              disabled={state.selectedIds.length === 0 || state.isMutating}
            >
              {showApplyTagsLabel ? labels.applyTags : null}
            </button>
            <label>
              {collectionLabel}
              <select value={state.collectionId} onChange={(event) => state.setCollectionId(event.currentTarget.value)}>
                <option value="">{uncategorizedLabel}</option>
                {state.collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void state.moveToCollection().catch(() => undefined)}
              disabled={!state.selectedCount || state.isMutating}
            >
              {moveLabel}
            </button>
            <button
              type="button"
              onClick={() => void state.archive().catch(() => undefined)}
              disabled={!state.selectedCount || state.isMutating}
            >
              {archiveLabel}
            </button>
            <button
              type="button"
              onClick={() => void state.unarchive().catch(() => undefined)}
              disabled={!state.selectedCount || state.isMutating}
            >
              {unarchiveLabel}
            </button>
            <button
              type="button"
              onClick={() => void state.pin().catch(() => undefined)}
              disabled={!state.selectedCount || state.isMutating}
            >
              {pinLabel}
            </button>
            <button
              type="button"
              onClick={() => void state.unpin().catch(() => undefined)}
              disabled={!state.selectedCount || state.isMutating}
            >
              {unpinLabel}
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
      {state.error ? <p role="alert">{getErrorMessage(state.error, errorLabel)}</p> : null}
    </section>
  );
}
