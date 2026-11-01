// Uses the framework-neutral entry points from a Node service that does not install React.
import { exportItems, importItems } from "@keepkit/core/core";
import { parseKeepMeta } from "@keepkit/core/schema";
import { createBrowserStorageAdapter, LocalStorageAdapter } from "@keepkit/core/storage";

function createMemoryStorage() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const titleSchema = {
  safeParse(value) {
    if (typeof value === "object" && value !== null && typeof value.title === "string") {
      return { success: true, data: { title: value.title } };
    }
    return { success: false, error: new TypeError("title is required") };
  },
};

const source = new LocalStorageAdapter({ key: "service:items", storage: createMemoryStorage() });
await source.set({ id: "note-1", savedAt: 1, updatedAt: 1, meta: { title: "From the service" } });
const backup = await exportItems(source);

const target = new LocalStorageAdapter({ key: "service:items", storage: createMemoryStorage() });
const imported = await importItems(target, backup);
const restored = await target.getAll();

let schemaError = null;
try {
  await parseKeepMeta(titleSchema, { title: 42 });
} catch (error) {
  schemaError = error?.name ?? String(error);
}

let reactEntry = null;
try {
  await import("@keepkit/core/react");
  reactEntry = "loaded";
} catch (error) {
  reactEntry = error?.code ?? String(error);
}

const result = {
  imported: imported.imported,
  restored: restored.map(({ id, meta }) => ({ id, title: meta.title })),
  parsed: await parseKeepMeta(titleSchema, { title: "Valid", extra: true }),
  schemaError,
  browserFallbackItems: await createBrowserStorageAdapter().getAll(),
  reactEntry,
};
process.stdout.write(JSON.stringify(result));
