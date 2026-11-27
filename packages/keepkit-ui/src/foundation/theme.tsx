"use client";

import {
  type CSSProperties,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
export type KeepThemeMode = "light" | "dark" | "system" | "inherit";
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
  hostColorFormat?: "color" | "hsl-channels";
  density?: KeepThemeDensity;
  radius?: KeepThemeRadius;
  accentColor?: "blue" | "green" | "violet" | "orange" | "rose" | (string & {});
  highContrast?: boolean;
  reducedMotion?: boolean;
  variables?: KeepThemeVariables;
  style?: CSSProperties & KeepThemeVariables;
  asChild?: boolean;
};

export type KeepThemeContextValue = Pick<
  KeepThemeProviderProps,
  | "theme"
  | "mode"
  | "hostColorFormat"
  | "density"
  | "radius"
  | "accentColor"
  | "highContrast"
  | "reducedMotion"
  | "variables"
  | "style"
>;
const KeepThemeContext = createContext<KeepThemeContextValue>({});
const ThemeElementContext = createContext<RefObject<HTMLElement | null> | null>(null);
export function useKeepTheme(): KeepThemeContextValue {
  return useContext(KeepThemeContext);
}

/** Scopes KeepKit tokens and opt-in component styles to one subtree. */
export function KeepThemeProvider({
  children,
  theme = "default",
  mode = "inherit",
  hostColorFormat = "color",
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
  const elementRef = useRef<HTMLDivElement>(null);
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
    ...(accentColor && !highContrast ? { "--keep-primary": accentColor } : {}),
    ...variables,
  } as CSSProperties & KeepThemeVariables;
  const rootProps = {
    ...props,
    ref: elementRef,
    className: themeClassName,
    style: themeStyle,
    "data-keep-theme": theme,
    "data-theme": theme,
    "data-mode": mode,
    "data-host-color-format": hostColorFormat,
    "data-density": density,
    "data-radius": radius,
    "data-accent-color": accentColor,
    "data-high-contrast": highContrast ? "true" : undefined,
    "data-reduced-motion": reducedMotion ? "true" : undefined,
  };

  const content = asChild ? (
    (() => {
      if (!isValidElement(children))
        throw new Error("KeepThemeProvider with asChild requires a single React element child.");
      return createSlot(children as ReactElement<Record<string, unknown>>, rootProps);
    })()
  ) : (
    <div {...rootProps}>{children}</div>
  );
  return (
    <KeepThemeContext.Provider
      value={{
        theme,
        mode,
        hostColorFormat,
        density,
        radius,
        accentColor,
        highContrast,
        reducedMotion,
        variables,
        style,
      }}
    >
      <ThemeElementContext.Provider value={elementRef}>{content}</ThemeElementContext.Provider>
    </KeepThemeContext.Provider>
  );
}

/** A portal outside the host subtree cannot inherit its resolved CSS variables. */
export function KeepPortalTheme({
  children,
  sourceRef,
}: {
  children: ReactNode;
  sourceRef?: RefObject<HTMLElement | null>;
}) {
  const theme = useKeepTheme();
  const themeRef = useContext(ThemeElementContext);
  const [tokens, setTokens] = useState<KeepThemeVariables>();
  useLayoutEffect(() => {
    const source = sourceRef?.current ?? themeRef?.current;
    if (!source) return;
    const sync = () => {
      const computed = getComputedStyle(source);
      const resolved: KeepThemeVariables = {};
      for (let index = 0; index < computed.length; index++) {
        const name = computed.item(index);
        if (name.startsWith("--keep-")) resolved[name as `--keep-${string}`] = computed.getPropertyValue(name);
      }
      setTokens(resolved);
    };
    sync();
    const observer = new MutationObserver(sync);
    for (let element: Element | null = source; element; element = element.parentElement) {
      observer.observe(element, { attributes: true });
    }
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", sync);
    return () => {
      media?.removeEventListener?.("change", sync);
      observer.disconnect();
    };
  }, [sourceRef, themeRef]);
  return (
    <KeepThemeProvider {...theme} variables={{ ...theme.variables, ...tokens }}>
      {children}
    </KeepThemeProvider>
  );
}
