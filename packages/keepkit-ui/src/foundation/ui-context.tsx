"use client";

import type { KeepItem } from "@keepkit/core/core";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { getKeepLocaleLabels, KEEP_LOCALE_LABELS, normalizeKeepLocale } from "../locales";
import type { KeepUiLabelKey, KeepUiLabelOptionsMap, KeepUiLabels, KeepUiLocaleLabels } from "../locales/types";

export type { KeepUiLocale } from "../locales";
export type {
  KeepUiLabelKey,
  KeepUiLabelOptions,
  KeepUiLabelOptionsMap,
  KeepUiLabels,
  KeepUiLocaleLabels,
} from "../locales/types";

export type KeepUiLabelContext = {
  locale?: string;
  labels: Readonly<Record<KeepUiLabelKey, string>>;
  labelVisibility?: Readonly<Partial<Record<KeepUiLabelKey, boolean>>>;
  customLabels?: KeepUiLabels;
  labelOptions?: KeepUiLabelOptionsMap;
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
  labelVisibility: {},
  emitFeedback: () => undefined,
});

export type KeepUiProviderProps<TMeta = Record<string, unknown>> = {
  labels?: KeepUiLabels;
  labelOptions?: KeepUiLabelOptionsMap;
  locale?: string;
  labelResolver?: KeepUiLabelContext["labelResolver"];
  onFeedback?: (event: KeepUiFeedbackEvent<TMeta>) => void;
  children?: ReactNode;
};

/** Provides one complete locale-aware label source to every UI primitive. */
export function KeepUiProvider<TMeta = Record<string, unknown>>({
  labels,
  labelOptions,
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
    const resolved = { ...DEFAULT_LABELS, ...dictionary };
    const labelVisibility = {} as Record<KeepUiLabelKey, boolean>;
    for (const key of Object.keys(resolved) as KeepUiLabelKey[]) {
      const customLabel = labels?.[key];
      const text = labelOptions?.[key]?.text ?? customLabel;
      if (text !== undefined) resolved[key] = text;
      labelVisibility[key] = labelOptions?.[key]?.visible !== false;
    }
    return {
      locale: locale ?? resolvedLocale,
      labels: resolved,
      labelVisibility,
      customLabels: labels,
      labelOptions,
      labelResolver,
      emitFeedback,
    };
  }, [emitFeedback, labelOptions, labelResolver, labels, locale]);
  return <KeepUiLabelsContext.Provider value={value}>{children}</KeepUiLabelsContext.Provider>;
}

export function useKeepUiLabels(): KeepUiLabelContext {
  return useContext(KeepUiLabelsContext);
}

export function useUiLabel(key: KeepUiLabelKey, override?: string): string {
  const context = useKeepUiLabels();
  return (
    override ??
    context.labelOptions?.[key]?.text ??
    context.customLabels?.[key] ??
    context.labelResolver?.(key, { locale: context.locale }) ??
    context.labels[key]
  );
}

/** Returns whether a localized label should be rendered as visible text. */
export function useUiLabelVisibility(key: KeepUiLabelKey): boolean {
  return useKeepUiLabels().labelVisibility?.[key] ?? true;
}

export function useKeepUiFeedback<TMeta = Record<string, unknown>>() {
  const { emitFeedback } = useKeepUiLabels();
  return useCallback((event: KeepUiFeedbackEvent<TMeta>) => emitFeedback(event), [emitFeedback]);
}

export { getKeepLocaleLabels };
