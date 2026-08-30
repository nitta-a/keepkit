import type { KeepItem } from "@keepkit/core/core";
import { KeepButton, useKeepList } from "@keepkit/core/react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getSession } from "../lib/auth";
import { listKeepItems } from "../lib/serverKeepApi";

type ArticleMeta = { title: string; url: string };

export const getServerSideProps: GetServerSideProps<{ keepItems: KeepItem<ArticleMeta>[] }> = async ({ req }) => {
  const session = getSession(req);
  return { props: { keepItems: session ? await listKeepItems(session) : [] } };
};

export default function Home({ keepItems }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { items, isHydrated, syncState } = useKeepList({ targetType: "article" });
  const article = {
    id: "article-123",
    targetType: "article",
    meta: { title: "Pages Router article", url: "/article-123" },
  };

  return (
    <main>
      <p>
        SSR snapshot: {keepItems.length} items; hydrated: {String(isHydrated)}
      </p>
      <KeepButton item={article} savedAriaLabel="Remove from saved" unsavedAriaLabel="Save article" />
      <p>
        Saved locally: {items.length}. Sync: {syncState.status}
      </p>
    </main>
  );
}
