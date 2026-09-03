"use client";

import type { KeepItemStatus } from "@keepkit/core/core";
import type { HTMLAttributes, ReactNode } from "react";
import { useKeepItemStatusBadge } from "./hooks/useKeepItemStatusBadge";

export type KeepItemStatusBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  status?: KeepItemStatus | "restricted";
  label?: ReactNode;
};

export type KeepDisplayStatus = "available" | "expired" | "removed" | "restricted";

/** Displays the normalized availability state of a saved item. */
export function KeepItemStatusBadge({ status = "available", label, className, ...props }: KeepItemStatusBadgeProps) {
  const view = useKeepItemStatusBadge(status);
  return (
    <span
      {...props}
      className={className}
      data-keepkit="status-badge"
      data-status={status}
      data-item-status={view.resolvedStatus}
    >
      {label ?? view.statusLabel}
    </span>
  );
}
