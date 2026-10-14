import type { KeepStorageRecovery } from "../../storage/recovery-journal";
import type {
  KeepCollectionDefinition,
  KeepCollectionMembership,
  KeepItem,
  KeepSyncQueueOperation,
  StorageAdapter,
  SyncQueueAdapter,
  SyncScope,
} from "../items/types";
import { mergeKeepItemLists } from "./helpers";

export type KeepScope = SyncScope;

/** Return a stable, human-readable namespace for browser storage and queues. */
export function getKeepScopeKey(scope?: KeepScope): string {
  if (scope?.userId === undefined && scope?.tenantId === undefined) return "";
  return `:${encodeURIComponent(scope.tenantId ?? "_")}:${encodeURIComponent(scope.userId ?? "_")}`;
}

export function isSameKeepScope(left: KeepScope | undefined, right: KeepScope | undefined): boolean {
  return left?.userId === right?.userId && left?.tenantId === right?.tenantId;
}

/**
 * Adds an isolated user/tenant view over any StorageAdapter. Writes preserve
 * records belonging to other scopes, which makes account switching safe even
 * when applications share one physical localStorage key.
 */
export class ScopedStorageAdapter<TMeta = Record<string, unknown>> implements StorageAdapter<TMeta> {
  readonly scope?: KeepScope;
  readonly storageKey?: string;
  readonly recovery?: KeepStorageRecovery<TMeta>;
  readonly getCollections?: () => Promise<KeepCollectionDefinition[]>;
  readonly setCollection?: (collection: KeepCollectionDefinition) => Promise<void>;
  readonly removeCollection?: (id: string, scope?: SyncScope) => Promise<void>;
  readonly getCollectionMemberships?: () => Promise<KeepCollectionMembership[]>;
  readonly setCollectionMembership?: (membership: KeepCollectionMembership) => Promise<void>;
  readonly removeCollectionMembership?: (collectionId: string, itemId: string, scope?: SyncScope) => Promise<void>;
  private readonly base: StorageAdapter<TMeta>;

  constructor(base: StorageAdapter<TMeta>, scope?: KeepScope) {
    this.base = base;
    this.scope = scope;
    if (base.recovery && isSameKeepScope(base.scope, scope)) this.recovery = base.recovery;
    const scopeKey = getKeepScopeKey(scope);
    this.storageKey = base.storageKey
      ? base.storageKey.endsWith(scopeKey) && scopeKey
        ? base.storageKey
        : `${base.storageKey}${scopeKey}`
      : undefined;
    if (base.getCollections && base.setCollection && base.removeCollection) {
      const getCollections = base.getCollections.bind(base);
      const setCollection = base.setCollection.bind(base);
      const removeCollection = base.removeCollection.bind(base);
      this.getCollections = async () => {
        const collections = await getCollections();
        return this.scope
          ? collections.filter((collection) => isSameKeepScope(collection.scope, this.scope))
          : collections;
      };
      this.setCollection = async (collection) => {
        this.assertWritableScope();
        await setCollection({ ...collection, ...(this.scope ? { scope: this.scope } : {}) });
      };
      this.removeCollection = async (id) => {
        this.assertWritableScope();
        await removeCollection(id, this.scope);
      };
    }
    if (base.getCollectionMemberships && base.setCollectionMembership && base.removeCollectionMembership) {
      const getMemberships = base.getCollectionMemberships.bind(base);
      const setMembership = base.setCollectionMembership.bind(base);
      const removeMembership = base.removeCollectionMembership.bind(base);
      this.getCollectionMemberships = async () => {
        const memberships = await getMemberships();
        return this.scope
          ? memberships.filter((membership) => isSameKeepScope(membership.scope, this.scope))
          : memberships;
      };
      this.setCollectionMembership = async (membership) => {
        this.assertWritableScope();
        await setMembership({ ...membership, ...(this.scope ? { scope: this.scope } : {}) });
      };
      this.removeCollectionMembership = async (collectionId, itemId) => {
        this.assertWritableScope();
        await removeMembership(collectionId, itemId, this.scope);
      };
    }
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    const items = await this.base.getAll();
    return this.scope ? items.filter((item) => isSameKeepScope(item.scope, this.scope)) : items;
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    await this.setMany([item]);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    this.assertWritableScope();
    const scoped = items.map((item) => ({ ...item, ...(this.scope ? { scope: this.scope } : {}) }));
    if (this.base.setMany) await this.base.setMany(scoped);
    else for (const item of scoped) await this.base.set(item);
  }

