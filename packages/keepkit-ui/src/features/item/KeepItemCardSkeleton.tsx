"use client";

import type { HTMLAttributes } from "react";
import type { KeepLayoutPreset } from "../collection/KeepCollection";

export type KeepItemCardSkeletonProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  layout?: KeepLayoutPreset;
};

/** A non-interactive placeholder that preserves the selected card layout while data loads. */
export function KeepItemCardSkeleton({ layout = "list", ...props }: KeepItemCardSkeletonProps) {
  return (
    <article {...props} aria-hidden="true" data-keepkit="card-skeleton" data-layout={layout} data-state="loading">
      <span data-skeleton-part="media" />
      <span data-skeleton-part="title" />
      <span data-skeleton-part="meta" />
      <span data-skeleton-part="tag" />
      <span data-skeleton-part="tag" />
    </article>
  );
}
