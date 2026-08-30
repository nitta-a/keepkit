import type { KeepItem } from "@keepkit/core/core";
import { SavedCollection } from "./saved-collection";

type ArticleMeta = {
  title: string;
  url: string;
};

const initialItems: KeepItem<ArticleMeta>[] = [
  {
    id: "react-server-components",
    savedAt: 1,
    updatedAt: 1,
    targetType: "article",
    meta: {
      title: "React Server Components",
      url: "https://react.dev/reference/rsc/server-components",
    },
    tags: ["react", "reference"],
  },
];

/** Server Component: load or compose a snapshot and pass it to the client boundary. */
export default function Page() {
  return (
    <main>
      <h1>Saved articles</h1>
      <p>This snapshot is rendered on the server and hydrated into a local-first client collection.</p>
      <SavedCollection initialItems={initialItems} />
    </main>
  );
}
