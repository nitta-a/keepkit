"use client";

import type { HTMLAttributes, ReactNode } from "react";
import type { KeepLayoutPreset } from "./KeepCollection";

export type KeepLayoutProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  layout?: KeepLayoutPreset;
  children?: ReactNode;
};

/** A style-free layout wrapper with a stable preset attribute for host or theme CSS. */
export function KeepLayout({ layout = "list", children, ...props }: KeepLayoutProps) {
  return (
    <div {...props} data-keepkit="layout" data-layout={layout}>
      {children}
    </div>
  );
}
