import type { KeepListQuery } from "@keepkit/core/core";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";
import { useKeepBulkActions } from "../actions/hooks/useKeepBulkActions";
import type { KeepListSelection } from "./KeepList";

/** Shares one selection between the visible item rows and their bulk operation bar. */
export function KeepInlineSelection<TMeta>({
  query,
  children,
}: {
  query: KeepListQuery<TMeta>;
  children: (selection?: KeepListSelection) => ReactNode;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const previousQuery = useRef(query);
  useEffect(() => {
    if (previousQuery.current === query) return;
    previousQuery.current = query;
    setSelectedIds([]);
  }, [query]);
  const { state } = useKeepBulkActions<TMeta>({
    query,
    controlledSelectedIds: selectedIds,
    defaultSelectedIds: [],
    onSelectedIdsChange: setSelectedIds,
    onCompleted: undefined,
    controlledScope: "page",
    onSelectionScopeChange: undefined,
  });
  const selectLabel = useUiLabel("selectItems");
  const doneLabel = useUiLabel("done");
  const pageLabel = useUiLabel("currentPage");
  const countLabel = useUiLabel("selectedCount");
  const collectionLabel = useUiLabel("collection");
  const uncategorizedLabel = useUiLabel("uncategorized");
  const moveLabel = useUiLabel("moveSelected");
  const archiveLabel = useUiLabel("archive");
  const unarchiveLabel = useUiLabel("unarchive");
  const pinLabel = useUiLabel("pin");
  const unpinLabel = useUiLabel("unpin");
  const tagsLabel = useUiLabel("tagsToApply");
  const applyTagsLabel = useUiLabel("applyTags");
  const removeLabel = useUiLabel("deleteSelected");
  const moreLabel = useUiLabel("moreActions");
  const errorLabel = useUiLabel("error");
  const run = (operation: () => Promise<void>) => void operation().catch(() => undefined);
  const archivedOnly = query.archiveScope === "archived" || query.archived === true;
  return (
    <>
      <fieldset data-keepkit="inline-selection" aria-label={selectLabel} aria-busy={state.isMutating}>
        <button
          type="button"
          aria-pressed={selecting}
          disabled={state.isMutating || (!selecting && state.items.length === 0)}
          onClick={() => {
            setSelecting(!selecting);
            setSelectedIds([]);
          }}
        >
          {selecting ? doneLabel : selectLabel}
        </button>
        {selecting ? (
          <>
            <label>
              <input
                type="checkbox"
                checked={state.allSelected}
                onChange={state.toggleAll}
                disabled={state.isMutating || !state.items.length}
              />
              {pageLabel}
            </label>
            <span role="status">
              {state.selectedCount} {countLabel}
            </span>
          </>
        ) : null}
        {selecting && state.selectedCount > 0 ? (
          <fieldset disabled={state.isMutating}>
            <legend>
              {state.selectedCount} {countLabel}
            </legend>
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
            <button type="button" onClick={() => run(state.moveToCollection)}>
              {moveLabel}
            </button>
            <button type="button" onClick={() => run(archivedOnly ? state.unarchive : state.archive)}>
              {archivedOnly ? unarchiveLabel : archiveLabel}
            </button>
            <details>
              <summary>{moreLabel}</summary>
              <div>
                <label>
                  {tagsLabel}
                  <input value={state.tagsInput} onChange={(event) => state.setTagsInput(event.currentTarget.value)} />
                </label>
                <button type="button" onClick={() => run(state.updateTags)}>
                  {applyTagsLabel}
                </button>
                <button type="button" onClick={() => run(state.pin)}>
                  {pinLabel}
                </button>
                <button type="button" onClick={() => run(state.unpin)}>
                  {unpinLabel}
                </button>
                <button type="button" onClick={() => run(state.remove)}>
                  {removeLabel}
                </button>
              </div>
            </details>
          </fieldset>
        ) : null}
        {selecting && state.error ? <p role="alert">{getErrorMessage(state.error, errorLabel)}</p> : null}
      </fieldset>
      {children(
        selecting ? { selectedIds, onSelectedIdsChange: setSelectedIds, disabled: state.isMutating } : undefined,
      )}
    </>
  );
}
