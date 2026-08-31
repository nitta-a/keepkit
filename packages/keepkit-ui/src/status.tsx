"use client";

import type { KeepChangeContext, KeepItem } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { type HTMLAttributes, isValidElement, type ReactNode, useEffect, useRef, useState } from "react";
import { type RenderProp, renderRoot } from "./shared";
import { type KeepUiLabelKey, useUiLabel } from "./ui-context";

export type KeepEmptyStateProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  asChild?: boolean;
};

/** A style-free, reusable empty collection state. */
export function KeepEmptyState({
  title,
  description,
  action,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepEmptyStateProps) {
  const defaultTitle = useUiLabel("noItems").replace(/\.$/, "");
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = contentChildren ?? (
    <>
      <h2>{title ?? defaultTitle}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </>
  );
  return renderRoot(asChild, children, { ...rootProps, className, "data-state": "empty" }, body, "KeepEmptyState");
}

export type KeepStatusValue = "idle" | "empty" | "loading" | "saving" | "syncing" | "error";
export type KeepStatusLabels = Partial<Record<KeepStatusValue, ReactNode>>;

export type KeepStatusState<TMeta = Record<string, unknown>> = {
  status: KeepStatusValue;
  error: unknown | null;
  pendingCount: number;
  items: KeepItem<TMeta>[];
};

export type KeepStatusProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  status?: KeepStatusValue;
  labels?: KeepStatusLabels;
  children?: ReactNode | RenderProp<KeepStatusState<TMeta>>;
  render?: RenderProp<KeepStatusState<TMeta>>;
  asChild?: boolean;
};

/** Presents provider loading, mutation, synchronization, empty, and error states accessibly. */
export function KeepStatus<TMeta = Record<string, unknown>>({
  status,
  labels,
  children,
  render,
  asChild = false,
  className,
  ...rootProps
}: KeepStatusProps<TMeta>) {
  const context = useKeepContext<TMeta>();
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const resolvedStatus = status ?? getDerivedStatus(context);
  const defaultLabel = useUiLabel(getStatusLabelKey(resolvedStatus));
  const state: KeepStatusState<TMeta> = {
    status: resolvedStatus,
    error: context.error,
    pendingCount: context.syncState.pendingCount,
    items: context.items,
  };
  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? labels?.[resolvedStatus] ?? defaultLabel);
  const role = rootProps.role ?? (resolvedStatus === "error" ? "alert" : "status");
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      role,
      "aria-live": rootProps["aria-live"] ?? "polite",
      "data-state": resolvedStatus,
      "data-loading":
        resolvedStatus === "loading" || resolvedStatus === "saving" || resolvedStatus === "syncing"
          ? "true"
          : undefined,
    },
    body,
    "KeepStatus",
  );
}

export type KeepAnnouncementsProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  messages?: Partial<Record<"save" | "remove" | "note", string>>;
};

/** Announces successful save, remove, and note operations in a polite live region. */
export function KeepAnnouncements<TMeta = Record<string, unknown>>({ messages, ...props }: KeepAnnouncementsProps) {
  const context = useKeepContext<TMeta>();
  const savedMessage = useUiLabel("savedMessage", messages?.save);
  const removedMessage = useUiLabel("removedMessage", messages?.remove);
  const noteSavedMessage = useUiLabel("noteSavedMessage", messages?.note);
  const [message, setMessage] = useState("");
  const lastChangeRef = useRef<KeepChangeContext<TMeta> | undefined>(undefined);
  useEffect(() => {
    const change = context.lastChange;
    if (!change || change === lastChangeRef.current) return;
    lastChangeRef.current = change;
    if (change.action === "save") setMessage(savedMessage);
    else if (change.action === "remove" || change.action === "removeBatch") setMessage(removedMessage);
    else if (change.action === "updateNote") setMessage(noteSavedMessage);
  }, [context.lastChange, noteSavedMessage, removedMessage, savedMessage]);
  return (
    <div
      {...props}
      role={props.role ?? "status"}
      aria-live={props["aria-live"] ?? "polite"}
      aria-atomic="true"
      data-state="announcing"
    >
      {message}
    </div>
  );
}

/** Singular alias for applications that mount one announcer explicitly. */
export const KeepAnnouncer = KeepAnnouncements;

function getDerivedStatus<TMeta>(context: ReturnType<typeof useKeepContext<TMeta>>): KeepStatusValue {
  if (context.error) return "error";
  if (context.syncState.status === "pending" || context.syncState.status === "syncing") return "syncing";
  if (context.isMutating) return "saving";
  if (context.isLoading && !context.isHydrated) return "loading";
  if (context.isHydrated && context.items.length === 0) return "empty";
  return "idle";
}

function getStatusLabelKey(status: KeepStatusValue): KeepUiLabelKey {
  if (status === "empty") return "noItems";
  if (status === "loading") return "loadingItems";
  if (status === "error") return "error";
  if (status === "saving") return "saving";
  if (status === "syncing") return "syncing";
  return "saved";
}
