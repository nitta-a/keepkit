import { KeepProvider, LocalStorageAdapter } from "@keepkit/core";
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
};

const storage = new LocalStorageAdapter<DemoMeta>({ key: "keepkit-demo:items" });
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <KeepProvider<DemoMeta> storage={storage}>
      <App />
    </KeepProvider>
  </StrictMode>,
);
