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
      role="img"
      aria-label={props["aria-label"] ?? view.statusLabel}
      data-keepkit="status-badge"
      data-status={status}
      data-item-status={view.resolvedStatus}
    >
      <StatusIcon name={view.icon} />
      <span data-status-label="true">{label ?? view.statusLabel}</span>
    </span>
  );
}

function StatusIcon({ name }: { name: "check" | "clock" | "ban" | "lock" }) {
  return (
    <svg
      data-status-icon={name}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === "check" ? <path d="m5 12 4 4L19 6" /> : null}
      {name === "clock" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </>
      ) : null}
      {name === "ban" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m6.5 6.5 11 11" />
        </>
      ) : null}
      {name === "lock" ? (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      ) : null}
    </svg>
  );
}
