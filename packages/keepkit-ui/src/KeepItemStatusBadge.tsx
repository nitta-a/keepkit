"use client";

import type { KeepItemStatus } from "@keepkit/core/core";
import type { HTMLAttributes, ReactNode } from "react";
import { type KeepUiLabelKey, useUiLabel } from "./ui-context";

export type KeepItemStatusBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  status?: KeepItemStatus;
  label?: ReactNode;
};

/** Displays the normalized availability state of a saved item. */
export function KeepItemStatusBadge({ status = "available", label, className, ...props }: KeepItemStatusBadgeProps) {
  const resolvedStatus = status === "available" ? "available" : status;
  const statusLabel = useUiLabel(getStatusLabelKey(resolvedStatus));
  return (
    <span {...props} className={className} data-keepkit="status-badge" data-status={resolvedStatus}>
      {label ?? statusLabel}
    </span>
  );
}

function getStatusLabelKey(status: KeepItemStatus): KeepUiLabelKey {
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
    case "unknown":
      return status === "private" ? "statusPrivate" : "statusUnknown";
  }
}
