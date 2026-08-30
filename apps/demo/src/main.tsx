import { FavoriteProvider, LocalStorageAdapter } from "@keepkit/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const storage = new LocalStorageAdapter({ key: "keepkit-demo:favorites" });
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <FavoriteProvider storage={storage}>
      <App />
    </FavoriteProvider>
  </StrictMode>,
);
