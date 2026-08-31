import type { KeepItem, StorageAdapter, SyncOperation, SyncQueueAdapter, SyncScope } from "./types";

export type KeepScope = SyncScope;

/** Return a stable, human-readable namespace for browser storage and queues. */
export function getKeepScopeKey(scope?: KeepScope): string {
  if (!scope?.userId && !scope?.tenantId) return "";
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
  readonly storageKey?: string;
  private readonly base: StorageAdapter<TMeta>;
  private readonly scope?: KeepScope;

  constructor(base: StorageAdapter<TMeta>, scope?: KeepScope) {
    this.base = base;
    this.scope = scope;
    const scopeKey = getKeepScopeKey(scope);
    this.storageKey = base.storageKey
      ? base.storageKey.endsWith(scopeKey) && scopeKey
        ? base.storageKey
        : `${base.storageKey}${scopeKey}`
      : undefined;
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    const items = await this.base.getAll();
    return this.scope ? items.filter((item) => isSameKeepScope(item.scope, this.scope)) : items;
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    await this.setMany([item]);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    const current = await this.base.getAll();
    const scoped = items.map((item) => ({ ...item, ...(this.scope ? { scope: this.scope } : {}) }));
    const ids = new Set(scoped.map((item) => item.id));
    const next = current.filter((item) => !ids.has(item.id) || !isSameKeepScope(item.scope, this.scope));
    await writeAll(this.base, [...next, ...scoped]);
  }

  async remove(id: string): Promise<void> {
    const current = await this.base.getAll();
    await writeAll(
      this.base,
      current.filter((item) => item.id !== id || !isSameKeepScope(item.scope, this.scope)),
    );
  }

  async removeMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const current = await this.base.getAll();
    await writeAll(
      this.base,
      current.filter((item) => !idSet.has(item.id) || !isSameKeepScope(item.scope, this.scope)),
    );
  }

  async clear(): Promise<void> {
    const current = await this.base.getAll();
    await writeAll(
      this.base,
      current.filter((item) => !isSameKeepScope(item.scope, this.scope)),
    );
  }

  async merge(items: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    await this.setMany(items);
    return this.getAll();
  }

  subscribe(listener: () => void): () => void {
    return this.base.subscribe?.(listener) ?? (() => undefined);
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

  async getAll(): Promise<SyncOperation<TMeta>[]> {
    const operations = await this.base.getAll();
    return this.scope ? operations.filter((operation) => isSameKeepScope(operation.scope, this.scope)) : operations;
  }

  async setMany(operations: SyncOperation<TMeta>[]): Promise<void> {
    const current = await this.base.getAll();
    const scoped = operations.map((operation) => ({ ...operation, ...(this.scope ? { scope: this.scope } : {}) }));
    const ids = new Set(scoped.map((operation) => operation.operationId));
    await this.base.setMany([
      ...current.filter(
        (operation) => !ids.has(operation.operationId) && !isSameKeepScope(operation.scope, this.scope),
      ),
      ...scoped,
    ]);
  }

  remove(operationIds: string[]): Promise<void> {
    return this.base.remove(operationIds);
  }

  clear(): Promise<void> {
    return this.base
      .getAll()
      .then((operations) =>
        this.base.setMany(operations.filter((operation) => !isSameKeepScope(operation.scope, this.scope))),
      );
  }
}

async function writeAll<TMeta>(base: StorageAdapter<TMeta>, items: KeepItem<TMeta>[]): Promise<void> {
  if (base.setMany) {
    await base.setMany(items);
    return;
  }
  const existing = await base.getAll();
  const ids = new Set(items.map((item) => item.id));
  for (const item of existing) {
    if (!ids.has(item.id)) await base.remove(item.id);
  }
  for (const item of items) await base.set(item);
}
