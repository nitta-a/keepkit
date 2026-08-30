import type { ComponentType } from "react";
import { type UseKeepItemResult, useKeepItem } from "./hooks/useKeepItem";
import { type KeepListOptions, type UseKeepListResult, useKeepList } from "./hooks/useKeepList";
import { KeepButton, type KeepButtonProps } from "./KeepButton";
import { KeepProvider, type KeepProviderProps, useKeepContext } from "./KeepProvider";
import type { KeepItemInput } from "./types";

export type KeepKit<TMeta> = {
  KeepProvider: ComponentType<KeepProviderProps<TMeta>>;
  KeepButton: ComponentType<KeepButtonProps<TMeta>>;
  useKeepContext: () => ReturnType<typeof useKeepContext<TMeta>>;
  useKeepItem: (id: string, itemPayload?: KeepItemInput<TMeta>) => UseKeepItemResult<TMeta>;
  useKeepList: (options?: KeepListOptions<TMeta>) => UseKeepListResult<TMeta>;
};

/** Create an app-specific, fully typed set of KeepKit components and hooks. */
export function createKeepKit<TMeta = Record<string, unknown>>(): KeepKit<TMeta> {
  return {
    KeepProvider: (props) => <KeepProvider<TMeta> {...props} />,
    KeepButton: (props) => <KeepButton<TMeta> {...props} />,
    useKeepContext: () => useKeepContext<TMeta>(),
    useKeepItem: (id, itemPayload) => useKeepItem<TMeta>(id, itemPayload),
    useKeepList: (options) => useKeepList<TMeta>(options),
  };
}
