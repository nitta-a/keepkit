"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useRovingTabIndex } from "./hooks/useRovingTabIndex";
import type { KeepLayoutPreset } from "./KeepCollection";

export type KeepLayoutProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  layout?: KeepLayoutPreset;
  children?: ReactNode;
};

/** A container-aware layout wrapper with a stable preset attribute for host or theme CSS. */
export function KeepLayout({ layout = "list", children, onKeyDown, onFocusCapture, ...props }: KeepLayoutProps) {
  const roving = useRovingTabIndex<HTMLDivElement>();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: The group manages keyboard focus for descendant cards.
    <div
      {...props}
      ref={roving.ref}
      data-keepkit="layout"
      data-layout={layout}
      data-roving-tabindex="true"
      role={props.role ?? "group"}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) roving.onKeyDown(event);
      }}
      onFocusCapture={(event) => {
        onFocusCapture?.(event);
        if (!event.defaultPrevented) roving.onFocusCapture(event);
      }}
    >
      {children}
    </div>
  );
}
