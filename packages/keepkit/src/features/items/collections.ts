import type { KeepCollectionMembership, KeepItem, StorageAdapter } from "./types";

const collectionMutationQueues = new WeakMap<object, Promise<unknown>>();

export async function getKeepCollectionItems<TMeta>(
  storage: StorageAdapter<TMeta>,
  collectionId: string,
): Promise<KeepItem<TMeta>[]> {
  const memberships = await requireMemberships(storage);
  const items = await storage.getAll();
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return memberships
    .filter((membership) => membership.collectionId === collectionId)
    .sort((left, right) => left.order - right.order)
    .flatMap((membership) => {
      const item = itemsById.get(membership.itemId);
      return item ? [item] : [];
    });
}

export async function addKeepItemToCollection<TMeta>(
  storage: StorageAdapter<TMeta>,
  collectionId: string,
  itemId: string,
  order?: number,
): Promise<KeepCollectionMembership> {
  return withCollectionMutationLock(storage, async () => {
    if (!(await storage.getAll()).some((item) => item.id === itemId)) {
      throw new Error(`KeepKit cannot add missing item "${itemId}" to a collection.`);
    }
    const collectionMemberships = (await requireMemberships(storage))
      .filter((membership) => membership.collectionId === collectionId)
      .filter((membership) => membership.itemId !== itemId)
      .sort((left, right) => left.order - right.order);
    const insertionIndex = order ?? collectionMemberships.length;
    if (!Number.isInteger(insertionIndex) || insertionIndex < 0) {
      throw new RangeError("Collection order must be a non-negative integer.");
    }
    collectionMemberships.splice(Math.min(insertionIndex, collectionMemberships.length), 0, {
      collectionId,
      itemId,
      order: insertionIndex,
    });
    const reordered = collectionMemberships.map((membership, index) => ({ ...membership, order: index }));
    for (const membership of reordered) await storage.setCollectionMembership?.(membership);
    const added = reordered.find((membership) => membership.itemId === itemId);
    if (!added) throw new Error("KeepKit failed to add the collection membership.");
    return added;
  });
}

export async function removeKeepItemFromCollection<TMeta>(
  storage: StorageAdapter<TMeta>,
  collectionId: string,
  itemId: string,
): Promise<void> {
  await withCollectionMutationLock(storage, async () => {
    const memberships = await requireMemberships(storage);
    await storage.removeCollectionMembership?.(collectionId, itemId);
    const remaining = memberships
      .filter((membership) => membership.collectionId === collectionId && membership.itemId !== itemId)
      .sort((left, right) => left.order - right.order)
      .map((membership, order) => ({ ...membership, order }));
    for (const membership of remaining) await storage.setCollectionMembership?.(membership);
  });
}

/** Reorders only the requested collection and leaves other course membership orders untouched. */
export async function reorderKeepCollectionItems<TMeta>(
  storage: StorageAdapter<TMeta>,
  collectionId: string,
  itemIds: string[],
): Promise<KeepCollectionMembership[]> {
  return withCollectionMutationLock(storage, async () => {
    const allMemberships = await requireMemberships(storage);
    const current = allMemberships
      .filter((membership) => membership.collectionId === collectionId)
      .sort((left, right) => left.order - right.order);
    const currentIds = new Set(current.map((membership) => membership.itemId));
    const orderedIds = [...itemIds.filter((id, index) => currentIds.has(id) && itemIds.indexOf(id) === index)];
    for (const membership of current) {
      if (!orderedIds.includes(membership.itemId)) orderedIds.push(membership.itemId);
    }
    const currentByItemId = new Map(current.map((membership) => [membership.itemId, membership]));
    const reordered = orderedIds.map((itemId, order) => ({
      ...(currentByItemId.get(itemId) ?? {}),
      collectionId,
      itemId,
      order,
    }));
    for (const membership of reordered) await storage.setCollectionMembership?.(membership);
    return reordered;
  });
}

function withCollectionMutationLock<TMeta, TResult>(
  storage: StorageAdapter<TMeta>,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  const previous = collectionMutationQueues.get(storage) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  collectionMutationQueues.set(storage, next);
  return next.finally(() => {
    if (collectionMutationQueues.get(storage) === next) collectionMutationQueues.delete(storage);
  });
}

async function requireMemberships<TMeta>(storage: StorageAdapter<TMeta>): Promise<KeepCollectionMembership[]> {
  if (!storage.getCollectionMemberships || !storage.setCollectionMembership || !storage.removeCollectionMembership) {
    throw new Error("KeepKit storage adapter does not support collection memberships.");
  }
  return storage.getCollectionMemberships();
}
