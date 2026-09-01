"use client";

import type { KeepItem, KeepSyncConflict } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { type HTMLAttributes, type ReactNode, useEffect, useState } from "react";
import { KeepBackup } from "./KeepBackup";
import { getMetaTitle } from "./shared";
import { useUiLabel } from "./ui-context";

export type KeepSyncRecoveryDialogProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "title"
> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  conflicts?: KeepSyncConflict<TMeta>[];
  onManualMerge?: (conflict: KeepSyncConflict<TMeta>) => KeepItem<TMeta> | Promise<KeepItem<TMeta>>;
  backup?: ReactNode;
  showBackupControls?: boolean;
  title?: ReactNode;
  children?: ReactNode;
};

/** Resolves queued sync conflicts and guides users to restore a backup after data corruption. */
export function KeepSyncRecoveryDialog<TMeta = Record<string, unknown>>({
  open,
  onOpenChange,
  conflicts,
  onManualMerge,
  backup,
  showBackupControls = true,
  title,
  children,
  className,
  ...props
}: KeepSyncRecoveryDialogProps<TMeta>) {
  const context = useKeepContext<TMeta>();
  const closeLabel = useUiLabel("close");
  const defaultDialogTitle = useUiLabel("resolveSync");
  const dialogTitle = title ?? defaultDialogTitle;
  const conflictLabel = useUiLabel("syncConflict");
  const keepLocalLabel = useUiLabel("keepLocal");
  const useServerLabel = useUiLabel("useServer");
  const manualMergeLabel = useUiLabel("manualMerge");
  const localVersionLabel = useUiLabel("localVersion");
  const remoteVersionLabel = useUiLabel("remoteVersion");
  const updatedAtLabel = useUiLabel("updatedAt");
  const noteLabel = useUiLabel("note");
  const backupRecoveryLabel = useUiLabel("backupRecovery");
  const backupRecoveryDescription = useUiLabel("backupRecoveryDescription");
  const errorLabel = useUiLabel("error");
  const conflictList = conflicts ?? context.syncState.conflicts ?? [];
  const hasRecovery = conflictList.length > 0 || context.syncState.status === "error" || Boolean(context.error);
  const [dismissed, setDismissed] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (hasRecovery) setDismissed(false);
  }, [hasRecovery]);
  const isOpen = open ?? (hasRecovery && !dismissed);
  if (!isOpen) return null;

  const close = () => {
    setDismissed(true);
    onOpenChange?.(false);
  };

  async function resolve(conflict: KeepSyncConflict<TMeta>, resolution: "local" | "remote" | "manual") {
    setError(undefined);
    setBusyId(conflict.id);
    try {
      const merged = resolution === "manual" ? await onManualMerge?.(conflict) : undefined;
      if (resolution === "manual" && !merged) throw new Error("A manual merge result is required.");
      await context.resolveSyncConflict(conflict.id, resolution, merged);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <section
      {...props}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keepkit-sync-recovery-title"
      aria-describedby={error ? "keepkit-sync-recovery-error" : undefined}
      aria-busy={busyId !== undefined}
      data-keepkit="sync-recovery"
      data-state={conflictList.length > 0 ? "conflict" : "error"}
      data-loading={busyId !== undefined ? "true" : undefined}
    >
      <header>
        <h2 id="keepkit-sync-recovery-title">{dialogTitle}</h2>
        <button type="button" onClick={close} aria-label={closeLabel}>
          {closeLabel}
        </button>
      </header>
      {children}
      {conflictList.length > 0 ? (
        <div>
          <p>{conflictLabel}</p>
          {conflictList.map((conflict) => (
            <article key={conflict.id} data-conflict-id={conflict.id}>
              <h3>{getMetaTitle(conflict.operation.item?.meta) ?? conflict.id}</h3>
              <div data-conflict-preview>
                <ConflictPreview
                  item={conflict.operation.item}
                  heading={localVersionLabel}
                  updatedAtLabel={updatedAtLabel}
                  noteLabel={noteLabel}
                  side="local"
                />
                <ConflictPreview
                  item={conflict.remote}
                  heading={remoteVersionLabel}
                  updatedAtLabel={updatedAtLabel}
                  noteLabel={noteLabel}
                  side="remote"
                />
              </div>
              <div>
                <button type="button" onClick={() => void resolve(conflict, "local")} disabled={busyId !== undefined}>
                  {keepLocalLabel}
                </button>
                <button type="button" onClick={() => void resolve(conflict, "remote")} disabled={busyId !== undefined}>
                  {useServerLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void resolve(conflict, "manual")}
                  disabled={busyId !== undefined || !onManualMerge}
                >
                  {manualMergeLabel}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {context.syncState.status === "error" || context.error ? (
        <section data-recovery="backup">
          <h3>{backupRecoveryLabel}</h3>
          <p>{backupRecoveryDescription}</p>
          {backup ?? (showBackupControls ? <KeepBackup /> : null)}
        </section>
      ) : null}
      {error ? (
        <p id="keepkit-sync-recovery-error" role="alert" aria-live="assertive">
          {error instanceof Error ? error.message : errorLabel}
        </p>
      ) : null}
    </section>
  );
}

function ConflictPreview<TMeta>({
  item,
  heading,
  updatedAtLabel,
  noteLabel,
  side,
}: {
  item?: KeepItem<TMeta>;
  heading: string;
  updatedAtLabel: string;
  noteLabel: string;
  side: "local" | "remote";
}) {
  return (
    <article data-conflict-version={side} aria-label={heading}>
      <h4>{heading}</h4>
      <dl>
        <div>
          <dt>{updatedAtLabel}</dt>
          <dd>
            {item ? (
              <time dateTime={new Date(item.updatedAt).toISOString()}>{formatConflictDate(item.updatedAt)}</time>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>{noteLabel}</dt>
          <dd>{item?.note || "—"}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatConflictDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
