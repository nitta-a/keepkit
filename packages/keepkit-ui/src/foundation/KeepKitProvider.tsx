"use client";

import { KeepProvider, type KeepProviderProps } from "@keepkit/core/react";
import type { ReactNode } from "react";
import { KeepTourProvider, type KeepTourProviderProps } from "../features/navigation/tour-context";
import { KeepAnnouncements } from "../features/status/status";
import { KeepSyncFeedbackObserver } from "../features/sync/KeepSyncFeedbackObserver";
import { KeepThemeProvider, type KeepThemeProviderProps } from "./theme";
import { KeepUiProvider, type KeepUiProviderProps } from "./ui-context";

export type KeepKitProviderProps<TMeta = Record<string, unknown>> = Omit<KeepProviderProps<TMeta>, "children"> &
  Omit<KeepUiProviderProps<TMeta>, "children"> &
  Omit<KeepThemeProviderProps, "children"> & {
    children?: ReactNode;
    tour?: Omit<KeepTourProviderProps<TMeta>, "children">;
  };

/** Combines the core store, UI labels, and the global live announcer. */
export function KeepKitProvider<TMeta = Record<string, unknown>>({
  icons,
  labels,
  labelOptions,
  locale,
  labelResolver,
  onFeedback,
  theme,
  mode,
  hostColorFormat,
  density,
  radius,
  accentColor,
  highContrast,
  reducedMotion,
  variables,
  className: themeClassName,
  style: themeStyle,
  asChild: themeAsChild,
  tour,
  children,
  ...providerProps
}: KeepKitProviderProps<TMeta>) {
  return (
    <KeepUiProvider<TMeta>
      icons={icons}
      labels={labels}
      labelOptions={labelOptions}
      locale={locale}
      labelResolver={labelResolver}
      onFeedback={onFeedback}
    >
      <KeepThemeProvider
        theme={theme}
        mode={mode}
        hostColorFormat={hostColorFormat}
        density={density}
        radius={radius}
        accentColor={accentColor}
        highContrast={highContrast}
        reducedMotion={reducedMotion}
        variables={variables}
        className={themeClassName}
        style={themeStyle}
        asChild={themeAsChild}
      >
        <KeepProvider<TMeta> {...providerProps}>
          <KeepSyncFeedbackObserver />
          <KeepTourProvider<TMeta> {...tour}>{children}</KeepTourProvider>
          <KeepAnnouncements />
        </KeepProvider>
      </KeepThemeProvider>
    </KeepUiProvider>
  );
}
