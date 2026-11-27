import { type RefObject, useEffect, useRef } from "react";
import { useKeepIcon } from "../../foundation/icon";
import { useUiLabel, useUiLabelVisibility } from "../../foundation/ui-context";
import type { KeepBulkActionsState } from "./KeepBulkActions";

export function KeepRemovalConfirmation<TMeta>({
  state,
  triggerRef,
}: {
  state: KeepBulkActionsState<TMeta>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const title = useUiLabel("confirmRemoval");
  const question = useUiLabel("confirmRemovalDescription");
  const selected = useUiLabel("selectedCount");
  const remove = useUiLabel("deleteSelected");
  const showRemoveLabel = useUiLabelVisibility("deleteSelected");
  const removeIcon = useKeepIcon("remove");
  const cancel = useUiLabel("cancel");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const wasMutating = useRef(false);
  const open = state.removalConfirmation !== null;
  useEffect(() => {
    if (open && (!wasOpen.current || (wasMutating.current && !state.isMutating))) confirmRef.current?.focus();
    if (!open && wasOpen.current && triggerRef.current?.isConnected) triggerRef.current.focus();
    wasOpen.current = open;
    wasMutating.current = state.isMutating;
  }, [open, state.isMutating, triggerRef]);
  if (!state.removalConfirmation) return null;
  return (
    <div
      role="dialog"
      aria-label={title}
      aria-busy={state.isMutating}
      data-keepkit="removal-confirmation"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || state.isMutating) return;
        event.preventDefault();
        event.stopPropagation();
        state.cancelRemoval();
      }}
    >
      <p>
        {state.removalConfirmation.count} {selected} — {question}
      </p>
      <button
        ref={confirmRef}
        type="button"
        disabled={state.isMutating}
        aria-label={showRemoveLabel ? undefined : remove}
        onClick={() => void state.confirmRemoval().catch(() => undefined)}
      >
        {removeIcon}
        {showRemoveLabel ? remove : null}
      </button>
      <button type="button" disabled={state.isMutating} onClick={state.cancelRemoval}>
        {cancel}
      </button>
    </div>
  );
}
