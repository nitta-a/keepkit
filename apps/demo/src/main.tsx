import type { RemoteSyncDriver } from "@keepkit/core/core";
import { createBrowserStorageAdapter, SyncStorageAdapter } from "@keepkit/core/storage";
import { KeepKitProvider, type KeepThemeName } from "@keepkit/ui";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@keepkit/ui/theme.css";
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
const demoThemes = ["default", "ocean", "forest", "sunset", "lavender"] as const satisfies readonly KeepThemeName[];

function isDemoTheme(value: string): value is (typeof demoThemes)[number] {
  return demoThemes.some((theme) => theme === value);
}

function Demo() {
  const [theme, setTheme] = useState<(typeof demoThemes)[number]>("default");

  return (
    <KeepKitProvider<DemoMeta> storage={storage} theme={theme} mode="light" radius="large">
      <label className="theme-switcher">
        Theme
        <select
          value={theme}
          onChange={(event) => {
            const nextTheme = event.currentTarget.value;
            if (isDemoTheme(nextTheme)) setTheme(nextTheme);
          }}
        >
          {demoThemes.map((name) => (
            <option key={name} value={name}>
              {name[0]?.toUpperCase()}
              {name.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <App />
    </KeepKitProvider>
  );
}

if (!rootElement) {
  throw new Error("The root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
