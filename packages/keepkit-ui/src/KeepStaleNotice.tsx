"use client";

import type { KeepItem, KeepItemStatus } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { KeepItemStatusBadge } from "./KeepItemStatusBadge";
import { useUiLabel } from "./ui-context";

export type KeepStaleNoticeProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  item: KeepItem<TMeta>;
  onRetry?: (item: KeepItem<TMeta>) => void | Promise<void>;
  onRemoved?: (item: KeepItem<TMeta>) => void;
  retryLabel?: ReactNode;
  removeLabel?: ReactNode;
  children?: ReactNode;
};

/** Provides retry and remove actions for an item whose source is no longer available. */
export function KeepStaleNotice<TMeta = Record<string, unknown>>({
  item,
  onRetry,
  onRemoved,
  retryLabel,
  removeLabel,
  children,
  className,
  ...props
}: KeepStaleNoticeProps<TMeta>) {
  const context = useKeepContext<TMeta>();
  const retryText = useUiLabel("retry");
  const removeText = useUiLabel("removeFromList");
  const errorText = useUiLabel("error");
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const status = item.status && item.status !== "available" ? item.status : "unknown";

  async function handleRetry() {
    setError(null);
    setIsRetrying(true);
    try {
      if (onRetry) await onRetry(item);
      else await context.revalidateItems();
    } catch (cause) {
      setError(cause);
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleRemove() {
    try {
      await context.removeItemWithUndo(item.id);
      onRemoved?.(item);
    } catch (cause) {
      setError(cause);
    }
  }

  return (
    <aside {...props} className={className} data-keepkit="stale-notice" data-state={error ? "error" : "stale"}>
      <KeepItemStatusBadge status={status} />
      {children ?? (item.statusReason ? <p>{item.statusReason}</p> : null)}
      <div>
        <button type="button" onClick={() => void handleRetry()} disabled={isRetrying || context.isMutating}>
          {retryLabel ?? retryText}
        </button>
        <button type="button" onClick={() => void handleRemove()} disabled={context.isMutating}>
          {removeLabel ?? removeText}
        </button>
      </div>
      {error ? <p role="alert">{error instanceof Error ? error.message : errorText}</p> : null}
    </aside>
  );
}

export type KeepPruneStaleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  statuses?: KeepItemStatus[];
  label?: ReactNode;
  onPruned?: (ids: string[]) => void;
  children?: ReactNode;
};

/** Removes all unavailable items through the provider's undo-capable batch action. */
export function KeepPruneStaleButton<TMeta = Record<string, unknown>>({
  statuses = ["expired", "removed", "deleted", "private", "unknown"],
  label,
  onPruned,
  children,
  disabled,
  ...props
}: KeepPruneStaleButtonProps) {
  const context = useKeepContext<TMeta>();
  const defaultLabel = useUiLabel("pruneStale");
  const staleIds = context.items.filter((item) => item.status && statuses.includes(item.status)).map((item) => item.id);

  async function handlePrune() {
    const ids = [...staleIds];
    await context.removeItemsWithUndo(ids);
    onPruned?.(ids);
  }

  return (
    <button
      {...props}
      type="button"
      className={props.className}
      data-keepkit="prune-stale"
      data-state={staleIds.length > 0 ? "available" : "empty"}
      disabled={staleIds.length === 0 || context.isMutating || disabled}
      onClick={() => void handlePrune()}
    >
      {children ?? label ?? `${defaultLabel} (${staleIds.length})`}
    </button>
  );
}
