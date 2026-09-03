import type { KeepItemStatus } from "@keepkit/core/core";
import { type KeepUiLabelKey, useUiLabel } from "../../../foundation/ui-context";
import type { KeepDisplayStatus } from "../KeepItemStatusBadge";

export function useKeepItemStatusBadge(status: KeepItemStatus | "restricted") {
  return {
    resolvedStatus: getDisplayStatus(status),
    statusLabel: useUiLabel(getStatusLabelKey(status)),
    icon: getStatusIcon(status),
  };
}

export type KeepStatusIconName = "check" | "clock" | "ban" | "lock";

function getStatusIcon(status: KeepItemStatus | "restricted"): KeepStatusIconName {
  if (status === "available") return "check";
  if (status === "expired") return "clock";
  if (status === "removed" || status === "deleted") return "ban";
  return "lock";
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
  if (status === "removed" || status === "deleted") return "removed";
  return "restricted";
}
