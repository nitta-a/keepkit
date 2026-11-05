"use client";

import { useKeepContext } from "@keepkit/core/react";
import { useEffect, useState } from "react";
import { getErrorMessage, getMetaTitle } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";

/** Offers to restore the most recently archived item. */
export function KeepArchiveUndo<TMeta = Record<string, unknown>>() {
  const { items, lastChange, unarchiveItem, isMutating, isHydrated } = useKeepContext<TMeta>();
  const [pending, setPending] = useState<{ id: string; restore: typeof unarchiveItem }>();
  const [error, setError] = useState<unknown>();
  const archivedLabel = useUiLabel("archived");
  const undoLabel = useUiLabel("undo");
  const errorLabel = useUiLabel("error");

  // biome-ignore lint/correctness/useExhaustiveDependencies: A new storage action must not revive an old archive.
  useEffect(() => {
    if (!lastChange) {
      setPending(undefined);
      setError(undefined);
      return;
    }
    if (lastChange.action !== "archive" || lastChange.phase !== "local") return;
    setPending(lastChange.item?.archived && lastChange.id ? { id: lastChange.id, restore: unarchiveItem } : undefined);
    setError(undefined);
  }, [lastChange]);

  const item =
    isHydrated && lastChange && pending?.restore === unarchiveItem
      ? items.find((entry) => entry.id === pending.id && entry.archived)
      : undefined;
  if (!item) return null;

  async function undo(id: string) {
    setError(undefined);
    try {
      await unarchiveItem(id);
    } catch (cause) {
      setError(cause);
    }
  }

  return (
    <div data-keepkit="archive-undo">
      <div role="status">
        <span>{archivedLabel}</span> — {getMetaTitle(item.meta) ?? item.id}{" "}
        <button type="button" disabled={isMutating} onClick={() => void undo(item.id)}>
          {undoLabel}
        </button>
      </div>
      {error ? <p role="alert">{getErrorMessage(error, errorLabel)}</p> : null}
    </div>
  );
}
