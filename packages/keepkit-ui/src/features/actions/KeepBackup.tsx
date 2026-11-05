"use client";

import type { ImportItemsResult } from "@keepkit/core/core";
import { type HTMLAttributes, useEffect, useId, useRef } from "react";
import { getErrorMessage } from "../../foundation/shared";
import { useUiLabelVisibility } from "../../foundation/ui-context";
import { useKeepBackup } from "./hooks/useKeepBackup";

export type KeepBackupProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  filename?: string;
  markdownFilename?: string;
  /** Enables a button to export saved items as a portable Markdown list. */
  allowMarkdownExport?: boolean;
  /** Requires confirmation with a backup summary before replacing current storage data. */
  confirmReplace?: boolean;
  onExport?: (data: string) => void;
  onExportMarkdown?: (markdown: string) => void;
  onImported?: (result: ImportItemsResult<TMeta>) => void;
};

/** Accessible JSON backup controls backed by the current KeepProvider storage. */
export function KeepBackup<TMeta = Record<string, unknown>>({
  filename = "keepkit-backup.json",
  markdownFilename = "keepkit-links.md",
  allowMarkdownExport = false,
  confirmReplace = false,
  onExport,
  onExportMarkdown,
  onImported,
  ...props
}: KeepBackupProps<TMeta>) {
  const view = useKeepBackup<TMeta>({
    filename,
    markdownFilename,
    confirmReplace,
    onExport,
    onExportMarkdown,
    onImported,
  });
  const showExportLabel = useUiLabelVisibility("exportData");
  const showExportMarkdownLabel = useUiLabelVisibility("exportMarkdown");
  const showImportModeLabel = useUiLabelVisibility("importMode");
  const showImportLabel = useUiLabelVisibility("importData");
  const replaceDescriptionId = useId();
  const importButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const wasMutating = useRef(false);
  const isOpen = view.replaceConfirmation !== null;
  useEffect(() => {
    if (isOpen && (!wasOpen.current || (wasMutating.current && !view.isMutating))) confirmButton.current?.focus();
    if (!isOpen && wasOpen.current && importButton.current?.isConnected) importButton.current.focus();
    wasOpen.current = isOpen;
    wasMutating.current = view.isMutating;
  }, [isOpen, view.isMutating]);

  return (
    <section
      {...props}
      data-keepkit="backup"
      data-state={view.error ? "error" : view.replaceConfirmation ? "confirming" : view.result ? "complete" : "idle"}
      data-loading={view.isMutating ? "true" : undefined}
    >
      <button
        type="button"
        data-keep-action="export-backup"
        onClick={() => void view.exportBackup()}
        disabled={view.isMutating}
        aria-label={showExportLabel ? undefined : view.labels.export}
      >
        {showExportLabel ? view.labels.export : null}
      </button>
      {allowMarkdownExport ? (
        <button
          type="button"
          data-keep-action="export-markdown"
          onClick={view.exportMarkdown}
          disabled={view.isMutating}
          aria-label={showExportMarkdownLabel ? undefined : view.labels.exportMarkdown}
        >
          {showExportMarkdownLabel ? view.labels.exportMarkdown : null}
        </button>
      ) : null}
      <label>
        {showImportModeLabel ? view.labels.importMode : null}
        <select
          data-keep-action="select-import-mode"
          value={view.mode}
          aria-label={showImportModeLabel ? undefined : view.labels.importMode}
          aria-describedby={view.mode === "replace" ? replaceDescriptionId : undefined}
          onChange={(event) => view.setMode(event.currentTarget.value as "merge" | "replace")}
        >
          <option value="merge">{view.labels.merge}</option>
          <option value="replace">{view.labels.replace}</option>
        </select>
      </label>
      {view.mode === "replace" ? <p id={replaceDescriptionId}>{view.labels.confirmReplaceDescription}</p> : null}
      <button
        ref={importButton}
        type="button"
        data-keep-action="import-backup"
        onClick={view.openFilePicker}
        disabled={view.isMutating}
        aria-label={showImportLabel ? undefined : view.labels.import}
      >
        {showImportLabel ? view.labels.import : null}
      </button>
      <input
        ref={view.inputRef}
        type="file"
        data-keep-action="select-backup-file"
        accept="application/json,.json"
        aria-label={view.labels.import}
        onChange={(event) => void view.importBackup(event)}
      />
      {view.replaceConfirmation ? (
        <div
          role="dialog"
          aria-label={view.labels.confirmReplaceTitle}
          aria-busy={view.isMutating}
          data-keepkit="replace-confirmation"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || view.isMutating) return;
            event.preventDefault();
            event.stopPropagation();
            view.cancelReplace();
          }}
        >
          <p>
            {view.replaceConfirmation.summary.itemCount}{" "}
            {view.replaceConfirmation.summary.itemCount === 1 ? view.labels.item : view.labels.items} —{" "}
            {view.labels.confirmReplaceDescription}
          </p>
          <button
            ref={confirmButton}
            type="button"
            data-keep-action="confirm-replace-backup"
            disabled={view.isMutating}
            onClick={() => void view.confirmReplace()}
          >
            {view.labels.replace}
          </button>
          <button
            type="button"
            data-keep-action="cancel-replace-backup"
            disabled={view.isMutating}
            onClick={view.cancelReplace}
          >
            {view.labels.cancel}
          </button>
        </div>
      ) : null}
      {view.result ? (
        <p role="status">
          {view.result.imported} {view.labels.importedCount}; {view.result.failed} {view.labels.failedCount}
        </p>
      ) : null}
      {view.error ? (
        <p role="alert">
          {isQuotaError(view.error) ? view.labels.quotaError : getErrorMessage(view.error, "Something went wrong.")}
        </p>
      ) : null}
    </section>
  );
}

function isQuotaError(error: unknown): boolean {
  if (error instanceof Error && error.name === "KeepStorageQuotaError") return true;
  if (error && typeof error === "object" && "cause" in error) return isQuotaError(error.cause);
  return false;
}
