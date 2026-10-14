import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepProvider, useKeepContext } from "@keepkit/core/react";
import {
  createBrowserStorageAdapter,
  IndexedDBAdapter,
  LocalStorageAdapter,
  LocalStorageRecoveryJournal,
} from "@keepkit/core/storage";
import { KeepBulkActions, KeepFallbackRecovery, KeepItemCard, KeepUiProvider, KeepUndo } from "@keepkit/ui";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

type FixtureMeta = { title: string; value?: unknown };
type Recovery = NonNullable<StorageAdapter<FixtureMeta>["recovery"]>;
export type FixtureFaults = {
  primary?: boolean;
  mirror?: boolean;
  journal?: boolean;
  primaryWritesBeforeFailure?: number | null;
};
const scopeId = new URLSearchParams(location.search).get("scope") ?? "reader";
const showRecovery = new URLSearchParams(location.search).has("recovery");
const scope = { userId: scopeId };
const baseKey = "keepkit:browser-fixture";
const faultsKey = `keepkit:browser-faults:${scopeId}`;
let primaryWrites = 0;
let journalStorageKey: string | undefined;

function getFaults(): FixtureFaults {
  const value: unknown = JSON.parse(sessionStorage.getItem(faultsKey) ?? "{}");
  if (!value || typeof value !== "object") throw new Error("Invalid fixture fault controls.");
  return {
    primary: "primary" in value && value.primary === true,
    mirror: "mirror" in value && value.mirror === true,
    journal: "journal" in value && value.journal === true,
    primaryWritesBeforeFailure:
      "primaryWritesBeforeFailure" in value && typeof value.primaryWritesBeforeFailure === "number"
        ? value.primaryWritesBeforeFailure
        : null,
  };
}

function checkPrimary() {
  if (getFaults().primary) throw new DOMException("Simulated IndexedDB outage", "InvalidStateError");
}

