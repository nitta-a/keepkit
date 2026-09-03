import { createBrowserStorageAdapter } from "../../storage/index";
import { SyncStorageAdapter } from "../../storage/sync";
import { exportItems } from "../persistence/backup";
import { createScopedStorageAdapter, type KeepScope } from "../persistence/scope";
import type { RemoteSyncDriver, StorageAdapter } from "./types";

export type KeepKitPresetMode = "local" | "sync" | "backup";

export type KeepKitPresetOptions<TMeta = Record<string, unknown>> = {
  mode?: KeepKitPresetMode;
  key?: string;
  scope?: KeepScope;
  remote?: RemoteSyncDriver<TMeta>;
  storage?: StorageAdapter<TMeta>;
};

export type KeepKitSetup<TMeta = Record<string, unknown>> = {
  mode: KeepKitPresetMode;
  scope?: KeepScope;
  storage: StorageAdapter<TMeta>;
  exportBackup: () => Promise<string>;
};

/**
 * Build the recommended local/sync/backup wiring without imposing an auth or
 * API client. Pass the current user and tenant scope whenever the account changes.
 */
export function createKeepKitPreset<TMeta = Record<string, unknown>>(
  options: KeepKitPresetOptions<TMeta> = {},
): KeepKitSetup<TMeta> {
  const mode = options.mode ?? "local";
  const local = options.storage
    ? options.scope
      ? createScopedStorageAdapter(options.storage, options.scope)
      : options.storage
    : createBrowserStorageAdapter<TMeta>({ key: options.key, scope: options.scope });
  if (mode === "sync" && !options.remote) {
    throw new Error('createKeepKitPreset({ mode: "sync" }) requires a remote driver.');
  }
  let storage: StorageAdapter<TMeta> = local;
  if (mode === "sync") {
    const remote = options.remote;
    if (!remote) throw new Error('createKeepKitPreset({ mode: "sync" }) requires a remote driver.');
    storage = new SyncStorageAdapter<TMeta>({
      local,
      remote,
      userId: options.scope?.userId,
      tenantId: options.scope?.tenantId,
    });
  }
  return {
    mode,
    scope: options.scope,
    storage,
    exportBackup: () => exportItems(storage),
  };
}

export const createKeepKitSetup = createKeepKitPreset;
