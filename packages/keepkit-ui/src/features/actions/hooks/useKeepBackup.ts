import {
  formatItemsAsMarkdown,
  type ImportItemsResult,
  inspectKeepBackup,
  type KeepBackupSummary,
} from "@keepkit/core/core";
import { useKeepCollections, useKeepContext } from "@keepkit/core/react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { useUiLabel } from "../../../foundation/ui-context";

type KeepBackupOptions<TMeta> = {
  filename: string;
  markdownFilename?: string;
  confirmReplace?: boolean;
  onExport: ((data: string) => void) | undefined;
  onExportMarkdown?: (markdown: string) => void;
  onImported: ((result: ImportItemsResult<TMeta>) => void) | undefined;
};

export type KeepBackupReplaceConfirmation = {
  data: string;
  summary: KeepBackupSummary;
  existingItemCount: number;
};

export function useKeepBackup<TMeta>({
  filename,
  markdownFilename = "keepkit-links.md",
  confirmReplace = false,
  onExport,
  onExportMarkdown,
  onImported,
}: KeepBackupOptions<TMeta>) {
  const context = useKeepContext<TMeta>();
  const collections = useKeepCollections<TMeta>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setModeState] = useState<"merge" | "replace">("merge");
  const [result, setResult] = useState<ImportItemsResult<TMeta>>();
  const [error, setError] = useState<unknown>();
  const [replaceConfirmation, setReplaceConfirmation] = useState<KeepBackupReplaceConfirmation | null>(null);

  function setMode(nextMode: "merge" | "replace") {
    setModeState(nextMode);
    if (nextMode !== "replace") setReplaceConfirmation(null);
  }

  async function exportBackup() {
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

  function exportMarkdown() {
    setError(undefined);
    try {
      const collectionLabels = Object.fromEntries(collections.map((entry) => [entry.id, entry.name]));
      const markdown = formatItemsAsMarkdown(context.items, { collectionLabels });
      onExportMarkdown?.(markdown);
      if (typeof document === "undefined") return;
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = markdownFilename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause);
    }
  }

  async function performImport(text: string, importMode: "merge" | "replace") {
    setError(undefined);
    setResult(undefined);
    try {
      const imported = await context.importBackup(text, { mode: importMode });
      setReplaceConfirmation(null);
      setResult(imported);
      onImported?.(imported);
    } catch (cause) {
      setError(cause);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError(undefined);
    setResult(undefined);
    setReplaceConfirmation(null);
    try {
      const text = await file.text();
      if (confirmReplace && mode === "replace") {
        const summary = inspectKeepBackup(text);
        setReplaceConfirmation({
          data: text,
          summary,
          existingItemCount: context.items.length,
        });
        return;
      }
      await performImport(text, mode);
    } catch (cause) {
      setError(cause);
    }
  }

  async function confirmPendingReplace() {
    if (!replaceConfirmation) return;
    await performImport(replaceConfirmation.data, "replace");
  }

  function cancelPendingReplace() {
    if (!context.isMutating) setReplaceConfirmation(null);
  }

  return {
    inputRef,
    mode,
    setMode,
    result,
    error,
    replaceConfirmation,
    confirmReplace: confirmPendingReplace,
    cancelReplace: cancelPendingReplace,
    isMutating: context.isMutating,
    exportBackup,
    exportMarkdown,
    importBackup,
    openFilePicker: () => inputRef.current?.click(),
    labels: {
      export: useUiLabel("exportData"),
      exportMarkdown: useUiLabel("exportMarkdown"),
      import: useUiLabel("importData"),
      importMode: useUiLabel("importMode"),
      merge: useUiLabel("merge"),
      replace: useUiLabel("replace"),
      importedCount: useUiLabel("importedCount"),
      failedCount: useUiLabel("failedCount"),
      quotaError: useUiLabel("storageQuotaError"),
      confirmReplaceTitle: useUiLabel("confirmReplace"),
      confirmReplaceDescription: useUiLabel("confirmReplaceDescription"),
      cancel: useUiLabel("cancel"),
      item: useUiLabel("collectionItem"),
      items: useUiLabel("collectionItems"),
    },
  };
}
