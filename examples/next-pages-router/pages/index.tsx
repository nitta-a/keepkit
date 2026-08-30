import type { KeepItem } from "@keepkit/core/core";
import { KeepButton, type KeepImageProps, KeepItemCard, KeepList, useKeepList } from "@keepkit/ui";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Image from "next/image";
import { getSession } from "../lib/auth";
import { listKeepItems } from "../lib/serverKeepApi";

type ArticleMeta = { title: string; url: string; image?: string };

function NextImage({ src, alt, width, height }: Pick<KeepImageProps, "src" | "alt" | "width" | "height">) {
  return <Image src={src} alt={alt} width={width ?? 640} height={height ?? 360} />;
}

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
      <KeepList<ArticleMeta>
        query={{ targetType: "article" }}
        renderItem={(entry) => (
          <KeepItemCard
            item={entry}
            getImageProps={(current, title) =>
              current.meta.image ? { src: current.meta.image, alt: String(title), width: 320, height: 180 } : undefined
            }
            imageComponent={NextImage}
          />
        )}
      />
    </main>
  );
}
