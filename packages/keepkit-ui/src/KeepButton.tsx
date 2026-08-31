"use client";

import {
  KeepButton as CoreKeepButton,
  type KeepButtonProps as CoreKeepButtonProps,
  type KeepButtonState,
  useKeepItem,
} from "@keepkit/core/react";
import { createElement, type ReactNode } from "react";
import type { KeepButtonIcon, KeepButtonIcons, KeepButtonLabels } from "./shared";
import { useUiLabel } from "./ui-context";

export type { KeepButtonIcon, KeepButtonIconProps, KeepButtonIcons, KeepButtonLabels } from "./shared";

export type KeepButtonProps<TMeta = Record<string, unknown>> = CoreKeepButtonProps<TMeta> & {
  labels?: KeepButtonLabels;
  icons?: KeepButtonIcons;
  iconOnly?: boolean;
  showLabel?: boolean;
  iconClassName?: string;
};

/** A style-free save toggle with localized labels and the core button's ARIA/asChild behavior. */
export function KeepButton<TMeta = Record<string, unknown>>({
  labels,
  icons,
  iconOnly = false,
  showLabel = true,
  iconClassName,
  ...props
}: KeepButtonProps<TMeta>) {
  const saveLabel = useUiLabel("save", typeof labels?.unsaved === "string" ? labels.unsaved : undefined);
  const savedLabel = useUiLabel("saved", typeof labels?.saved === "string" ? labels.saved : undefined);
  const loadingLabel = useUiLabel("loading", typeof labels?.loading === "string" ? labels.loading : undefined);
  const errorLabel = useUiLabel("error", typeof labels?.error === "string" ? labels.error : undefined);
  const buttonState = useKeepItem<TMeta>(props.item);
  const customStateLabel =
    labels?.loading !== undefined ||
    labels?.error !== undefined ||
    (icons !== undefined && props.children === undefined);
  const getStateContent = (state: KeepButtonState<TMeta>): ReactNode => {
    if (typeof props.children === "function") return props.children(state);
    if (props.children !== undefined) return props.children;
    const label = state.error
      ? (labels?.error ?? errorLabel)
      : state.isMutating
        ? (labels?.loading ?? loadingLabel)
        : state.isSaved
          ? (labels?.saved ?? savedLabel)
          : (labels?.unsaved ?? saveLabel);
    if (!icons) return label;
    const icon = state.error
      ? icons.error
      : state.isMutating
        ? icons.loading
        : state.isSaved
          ? (icons.remove ?? icons.saved)
          : icons.save;
    return (
      <>
        {renderIcon(icon, iconClassName)}
        {showLabel && !iconOnly ? label : null}
      </>
    );
  };
  const sharedProps = {
    ...props,
    "data-keepkit": "button",
    "data-icon-only": iconOnly ? "true" : undefined,
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

function renderIcon(icon: KeepButtonIcon | undefined, className?: string): ReactNode {
  if (typeof icon === "function") return createElement(icon, { "aria-hidden": true, className });
  return icon ?? null;
}
