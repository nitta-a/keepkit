// Renders the published React entry points on the server, as a Next.js or Remix host would.
import { KeepButton, KeepProvider } from "@keepkit/core/react";
import { KeepCollection, KeepKitProvider } from "@keepkit/ui";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";

const saved = { id: "article-1", meta: { title: "Server rendered article" } };
const unsaved = { id: "article-2", meta: { title: "Not saved yet" } };
const initialItems = [{ ...saved, savedAt: 1, updatedAt: 1 }];

const core = renderToString(
  h(KeepProvider, { initialItems }, h(KeepButton, { item: saved }), h(KeepButton, { item: unsaved })),
);
// The UI provider wraps the core provider, so a core button must observe the same store.
const ui = renderToString(h(KeepKitProvider, { initialItems }, h(KeepButton, { item: saved }), h(KeepCollection)));

process.stdout.write(JSON.stringify({ core, ui }));
