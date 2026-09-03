"use client";

import { type CSSProperties, isValidElement, type ReactElement, type ReactNode } from "react";
import { createSlot } from "./shared";

export const keepThemeNames = [
  "default",
  "ocean",
  "forest",
  "sunset",
  "lavender",
  "compact",
  "minimal",
  "rounded",
  "high-contrast",
  "dark",
] as const;

export type KeepThemeName = (typeof keepThemeNames)[number];
export type KeepThemeMode = "light" | "dark" | "system";
export type KeepThemeDensity = "compact" | "comfortable" | "spacious";
export type KeepThemeRadius = "none" | "small" | "medium" | "large" | "full";

export type KeepThemeVariables = Record<`--keep-${string}`, string | number>;

export type KeepThemeProviderProps = {
  children?: ReactNode;
  className?: string;
  id?: string;
  title?: string;
  role?: string;
  tabIndex?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "data-testid"?: string;
  [key: `data-${string}`]: string | undefined;
  theme?: KeepThemeName;
  mode?: KeepThemeMode;
  density?: KeepThemeDensity;
  radius?: KeepThemeRadius;
  accentColor?: "blue" | "green" | "violet" | "orange" | "rose" | (string & {});
  highContrast?: boolean;
  reducedMotion?: boolean;
  variables?: KeepThemeVariables;
  style?: CSSProperties & KeepThemeVariables;
  asChild?: boolean;
};

/** Scopes KeepKit tokens and opt-in component styles to one subtree. */
export function KeepThemeProvider({
  children,
  theme = "default",
  mode = "system",
  density = "comfortable",
  radius = "medium",
  accentColor,
  highContrast = false,
  reducedMotion = false,
  variables,
  style,
  className,
  asChild = false,
  ...props
}: KeepThemeProviderProps) {
  const themeClassName = [
    "keep-theme",
    `keep-theme--${theme}`,
    `keep-theme--${mode}`,
    `keep-theme--density-${density}`,
    `keep-theme--radius-${radius}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const themeStyle = {
    ...style,
    ...(accentColor && !highContrast ? { "--keep-accent": accentColor, "--keep-primary": accentColor } : {}),
    ...variables,
  } as CSSProperties & KeepThemeVariables;
  const rootProps = {
    ...props,
    className: themeClassName,
    style: themeStyle,
    "data-keep-theme": theme,
    "data-theme": theme,
    "data-mode": mode,
    "data-density": density,
    "data-radius": radius,
    "data-accent-color": accentColor,
    "data-high-contrast": highContrast ? "true" : undefined,
    "data-reduced-motion": reducedMotion ? "true" : undefined,
  };

  if (asChild) {
    if (!isValidElement(children))
      throw new Error("KeepThemeProvider with asChild requires a single React element child.");
    return createSlot(children as ReactElement<Record<string, unknown>>, rootProps);
  }
  return <div {...rootProps}>{children}</div>;
}
