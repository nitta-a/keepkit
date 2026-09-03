import { useCallback, useRef, useSyncExternalStore } from "react";
import type { KeepStore, KeepStoreState } from "../../features/store/store";

export function useKeepStoreSelector<TMeta, TSelected>(
  store: KeepStore<TMeta>,
  selector: (state: KeepStoreState<TMeta>) => TSelected,
): TSelected {
  const cacheRef = useRef<{
    snapshot: KeepStoreState<TMeta>;
    selector: (state: KeepStoreState<TMeta>) => TSelected;
    selected: TSelected;
  } | null>(null);
  const getSelectedSnapshot = useCallback(() => {
    const snapshot = store.getSnapshot();
    const cached = cacheRef.current;
    if (cached?.snapshot === snapshot && cached.selector === selector) return cached.selected;
    const selected = selector(snapshot);
    cacheRef.current = { snapshot, selector, selected };
    return selected;
  }, [selector, store]);

  return useSyncExternalStore(store.subscribe, getSelectedSnapshot, getSelectedSnapshot);
}
