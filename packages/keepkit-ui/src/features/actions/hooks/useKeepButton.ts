import type { KeepButtonState } from "@keepkit/core/react";
import { useKeepItem } from "@keepkit/core/react";
import type { ReactNode } from "react";
import type { KeepButtonIcons, KeepButtonLabels } from "../../../foundation/shared";
import { useKeepUiFeedback, useUiLabel } from "../../../foundation/ui-context";

type KeepButtonOptions<TMeta> = {
  item: Parameters<typeof useKeepItem<TMeta>>[0];
  labels: KeepButtonLabels | undefined;
  icons: KeepButtonIcons | undefined;
  children: ReactNode | ((state: KeepButtonState<TMeta>) => ReactNode);
};

export function useKeepButton<TMeta>({ item, labels, icons, children }: KeepButtonOptions<TMeta>) {
  return {
    buttonState: useKeepItem<TMeta>(item),
    emitFeedback: useKeepUiFeedback<TMeta>(),
    customStateLabel:
      labels?.loading !== undefined || labels?.error !== undefined || (icons !== undefined && children === undefined),
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
  };
}