// The backend stays native. Only availability errors are injected at its boundary.
function faultDatabase(database: IDBDatabase): IDBDatabase {
  return new Proxy(database, {
    get(target, key) {
      if (key === "transaction") {
        return (...args: Parameters<IDBDatabase["transaction"]>) => {
          checkPrimary();
          const faults = getFaults();
          if (args[1] === "readwrite" && faults.primaryWritesBeforeFailure != null) {
            if (faults.primaryWritesBeforeFailure === 0)
              throw new DOMException("Simulated write outage", "InvalidStateError");
            sessionStorage.setItem(
              faultsKey,
              JSON.stringify({ ...faults, primaryWritesBeforeFailure: faults.primaryWritesBeforeFailure - 1 }),
            );
          }
          if (args[1] === "readwrite") primaryWrites += 1;
          return target.transaction(...args);
        };
      }
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

const faultIndexedDB = new Proxy(indexedDB, {
  get(target, key) {
    if (key === "open") {
      return (...args: Parameters<IDBFactory["open"]>) => {
        checkPrimary();
        const request = target.open(...args);
        return new Proxy(request, {
          get(requestTarget, requestKey) {
            if (requestKey === "result") return faultDatabase(requestTarget.result);
            const value = Reflect.get(requestTarget, requestKey, requestTarget);
            return typeof value === "function" ? value.bind(requestTarget) : value;
          },
          set(requestTarget, requestKey, value) {
            return Reflect.set(requestTarget, requestKey, value, requestTarget);
          },
        });
      };
    }
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

const faultStorage = new Proxy(localStorage, {
  get(target, key) {
    if (key === "getItem") {
      return (storageKey: string) => {
        if (storageKey.startsWith(baseKey) && storageKey.includes(":recovery:")) journalStorageKey ??= storageKey;
        return target.getItem(storageKey);
      };
    }
    if (key === "setItem") {
      return (storageKey: string, value: string) => {
        const faults = getFaults();
        if (storageKey.startsWith(baseKey)) {
          const journal = storageKey === journalStorageKey;
          if ((journal && faults.journal) || (!journal && faults.mirror)) {
            throw new DOMException("Simulated localStorage quota failure", "QuotaExceededError");
          }
        }
        target.setItem(storageKey, value);
      };
    }
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

const storage = createBrowserStorageAdapter<FixtureMeta>({
  key: baseKey,
  scope,
  indexedDB: faultIndexedDB,
  storage: faultStorage,
});
const primary = new IndexedDBAdapter<FixtureMeta>();
let refreshProvider: (() => Promise<void>) | undefined;
let observer: { controller: Recovery; unsubscribe: () => void; notifications: number } | undefined;

function item(id: string, title = id): KeepItem<FixtureMeta> {
  return { id, meta: { title }, tags: ["article"], savedAt: 1, updatedAt: 1 };
}

async function read() {
  return {
    items: await storage.getAll(),
    collections: (await storage.getCollections?.()) ?? [],
    memberships: (await storage.getCollectionMemberships?.()) ?? [],
  };
}

function recovery(): Recovery {
  if (!storage.recovery) throw new Error("The fixture adapter must expose recovery.");
  return storage.recovery;
}

export const fixtureApi = {
  observeRecovery() {
    observer?.unsubscribe();
    const adapter = createBrowserStorageAdapter<FixtureMeta>({
      key: baseKey,
      scope,
      indexedDB: faultIndexedDB,
      storage: faultStorage,
    });
    if (!adapter.recovery) throw new Error("Missing observer recovery state.");
    const controller = adapter.recovery;
    observer = { controller, unsubscribe: () => undefined, notifications: 0 };
    observer.unsubscribe = controller.subscribe(() => {
      if (observer) observer.notifications += 1;
    });
  },
  getObservedState() {
    if (!observer) throw new Error("The state observer has not started.");
    return { ...observer.controller.getState(), notifications: observer.notifications };
  },
  getPrimaryWrites() {
    return primaryWrites;
  },
  setFaults(faults: FixtureFaults) {
    sessionStorage.setItem(faultsKey, JSON.stringify({ ...getFaults(), ...faults }));
  },
  read,
  async readPrimary() {
    return {
      items: (await primary.getAll()).filter((value) => value.scope?.userId === scopeId),
      collections: (await primary.getCollections()).filter((value) => value.scope?.userId === scopeId),
      memberships: (await primary.getCollectionMemberships()).filter((value) => value.scope?.userId === scopeId),
    };
  },
  async save(id: string, title?: string) {
    await storage.set(item(id, title));
  },
  async saveNonJson(id: string, kind: "bigint" | "cycle") {
    const meta: FixtureMeta = { title: kind };
    if (kind === "bigint") meta.value = 12n;
    else {
      const cyclic: { self?: unknown } = {};
      cyclic.self = cyclic;
      meta.value = cyclic;
    }
    await storage.set({ ...item(id), meta });
  },
  remove(id: string) {
    return storage.remove(id);
  },
  clear() {
    return storage.clear();
  },
  async saveCollection(id: string, name: string) {
    if (!storage.setCollection) throw new Error("Missing collection storage.");
    await storage.setCollection({ id, name });
  },
  async saveMembership(collectionId: string, itemId: string) {
    if (!storage.setCollectionMembership) throw new Error("Missing membership storage.");
    await storage.setCollectionMembership({ collectionId, itemId, order: 0 });
  },
  async removeCollection(id: string) {
    if (!storage.removeCollection) throw new Error("Missing collection storage.");
    await storage.removeCollection(id);
  },
  async seedFallback(id: string, title: string) {
    const fallback = new LocalStorageAdapter<FixtureMeta>({ key: storage.storageKey });
    await fallback.set({ ...item(id, title), scope });
  },
  async seedFallbackCollection(id: string, name: string) {
    const fallback = new LocalStorageAdapter<FixtureMeta>({ key: storage.storageKey });
    await fallback.setCollection({ id, name, scope });
  },
  seedLegacyRecovery() {
    if (!journalStorageKey) throw new Error("The fixture journal has not initialized.");
    const legacyKey = `${storage.storageKey}:recovery:${encodeURIComponent("keepkit:items")}`;
    localStorage.setItem(
      legacyKey,
      JSON.stringify({
        version: 1,
        operations: [
          { type: "removeItems", ids: ["removed"], scope },
          { type: "setItems", items: [{ ...item("v1-new", "Pending v1 item"), scope }] },
          { type: "setCollection", collection: { id: "legacy", name: "Pending v1 collection", scope } },
          { type: "setMembership", membership: { collectionId: "legacy", itemId: "v1-new", order: 0, scope } },
        ],
      }),
    );
    localStorage.removeItem(journalStorageKey);
    return legacyKey;
  },
  readCurrentJournal() {
    if (!journalStorageKey) throw new Error("The fixture journal has not initialized.");
    return new LocalStorageRecoveryJournal<FixtureMeta>(journalStorageKey, localStorage).read();
  },
  getRecoveryState() {
    return recovery().getState();
  },
  inspect: (options?: Parameters<NonNullable<Recovery["inspect"]>>[0]) => {
    const controller = recovery();
    if (!controller.inspect) throw new Error("Recovery inspection is unavailable.");
    return controller.inspect(options);
  },
  apply: (options: Parameters<NonNullable<Recovery["apply"]>>[0]) => {
    const controller = recovery();
    if (!controller.apply) throw new Error("Recovery application is unavailable.");
    return controller.apply(options);
  },
  retry() {
    const controller = recovery();
    if (!controller.retry) throw new Error("Recovery retry is unavailable.");
    return controller.retry();
  },
  async refreshUi() {
    if (!refreshProvider) throw new Error("The fixture UI has not hydrated.");
    await refreshProvider();
  },
};

export type FixtureApi = typeof fixtureApi;
declare global {
  interface Window {
    keepkitFixture: FixtureApi;
  }
}
window.keepkitFixture = fixtureApi;

function FixtureUi() {
  const { items, refresh, isLoading } = useKeepContext<FixtureMeta>();
  const [opened, setOpened] = useState(0);
  const [selectedIds, setSelectedIds] = useState(["alpha", "beta"]);
  useEffect(() => {
    refreshProvider = refresh;
    return () => {
      refreshProvider = undefined;
    };
  }, [refresh]);
  return (
    <main>
      <h1>KeepKit browser regression fixture</h1>
      <output data-testid="hydrated">{isLoading ? "loading" : "ready"}</output>
      <output data-testid="opened">{opened}</output>
      <section aria-label="Custom cards">
        {items.map((value) => (
          <KeepItemCard
            key={value.id}
            item={value}
            href="#opened"
            trackOpen
            showPinButton
            onOpen={() => setOpened((count) => count + 1)}
          >
            <KeepItemCard.Link>
              <KeepItemCard.Content />
            </KeepItemCard.Link>
            <KeepItemCard.Tags />
            <KeepItemCard.Actions />
          </KeepItemCard>
        ))}
      </section>
      <KeepBulkActions
        query={{ pagination: { page: 1, pageSize: 1 } }}
        confirmRemoval
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
      />
      <KeepUndo />
      {showRecovery && storage.recovery ? <KeepFallbackRecovery recovery={storage.recovery} /> : null}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root.");
createRoot(root).render(
  <KeepUiProvider locale="en">
    <KeepProvider storage={storage}>
      <FixtureUi />
    </KeepProvider>
  </KeepUiProvider>,
);
