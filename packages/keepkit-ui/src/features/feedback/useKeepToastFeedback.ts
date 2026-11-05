import { useCallback } from "react";
import { getErrorMessage, UndoUnavailableError } from "../../foundation/shared";
import type { KeepUiFeedbackEvent } from "../../foundation/ui-context";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepToastFeedbackOptions = {
  action?: { label: string; onClick: () => void };
};

export type KeepToastHandler = (message: string, options?: KeepToastFeedbackOptions) => unknown;

/** Adapts KeepKit feedback to Sonner-like toast functions without adding a toast dependency. */
export function useKeepToastFeedback<TMeta = Record<string, unknown>>(showToast: KeepToastHandler) {
  const errorLabel = useUiLabel("error");
  return useCallback(
    (event: KeepUiFeedbackEvent<TMeta>) => {
      if (!("undo" in event)) {
        showToast(event.message);
        return;
      }
      let pending = false;
      const action = {
        label: event.undoLabel,
        onClick: () => {
          if (pending) return;
          pending = true;
          void Promise.resolve()
            .then(event.undo)
            .catch((error: unknown) => {
              if (error instanceof UndoUnavailableError) showToast(getErrorMessage(error, errorLabel));
              else showToast(getErrorMessage(error, errorLabel), { action });
            })
            .finally(() => {
              pending = false;
            });
        },
      };
      showToast(event.message, { action });
    },
    [errorLabel, showToast],
  );
}
