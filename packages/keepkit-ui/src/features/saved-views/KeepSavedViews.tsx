"use client";

import type { KeepListQuery, KeepSavedViewStorage } from "@keepkit/core/core";
import { useState } from "react";
import { useUiLabel } from "../../foundation/ui-context";
import { useKeepSavedViews } from "./useKeepSavedViews";

export type KeepSavedViewsProps<TMeta = Record<string, unknown>> = {
  storage?: KeepSavedViewStorage<TMeta>;
  onApply?: (query: KeepListQuery<TMeta>) => void;
};

export function KeepSavedViews<TMeta = Record<string, unknown>>({ storage, onApply }: KeepSavedViewsProps<TMeta>) {
  const { views, error, updateView, removeView, applyView } = useKeepSavedViews(storage);
  const savedViewsLabel = useUiLabel("savedViews");
  const pinLabel = useUiLabel("pin");
  const unpinLabel = useUiLabel("unpin");
  const renameLabel = useUiLabel("renameSavedView");
  const deleteLabel = useUiLabel("deleteSavedView");
  const loadErrorLabel = useUiLabel("savedViewsLoadError");
  return (
    <nav aria-label={savedViewsLabel} data-keepkit="saved-views">
      <ul>
        {views.map((view) => (
          <li key={view.id}>
            <button
              type="button"
              onClick={() =>
                void applyView(view.id)
                  .then((query) => query && onApply?.(query))
                  .catch(() => undefined)
              }
            >
              {view.name}
            </button>
            <button
              type="button"
              aria-label={`${view.pinned ? unpinLabel : pinLabel} ${view.name}`}
              onClick={() => void updateView(view.id, { pinned: !view.pinned }).catch(() => undefined)}
            >
              {view.pinned ? unpinLabel : pinLabel}
            </button>
            <details>
              <summary>{`${renameLabel} ${view.name}`}</summary>
              <RenameForm name={view.name} onRename={(name) => updateView(view.id, { name })} />
            </details>
            <button
              type="button"
              aria-label={`${deleteLabel} ${view.name}`}
              onClick={() => void removeView(view.id).catch(() => undefined)}
            >
              {deleteLabel}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error instanceof Error ? error.message : loadErrorLabel}</p> : null}
    </nav>
  );
}

export function KeepSaveViewButton<TMeta = Record<string, unknown>>({
  query,
  storage,
}: {
  query: KeepListQuery<TMeta>;
  storage?: KeepSavedViewStorage<TMeta>;
}) {
  const { createView } = useKeepSavedViews(storage);
  const nameLabel = useUiLabel("savedViewName");
  const saveLabel = useUiLabel("saveView");
  const saveErrorLabel = useUiLabel("savedViewSaveError");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      data-keepkit="save-view"
      onSubmit={(event) => {
        event.preventDefault();
        void createView(name, query)
          .then(() => {
            setName("");
            setError("");
          })
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : saveErrorLabel));
      }}
    >
      <label>
        {nameLabel}
        <input value={name} onChange={(event) => setName(event.currentTarget.value)} required />
      </label>
      <button type="submit" disabled={!name.trim()}>
        {saveLabel}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

function RenameForm({ name, onRename }: { name: string; onRename: (name: string) => Promise<void> }) {
  const [value, setValue] = useState(name);
  const nameLabel = useUiLabel("savedViewNewName");
  const renameLabel = useUiLabel("renameSavedView");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onRename(value).catch(() => undefined);
      }}
    >
      <label>
        {nameLabel}
        <input value={value} onChange={(event) => setValue(event.currentTarget.value)} required />
      </label>
      <button type="submit">{renameLabel}</button>
    </form>
  );
}
