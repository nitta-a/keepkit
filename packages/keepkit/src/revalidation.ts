import type { KeepItem, KeepItemStatus, StorageAdapter } from "./types";

export type { KeepItemStatus } from "./types";

export type KeepItemRevalidationResult<TMeta = Record<string, unknown>> =
  | { status: "available"; meta?: TMeta }
  | { status: Exclude<KeepItemStatus, "available">; reason?: string };

export type KeepItemRevalidator<TMeta = Record<string, unknown>> = (
  item: KeepItem<TMeta>,
) =>
  | KeepItemRevalidationResult<TMeta>
  | KeepItemRevalidationResult<TMeta>["status"]
  | Promise<KeepItemRevalidationResult<TMeta> | KeepItemRevalidationResult<TMeta>["status"]>;

export type KeepItemResolver<TMeta = Record<string, unknown>> = (
  item: KeepItem<TMeta>,
  result: KeepItemRevalidationResult<TMeta>,
) => KeepItem<TMeta> | undefined | Promise<KeepItem<TMeta> | undefined>;

export type KeepItemMetadataRefresher<TMeta = Record<string, unknown>> = (
  item: KeepItem<TMeta>,
) => TMeta | Promise<TMeta>;

/** Return whether source metadata should be fetched again based on its age. */
export function isKeepItemMetadataStale<TMeta>(
  item: KeepItem<TMeta>,
  maxAgeMs: number,
  now: () => number = Date.now,
): boolean {
  return item.metaUpdatedAt === undefined || now() - item.metaUpdatedAt >= maxAgeMs;
}

export type KeepItemRevalidationRecord<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta>;
  status: KeepItemStatus;
  reason?: string;
  updated: boolean;
};

export type RevalidateKeepItemsOptions<TMeta = Record<string, unknown>> = {
  /** Statuses that should be removed after they are detected. Detection is the default. */
  removeStatuses?: Array<Exclude<KeepItemStatus, "available">>;
  now?: () => number;
  resolveItem?: KeepItemResolver<TMeta>;
};

export type KeepItemRevalidationSummary<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  checked: number;
  updated: number;
  removed: number;
  updatedItems: KeepItem<TMeta>[];
  removedIds: string[];
  results: KeepItemRevalidationRecord<TMeta>[];
};

/** Revalidate saved items without coupling the checker to a network client. */
export async function revalidateKeepItems<TMeta = Record<string, unknown>>(
  source: KeepItem<TMeta>[],
  revalidator: KeepItemRevalidator<TMeta>,
  options: RevalidateKeepItemsOptions<TMeta> = {},
): Promise<KeepItemRevalidationSummary<TMeta>> {
  const removeStatuses = new Set(options.removeStatuses ?? []);
  const now = options.now ?? Date.now;
  const items: KeepItem<TMeta>[] = [];
  const updatedItems: KeepItem<TMeta>[] = [];
  const removedIds: string[] = [];
  const results: KeepItemRevalidationRecord<TMeta>[] = [];

  for (const item of source) {
    const rawResult = await revalidator(item);
    const result: KeepItemRevalidationResult<TMeta> = typeof rawResult === "string" ? { status: rawResult } : rawResult;
    const reason = result.status === "available" ? undefined : result.reason;
    const defaultResolved = {
      ...item,
      status: result.status,
      ...(result.status === "available" ? { statusReason: undefined } : { statusReason: reason }),
    };
    const resolved = options.resolveItem
      ? await (options.resolveItem as KeepItemResolver<TMeta>)(item, result)
      : defaultResolved;
    if (resolved === undefined) {
      removedIds.push(item.id);
      results.push({ item, status: result.status, reason, updated: false });
      continue;
    }
    if (result.status === "available") {
      const timestamp = now();
      const availableItem = clearItemStatus(resolved);
      const updated =
        result.meta === undefined
          ? availableItem
          : { ...availableItem, meta: result.meta, metaUpdatedAt: timestamp, updatedAt: timestamp };
      const didUpdate = updated !== item;
      items.push(updated);
      if (didUpdate) updatedItems.push(updated);
      results.push({ item: updated, status: "available", updated: didUpdate });
      continue;
    }

    const withStatus = { ...resolved, status: result.status, ...(reason ? { statusReason: reason } : {}) };
    const shouldRemove = removeStatuses.has(result.status);
    if (shouldRemove) removedIds.push(item.id);
    else items.push(withStatus);
    if (!shouldRemove && withStatus !== item) updatedItems.push(withStatus);
    results.push({ item: withStatus, status: result.status, reason, updated: !shouldRemove && withStatus !== item });
  }

  return {
    items,
    checked: source.length,
    updated: updatedItems.length,
    removed: removedIds.length,
    updatedItems,
    removedIds,
    results,
  };
}

/** Revalidate and persist saved items for framework-neutral applications. */
export async function reconcileKeepItems<TMeta = Record<string, unknown>>(
  storage: StorageAdapter<TMeta>,
  revalidator: KeepItemRevalidator<TMeta>,
  options: RevalidateKeepItemsOptions<TMeta> = {},
): Promise<KeepItemRevalidationSummary<TMeta>> {
  const source = await storage.getAll();
  const summary = await revalidateKeepItems(source, revalidator, options);
  if (summary.updatedItems.length > 0) await persistItems(storage, summary.updatedItems);
  if (summary.removedIds.length > 0) await removeItems(storage, summary.removedIds);
  return summary;
}

async function persistItems<TMeta>(storage: StorageAdapter<TMeta>, items: KeepItem<TMeta>[]): Promise<void> {
  if (storage.setMany) {
    await storage.setMany(items);
    return;
  }
  for (const item of items) await storage.set(item);
}

async function removeItems<TMeta>(storage: StorageAdapter<TMeta>, ids: string[]): Promise<void> {
  if (storage.removeMany) {
    await storage.removeMany(ids);
    return;
  }
  for (const id of ids) await storage.remove(id);
}

function clearItemStatus<TMeta>(item: KeepItem<TMeta>): KeepItem<TMeta> {
  const next = { ...item };
  delete next.status;
  delete next.statusReason;
  return next;
}
