"use client";

import {
  KeepButton as CoreKeepButton,
  type KeepButtonProps as CoreKeepButtonProps,
  type KeepButtonState,
} from "@keepkit/core/react";
import { createElement, type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import type { KeepButtonIcon, KeepButtonIcons, KeepButtonLabels } from "../../foundation/shared";
import { useKeepButton } from "./hooks/useKeepButton";

export type { KeepButtonIcon, KeepButtonIconProps, KeepButtonIcons, KeepButtonLabels } from "../../foundation/shared";

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
  onClick,
  onToggleError,
  ...props
}: KeepButtonProps<TMeta>) {
  const view = useKeepButton<TMeta>({ item: props.item, labels, icons, children: props.children });
  const pendingToggle = useRef<{ wasSaved: boolean; item: KeepButtonState<TMeta>["item"] } | null>(null);
  useEffect(() => {
    const pending = pendingToggle.current;
    if (!pending || view.buttonState.isMutating || pending.wasSaved === view.buttonState.isSaved) return;
    pendingToggle.current = null;
    if (view.buttonState.isSaved && view.buttonState.item) {
      view.emitFeedback({ type: "item-saved", item: view.buttonState.item, message: view.labels.savedMessage });
      return;
    }
    if (!pending.item) return;
    const removedItem = pending.item;
    view.emitFeedback({
      type: "item-removed",
      item: removedItem,
      message: view.labels.removedMessage,
      undoLabel: view.labels.undo,
      undo: async () => {
        await view.buttonState.save();
        view.emitFeedback({
          type: "item-restored",
          item: removedItem,
          items: [removedItem],
          message: view.labels.restoredMessage,
        });
      },
    });
  }, [view]);
  const getStateContent = (state: KeepButtonState<TMeta>): ReactNode => {
    if (typeof props.children === "function") return props.children(state);
    if (props.children !== undefined) return props.children;
    const label = state.error
      ? (labels?.error ?? view.labels.error)
      : state.isMutating
        ? (labels?.loading ?? view.labels.loading)
        : state.isSaved
          ? (labels?.saved ?? view.labels.saved)
          : (labels?.unsaved ?? view.labels.save);
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
    onClick: (event: MouseEvent<HTMLElement>) => {
      onClick?.(event as MouseEvent<HTMLButtonElement> & MouseEvent<HTMLElement>);
      if (!event.defaultPrevented) {
        pendingToggle.current = { wasSaved: view.buttonState.isSaved, item: view.buttonState.item };
      }
    },
    onToggleError: (error: unknown) => {
      pendingToggle.current = null;
      onToggleError?.(error);
    },
    "data-keepkit": "button",
    "data-keep-action": "toggle-save",
    "data-has-custom-icon": icons ? "true" : undefined,
    "data-icon-only": iconOnly ? "true" : undefined,
    "aria-busy": props["aria-busy"] ?? (view.buttonState.isLoading || view.buttonState.isMutating),
    savedLabel: labels?.saved ?? props.savedLabel ?? view.labels.saved,
    unsavedLabel: labels?.unsaved ?? props.unsavedLabel ?? view.labels.save,
    savedAriaLabel: labels?.savedAriaLabel ?? props.savedAriaLabel,
    unsavedAriaLabel: labels?.unsavedAriaLabel ?? props.unsavedAriaLabel,
  };
  if (!view.customStateLabel) return <CoreKeepButton<TMeta> {...sharedProps} />;
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
