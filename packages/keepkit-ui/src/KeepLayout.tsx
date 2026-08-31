"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import type { KeepLayoutPreset } from "./KeepCollection";

export type KeepLayoutProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  layout?: KeepLayoutPreset;
  children?: ReactNode;
};

/** A CSS-free layout wrapper with responsive grid presets and data attributes for host styling. */
export function KeepLayout({ layout = "list", children, style, ...props }: KeepLayoutProps) {
  const layoutStyle: CSSProperties =
    layout === "grid"
      ? { display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }
      : layout === "compact"
        ? { display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }
        : { display: "flex", flexDirection: "column", gap: "1rem" };
  return (
    <div {...props} style={{ ...layoutStyle, ...style }} data-keepkit="layout" data-layout={layout}>
      {children}
    </div>
  );
}
