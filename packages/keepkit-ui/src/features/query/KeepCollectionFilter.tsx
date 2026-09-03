"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { type SelectHTMLAttributes, useMemo, useState } from "react";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepCollectionOption = { id?: string; label: string };

export type KeepCollectionControlProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (collectionId?: string) => void;
  onChange?: (collectionId?: string) => void;
  collectionLabels?: Record<string, string>;
  allLabel?: string;
  uncategorizedLabel?: string;
};

function useCollectionOptions<TMeta>(collectionLabels?: Record<string, string>, items?: KeepItem<TMeta>[]) {
  const ids = useMemo(
    () => [...new Set((items ?? []).map((item) => item.collectionId).filter((id): id is string => Boolean(id)))].sort(),
    [items],
  );
  return ids.map((id) => ({ id, label: collectionLabels?.[id] ?? id }));
}

/** A select that moves one item between derived collections. */
export function KeepCollectionSelect<TMeta = Record<string, unknown>>({
  item,
  value,
  defaultValue,
  onValueChange,
  onChange,
  collectionLabels,
  uncategorizedLabel,
  ...props
}: KeepCollectionControlProps & { item: KeepItem<TMeta> }) {
  const context = useKeepContext<TMeta>();
  const state = useState(value ?? defaultValue ?? item.collectionId ?? "");
  const selected = value ?? state[0];
  const options = useCollectionOptions(collectionLabels, context.items);
  const defaultUncategorizedLabel = useUiLabel("uncategorized");
  const uncategorized = uncategorizedLabel ?? defaultUncategorizedLabel;
  const handleChange = (next: string) => {
    const resolved = next || undefined;
    if (value === undefined) state[1](next);
    onValueChange?.(resolved);
    onChange?.(resolved);
    void context.moveToCollection(item.id, resolved);
  };
  return (
    <select
      {...props}
      value={selected}
      onChange={(event) => handleChange(event.currentTarget.value)}
      data-keep-action="move-collection"
    >
      <option value="">{uncategorized}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** A select filter for the collections derived from current items. */
export function KeepCollectionFilter<TMeta = Record<string, unknown>>({
  value,
  defaultValue,
  onValueChange,
  onChange,
  collectionLabels,
  allLabel,
  uncategorizedLabel,
  ...props
}: KeepCollectionControlProps) {
  const context = useKeepContext<TMeta>();
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? "");
  const selected = value ?? internalValue;
  const options = useCollectionOptions(collectionLabels, context.items);
  const collectionLabel = useUiLabel("collection");
  const defaultAllLabel = useUiLabel("allCollections");
  const defaultUncategorizedLabel = useUiLabel("uncategorized");
  const all = allLabel ?? defaultAllLabel;
  const uncategorized = uncategorizedLabel ?? defaultUncategorizedLabel;
  const handleChange = (next: string) => {
    if (value === undefined) setInternalValue(next);
    const resolved = next || undefined;
    onValueChange?.(resolved);
    onChange?.(resolved);
  };
  return (
    <label data-keepkit="collection-filter">
      <span>{collectionLabel}</span>
      <select
        {...props}
        value={selected}
        onChange={(event) => handleChange(event.currentTarget.value)}
        data-keep-action="filter-collection"
      >
        <option value="">{all}</option>
        <option value="__uncategorized__">{uncategorized}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
