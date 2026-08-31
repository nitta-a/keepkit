"use client";

import type { ImportItemsResult } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { type ChangeEvent, type HTMLAttributes, useRef, useState } from "react";
import { useUiLabel } from "./ui-context";

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
  const context = useKeepContext<TMeta>();
  const exportLabel = useUiLabel("exportData");
  const importLabel = useUiLabel("importData");
  const importModeLabel = useUiLabel("importMode");
  const mergeLabel = useUiLabel("merge");
  const replaceLabel = useUiLabel("replace");
  const importedCountLabel = useUiLabel("importedCount");
  const failedCountLabel = useUiLabel("failedCount");
  const quotaErrorLabel = useUiLabel("storageQuotaError");
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [result, setResult] = useState<ImportItemsResult<TMeta>>();
  const [error, setError] = useState<unknown>();

  async function handleExport() {
    setError(undefined);
    try {
      const data = await context.exportBackup();
      onExport?.(data);
      if (typeof document === "undefined") return;
      const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError(undefined);
    setResult(undefined);
    try {
      const imported = await context.importBackup(await file.text(), { mode });
      setResult(imported);
      onImported?.(imported);
    } catch (cause) {
      setError(cause);
    }
  }

  return (
    <section {...props} data-state={error ? "error" : result ? "complete" : "idle"}>
      <button type="button" onClick={() => void handleExport()} disabled={context.isMutating}>
        {exportLabel}
      </button>
      <label>
        {importModeLabel}
        <select value={mode} onChange={(event) => setMode(event.currentTarget.value as "merge" | "replace")}>
          <option value="merge">{mergeLabel}</option>
          <option value="replace">{replaceLabel}</option>
        </select>
      </label>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={context.isMutating}>
        {importLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        aria-label={importLabel}
        onChange={(event) => void handleImport(event)}
      />
      {result ? (
        <p role="status">
          {result.imported} {importedCountLabel}; {result.failed} {failedCountLabel}
        </p>
      ) : null}
      {error ? <p role="alert">{isQuotaError(error) ? quotaErrorLabel : getErrorMessage(error)}</p> : null}
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
