// Renders the published React entry points on the server, as a Next.js or Remix host would.
import assert from "node:assert/strict";
import { KeepButton, KeepProvider } from "@keepkit/core/react";
import * as root from "@keepkit/ui";
import { KeepButton as UiButton } from "@keepkit/ui/button";
import { KeepKitProvider } from "@keepkit/ui/kit-provider";
import { KeepKitProvider as LightKitProvider } from "@keepkit/ui/kit-provider-light";
import { JA_LABELS } from "@keepkit/ui/locales/ja";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import * as components from "./components.ts";

assert.deepEqual(
  { ...components },
  Object.fromEntries(Object.entries(root).filter(([name]) => /^Keep[A-Z]/.test(name))),
);

const saved = { id: "article-1", meta: { title: "Server rendered article" } };
const unsaved = { id: "article-2", meta: { title: "Not saved yet" } };
const initialItems = [{ ...saved, savedAt: 1, updatedAt: 1 }];

const core = renderToString(
  h(KeepProvider, { initialItems }, h(KeepButton, { item: saved }), h(KeepButton, { item: unsaved })),
);
// The UI provider wraps the core provider, so a core button must observe the same store.
const ui = renderToString(
  h(
    KeepKitProvider,
    { initialItems, labels: { saved: "Packed label" } },
    h(KeepButton, { item: saved }),
    h(UiButton, { item: saved }),
    h(root.KeepCollection),
  ),
);
const light = renderToString(
  h(LightKitProvider, { initialItems, locale: "ja", dictionary: JA_LABELS }, h(UiButton, { item: saved })),
);
assert.ok(light.includes(JA_LABELS.saved));

process.stdout.write(JSON.stringify({ core, ui }));
