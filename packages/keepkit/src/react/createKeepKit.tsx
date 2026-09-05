import type { ComponentType } from "react";
import type { KeepListQuery } from "../features/items/query";
import type { KeepItemInput } from "../features/items/types";
import { KeepButton, type KeepButtonProps } from "./components/KeepButton";
import { KeepProvider, type KeepProviderProps, useKeepContext } from "./components/KeepProvider";
import { type UseKeepCollectionsResult, useKeepCollections } from "./hooks/useKeepCollections";
import { type UseKeepItemResult, useKeepItem } from "./hooks/useKeepItem";
import { type UseKeepListResult, useKeepList } from "./hooks/useKeepList";
import { type UseKeepNavigatorOptions, type UseKeepNavigatorResult, useKeepNavigator } from "./hooks/useKeepNavigator";
import { type KeepShortcutOptions, useKeepShortcut } from "./hooks/useKeepShortcut";

export type CreateKeepKitOptions<TMeta = Record<string, unknown>> = Omit<KeepProviderProps<TMeta>, "children">;

export type KeepKit<TMeta> = {
  Provider: ComponentType<KeepProviderProps<TMeta>>;
  Button: ComponentType<KeepButtonProps<TMeta>>;
  useContext: () => ReturnType<typeof useKeepContext<TMeta>>;
  useItem: (item?: KeepItemInput<TMeta>) => UseKeepItemResult<TMeta>;
  useCollections: (options?: { targetType?: string; orderBy?: "name" | "count" }) => UseKeepCollectionsResult;
  useList: (query?: KeepListQuery<TMeta>) => UseKeepListResult<TMeta>;
  useNavigator: (options?: UseKeepNavigatorOptions<TMeta>) => UseKeepNavigatorResult<TMeta>;
  useShortcut: (options: KeepShortcutOptions<TMeta>) => void;
};

/** Create an app-specific, fully typed set of KeepKit components and hooks. */
export function createKeepKit<TMeta = Record<string, unknown>>(
  options: CreateKeepKitOptions<TMeta> = {},
): KeepKit<TMeta> {
  return {
    Provider: (props) => <KeepProvider<TMeta> {...options} {...props} />,
    Button: (props) => <KeepButton<TMeta> {...props} />,
    useContext: () => useKeepContext<TMeta>(),
    useItem: (item) => useKeepItem<TMeta>(item),
    useCollections: (collectionsOptions) => useKeepCollections<TMeta>(collectionsOptions),
    useList: (query) => useKeepList<TMeta>(query),
    useNavigator: (navigatorOptions) => useKeepNavigator<TMeta>(navigatorOptions),
    useShortcut: (shortcutOptions) => useKeepShortcut<TMeta>(shortcutOptions),
  };
}
