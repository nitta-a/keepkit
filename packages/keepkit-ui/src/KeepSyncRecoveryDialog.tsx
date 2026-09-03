"use client";

import type { KeepItem, KeepSyncConflict } from "@keepkit/core/core";
import type { HTMLAttributes, ReactNode } from "react";
import { useKeepSyncRecoveryDialog } from "./hooks/useKeepSyncRecoveryDialog";
import { KeepBackup } from "./KeepBackup";
import { getMetaTitle } from "./shared";

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
  const view = useKeepSyncRecoveryDialog<TMeta>({ open, onOpenChange, conflicts, onManualMerge });
  if (!view.isOpen) return null;

  return (
    <section
      {...props}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keepkit-sync-recovery-title"
      aria-describedby={view.error ? "keepkit-sync-recovery-error" : undefined}
      aria-busy={view.busyId !== undefined}
      data-keepkit="sync-recovery"
      data-state={view.conflictList.length > 0 ? "conflict" : "error"}
      data-loading={view.busyId !== undefined ? "true" : undefined}
    >
      <header>
        <h2 id="keepkit-sync-recovery-title">{title ?? view.labels.title}</h2>
        <button type="button" data-keep-action="close-dialog" onClick={view.close} aria-label={view.labels.close}>
          {view.labels.close}
        </button>
      </header>
      {children}
      {view.conflictList.length > 0 ? (
        <div>
          <p>{view.labels.conflict}</p>
          {view.conflictList.map((conflict) => (
            <article key={conflict.id} data-conflict-id={conflict.id}>
              <h3>{getMetaTitle(conflict.operation.item?.meta) ?? conflict.id}</h3>
              <div data-conflict-preview>
                <ConflictPreview
                  item={conflict.operation.item}
                  heading={view.labels.localVersion}
                  updatedAtLabel={view.labels.updatedAt}
                  noteLabel={view.labels.note}
                  side="local"
                />
                <ConflictPreview
                  item={conflict.remote}
                  heading={view.labels.remoteVersion}
                  updatedAtLabel={view.labels.updatedAt}
                  noteLabel={view.labels.note}
                  side="remote"
                />
              </div>
              <div>
                <button
                  type="button"
                  data-keep-action="keep-local"
                  onClick={() => void view.resolve(conflict, "local")}
                  disabled={view.busyId !== undefined}
                >
                  {view.labels.keepLocal}
                </button>
                <button
                  type="button"
                  data-keep-action="use-server"
                  onClick={() => void view.resolve(conflict, "remote")}
                  disabled={view.busyId !== undefined}
                >
                  {view.labels.useServer}
                </button>
                <button
                  type="button"
                  data-keep-action="manual-merge"
                  onClick={() => void view.resolve(conflict, "manual")}
                  disabled={view.busyId !== undefined || !onManualMerge}
                >
                  {view.labels.manualMerge}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {view.showBackupRecovery ? (
        <section data-recovery="backup">
          <h3>{view.labels.backupRecovery}</h3>
          <p>{view.labels.backupRecoveryDescription}</p>
          {backup ?? (showBackupControls ? <KeepBackup /> : null)}
        </section>
      ) : null}
      {view.error ? (
        <p id="keepkit-sync-recovery-error" role="alert" aria-live="assertive">
          {view.error instanceof Error ? view.error.message : view.labels.error}
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
