"use client";

import type { KeepItem } from "@keepkit/core/core";
import type { InputHTMLAttributes, ReactNode } from "react";

export type KeepItemCheckboxProps<TMeta = Record<string, unknown>> = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "defaultChecked" | "onChange"
> & {
  item: KeepItem<TMeta>;
  checked?: boolean;
  label?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
};

/** A reusable accessible selection checkbox for a saved item. */
export function KeepItemCheckbox<TMeta = Record<string, unknown>>({
  item,
  checked = false,
  label,
  onCheckedChange,
  "aria-label": ariaLabel,
  ...props
}: KeepItemCheckboxProps<TMeta>) {
  const itemLabel = getItemLabel(item) ?? item.id;
  const accessibleLabel = ariaLabel ?? (typeof label === "string" ? label : itemLabel);
  return (
    <input
      {...props}
      type="checkbox"
      checked={checked}
      data-keepkit="item-checkbox"
      data-state={checked ? "checked" : "unchecked"}
      data-disabled={props.disabled ? "true" : undefined}
      aria-label={accessibleLabel}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
    />
  );
}

function getItemLabel<TMeta>(item: KeepItem<TMeta>): string | undefined {
  if (typeof item.meta !== "object" || item.meta === null || !("title" in item.meta)) return undefined;
  const title = (item.meta as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}
