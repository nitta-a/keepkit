import type { ComponentType } from "react";
import type { KeepButtonIcon, KeepButtonIconProps } from "./shared";
import { useKeepUiIcons } from "./ui-context";

export function useKeepIcon(slot: "collection" | "remove", enabled = true) {
  const icons = useKeepUiIcons();
  return enabled ? renderKeepIcon(icons?.[slot]) : null;
}

function isIconComponent(icon: KeepButtonIcon): icon is ComponentType<KeepButtonIconProps> {
  if (typeof icon === "function") return true;
  if (!icon || typeof icon !== "object" || !("$$typeof" in icon)) return false;
  return (
    icon.$$typeof === Symbol.for("react.forward_ref") ||
    icon.$$typeof === Symbol.for("react.memo") ||
    icon.$$typeof === Symbol.for("react.lazy")
  );
}

/** Hide even text glyphs and named SVGs from the surrounding control's accessible name. */
export function renderKeepIcon(icon: KeepButtonIcon, className?: string) {
  if (icon == null || typeof icon === "boolean" || icon === "") return null;
  const Icon = icon;
  return (
    <span data-keep-icon="" aria-hidden="true">
      {isIconComponent(Icon) ? <Icon aria-hidden={true} className={className} /> : Icon}
    </span>
  );
}
