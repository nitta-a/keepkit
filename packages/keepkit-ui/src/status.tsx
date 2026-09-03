"use client";

import type { KeepItem } from "@keepkit/core/core";
import { type HTMLAttributes, isValidElement, type ReactNode } from "react";
import { useKeepAnnouncements, useKeepEmptyState, useKeepStatus } from "./hooks/useStatusViews";
import { type RenderProp, renderRoot } from "./shared";

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
  const defaultTitle = useKeepEmptyState();
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = contentChildren ?? (
    <>
      <h2>{title ?? defaultTitle}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </>
  );
  return renderRoot(
    asChild,
    children,
    { ...rootProps, className, "data-keepkit": "empty-state", "data-state": "empty" },
    body,
    "KeepEmptyState",
  );
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
  const view = useKeepStatus<TMeta>(status);
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = render
    ? render(view.state)
    : typeof contentChildren === "function"
      ? contentChildren(view.state)
      : (contentChildren ?? labels?.[view.state.status] ?? view.defaultLabel);
  const role = rootProps.role ?? (view.state.status === "error" ? "alert" : "status");
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "data-keepkit": "status",
      role,
      "aria-live": rootProps["aria-live"] ?? "polite",
      "data-state": view.state.status,
      "data-loading":
        view.state.status === "loading" || view.state.status === "saving" || view.state.status === "syncing"
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
  const message = useKeepAnnouncements<TMeta>(messages);
  return (
    <div
      {...props}
      role={props.role ?? "status"}
      aria-live={props["aria-live"] ?? "polite"}
      aria-atomic="true"
      data-keepkit="announcements"
      data-state="announcing"
    >
      {message}
    </div>
  );
}

/** Singular alias for applications that mount one announcer explicitly. */
export const KeepAnnouncer = KeepAnnouncements;
