import { type KeepStorageOperation, KeepStorageSerializationError } from "../items/types";

const optionalFields = new Set([
  "scope",
  "userId",
  "tenantId",
  "order",
  "archived",
  "pinned",
  "lastOpenedAt",
  "collectionId",
  "targetType",
  "note",
  "tags",
  "schemaVersion",
  "revision",
  "metaUpdatedAt",
  "status",
  "statusReason",
  "updatedAt",
  "snapshot",
  "archives",
  "backups",
  "scopes",
  "initialized",
  "capturedAt",
  "issue",
  "item",
  "collection",
  "membership",
  "entity",
  "baseRevision",
  "attempts",
]);

/** Reject values whose JSON representation would silently change or discard data. */
export function serializeKeepStorage(
  value: unknown,
  options: { operation: KeepStorageOperation; storageKey?: string },
): string {
  const ancestors = new Set<object>();
  const visit = (entry: unknown, inMeta: boolean): unknown => {
    if (entry === null || typeof entry === "string" || typeof entry === "boolean") return entry;
    if (typeof entry === "number" && Number.isFinite(entry)) return entry;
    if (typeof entry !== "object" || entry === null) throw new Error("The value cannot be represented in JSON.");
    if (ancestors.has(entry)) throw new Error("Circular references cannot be represented in JSON.");
    ancestors.add(entry);
    try {
      if (Array.isArray(entry)) {
        const result: unknown[] = [];
        for (let index = 0; index < entry.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(entry, index);
          if (!descriptor) throw new Error("Sparse arrays cannot be represented in JSON.");
          if (!("value" in descriptor)) throw new Error("Accessors cannot be represented in JSON.");
          result.push(visit(descriptor.value, inMeta));
        }
        if (
          Reflect.ownKeys(entry).some(
            (key) =>
              typeof key !== "string" ||
              (key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= entry.length)),
          )
        )
          throw new Error("Extra array properties cannot be represented in JSON.");
        return result;
      }
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null)
        throw new Error("Only plain JSON objects are supported.");
      if (Reflect.ownKeys(entry).some((key) => typeof key === "symbol"))
        throw new Error("Symbol keys are unsupported.");
      if (Object.getOwnPropertyNames(entry).some((key) => !Object.getOwnPropertyDescriptor(entry, key)?.enumerable))
        throw new Error("Non-enumerable properties cannot be represented in JSON.");
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(entry).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(entry, key);
        if (!descriptor || !("value" in descriptor)) throw new Error("Accessors cannot be represented in JSON.");
        const field: unknown = descriptor.value;
        if (field === undefined && !inMeta && optionalFields.has(key)) continue;
        Object.defineProperty(result, key, { value: visit(field, inMeta || key === "meta"), enumerable: true });
      }
      return result;
    } finally {
      ancestors.delete(entry);
    }
  };
  try {
    return JSON.stringify(visit(value, false));
  } catch (cause) {
    throw new KeepStorageSerializationError({ ...options, cause });
  }
}