  async remove(id: string): Promise<void> {
    this.assertWritableScope();
    await this.base.remove(id, this.scope);
    await this.removeMembershipsForItems([id]);
  }

  async removeMany(ids: string[]): Promise<void> {
    this.assertWritableScope();
    const uniqueIds = [...new Set(ids)];
    if (this.base.removeMany) await this.base.removeMany(uniqueIds, this.scope);
    else for (const id of uniqueIds) await this.base.remove(id, this.scope);
    await this.removeMembershipsForItems(uniqueIds);
  }

  async clear(): Promise<void> {
    this.assertWritableScope();
    const removedIds = (await this.getAll()).map((item) => item.id);
    await this.removeMany(removedIds);
    await this.clearMembershipsForScope();
  }

  async merge(items: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    this.assertWritableScope();
    const scopedItems = items.map((item) => ({ ...item, ...(this.scope ? { scope: this.scope } : {}) }));
    const merged = mergeKeepItemLists(await this.getAll(), scopedItems);
    await this.setMany(merged);
    return merged;
  }

  subscribe(listener: () => void): () => void {
    return this.base.subscribe?.(listener) ?? (() => undefined);
  }

  private assertWritableScope(): void {
    if (this.base.scope && this.scope && !isSameKeepScope(this.base.scope, this.scope))
      throw new Error("Cannot write through an adapter bound to a different storage scope.");
  }

  private async removeMembershipsForItems(ids: string[]): Promise<void> {
    if (!this.base.getCollectionMemberships || !this.base.removeCollectionMembership || ids.length === 0) return;
    const removedIds = new Set(ids);
    const memberships = await this.base.getCollectionMemberships();
    for (const membership of memberships) {
      if (removedIds.has(membership.itemId) && isSameKeepScope(membership.scope, this.scope)) {
        await this.base.removeCollectionMembership(membership.collectionId, membership.itemId, this.scope);
      }
    }
  }

  private async clearMembershipsForScope(): Promise<void> {
    if (!this.base.getCollectionMemberships || !this.base.removeCollectionMembership) return;
    const memberships = await this.base.getCollectionMemberships();
    for (const membership of memberships) {
      if (isSameKeepScope(membership.scope, this.scope)) {
        await this.base.removeCollectionMembership(membership.collectionId, membership.itemId, this.scope);
      }
    }
  }
}

export function createScopedStorageAdapter<TMeta = Record<string, unknown>>(
  base: StorageAdapter<TMeta>,
  scope?: KeepScope,
): ScopedStorageAdapter<TMeta> {
  return new ScopedStorageAdapter(base, scope);
}

/** Scope a durable synchronization queue so a user switch cannot flush another user's operations. */
export class ScopedSyncQueueAdapter<TMeta = Record<string, unknown>> implements SyncQueueAdapter<TMeta> {
  private readonly base: SyncQueueAdapter<TMeta>;
  private readonly scope?: KeepScope;

  constructor(base: SyncQueueAdapter<TMeta>, scope?: KeepScope) {
    this.base = base;
    this.scope = scope;
  }

  async getAll(): Promise<KeepSyncQueueOperation<TMeta>[]> {
    const operations = await this.base.getAll();
    return this.scope ? operations.filter((operation) => isSameKeepScope(operation.scope, this.scope)) : operations;
  }

  async setMany(operations: KeepSyncQueueOperation<TMeta>[]): Promise<void> {
    const current = await this.base.getAll();
    const scoped = operations.map((operation) => ({ ...operation, ...(this.scope ? { scope: this.scope } : {}) }));
    const ids = new Set(scoped.map((operation) => operation.operationId));
    await this.base.setMany([
      ...current.filter(
        (operation) => !ids.has(operation.operationId) || !isSameKeepScope(operation.scope, this.scope),
      ),
      ...scoped,
    ]);
  }

  async remove(operationIds: string[]): Promise<void> {
    const ids = new Set(operationIds);
    const scopedIds = (await this.base.getAll())
      .filter((operation) => ids.has(operation.operationId) && isSameKeepScope(operation.scope, this.scope))
      .map((operation) => operation.operationId);
    await this.base.remove(scopedIds);
  }

  async clear(): Promise<void> {
    const operationIds = (await this.base.getAll())
      .filter((operation) => isSameKeepScope(operation.scope, this.scope))
      .map((operation) => operation.operationId);
    await this.base.remove(operationIds);
  }
}
