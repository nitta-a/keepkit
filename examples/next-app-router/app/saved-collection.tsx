"use client";

import type { KeepItem } from "@keepkit/core/core";
import { createBrowserStorageAdapter, KeepCollection, KeepKitProvider } from "@keepkit/ui";

type ArticleMeta = {
  title: string;
  url: string;
};

const storage = createBrowserStorageAdapter<ArticleMeta>({ key: "keepkit:next-app-router" });

export function SavedCollection({ initialItems }: { initialItems: KeepItem<ArticleMeta>[] }) {
  return (
    <KeepKitProvider<ArticleMeta>
      storage={storage}
      initialItems={initialItems}
      labels={{ search: "Search articles", noItems: "No saved articles." }}
    >
      <KeepCollection<ArticleMeta>
        query={{ targetType: "article" }}
        itemCardProps={{
          title: (item) => <a href={item.meta.url}>{item.meta.title}</a>,
        }}
      />
    </KeepKitProvider>
  );
}
