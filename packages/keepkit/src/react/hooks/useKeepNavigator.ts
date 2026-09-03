import { useCallback, useMemo, useState } from "react";
import { getKeepNavigationState, type KeepNavigationState } from "../../features/items/navigation";
import { type KeepListQuery, queryKeepItems } from "../../features/items/query";
import type { KeepItem } from "../../features/items/types";
import { useKeepStore } from "../components/KeepProvider";
import { useKeepStoreSelector } from "./useKeepStoreSelector";

export type UseKeepNavigatorOptions<TMeta = Record<string, unknown>> = {
  currentId?: string;
  initialIndex?: number;
  query?: Omit<KeepListQuery<TMeta>, "pagination">;
};

export type UseKeepNavigatorResult<TMeta = Record<string, unknown>> = KeepNavigationState<TMeta> & {
  goToNext: () => KeepItem<TMeta> | null;
  goToPrev: () => KeepItem<TMeta> | null;
  goToIndex: (index: number) => KeepItem<TMeta> | null;
  goToItem: (id: string) => KeepItem<TMeta> | null;
};

/** Derive a stable previous/current/next view and pointer actions from the provider store. */
export function useKeepNavigator<TMeta = Record<string, unknown>>(
  options: UseKeepNavigatorOptions<TMeta> = {},
): UseKeepNavigatorResult<TMeta> {
  const { store } = useKeepStore<TMeta>();
  const { currentId, initialIndex = 0, query } = options;
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, Math.floor(initialIndex)));
  const queryOptions = useMemo(() => ({ ...query, pagination: undefined }), [query]);
  const selector = useMemo(() => {
    let previousSource: KeepItem<TMeta>[] | undefined;
    let previousItems: KeepItem<TMeta>[] | undefined;
    let previousPointer: string | number | undefined;
    let previousResult: KeepNavigationState<TMeta> | undefined;
    return (state: { items: KeepItem<TMeta>[] }) => {
      if (previousSource !== state.items) {
        previousSource = state.items;
        previousItems = queryKeepItems(state.items, queryOptions).items;
        previousResult = undefined;
      }
      const items = previousItems ?? [];
      const pointer = currentId ?? activeIndex;
      if (previousResult && previousPointer === pointer) return previousResult;
      previousPointer = pointer;
      previousResult = getKeepNavigationState(items, pointer);
      return previousResult;
    };
  }, [activeIndex, currentId, queryOptions]);
  const navigation = useKeepStoreSelector(store, selector);

  const goToIndex = useCallback(
    (index: number) => {
      const item = navigation.items[index];
      if (!item) return null;
      setActiveIndex(index);
      return item;
    },
    [navigation.items],
  );
  const goToNext = useCallback(() => {
    if (!navigation.nextItem) return null;
    setActiveIndex(navigation.currentIndex + 1);
    return navigation.nextItem;
  }, [navigation.currentIndex, navigation.nextItem]);
  const goToPrev = useCallback(() => {
    if (!navigation.prevItem) return null;
    setActiveIndex(navigation.currentIndex - 1);
    return navigation.prevItem;
  }, [navigation.currentIndex, navigation.prevItem]);
  const goToItem = useCallback(
    (id: string) => {
      const index = navigation.items.findIndex((item) => item.id === id);
      return index < 0 ? null : goToIndex(index);
    },
    [goToIndex, navigation.items],
  );

  return { ...navigation, goToNext, goToPrev, goToIndex, goToItem };
}
