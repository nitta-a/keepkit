"use client";

import type { KeepItemStatus } from "@keepkit/core/core";
import type { HTMLAttributes, ReactNode } from "react";
import { type KeepUiLabelKey, useUiLabel } from "./ui-context";

export type KeepItemStatusBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  status?: KeepItemStatus | "restricted";
  label?: ReactNode;
};

export type KeepDisplayStatus = "available" | "expired" | "removed" | "restricted";

/** Displays the normalized availability state of a saved item. */
export function KeepItemStatusBadge({ status = "available", label, className, ...props }: KeepItemStatusBadgeProps) {
  const resolvedStatus = getDisplayStatus(status);
  const statusLabel = useUiLabel(getStatusLabelKey(status));
  return (
    <span
      {...props}
      className={className}
      data-keepkit="status-badge"
      data-status={status}
      data-item-status={resolvedStatus}
    >
      {label ?? statusLabel}
    </span>
  );
}

function getStatusLabelKey(status: KeepItemStatus | "restricted"): KeepUiLabelKey {
  switch (status) {
    case "available":
      return "statusAvailable";
    case "expired":
      return "statusExpired";
    case "removed":
      return "statusRemoved";
    case "deleted":
      return "statusDeleted";
    case "private":
      return "statusPrivate";
    case "unknown":
      return "statusUnknown";
    case "restricted":
      return "statusPrivate";
  }
}

function getDisplayStatus(status: KeepItemStatus | "restricted"): KeepDisplayStatus {
  if (status === "available") return "available";
  if (status === "expired") return "expired";
  if (status === "removed") return "removed";
  return "restricted";
}
