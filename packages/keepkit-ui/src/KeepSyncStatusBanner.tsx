"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useKeepSyncStatusBanner } from "./hooks/useKeepSyncStatusBanner";

export type KeepSyncStatusBannerProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  onRetry?: () => void | Promise<void>;
  onResolveConflicts?: () => void;
  children?: ReactNode;
};

/** Announces synchronization failures and exposes retry or conflict-recovery entry points. */
export function KeepSyncStatusBanner({
  onRetry,
  onResolveConflicts,
  children,
  className,
  ...props
}: KeepSyncStatusBannerProps) {
  const view = useKeepSyncStatusBanner({ onRetry, children });
  if (view.status === "idle" && !view.hasConflicts) return null;

  return (
    <aside
      {...props}
      className={className}
      role={props.role ?? view.role}
      aria-live={props["aria-live"] ?? "polite"}
      data-keepkit="sync-status"
      data-state={view.status}
    >
      <p>{view.message}</p>
      {view.showRetry ? (
        <button
          type="button"
          data-keep-action="retry-sync"
          onClick={() => void view.retry()}
          disabled={view.isMutating}
        >
          {view.retryLabel}
        </button>
      ) : null}
      {view.hasConflicts ? (
        <button
          type="button"
          data-keep-action="resolve-conflicts"
          onClick={onResolveConflicts}
          disabled={!onResolveConflicts}
        >
          {view.resolveLabel}
        </button>
      ) : null}
    </aside>
  );
}
