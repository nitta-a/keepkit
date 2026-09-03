import type { KeepListQuery } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { useUiLabel } from "../ui-context";

export function useKeepListView<TMeta>(query: KeepListQuery<TMeta> | undefined) {
  return {
    state: useKeepList<TMeta>(query),
    labels: {
      loading: useUiLabel("loadingItems"),
      empty: useUiLabel("noItems"),
      error: useUiLabel("errorItems"),
    },
  };
}
