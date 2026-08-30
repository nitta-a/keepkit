import type { KeepItem, RemoteSyncDriver, RemoteSyncResult, StorageAdapter, SyncOperation } from "@keepkit/core/core";
import { LocalStorageAdapter, SyncStorageAdapter } from "@keepkit/core/storage";

type ArticleMeta = { title: string; url: string };

/** The session cookie is sent automatically; the API route performs auth. */
export function createKeepStorage() {
  const local: StorageAdapter<ArticleMeta> = new LocalStorageAdapter<ArticleMeta>({ key: "example:keep-items" });
  const remote: RemoteSyncDriver<ArticleMeta> = {
    async pull() {
      const response = await fetch("/api/keep", { credentials: "include" });
      if (!response.ok) throw new Error(`Keep API pull failed (${response.status}).`);
      return (await response.json()) as KeepItem<ArticleMeta>[];
    },
    async push(operation: SyncOperation<ArticleMeta>): Promise<RemoteSyncResult<ArticleMeta>> {
      const response = await fetch("/api/keep", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(operation),
      });
      if (!response.ok) throw new Error(`Keep API push failed (${response.status}).`);
      return (await response.json()) as RemoteSyncResult<ArticleMeta>;
    },
  };
  return new SyncStorageAdapter<ArticleMeta>({
    local,
    remote,
  });
}
