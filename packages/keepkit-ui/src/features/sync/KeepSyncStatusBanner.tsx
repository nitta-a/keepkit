"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useUiLabelVisibility } from "../../foundation/ui-context";
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
  const showRetryLabel = useUiLabelVisibility("retrySync");
  const showResolveLabel = useUiLabelVisibility("resolveSync");
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
          aria-label={showRetryLabel ? undefined : view.retryLabel}
        >
          {showRetryLabel ? view.retryLabel : null}
        </button>
      ) : null}
      {view.hasConflicts ? (
        <button
          type="button"
          data-keep-action="resolve-conflicts"
          onClick={onResolveConflicts}
          disabled={!onResolveConflicts}
          aria-label={showResolveLabel ? undefined : view.resolveLabel}
        >
          {showResolveLabel ? view.resolveLabel : null}
        </button>
      ) : null}
    </aside>
  );
}
