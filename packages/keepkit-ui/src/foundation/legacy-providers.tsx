"use client";

import { getKeepLocaleLabels } from "../locales";
import { KeepKitProvider as BaseKeepKitProvider, type KeepKitProviderProps } from "./KeepKitProvider";
import { KeepUiProvider as BaseKeepUiProvider, type KeepUiProviderProps } from "./ui-context";

export function KeepUiProvider<TMeta = Record<string, unknown>>(props: KeepUiProviderProps<TMeta>) {
  return <BaseKeepUiProvider {...props} dictionary={props.dictionary ?? getKeepLocaleLabels(props.locale)} />;
}

export function KeepKitProvider<TMeta = Record<string, unknown>>(props: KeepKitProviderProps<TMeta>) {
  return <BaseKeepKitProvider {...props} dictionary={props.dictionary ?? getKeepLocaleLabels(props.locale)} />;
}
