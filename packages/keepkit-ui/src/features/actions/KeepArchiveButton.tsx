"use client";

import type { KeepItemInput } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepArchiveButtonState<TMeta = Record<string, unknown>> = ReturnType<typeof useKeepItem<TMeta>>;

export type KeepArchiveButtonProps<TMeta = Record<string, unknown>> = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "aria-pressed"
> & {
  item: KeepItemInput<TMeta>;
  children?: ReactNode | ((state: KeepArchiveButtonState<TMeta>) => ReactNode);
  archiveLabel?: ReactNode;
  unarchiveLabel?: ReactNode;
  onToggleError?: (error: unknown) => void;
};

/** A style-free accessible archive toggle. */
export function KeepArchiveButton<TMeta = Record<string, unknown>>({
  item,
  children,
  archiveLabel,
  unarchiveLabel,
  onToggleError,
  disabled,
  ...props
}: KeepArchiveButtonProps<TMeta>) {
  const state = useKeepItem(item);
  const archive = useUiLabel("archive");
  const unarchive = useUiLabel("unarchive");
  const archivedLabel = useUiLabel("archived");
  const isArchived = state.item?.archived === true;
  const isDisabled = disabled ?? state.isMutating;
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={isDisabled}
      aria-pressed={isArchived}
      data-archived={isArchived ? "true" : "false"}
      data-keep-action="toggle-archive"
      onClick={() => void state.toggleArchive().catch((error) => onToggleError?.(error))}
    >
      {typeof children === "function"
        ? children(state)
        : (children ?? (isArchived ? (unarchiveLabel ?? unarchive) : (archiveLabel ?? archive)))}
      {isArchived && children === undefined ? <span aria-hidden="true"> ({archivedLabel})</span> : null}
    </button>
  );
}

export type KeepPinButtonState<TMeta = Record<string, unknown>> = ReturnType<typeof useKeepItem<TMeta>>;

export type KeepPinButtonProps<TMeta = Record<string, unknown>> = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "aria-pressed"
> & {
  item: KeepItemInput<TMeta>;
  children?: ReactNode | ((state: KeepPinButtonState<TMeta>) => ReactNode);
  pinLabel?: ReactNode;
  unpinLabel?: ReactNode;
  onToggleError?: (error: unknown) => void;
};

/** A style-free accessible pin toggle. */
export function KeepPinButton<TMeta = Record<string, unknown>>({
  item,
  children,
  pinLabel,
  unpinLabel,
  onToggleError,
  disabled,
  ...props
}: KeepPinButtonProps<TMeta>) {
  const state = useKeepItem(item);
  const pin = useUiLabel("pin");
  const unpin = useUiLabel("unpin");
  const pinnedLabel = useUiLabel("pinned");
  const isPinned = state.item?.pinned === true;
  const isDisabled = disabled ?? state.isMutating;
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={isDisabled}
      aria-pressed={isPinned}
      data-pinned={isPinned ? "true" : "false"}
      data-keep-action="toggle-pin"
      onClick={() => void state.togglePin().catch((error) => onToggleError?.(error))}
    >
      {typeof children === "function"
        ? children(state)
        : (children ?? (isPinned ? (unpinLabel ?? unpin) : (pinLabel ?? pin)))}
      {isPinned && children === undefined ? <span aria-hidden="true"> ({pinnedLabel})</span> : null}
    </button>
  );
}
