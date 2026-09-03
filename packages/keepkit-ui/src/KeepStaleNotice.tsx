"use client";

import type { KeepItem, KeepItemStatus } from "@keepkit/core/core";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useKeepPruneStale, useKeepStaleNotice } from "./hooks/useKeepStaleNotice";
import { KeepItemStatusBadge } from "./KeepItemStatusBadge";

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
  const view = useKeepStaleNotice<TMeta>({ item, onRetry, onRemoved });

  return (
    <aside {...props} className={className} data-keepkit="stale-notice" data-state={view.error ? "error" : "stale"}>
      <KeepItemStatusBadge status={view.status} />
      {children ?? (item.statusReason ? <p>{item.statusReason}</p> : null)}
      <div>
        <button
          type="button"
          data-keep-action="retry-item"
          onClick={() => void view.retry()}
          disabled={view.isRetrying || view.isMutating}
        >
          {retryLabel ?? view.labels.retry}
        </button>
        <button
          type="button"
          data-keep-action="remove-item"
          onClick={() => void view.remove()}
          disabled={view.isMutating}
        >
          {removeLabel ?? view.labels.remove}
        </button>
      </div>
      {view.error ? <p role="alert">{view.error instanceof Error ? view.error.message : view.labels.error}</p> : null}
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
  const view = useKeepPruneStale<TMeta>({ statuses, onPruned });

  return (
    <button
      {...props}
      type="button"
      className={props.className}
      data-keepkit="prune-stale"
      data-keep-action="prune-stale"
      data-state={view.staleIds.length > 0 ? "available" : "empty"}
      disabled={view.staleIds.length === 0 || view.isMutating || disabled}
      onClick={() => void view.prune()}
    >
      {children ?? label ?? `${view.label} (${view.staleIds.length})`}
    </button>
  );
}
