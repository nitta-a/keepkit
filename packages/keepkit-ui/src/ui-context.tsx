"use client";

import type { KeepItem } from "@keepkit/core/core";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { getKeepLocaleLabels, KEEP_LOCALE_LABELS, normalizeKeepLocale } from "./locales";
import type { KeepUiLabelKey, KeepUiLabels, KeepUiLocaleLabels } from "./locales/types";

export type { KeepUiLocale } from "./locales";
export type { KeepUiLabelKey, KeepUiLabels, KeepUiLocaleLabels } from "./locales/types";

export type KeepUiLabelContext = {
  locale?: string;
  labels: Readonly<Record<KeepUiLabelKey, string>>;
  customLabels?: KeepUiLabels;
  labelResolver?: (key: KeepUiLabelKey, context: { locale?: string }) => string | undefined;
  emitFeedback: <TMeta>(event: KeepUiFeedbackEvent<TMeta>) => void;
};

type KeepUiFeedbackBase<TType extends string> = { type: TType; message: string };

export type KeepUiFeedbackEvent<TMeta = Record<string, unknown>> =
  | (KeepUiFeedbackBase<"item-saved"> & { item: KeepItem<TMeta> })
  | (KeepUiFeedbackBase<"item-removed"> & {
      item: KeepItem<TMeta>;
      undo: () => void | Promise<void>;
      undoLabel: string;
    })
  | (KeepUiFeedbackBase<"item-restored"> & { item?: KeepItem<TMeta>; items: KeepItem<TMeta>[] })
  | KeepUiFeedbackBase<"sync-completed">
  | (KeepUiFeedbackBase<"sync-failed"> & { error: unknown })
  | (KeepUiFeedbackBase<"stale-pruned"> & {
      item?: KeepItem<TMeta>;
      items: KeepItem<TMeta>[];
      undo: () => void | Promise<void>;
      undoLabel: string;
    });

export const DEFAULT_LABELS: KeepUiLocaleLabels = KEEP_LOCALE_LABELS.en;

const KeepUiLabelsContext = createContext<KeepUiLabelContext>({
  labels: DEFAULT_LABELS,
  emitFeedback: () => undefined,
});

export type KeepUiProviderProps<TMeta = Record<string, unknown>> = {
  labels?: KeepUiLabels;
  locale?: string;
  labelResolver?: KeepUiLabelContext["labelResolver"];
  onFeedback?: (event: KeepUiFeedbackEvent<TMeta>) => void;
  children?: ReactNode;
};

/** Provides one complete locale-aware label source to every UI primitive. */
export function KeepUiProvider<TMeta = Record<string, unknown>>({
  labels,
  locale,
  labelResolver,
  onFeedback,
  children,
}: KeepUiProviderProps<TMeta>) {
  const emitFeedback = useCallback(
    <TEventMeta,>(event: KeepUiFeedbackEvent<TEventMeta>) => {
      onFeedback?.(event as KeepUiFeedbackEvent<TMeta>);
    },
    [onFeedback],
  );
  const value = useMemo<KeepUiLabelContext>(() => {
    const resolvedLocale = normalizeKeepLocale(locale);
    const dictionary = getKeepLocaleLabels(resolvedLocale);
    const resolved = { ...DEFAULT_LABELS, ...dictionary, ...labels };
    return { locale: locale ?? resolvedLocale, labels: resolved, customLabels: labels, labelResolver, emitFeedback };
  }, [emitFeedback, labelResolver, labels, locale]);
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

export function useKeepUiFeedback<TMeta = Record<string, unknown>>() {
  const { emitFeedback } = useKeepUiLabels();
  return useCallback((event: KeepUiFeedbackEvent<TMeta>) => emitFeedback(event), [emitFeedback]);
}

export { getKeepLocaleLabels };
