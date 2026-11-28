import { useKeepItem } from "@keepkit/core/react";
import type { KeepButtonIcons, KeepButtonLabels } from "../../../foundation/shared";
import { useKeepUiFeedback, useKeepUiIcons, useUiLabel } from "../../../foundation/ui-context";

type KeepButtonOptions<TMeta> = {
  item: Parameters<typeof useKeepItem<TMeta>>[0];
  labels: KeepButtonLabels | undefined;
  icons: KeepButtonIcons | undefined;
};

export function useKeepButton<TMeta>({ item, labels, icons }: KeepButtonOptions<TMeta>, failed: boolean) {
  const defaults = useKeepUiIcons();
  const buttonState = useKeepItem<TMeta>(item);
  const slot = failed
    ? "error"
    : buttonState.isMutating || buttonState.isLoading
      ? "loading"
      : buttonState.isSaved
        ? "saved"
        : "save";
  const icon =
    slot === "saved"
      ? (icons?.remove ?? icons?.saved ?? defaults?.remove ?? defaults?.saved)
      : (icons?.[slot] ?? defaults?.[slot]);
  return {
    buttonState,
    icon,
    slot,
    emitFeedback: useKeepUiFeedback<TMeta>(),
    customStateLabel:
      labels?.loading !== undefined || labels?.error !== undefined || icons !== undefined || icon != null,
    labels: {
      save: useUiLabel("save", typeof labels?.unsaved === "string" ? labels.unsaved : undefined),
      saved: useUiLabel("saved", typeof labels?.saved === "string" ? labels.saved : undefined),
      loading: useUiLabel("loading", typeof labels?.loading === "string" ? labels.loading : undefined),
      error: useUiLabel("error", typeof labels?.error === "string" ? labels.error : undefined),
      savedMessage: useUiLabel("savedMessage"),
      removedMessage: useUiLabel("removedMessage"),
      restoredMessage: useUiLabel("restoredMessage"),
      undo: useUiLabel("undo"),
    },
  } as const;
}
