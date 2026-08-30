"use client";

export type { CreateKeepKitOptions, KeepKit } from "./createKeepKit";
export { createKeepKit } from "./createKeepKit";
/** React bindings for the framework-neutral KeepKit primitives. */
export type { UseKeepItemResult } from "./hooks/useKeepItem";
export { useKeepItem } from "./hooks/useKeepItem";
export type { KeepListOptions, UseKeepListResult } from "./hooks/useKeepList";
export {
  getTagCounts,
  type QueryKeepItemsResult,
  queryKeepItems,
  useKeepList,
} from "./hooks/useKeepList";
export type { KeepShortcutModifier, KeepShortcutOptions } from "./hooks/useKeepShortcut";
export { useKeepShortcut } from "./hooks/useKeepShortcut";
export type { KeepButtonItem, KeepButtonProps, KeepButtonState } from "./KeepButton";
export { KeepButton } from "./KeepButton";
export type { KeepContextValue, KeepProviderProps } from "./KeepProvider";
export { KeepProvider, useKeepContext, useKeepStore } from "./KeepProvider";
