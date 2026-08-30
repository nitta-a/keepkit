# @keepkit/core

[日本語](#日本語) | [English](#english)

## 日本語

Reactアプリケーション向けの、ヘッドレスで非同期処理を前提とした保存・コレクション用プリミティブです。

```tsx
import { KeepButton, KeepProvider, LocalStorageAdapter } from "@keepkit/core";

const storage = new LocalStorageAdapter({ key: "my-app:items" });

<KeepProvider storage={storage}>
  <KeepButton
    item={{
      id: "article-123",
      targetType: "article",
      meta: { title: "Example article", url: "/articles/123" },
    }}
  />
</KeepProvider>;
```

`useKeepItem(id, payload)` では保存、切り替え、削除、ノート・タグ更新を行えます。`useKeepList()` ではコレクションの取得、タグ絞り込み・検索・ソート・ページネーション、`removeBatch` / `updateTagsBatch` / `addTagsBatch` / `removeTagsBatch` による一括操作ができます。`KeepProvider` は `isHydrated` / `isMutating` と typed storage errors を公開します。`LocalStorageAdapter` はSSR環境からimportでき、`StorageAdapter<TMeta>` または `createStorageAdapter` でサーバー側のストアに接続できます。

`exportItems(adapter)` / `importItems(adapter, json, { mode: "replace" | "merge" })` でversion付きJSONバックアップを扱えます。結果には `imported` / `failed` 件数が含まれます。

大規模アプリでは `SyncStorageAdapter` を使ってローカル保存とリモート同期を分離できます。`IndexedDBSyncQueueAdapter`（既定）または `LocalStorageSyncQueueAdapter` に操作を永続化し、オンライン復帰時に `flushSync()` で再送します。`KeepProvider` の `syncState` で `pending` / `syncing` / `conflict` / `error` を取得できます。

```tsx
const storage = new SyncStorageAdapter({
  local: new IndexedDBAdapter({ databaseName: "my-app" }),
  remote: {
    push: (operation) => api.syncKeepOperation(operation),
  },
  resolveConflict: (local, remote) => ({
    ...remote,
    note: local?.note ?? remote.note,
  }),
});

<KeepProvider
  storage={storage}
  schema={{ parse: (value) => validateMeta(value) }}
  invalidItemPolicy="drop"
/>;
```

`useKeepList` は `savedBetween`、`search: { query, mode: "and" | "or" }`、`filterFn`、`tagCounts` をサポートします。TanStack Query や SWR のキャッシュ連携には、依存関係を core に追加しない `createKeepInvalidationPlugin` を利用できます。

ブラウザの制限環境では `createBrowserStorageAdapter` が IndexedDB を優先し、アクセスできない場合は `LocalStorageAdapter` に切り替えます。自前の主／代替 adapter を組み合わせる場合は `FallbackStorageAdapter` を利用できます。`useKeepShortcut({ key: "k", modifier: "meta", id, itemPayload })` は編集可能なフィールドを除外して保存操作をキーボードに割り当てます。`asChild` の `KeepButton` には `aria-pressed`、`aria-disabled`、button role、Space／Enter 操作が自動で付与されます。

詳細な使い方と開発コマンドは [ルートREADME](../../README.md) を、現在の変更内容は [リリースノート](../../RELEASE_NOTES.md) を参照してください。

## English

Headless, async-first save-and-collect primitives for React applications.

```tsx
import { KeepButton, KeepProvider, LocalStorageAdapter } from "@keepkit/core";

const storage = new LocalStorageAdapter({ key: "my-app:items" });

<KeepProvider storage={storage}>
  <KeepButton
    item={{
      id: "article-123",
      targetType: "article",
      meta: { title: "Example article", url: "/articles/123" },
    }}
  />
</KeepProvider>;
```

Use `useKeepItem(id, payload)` for saving, toggling, removing, and updating notes or tags. Use `useKeepList()` to read, filter, sort, and perform bulk removal/tag updates. `KeepProvider` exposes `isHydrated`, `isMutating`, and typed storage errors. `LocalStorageAdapter` is safe to import in SSR environments; implement `StorageAdapter<TMeta>` or use `createStorageAdapter` to connect a server-backed store.

Use `exportItems(adapter)` and `importItems(adapter, json, { mode: "replace" | "merge" })` for versioned JSON backups. Results include imported and failed counts.

For larger applications, wrap a local adapter with `SyncStorageAdapter` to persist a durable offline queue and flush it with `flushSync()` when connectivity returns. Use `syncState` from `KeepProvider` for `pending`, `syncing`, `conflict`, and `error` feedback. `KeepProvider` also accepts a Zod-like `parse`, `safeParse`, or Standard Schema validator through `schema`; invalid stored records can be rejected or dropped with `invalidItemPolicy`.

`useKeepList` supports `savedBetween`, tokenized `search` with `and` / `or` modes, `filterFn`, and `tagCounts`. Use `createKeepInvalidationPlugin` to connect TanStack Query, SWR, or another cache without adding framework dependencies to core.

In restricted browser environments, `createBrowserStorageAdapter` prefers IndexedDB and switches to `LocalStorageAdapter` when IndexedDB cannot be accessed. Use `FallbackStorageAdapter` to compose your own primary and fallback adapters. `useKeepShortcut({ key: "k", modifier: "meta", id, itemPayload })` binds a save action while ignoring editable fields. `KeepButton asChild` automatically supplies `aria-pressed`, `aria-disabled`, a button role, and Space/Enter activation.

See the [root README](../../README.md) for detailed usage and development commands, and the [release notes](../../RELEASE_NOTES.md) for the current changes.
