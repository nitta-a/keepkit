import { useCallback } from "react";
import type { KeepUiFeedbackEvent } from "../../foundation/ui-context";

export type KeepToastFeedbackOptions = {
  action?: { label: string; onClick: () => void };
};

export type KeepToastHandler = (message: string, options?: KeepToastFeedbackOptions) => unknown;

/** Adapts KeepKit feedback to Sonner-like toast functions without adding a toast dependency. */
export function useKeepToastFeedback<TMeta = Record<string, unknown>>(showToast: KeepToastHandler) {
  return useCallback(
    (event: KeepUiFeedbackEvent<TMeta>) => {
      if (!("undo" in event)) {
        showToast(event.message);
        return;
      }
      showToast(event.message, {
        action: {
          label: event.undoLabel,
          onClick: () => void event.undo(),
        },
      });
    },
    [showToast],
  );
}
