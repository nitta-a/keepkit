import type { RemoteSyncDriver } from "@keepkit/core/core";
import { createBrowserStorageAdapter, SyncStorageAdapter } from "@keepkit/core/storage";
import {
  type KeepCollectionRevealResult,
  KeepKitProvider,
  type KeepThemeName,
  type KeepToastFeedbackOptions,
  type KeepUiFeedbackEvent,
  useKeepToastFeedback,
} from "@keepkit/ui";
import { StrictMode, useCallback, useRef, useState } from "react";
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
  const [toast, setToast] = useState<{ message: string; options?: KeepToastFeedbackOptions }>();
  const [revealRequest, setRevealRequest] = useState<{ requestId: number; itemId: string }>();
  const revealId = useRef(0);
  const showToast = useCallback((message: string, options?: KeepToastFeedbackOptions) => {
    setToast({ message, ...(options ? { options } : {}) });
  }, []);
  const showDefaultFeedback = useKeepToastFeedback<DemoMeta>(showToast);
  const onFeedback = useCallback(
    (event: KeepUiFeedbackEvent<DemoMeta>) => {
      if (event.type === "sync-completed") return;
      if (event.type !== "item-saved") {
        showDefaultFeedback(event);
        return;
      }
      showToast(event.message, {
        action: {
          label: "View in collection",
          onClick: () => {
            revealId.current += 1;
            setRevealRequest({ requestId: revealId.current, itemId: event.item.id });
          },
        },
      });
    },
    [showDefaultFeedback, showToast],
  );

  const onRevealResult = useCallback(
    (result: KeepCollectionRevealResult) => {
      if (result.status === "not-found") {
        showToast("This item is no longer saved.");
        return;
      }
      if (result.status === "excluded") {
        showToast("This item cannot be shown with the current collection scope.");
        return;
      }
      window.requestAnimationFrame(() => {
        const card = document.getElementById(`saved-item-${encodeURIComponent(result.itemId)}`);
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        card?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        card?.focus();
        setToast(undefined);
      });
    },
    [showToast],
  );

  return (
    <KeepKitProvider<DemoMeta> storage={storage} theme={theme} mode="light" radius="large" onFeedback={onFeedback}>
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
      <App {...(revealRequest ? { revealRequest } : {})} onRevealResult={onRevealResult} />
      {toast ? (
        <aside className="demo-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.options?.action ? (
            <button type="button" onClick={toast.options.action.onClick}>
              {toast.options.action.label}
            </button>
          ) : null}
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(undefined)}>
            ×
          </button>
        </aside>
      ) : null}
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
