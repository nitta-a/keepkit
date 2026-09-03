import type { KeepItemStatus } from "@keepkit/core/core";
import type { KeepDisplayStatus } from "../KeepItemStatusBadge";
import { type KeepUiLabelKey, useUiLabel } from "../ui-context";

export function useKeepItemStatusBadge(status: KeepItemStatus | "restricted") {
  return { resolvedStatus: getDisplayStatus(status), statusLabel: useUiLabel(getStatusLabelKey(status)) };
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
