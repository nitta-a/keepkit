import { useCallback, useState } from "react";
import type { KeepCollectionFeature } from "../../collection/KeepCollection";
import type { KeepWorkspaceModule, KeepWorkspacePreset } from "../KeepWorkspace";

type KeepWorkspaceOptions = {
  preset: KeepWorkspacePreset;
  modules: Partial<Record<KeepWorkspaceModule, boolean>> | undefined;
  recoveryOpen: boolean | undefined;
  onRecoveryOpenChange: ((open: boolean) => void) | undefined;
  onResolveConflicts: (() => void) | undefined;
};

const PRESET_MODULES: Record<KeepWorkspacePreset, Record<KeepWorkspaceModule, boolean>> = {
  basic: { syncStatus: false, undo: false, recovery: false, backup: false, stalePrune: false },
  standard: { syncStatus: false, undo: true, recovery: false, backup: false, stalePrune: false },
  management: { syncStatus: false, undo: true, recovery: false, backup: true, stalePrune: true },
  sync: { syncStatus: true, undo: true, recovery: true, backup: false, stalePrune: false },
};

const PRESET_COLLECTION_FEATURES: Record<KeepWorkspacePreset, Partial<Record<KeepCollectionFeature, boolean>>> = {
  basic: { search: false, sort: false, pagination: false },
  standard: {},
  management: { tagFilter: true, collectionFilter: true, bulkActions: true, pin: true, archive: true },
  sync: {},
};

export function useKeepWorkspace({
  preset,
  modules,
  recoveryOpen,
  onRecoveryOpenChange,
  onResolveConflicts,
}: KeepWorkspaceOptions) {
  const [internalRecoveryOpen, setInternalRecoveryOpen] = useState(false);
  const resolvedModules = { ...PRESET_MODULES[preset], ...modules };
  const setRecoveryOpen = useCallback(
    (open: boolean) => {
      if (recoveryOpen === undefined) setInternalRecoveryOpen(open);
      onRecoveryOpenChange?.(open);
    },
    [onRecoveryOpenChange, recoveryOpen],
  );
  const openRecovery = useCallback(() => {
    onResolveConflicts?.();
    setRecoveryOpen(true);
  }, [onResolveConflicts, setRecoveryOpen]);

  return {
    preset,
    modules: resolvedModules,
    collectionFeatures: PRESET_COLLECTION_FEATURES[preset],
    recoveryOpen: recoveryOpen ?? internalRecoveryOpen,
    setRecoveryOpen,
    openRecovery,
  };
}
