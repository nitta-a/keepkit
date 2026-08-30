# @keepkit/core

[日本語](#日本語) | [English](#english)

## 日本語

Reactアプリケーション向けの、ヘッドレスで非同期処理を前提とした保存・コレクション用プリミティブです。

```tsx
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { KeepButton, KeepProvider } from "@keepkit/core/react";

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

`KeepButton` の標準ARIAラベルは `savedAriaLabel` / `unsavedAriaLabel` または `getAriaLabel` で多言語化できます。`useKeepItem(id).refreshMetadata` と `isKeepItemMetadataStale` はメタデータの再取得に使えます。`useKeepList().revalidate` または `useKeepContext().revalidateItems` は削除・非公開・期限切れの対象を検出します。検出した状態を整理する場合は `removeStatuses` を明示してください。

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

サーバーで取得した一覧を初期表示に使う場合は `KeepProvider initialItems={itemsFromServer}` を指定できます。クライアント adapter の初回読み込み中も同じスナップショットを描画し、refresh 完了後は adapter の値に更新されます。Reactを使わない環境やRSCのサーバー側コードでは `@keepkit/core/core`、React binding は `@keepkit/core/react`、ストレージは `@keepkit/core/storage`、スキーマ処理は `@keepkit/core/schema` からimportできます。

ブラウザの制限環境では `createBrowserStorageAdapter` が IndexedDB を優先し、アクセスできない場合は `LocalStorageAdapter` に切り替えます。自前の主／代替 adapter を組み合わせる場合は `FallbackStorageAdapter` を利用できます。`useKeepShortcut({ key: "k", modifier: "meta", id, itemPayload })` は編集可能なフィールドを除外して保存操作をキーボードに割り当てます。`asChild` の `KeepButton` には `aria-pressed`、`aria-disabled`、button role、Space／Enter 操作が自動で付与されます。

詳細な使い方と開発コマンドは [ルートREADME](../../README.md) を、現在の変更内容は [リリースノート](../../RELEASE_NOTES.md) を参照してください。

## English

Headless, async-first save-and-collect primitives for React applications.

```tsx
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { KeepButton, KeepProvider } from "@keepkit/core/react";

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

Localize the default `KeepButton` ARIA label with `savedAriaLabel` / `unsavedAriaLabel` or `getAriaLabel`. `useKeepItem(id).refreshMetadata` and `isKeepItemMetadataStale` fetch current metadata, while `useKeepList().revalidate` or `useKeepContext().revalidateItems` detects deleted, private, and expired targets. Pass `removeStatuses` explicitly when detected records should be cleaned up.

For larger applications, wrap a local adapter with `SyncStorageAdapter` to persist a durable offline queue and flush it with `flushSync()` when connectivity returns. Use `syncState` from `KeepProvider` for `pending`, `syncing`, `conflict`, and `error` feedback. `KeepProvider` also accepts a Zod-like `parse`, `safeParse`, or Standard Schema validator through `schema`; invalid stored records can be rejected or dropped with `invalidItemPolicy`.

`useKeepList` supports `savedBetween`, tokenized `search` with `and` / `or` modes, `filterFn`, and `tagCounts`. Use `createKeepInvalidationPlugin` to connect TanStack Query, SWR, or another cache without adding framework dependencies to core.

Pass a server-loaded list as `KeepProvider initialItems={itemsFromServer}` when the initial client render should use the same snapshot while storage hydrates. The first refresh then updates the state from the adapter. Framework-neutral and RSC server code can import `@keepkit/core/core`; React bindings, storage, and schema helpers are also available from `@keepkit/core/react`, `@keepkit/core/storage`, and `@keepkit/core/schema` respectively.

In restricted browser environments, `createBrowserStorageAdapter` prefers IndexedDB and switches to `LocalStorageAdapter` when IndexedDB cannot be accessed. Use `FallbackStorageAdapter` to compose your own primary and fallback adapters. `useKeepShortcut({ key: "k", modifier: "meta", id, itemPayload })` binds a save action while ignoring editable fields. `KeepButton asChild` automatically supplies `aria-pressed`, `aria-disabled`, a button role, and Space/Enter activation.

See the [root README](../../README.md) for detailed usage and development commands, and the [release notes](../../RELEASE_NOTES.md) for the current changes.
