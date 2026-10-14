import type { KeepListQuery } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { useUiLabel } from "../../../foundation/ui-context";
import { reorderVisibleItems } from "./reorderVisibleItems";

export function useKeepListView<TMeta>(query: KeepListQuery<TMeta> | undefined) {
  const state = useKeepList<TMeta>(query);
  const allState = useKeepList<TMeta>({ archiveScope: "all" });
  return {
    state,
    allState,
    reorder: (orderedIds: string[]) => state.reorder(reorderVisibleItems(allState.items, orderedIds)),
    labels: {
      loading: useUiLabel("loadingItems"),
      empty: useUiLabel("noItems"),
      error: useUiLabel("errorItems"),
    },
  };
}
