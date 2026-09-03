"use client";

import type { ImportItemsResult } from "@keepkit/core/core";
import type { HTMLAttributes } from "react";
import { useKeepBackup } from "./hooks/useKeepBackup";

export type KeepBackupProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  filename?: string;
  onExport?: (data: string) => void;
  onImported?: (result: ImportItemsResult<TMeta>) => void;
};

/** Accessible JSON backup controls backed by the current KeepProvider storage. */
export function KeepBackup<TMeta = Record<string, unknown>>({
  filename = "keepkit-backup.json",
  onExport,
  onImported,
  ...props
}: KeepBackupProps<TMeta>) {
  const view = useKeepBackup<TMeta>({ filename, onExport, onImported });

  return (
    <section
      {...props}
      data-keepkit="backup"
      data-state={view.error ? "error" : view.result ? "complete" : "idle"}
      data-loading={view.isMutating ? "true" : undefined}
    >
      <button
        type="button"
        data-keep-action="export-backup"
        onClick={() => void view.exportBackup()}
        disabled={view.isMutating}
      >
        {view.labels.export}
      </button>
      <label>
        {view.labels.importMode}
        <select
          data-keep-action="select-import-mode"
          value={view.mode}
          onChange={(event) => view.setMode(event.currentTarget.value as "merge" | "replace")}
        >
          <option value="merge">{view.labels.merge}</option>
          <option value="replace">{view.labels.replace}</option>
        </select>
      </label>
      <button type="button" data-keep-action="import-backup" onClick={view.openFilePicker} disabled={view.isMutating}>
        {view.labels.import}
      </button>
      <input
        ref={view.inputRef}
        type="file"
        data-keep-action="select-backup-file"
        accept="application/json,.json"
        aria-label={view.labels.import}
        onChange={(event) => void view.importBackup(event)}
      />
      {view.result ? (
        <p role="status">
          {view.result.imported} {view.labels.importedCount}; {view.result.failed} {view.labels.failedCount}
        </p>
      ) : null}
      {view.error ? (
        <p role="alert">{isQuotaError(view.error) ? view.labels.quotaError : getErrorMessage(view.error)}</p>
      ) : null}
    </section>
  );
}

function isQuotaError(error: unknown): boolean {
  if (error instanceof Error && error.name === "KeepStorageQuotaError") return true;
  if (error && typeof error === "object" && "cause" in error) return isQuotaError(error.cause);
  return false;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
