import {
  createAuthenticatedSyncKit,
  exportItems,
  type KeepItem,
  type KeepSyncState,
  type StorageAdapter,
} from "@keepkit/core/core";
import { KeepButton, KeepProvider, useKeepItem, useKeepList } from "@keepkit/core/react";
import { parseKeepMeta } from "@keepkit/core/schema";
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { KeepCollection, KeepKitProvider } from "@keepkit/ui";
import { keepKitTheme } from "@keepkit/ui/tailwind";

type ArticleMeta = { title: string; url: string };

const articleSchema = {
  parse(value: unknown): ArticleMeta {
    if (typeof value !== "object" || value === null || !("title" in value) || !("url" in value)) {
      throw new TypeError("An article needs a title and URL.");
    }
    const { title, url } = value;
    if (typeof title !== "string" || typeof url !== "string") throw new TypeError("Invalid article.");
    return { title, url };
  },
};

const article: KeepItem<ArticleMeta> = {
  id: "article-1",
  savedAt: 1,
  updatedAt: 1,
  meta: { title: "Typed", url: "https://example.com" },
};
const storage: StorageAdapter<ArticleMeta> = new LocalStorageAdapter<ArticleMeta>({ key: "consumer" });

export const backup: Promise<string> = exportItems(storage);
export const meta: Promise<ArticleMeta> = parseKeepMeta(articleSchema, article.meta);
export const primaryColor: string = keepKitTheme.colors.primary;

export const kit = createAuthenticatedSyncKit<ArticleMeta>({
  local: storage,
  getAuthToken: async () => "token",
  transport: { push: async (operation) => ({ type: "synced", item: operation.item }) },
});
export const syncState: KeepSyncState<ArticleMeta> = kit.storage.getSyncState();

// @ts-expect-error The meta shape is enforced for typed items.
export const invalid: KeepItem<ArticleMeta> = { id: "x", savedAt: 1, updatedAt: 1, meta: { title: 1, url: "" } };

// @ts-expect-error The package root is intentionally not an entry point.
export type RootEntry = typeof import("@keepkit/core");

// @ts-expect-error Build output is private to the exports map.
export type DeepEntry = typeof import("@keepkit/core/dist/core.js");

function SavedCount() {
  const { items, isHydrated } = useKeepList<ArticleMeta>();
  const titles: string[] = items.map((item) => item.meta.title);
  return <output data-hydrated={isHydrated}>{titles.length}</output>;
}

function SaveArticle({ item }: { item: KeepItem<ArticleMeta> }) {
  const { isSaved, toggle } = useKeepItem<ArticleMeta>({ id: item.id, meta: item.meta });
  return (
    <button type="button" aria-pressed={isSaved} onClick={() => void toggle()}>
      {item.meta.title}
    </button>
  );
}

export function CoreApp() {
  return (
    <KeepProvider<ArticleMeta> storage={storage} initialItems={[article]}>
      <KeepButton<ArticleMeta> item={{ id: article.id, meta: article.meta }} savedLabel="Saved" />
      {/* @ts-expect-error KeepButton requires the item it controls. */}
      <KeepButton />
      <SaveArticle item={article} />
      <SavedCount />
    </KeepProvider>
  );
}

export function UiApp() {
  return (
    <KeepKitProvider<ArticleMeta> initialItems={[article]}>
      <KeepCollection<ArticleMeta> />
    </KeepKitProvider>
  );
}
