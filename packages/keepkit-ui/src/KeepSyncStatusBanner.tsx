"use client";

import { useKeepContext } from "@keepkit/core/react";
import type { HTMLAttributes, ReactNode } from "react";
import { useUiLabel } from "./ui-context";

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
  const context = useKeepContext();
  const retryLabel = useUiLabel("retrySync");
  const resolveLabel = useUiLabel("resolveSync");
  const conflictLabel = useUiLabel("syncConflict");
  const pendingLabel = useUiLabel("syncPending");
  const syncedLabel = useUiLabel("syncSynced");
  const status = context.syncState.status;
  const hasConflicts = (context.syncState.conflicts?.length ?? 0) > 0 || context.syncState.conflictIds.length > 0;
  if (status === "idle" && !hasConflicts) return null;

  const message =
    children ??
    (status === "error"
      ? getErrorMessage(context.syncState.error)
      : status === "conflict" || hasConflicts
        ? conflictLabel
        : status === "pending" || status === "syncing"
          ? pendingLabel
          : syncedLabel);
  const role = status === "error" || status === "conflict" || hasConflicts ? "alert" : "status";
  const retry = async () => {
    if (onRetry) {
      await onRetry();
      return;
    }
    await context.flushSync();
  };

  return (
    <aside
      {...props}
      className={className}
      role={props.role ?? role}
      aria-live={props["aria-live"] ?? "polite"}
      data-keepkit="sync-status"
      data-state={status}
    >
      <p>{message}</p>
      {status === "error" || status === "pending" || status === "syncing" ? (
        <button type="button" onClick={() => void retry()} disabled={context.isMutating}>
          {retryLabel}
        </button>
      ) : null}
      {hasConflicts ? (
        <button type="button" onClick={onResolveConflicts} disabled={!onResolveConflicts}>
          {resolveLabel}
        </button>
      ) : null}
    </aside>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sync failed.";
}
