import type { RemoteSyncDriver } from "@keepkit/core/core";
import { createBrowserStorageAdapter, SyncStorageAdapter } from "@keepkit/core/storage";
import { KeepKitProvider } from "@keepkit/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@keepkit/ui/theme.css";
import "./styles.css";

export type DemoMeta = {
  title: string;
  url: string;
  description: string;
  image: string;
  collection: string;
};

const local = createBrowserStorageAdapter<DemoMeta>({
  key: "keepkit-collection-demo:items",
  databaseName: "keepkit-collection-demo",
});
const remote: RemoteSyncDriver<DemoMeta> = {
  push: async (operation) => ({ type: "synced", ...(operation.item ? { item: operation.item } : {}) }),
  pull: async () => [],
};
const storage = new SyncStorageAdapter({ local, remote });
const rootElement = document.getElementById("root");

if (!rootElement) throw new Error("The demo root element is missing.");

createRoot(rootElement).render(
  <StrictMode>
    <KeepKitProvider<DemoMeta> storage={storage} theme="ocean" mode="light" radius="medium">
      <App />
    </KeepKitProvider>
  </StrictMode>,
);
