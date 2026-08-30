import type { KeepItem } from "@keepkit/core/core";
import { KeepKitProvider } from "@keepkit/ui";
import type { AppProps } from "next/app";
import { useEffect, useRef } from "react";
import { createKeepStorage } from "../lib/keepStorage";

type ArticleMeta = { title: string; url: string };
type PageProps = { keepItems?: KeepItem<ArticleMeta>[] };

export default function App({ Component, pageProps }: AppProps<PageProps>) {
  const storageRef = useRef<ReturnType<typeof createKeepStorage> | undefined>(undefined);
  let storage = storageRef.current;
  if (!storage) {
    storage = createKeepStorage();
    storageRef.current = storage;
  }
  useEffect(() => {
    void storage.flushSync();
  }, [storage]);

  return (
    <KeepKitProvider<ArticleMeta> storage={storage} initialItems={pageProps.keepItems} locale="en-US">
      <Component {...pageProps} />
    </KeepKitProvider>
  );
}
