import {
  createAuthenticatedSyncKit,
  isKeepSyncAuthError,
  type KeepItem,
  type KeepSchema,
  type RemoteSyncDriver,
  type StorageAdapter,
} from "@keepkit/core/core";
import { parseKeepMeta } from "@keepkit/core/schema";
import { LocalStorageAdapter, SyncStorageAdapter } from "@keepkit/core/storage";

type NoteMeta = { title: string };

const schema: KeepSchema<NoteMeta> = {
  parse(value: unknown): NoteMeta {
    if (typeof value !== "object" || value === null || !("title" in value) || typeof value.title !== "string") {
      throw new TypeError("title is required");
    }
    return { title: value.title };
  },
};

const local: StorageAdapter<NoteMeta> = new LocalStorageAdapter<NoteMeta>({ key: "service" });
const remote: RemoteSyncDriver<NoteMeta> = {
  push: async (operation) => ({ type: "synced", revision: `rev-${operation.operationId}` }),
  pull: async () => [],
};

export const adapter = new SyncStorageAdapter<NoteMeta>({ local, remote, maxRetries: 2 });
export const kit = createAuthenticatedSyncKit<NoteMeta>({
  local,
  getAuthToken: async () => null,
  transport: { push: async () => ({ type: "synced" }) },
  onAuthError: (error) => {
    const status: number | undefined = error.status;
    void status;
  },
});

export async function readTitle(item: KeepItem<NoteMeta>): Promise<string> {
  const meta = await parseKeepMeta(schema, item.meta);
  return meta.title;
}

export function describeError(error: unknown): string {
  return isKeepSyncAuthError(error) ? `auth:${error.status}` : "other";
}
