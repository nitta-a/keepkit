import type { RemoteSyncDriver } from "@keepkit/core/core";
import { createBrowserStorageAdapter, SyncStorageAdapter } from "@keepkit/core/storage";
import { KeepKitProvider } from "@keepkit/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

export type DemoMeta = {
  title: string;
  url: string;
  image: string;
  description: string;
  price?: string;
  company?: string;
  location?: string;
  salary?: string;
};

const localStorage = createBrowserStorageAdapter<DemoMeta>({
  key: "keepkit-demo:items",
  databaseName: "keepkit-demo",
});
const remote: RemoteSyncDriver<DemoMeta> = {
  async push(operation) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("The demo is offline; the operation remains queued.");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { type: "synced", ...(operation.item ? { item: operation.item } : {}) };
  },
  pull: async () => [],
};
const storage = new SyncStorageAdapter({ local: localStorage, remote });
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <KeepKitProvider<DemoMeta> storage={storage}>
      <App />
    </KeepKitProvider>
  </StrictMode>,
);
