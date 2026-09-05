"use client";

import type { SelectHTMLAttributes } from "react";
import { useState } from "react";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepArchiveScope = "active" | "archived" | "all";

export type KeepArchiveScopeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: KeepArchiveScope;
  defaultValue?: KeepArchiveScope;
  onValueChange?: (value: KeepArchiveScope) => void;
};

/** A localized active/archived/all selector for a KeepCollection query. */
export function KeepArchiveScopeSelect({
  value: controlledValue,
  defaultValue = "active",
  onValueChange,
  "aria-label": ariaLabel,
  ...props
}: KeepArchiveScopeSelectProps) {
  const [internalValue, setInternalValue] = useState<KeepArchiveScope>(controlledValue ?? defaultValue);
  const value = controlledValue ?? internalValue;
  const label = useUiLabel("archiveScope");
  const activeLabel = useUiLabel("archiveScopeActive");
  const archivedLabel = useUiLabel("archiveScopeArchived");
  const allLabel = useUiLabel("archiveScopeAll");
  const handleChange = (next: string) => {
    if (next !== "active" && next !== "archived" && next !== "all") return;
    if (controlledValue === undefined) setInternalValue(next);
    onValueChange?.(next);
  };
  return (
    <label data-keepkit="archive-scope">
      <span>{label}</span>
      <select
        {...props}
        value={value}
        aria-label={ariaLabel ?? label}
        data-keep-action="archive-scope"
        onChange={(event) => handleChange(event.currentTarget.value)}
      >
        <option value="active">{activeLabel}</option>
        <option value="archived">{archivedLabel}</option>
        <option value="all">{allLabel}</option>
      </select>
    </label>
  );
}
