"use client";

import {
  KeepButton as CoreKeepButton,
  type KeepButtonProps as CoreKeepButtonProps,
  type KeepButtonState,
} from "@keepkit/core/react";
import { type MouseEvent, type Ref, useEffect, useRef } from "react";
import { renderKeepIcon } from "../../foundation/icon";
import type { KeepButtonIcons, KeepButtonLabels } from "../../foundation/shared";
import { useUiLabel, useUiLabelVisibility } from "../../foundation/ui-context";
import { useKeepButton } from "./hooks/useKeepButton";

export type { KeepButtonIcon, KeepButtonIconProps, KeepButtonIcons, KeepButtonLabels } from "../../foundation/shared";

export type KeepButtonProps<TMeta = Record<string, unknown>> = CoreKeepButtonProps<TMeta> & {
  ref?: Ref<HTMLElement> | { readonly current: unknown };
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
  const view = useKeepButton<TMeta>({ item: props.item, labels, icons });
  const removeLabel = useUiLabel("remove");
  const showSaveLabel = useUiLabelVisibility("save");
  const showSavedLabel = useUiLabelVisibility("saved");
  const showLoadingLabel = useUiLabelVisibility("loading");
  const showErrorLabel = useUiLabelVisibility("error");
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
  const icon = props.children === undefined && !props.asChild ? renderKeepIcon(view.icon, iconClassName) : null;
  const visible = showLabel && !iconOnly;
  const savedLabel = visible && showSavedLabel ? (labels?.saved ?? props.savedLabel ?? view.labels.saved) : null;
  const unsavedLabel = visible && showSaveLabel ? (labels?.unsaved ?? props.unsavedLabel ?? view.labels.save) : null;
  const meta = props.item.meta;
  const title =
    typeof meta === "object" && meta !== null && "title" in meta && typeof meta.title === "string"
      ? meta.title.trim()
      : "";
  const accessibleLabel = (label: string) => (title ? `${label}: ${title}` : label);
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
    "data-has-custom-icon": icon ? "true" : undefined,
    "data-icon-only": iconOnly ? "true" : undefined,
    "aria-busy": props["aria-busy"] ?? (view.buttonState.isLoading || view.buttonState.isMutating),
    savedLabel,
    unsavedLabel,
    savedAriaLabel:
      labels?.savedAriaLabel ??
      props.savedAriaLabel ??
      (props.children === undefined && !props.asChild && (iconOnly || !showLabel || !showSavedLabel)
        ? accessibleLabel(removeLabel)
        : undefined),
    unsavedAriaLabel:
      labels?.unsavedAriaLabel ??
      props.unsavedAriaLabel ??
      (props.children === undefined && !props.asChild && (iconOnly || !showLabel || !showSaveLabel)
        ? accessibleLabel(view.labels.save)
        : undefined),
  };
  if (props.children !== undefined || props.asChild || !view.customStateLabel) {
    return <CoreKeepButton<TMeta> {...sharedProps} />;
  }
  const stateLabels = {
    error: visible && showErrorLabel ? (labels?.error ?? view.labels.error) : null,
    loading: visible && showLoadingLabel ? (labels?.loading ?? view.labels.loading) : null,
    saved: savedLabel,
    save: unsavedLabel,
  };
  return (
    <CoreKeepButton<TMeta> {...sharedProps} asChild={false}>
      {icon}
      {stateLabels[view.slot]}
    </CoreKeepButton>
  );
}
