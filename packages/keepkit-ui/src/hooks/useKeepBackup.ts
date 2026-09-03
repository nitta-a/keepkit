import type { ImportItemsResult } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { useUiLabel } from "../ui-context";

type KeepBackupOptions<TMeta> = {
  filename: string;
  onExport: ((data: string) => void) | undefined;
  onImported: ((result: ImportItemsResult<TMeta>) => void) | undefined;
};

export function useKeepBackup<TMeta>({ filename, onExport, onImported }: KeepBackupOptions<TMeta>) {
  const context = useKeepContext<TMeta>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [result, setResult] = useState<ImportItemsResult<TMeta>>();
  const [error, setError] = useState<unknown>();

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

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
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

  return {
    inputRef,
    mode,
    setMode,
    result,
    error,
    isMutating: context.isMutating,
    exportBackup,
    importBackup,
    openFilePicker: () => inputRef.current?.click(),
    labels: {
      export: useUiLabel("exportData"),
      import: useUiLabel("importData"),
      importMode: useUiLabel("importMode"),
      merge: useUiLabel("merge"),
      replace: useUiLabel("replace"),
      importedCount: useUiLabel("importedCount"),
      failedCount: useUiLabel("failedCount"),
      quotaError: useUiLabel("storageQuotaError"),
    },
  };
}
