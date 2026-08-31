"use client";

import {
  KeepButton as CoreKeepButton,
  type KeepButtonProps as CoreKeepButtonProps,
  type KeepButtonState,
  useKeepItem,
} from "@keepkit/core/react";
import type { ReactNode } from "react";
import type { KeepButtonLabels } from "./shared";
import { useUiLabel } from "./ui-context";

export type { KeepButtonLabels } from "./shared";

export type KeepButtonProps<TMeta = Record<string, unknown>> = CoreKeepButtonProps<TMeta> & {
  labels?: KeepButtonLabels;
};

/** A style-free save toggle with localized labels and the core button's ARIA/asChild behavior. */
export function KeepButton<TMeta = Record<string, unknown>>({ labels, ...props }: KeepButtonProps<TMeta>) {
  const saveLabel = useUiLabel("save", typeof labels?.unsaved === "string" ? labels.unsaved : undefined);
  const savedLabel = useUiLabel("saved", typeof labels?.saved === "string" ? labels.saved : undefined);
  const loadingLabel = useUiLabel("loading", typeof labels?.loading === "string" ? labels.loading : undefined);
  const errorLabel = useUiLabel("error", typeof labels?.error === "string" ? labels.error : undefined);
  const buttonState = useKeepItem<TMeta>(props.item);
  const customStateLabel = labels?.loading !== undefined || labels?.error !== undefined;
  const getStateContent = (state: KeepButtonState<TMeta>): ReactNode => {
    if (state.error) return labels?.error ?? errorLabel;
    if (state.isMutating) return labels?.loading ?? loadingLabel;
    if (typeof props.children === "function") return props.children(state);
    if (props.children !== undefined) return props.children;
    return state.isSaved ? (labels?.saved ?? savedLabel) : (labels?.unsaved ?? saveLabel);
  };
  const sharedProps = {
    ...props,
    "aria-busy": props["aria-busy"] ?? (buttonState.isLoading || buttonState.isMutating),
    savedLabel: labels?.saved ?? props.savedLabel ?? savedLabel,
    unsavedLabel: labels?.unsaved ?? props.unsavedLabel ?? saveLabel,
    savedAriaLabel: labels?.savedAriaLabel ?? props.savedAriaLabel,
    unsavedAriaLabel: labels?.unsavedAriaLabel ?? props.unsavedAriaLabel,
  };
  if (!customStateLabel) return <CoreKeepButton<TMeta> {...sharedProps} />;
  return (
    <CoreKeepButton<TMeta> {...sharedProps}>
      {(state: KeepButtonState<TMeta>) => <>{getStateContent(state)}</>}
    </CoreKeepButton>
  );
}
