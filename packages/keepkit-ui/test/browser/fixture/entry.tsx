import type { KeepItem, StorageAdapter } from "@keepkit/core/core";
import { KeepFloatingTour, KeepKitProvider, KeepSavePopover, useKeepTour } from "../../../src/index";
import "../../../src/theme.css";
import { createRoot } from "react-dom/client";

type Meta = { title: string };
let items: KeepItem<Meta>[] = [];
const storage: StorageAdapter<Meta> = {
  getAll: async () => items,
  set: async (item) => {
    items = [item];
  },
  remove: async () => {
    items = [];
  },
  clear: async () => {
    items = [];
  },
};
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root.");
const portalContainer = new URLSearchParams(window.location.search).has("customPortal")
  ? document.body.appendChild(document.createElement("div"))
  : undefined;
if (portalContainer) portalContainer.dataset.testid = "custom-portal";
function Tour() {
  const tour = useKeepTour<Meta>();
  return (
    <button type="button" onClick={() => tour.start({ itemIds: ["entry"] })}>
      Start tour
    </button>
  );
}
createRoot(root).render(
  <KeepKitProvider storage={storage}>
    <Tour />
    <KeepFloatingTour<Meta> />
    <button type="button" data-testid="host-button" style={{ height: 24, padding: 0, border: 0 }}>
      Host
    </button>
    <input data-testid="host-input" style={{ height: 24, padding: 0, border: 0 }} />
    <div
      data-testid="clipped-card"
      style={{ position: "fixed", right: 0, bottom: 0, width: 100, height: 80, overflow: "hidden" }}
    >
      <KeepSavePopover item={{ id: "entry", meta: { title: "Article" } }} portalContainer={portalContainer} />
    </div>
  </KeepKitProvider>,
);
