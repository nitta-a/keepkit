"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { getKeepLocaleLabels, KEEP_LOCALE_LABELS, normalizeKeepLocale } from "./locales";
import type { KeepUiLabelKey, KeepUiLabels, KeepUiLocaleLabels } from "./locales/types";

export type { KeepUiLocale } from "./locales";
export type { KeepUiLabelKey, KeepUiLabels, KeepUiLocaleLabels } from "./locales/types";

export type KeepUiLabelContext = {
  locale?: string;
  labels: Readonly<Record<KeepUiLabelKey, string>>;
  customLabels?: KeepUiLabels;
  labelResolver?: (key: KeepUiLabelKey, context: { locale?: string }) => string | undefined;
};

export const DEFAULT_LABELS: KeepUiLocaleLabels = KEEP_LOCALE_LABELS.en;

const KeepUiLabelsContext = createContext<KeepUiLabelContext>({ labels: DEFAULT_LABELS });

export type KeepUiProviderProps = {
  labels?: KeepUiLabels;
  locale?: string;
  labelResolver?: KeepUiLabelContext["labelResolver"];
  children?: ReactNode;
};

/** Provides one complete locale-aware label source to every UI primitive. */
export function KeepUiProvider({ labels, locale, labelResolver, children }: KeepUiProviderProps) {
  const value = useMemo<KeepUiLabelContext>(() => {
    const resolvedLocale = normalizeKeepLocale(locale);
    const dictionary = getKeepLocaleLabels(resolvedLocale);
    const resolved = { ...DEFAULT_LABELS, ...dictionary, ...labels };
    return { locale: locale ?? resolvedLocale, labels: resolved, customLabels: labels, labelResolver };
  }, [labelResolver, labels, locale]);
  return <KeepUiLabelsContext.Provider value={value}>{children}</KeepUiLabelsContext.Provider>;
}

export function useKeepUiLabels(): KeepUiLabelContext {
  return useContext(KeepUiLabelsContext);
}

export function useUiLabel(key: KeepUiLabelKey, override?: string): string {
  const context = useKeepUiLabels();
  return (
    override ??
    context.customLabels?.[key] ??
    context.labelResolver?.(key, { locale: context.locale }) ??
    context.labels[key]
  );
}

export { getKeepLocaleLabels };
