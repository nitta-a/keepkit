import type { KeepItem } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import type { ReactNode } from "react";
import type { KeepImageProps, KeepItemCardState } from "../KeepItemCard";
import { getMetaTitle } from "../shared";
import { useKeepUiFeedback, useUiLabel } from "../ui-context";

type KeepItemCardOptions<TMeta> = {
  item: KeepItem<TMeta>;
  title: ReactNode | ((item: KeepItem<TMeta>) => ReactNode);
  getTitle: ((item: KeepItem<TMeta>) => ReactNode) | undefined;
  getImageProps: ((item: KeepItem<TMeta>, title: ReactNode) => KeepImageProps | undefined) | undefined;
  href: string | ((item: KeepItem<TMeta>) => string | undefined) | undefined;
  linkTargetAttribute: React.HTMLAttributeAnchorTarget | undefined;
  linkRel: string | undefined;
  onRemoveError: ((error: unknown) => void) | undefined;
  onRemoved: ((item: KeepItem<TMeta>) => void) | undefined;
};

export function useKeepItemCard<TMeta>(options: KeepItemCardOptions<TMeta>) {
  const {
    item,
    title,
    getTitle,
    getImageProps,
    href: hrefOption,
    linkTargetAttribute,
    linkRel,
    onRemoveError,
    onRemoved,
  } = options;
  const itemState = useKeepItem<TMeta>(item);
  const emitFeedback = useKeepUiFeedback<TMeta>();
  const removedMessage = useUiLabel("removedMessage");
  const restoredMessage = useUiLabel("restoredMessage");
  const undoLabel = useUiLabel("undo");
  const resolvedTitle =
    typeof title === "function" ? title(item) : (title ?? getTitle?.(item) ?? getMetaTitle(item.meta) ?? item.id);
  const imageProps = getImageProps?.(item, resolvedTitle);
  const href = typeof hrefOption === "function" ? hrefOption(item) : hrefOption;
  const isAvailable = item.status === undefined || item.status === "available";
  const isExternalLink = href ? /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href) : false;
  const statusLabelKey = item.status && item.status !== "available" ? getStatusLabelKey(item.status) : "statusUnknown";
  const unavailableLabel = useUiLabel(statusLabelKey);
  const remove = async () => {
    const wasSaved = itemState.isSaved;
    try {
      await itemState.removeWithUndo();
      onRemoved?.(item);
      if (!wasSaved) return;
      emitFeedback({
        type: "item-removed",
        item,
        message: removedMessage,
        undoLabel,
        undo: async () => {
          await itemState.undo();
          emitFeedback({ type: "item-restored", item, items: [item], message: restoredMessage });
        },
      });
    } catch (cause) {
      onRemoveError?.(cause);
    }
  };
  const state: KeepItemCardState<TMeta> = {
    item,
    isSaved: itemState.isSaved,
    isMutating: itemState.isMutating,
    error: itemState.error,
    remove,
    status: item.status,
  };

  return {
    itemState,
    state,
    resolvedTitle,
    imageProps,
    href,
    isAvailable,
    displayStatus: getDisplayStatus(item.status),
    resolvedLinkTarget: linkTargetAttribute ?? (isExternalLink ? "_blank" : undefined),
    resolvedLinkRel: linkRel ?? (isExternalLink ? "noreferrer" : undefined),
    statusLabel: item.status && item.status !== "available" ? unavailableLabel : undefined,
    remove,
    labels: {
      save: useUiLabel("save"),
      savedAt: useUiLabel("saved"),
      error: useUiLabel("error"),
      remove: useUiLabel("remove"),
      tags: useUiLabel("tags"),
    },
  };
}

function getStatusLabelKey(
  status: NonNullable<KeepItem["status"]>,
): "statusExpired" | "statusRemoved" | "statusDeleted" | "statusPrivate" | "statusUnknown" {
  switch (status) {
    case "expired":
      return "statusExpired";
    case "removed":
      return "statusRemoved";
    case "deleted":
      return "statusDeleted";
    case "private":
      return "statusPrivate";
    default:
      return "statusUnknown";
  }
}

function getDisplayStatus(status: KeepItem["status"]): "available" | "expired" | "removed" | "restricted" {
  if (status === undefined || status === "available") return "available";
  if (status === "expired") return "expired";
  if (status === "removed") return "removed";
  return "restricted";
}
