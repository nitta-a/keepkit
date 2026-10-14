# @keepkit/core

[日本語](#日本語) | [English](#english)

Release: v0.28.10

## 日本語

フレームワーク中立の保存処理と、React向けのProvider・hooksを提供します。
標準の一覧UIが必要な場合は[@keepkit/ui](../keepkit-ui/README.md)を使ってください。記事向けの`presentation="reading"`と行内選択はUIパッケージの追加機能で、Coreの型・保存形式は変更しません。未訪問の判定には既存の`lastOpenedAt`と`recordOpen()`を使います。

### インストールと入口

```bash
pnpm add @keepkit/core
```

| import先 | 用途 |
| --- | --- |
| `@keepkit/core/core` | 型、ストア、検索、コレクション、バックアップなど。Reactへの依存なし |
| `@keepkit/core/react` | `createKeepKit`、`KeepProvider`、`KeepButton`、hooks |
| `@keepkit/core/storage` | localStorage・IndexedDB・fallback・同期adapter |
| `@keepkit/core/schema` | スキーマの解析・検証 |

パッケージルートにはexportがありません。React bindingはReact 18以降に対応します。

### Reactで使う

```tsx
import { createKeepKit } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
});
const article = {
  id: "article-123",
  targetType: "article",
  meta: { title: "Example article", url: "/articles/123" },
};

function SavedArticles() {
  const { items, isLoading, error } = keep.useList({ targetType: "article" });
  if (isLoading) return <p>読み込み中…</p>;
  if (error) return <p role="alert">保存一覧を読み込めませんでした。</p>;
  return <ul>{items.map((item) => <li key={item.id}>{item.meta.title}</li>)}</ul>;
}

export function App() {
  return (
    <keep.Provider>
      <keep.Button item={article} />
      <SavedArticles />
    </keep.Provider>
  );
}
```

hooksはProvider内のコンポーネントで呼び出します。
保存入力は`{ id, meta, targetType?, note?, tags?, order? }`が基本です。時刻とタグの正規化はKeepKitが管理します。
`keep.useItem(article)`で保存・解除・メモ更新などを、`keep.useList(query)`で一覧と一括操作を利用できます。

### 主な機能

| 用途 | API |
| --- | --- |
| 検索・絞り込み | `KeepListQuery`の`search`、`tags`、`sort`、`pagination`。Reactなしでは`queryKeepItems` |
| 整理 | archive・pin・`collectionId`、`createInboxQuery`、`useKeepCollections` |
| 複数コレクションへの所属・順序 | `addKeepItemToCollection`、`getKeepCollectionItems`、`reorderKeepCollectionItems`、`removeKeepItemFromCollection` |
| 再発見 | `useKeepItem(item).recordOpen()`、`createRediscoveryQuery`、`useKeepRediscovery` |
| 閲覧履歴・鑑賞記録・進行位置 | `LocalStorageKeepHistoryStorage`、`LocalStorageKeepViewingRecordStorage`、`LocalStorageKeepProgressStorage` |
| 保存対象の再検証 | Providerの`validateItem` / `resolveItem`、`revalidateItems` |

一覧は未アーカイブのアイテムを既定で返します。`archiveScope: "all"`で両方を、`archived: true`でアーカイブを取得できます。
複数コレクションへの所属はアイテムと別に保存され、所属を外しても共有アイテムやメモは残ります。

`before`プラグインや永続化の失敗は保存操作を拒否します。保存成功後のコールバック、`after`プラグイン、`onChange`の例外は`onError(error, { action, id, phase: "notification" })`で報告し、保存済み状態とUndoを維持します。通知例外でも保存操作のPromiseは成功し、後続通知は継続します。

### 保存・同期・バックアップ

- `createBrowserStorageAdapter`はIndexedDB優先で、localStorageへフォールバックします。`scope`でユーザー／テナントを分離できます。
- `SyncStorageAdapter`と`RemoteSyncDriver`で永続オフラインキュー・再試行・競合処理を組み込みます。定義・所属の同期には、それぞれ`pushCollection` / `pullCollections`、`pushMembership` / `pullMemberships`が必要です。
- 認証方式はアプリ側で管理します。[認証付き同期の例](../../examples/authenticated-sync/README.md)でトークン取得とscope切り替えを確認できます。
- `exportItems(storage)` / `importItems(storage, json, { mode: "merge" })`で保存アイテム・コレクション定義・所属をバックアップ・復元します。閲覧履歴・鑑賞記録・進行位置は含みません。

fallbackの更新・削除・全消去・コレクション・所属操作は、ストレージとscopeごとのlocalStorage journalに記録します。journal保存が成功判定です。実データへの反映が失敗しても記録から変更を読み取り、再起動後も復旧を試します。全操作をprimaryへ再生し、読み取りとjournal消去が成功した後にIndexedDBへ戻ります。`clear()`はアイテムと所属を消去し、コレクション定義を保持します。

fallbackへの書き込みと復旧にはWeb Locks APIとJSON保存可能なメタデータが必要です。journal保存失敗はデータ変更前にエラーを返します。Web Locks未対応でも、未反映操作がなくIndexedDBが正常なら従来の保存が使えます。正常なIndexedDBのメタデータにJSON制約は追加しません。

journal v2は完全なアイテム・コレクション・所属のスナップショットと取得時刻を保存します。v1の保留操作も読み込み、空primaryへの既存データ移行後にスナップショットを作ります。障害中の読み取りは最後の永続スナップショットと保留操作を使います。primary保存後のスナップショット更新失敗は保存成功を維持し、`storage.recovery?.getState()`で`snapshotStale`と`issue`を報告します。次の正常読み取りで更新を再試行します。

標準browser factoryは旧v1保存キーからも読み込み、新しい記録の永続化後に旧キーを削除します。旧キーだけではbackendやscopeを一意に判定できない場合は、記録を保持してエラーを返します。独自の`createRecoveryJournal`を使う場合は、その実装で旧キーを移行してください。

`StorageAdapter.recovery`は任意です。`getState()` / `subscribe()`で状態を観察し、`inspect({ selections })`で書き込みなしに保存元と退避済み旧fallbackを比較します。異なるIDは両方保持し、同じIDの競合は明示選択が必要です。`apply({ token, selections })`は適用直前に再照合し、古い確認を拒否します。修復前のバックアップv2と承認済み操作を一回のjournal保存で確定します。`status: "pending"`は修復内容を保存済み・反映待ちなので、再提出せず`retry()`で続行してください。バックアップは自動削除しません。後続の`inspect()`が返す`retainedBackups`から修復前のJSONバックアップv2を取得できます。項目・所属・コレクションは対象scopeだけを比較・変更します。

`KeepFallbackRecovery`はこの能力を明示的に渡すUIです。[UIガイド](../keepkit-ui/README.md)を参照してください。`SyncStorageAdapter.recovery`は状態表示だけを公開します。分岐の修復は同期を開始する前のstandalone local adapterで行います。

独自の`FallbackStorageAdapter`には`recoveryJournal: FallbackRecoveryJournal<TMeta>`を渡せます。`read` / `write`でv1またはv2の状態を永続化し、`runExclusive`で同じbackendへのアクセスを排他します。任意の`subscribe`は別タブの変更を通知します。browser factoryの`createRecoveryJournal`には保存キー・排他キー・scopeが渡されます。独自排他機構を接続でき、標準実装は排他なしのjournal変更・復旧を拒否します。同一backendの全scopeで排他キーを共有してください。localStorageを使う独自実装は、読み取り前と書き込み後のタスク終了までロックを保持します。標準`LocalStorageRecoveryJournal`はこの待機を含みます。

JSON保存するmetadata・バックアップ・localStorage同期キューは、Date、Map／Set、非有限数、undefined、function、symbol、BigInt、循環参照などを`KeepStorageSerializationError`で拒否します。既知の任意フィールドのundefinedは省略できます。正常なIndexedDB保存はJSON互換性を要求しませんが、予備スナップショットの更新やJSON出力は失敗し得ます。

scope付きadapterを別のscopeで包み直しても書き込み先は切り替わりません。その構成の変更操作は保存前に拒否します。切替先のscopeからadapterを作成してください。

導入時は旧実装のタブをすべて更新してください。記録のない削除意図や失われた内容は自動復元できません。スナップショット保存自体が失敗した期間の完全な障害時表示と、排他機構のない環境での安全な書き込みは保証できません。

既存IndexedDBのコレクション保存先は`databaseName:storeName:collections`です。たとえば`("a:b", "c")`と`("a", "b:c")`は同じ保存先になるため、同じscopeで併用しないでください。この既存形式の曖昧なデータは、journal移行では自動分離できません。

**Replace（置換）は空のバックアップでも対象範囲を置き換え、ロールバックしません。** 途中失敗は`KeepBackupImportError`の`failedStage`と`applied`で確認できます。スコープ付きadapterは別scopeのデータを変更前に拒否します。

独自の`StorageAdapter`で定義・所属を扱う場合は、`getCollections` / `setCollection` / `removeCollection`と`getCollectionMemberships` / `setCollectionMembership` / `removeCollectionMembership`を実装してください。Providerのコレクション作成・改名・削除は定義メソッドが揃わない場合に拒否し、アイテムの所属も変更しません。

履歴・鑑賞記録・進行位置のlocalStorage書き込みには、ブラウザーでWeb Locks APIが必要です。未対応や保存先が利用できない場合はエラーを返します。SSRで初期化できますが、永続化操作はブラウザー側で行います。
履歴・進行位置のキーはアプリ側でユーザーごとに分け、進行位置の取得には記録と一致する言語・コンテンツ版・音声IDを渡してください。

デモと開発手順は[リポジトリREADME](../../README.md)、変更履歴は[リリースノート](../../RELEASE_NOTES.md)を参照してください。

## English

Framework-neutral persistence primitives and React providers and hooks.
Use [@keepkit/ui](../keepkit-ui/README.md) when you want a ready-made collection UI. Its opt-in `presentation="reading"` and inline selection add UI behavior without changing Core types or storage formats. Unvisited uses the existing `lastOpenedAt` and `recordOpen()` contracts.

### Installation and entry points

```bash
pnpm add @keepkit/core
```

| Import | Purpose |
| --- | --- |
| `@keepkit/core/core` | Types, store, queries, collections, and backups, with no React imports |
| `@keepkit/core/react` | `createKeepKit`, `KeepProvider`, `KeepButton`, and hooks |
| `@keepkit/core/storage` | localStorage, IndexedDB, fallback, and sync adapters |
| `@keepkit/core/schema` | Schema parsing and validation |

The package root has no export. React bindings support React 18 or later.

### React usage

```tsx
import { createKeepKit } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
});
const article = {
  id: "article-123",
  targetType: "article",
  meta: { title: "Example article", url: "/articles/123" },
};

function SavedArticles() {
  const { items, isLoading, error } = keep.useList({ targetType: "article" });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert">Could not load saved items.</p>;
  return <ul>{items.map((item) => <li key={item.id}>{item.meta.title}</li>)}</ul>;
}

export function App() {
  return (
    <keep.Provider>
      <keep.Button item={article} />
      <SavedArticles />
    </keep.Provider>
  );
}
```

Call hooks inside components under the provider.
The basic save input is `{ id, meta, targetType?, note?, tags?, order? }`; KeepKit manages timestamps and tag normalization.
Use `keep.useItem(article)` for saves, removal, and note updates, and `keep.useList(query)` for lists and bulk operations.

### Main APIs

| Task | API |
| --- | --- |
| Search and filtering | `KeepListQuery.search`, `tags`, `sort`, and `pagination`; `queryKeepItems` without React |
| Organization | Archive, pin, `collectionId`, `createInboxQuery`, and `useKeepCollections` |
| Multiple collections and ordering | `addKeepItemToCollection`, `getKeepCollectionItems`, `reorderKeepCollectionItems`, `removeKeepItemFromCollection` |
| Rediscovery | `useKeepItem(item).recordOpen()`, `createRediscoveryQuery`, and `useKeepRediscovery` |
| History, viewing records, and progress | `LocalStorageKeepHistoryStorage`, `LocalStorageKeepViewingRecordStorage`, `LocalStorageKeepProgressStorage` |
| Source revalidation | Provider `validateItem` / `resolveItem` and `revalidateItems` |

Lists return unarchived items by default. Use `archiveScope: "all"` for both or `archived: true` for archived items.
Memberships are stored separately; removing one leaves the shared item and note intact.

Failures in `before` plugins or persistence reject the mutation. Errors from post-save callbacks, `after` plugins, and `onChange` are reported through `onError(error, { action, id, phase: "notification" })`, preserving committed state and Undo. The mutation resolves successfully and later notifications still run.

### Storage, sync, and backups

- `createBrowserStorageAdapter` prefers IndexedDB and falls back to localStorage. Use `scope` to isolate users and tenants.
- Combine `SyncStorageAdapter` and `RemoteSyncDriver` for durable offline queues, retries, and conflicts. Definition and membership sync require `pushCollection` / `pullCollections` and `pushMembership` / `pullMemberships`, respectively.
- Authentication belongs to your app. See the [authenticated sync example](../../examples/authenticated-sync/README.md) for tokens and scope changes.
- Use `exportItems(storage)` / `importItems(storage, json, { mode: "merge" })` to back up and restore saved items, collection definitions, and memberships. History, viewing records, and progress are excluded.

Fallback updates, removals, clears, collection changes, and memberships enter a localStorage journal isolated by storage configuration and scope. Saving the journal commits the mutation. Reads apply recorded changes even if their projection into fallback storage fails, and recovery retries after restart. The adapter returns to IndexedDB after replaying every operation, reading the primary successfully, and clearing the journal. `clear()` removes items and memberships, preserving collection definitions.

Fallback writes and recovery require the Web Locks API and JSON-compatible metadata. Journal write failures reject before changing data. Browsers without Web Locks can still save to a healthy IndexedDB primary when no operations are pending. Healthy IndexedDB metadata gains no JSON restriction.

Journal v2 stores complete item, collection, and membership snapshots with their capture time. It also reads pending v1 operations and creates its first snapshot after migrating legacy data into an empty primary. Outage reads use the last durable snapshot plus pending operations. Failure to refresh the snapshot after a primary commit preserves mutation success and reports `snapshotStale` and `issue` through `storage.recovery?.getState()`. The next healthy read retries the refresh.

The standard browser factory also reads the original v1 storage key and removes it only after persisting the new record. If the old key cannot identify the backend or scope unambiguously, it preserves the record and reports an error. Custom `createRecoveryJournal` implementations must migrate their own older keys.

`StorageAdapter.recovery` is optional. Observe status through `getState()` / `subscribe()`, and compare storage sources and archived legacy fallback through `inspect({ selections })` without writing. Distinct IDs are retained together; conflicting records with the same identity need an explicit choice. `apply({ token, selections })` rechecks the data immediately before applying and rejects stale confirmation. It commits pre-repair v2 backups and the approved operation list in one journal write. A `status: "pending"` result means the repair is saved and awaiting projection: continue through `retry()` instead of submitting it again. Backups are never automatically deleted. Later `inspect()` results expose earlier v2 JSON backups through `retainedBackups`. Comparisons and changes include only the active scope.

`KeepFallbackRecovery` accepts this capability explicitly; see the [UI guide](../keepkit-ui/README.md). `SyncStorageAdapter.recovery` exposes status only. Repair existing branches through a standalone local adapter before starting synchronization.

Custom `FallbackStorageAdapter` instances can accept `recoveryJournal: FallbackRecoveryJournal<TMeta>`. Persist v1 or v2 state through `read` / `write` and provide exclusive access to the same backend through `runExclusive`. Optional `subscribe` notifies consumers of other tabs' changes. The browser factory's `createRecoveryJournal` receives the storage key, lock key, and scope. It supports a custom lock implementation; the default rejects journal changes and recovery without exclusive access. Share the lock key across all scopes using the same backend. Custom localStorage journals must hold the lock across task boundaries before reads and after writes. The standard `LocalStorageRecoveryJournal` includes these waits.

JSON metadata, backups, and localStorage sync queues reject Date, Map/Set, non-finite numbers, undefined, functions, symbols, BigInt, and circular references through `KeepStorageSerializationError`. Known optional fields may omit undefined. Healthy IndexedDB saves do not require JSON compatibility, but reserve snapshots and JSON exports may consequently fail.

Wrapping an already scoped adapter with a different scope does not switch its write destination. Such mutations reject before persistence. Create an adapter for the destination scope when switching accounts.

Refresh all tabs running the older implementation when adopting this journal. Missing deletion intent and already lost content cannot be reconstructed automatically. Complete outage views during snapshot-write failures and safe writes without an exclusive-access mechanism cannot be guaranteed.

The existing IndexedDB collection database is named `databaseName:storeName:collections`. For example, `("a:b", "c")` and `("a", "b:c")` share that database, so do not combine them within the same scope. Journal migration cannot automatically separate ambiguous data in this existing format.

**Replace imports overwrite the target data, even with an empty backup, and do not roll back.** Inspect `KeepBackupImportError.failedStage` and `applied` after partial failure. Scoped adapters reject data from another scope before mutation.

Custom `StorageAdapter` implementations need `getCollections` / `setCollection` / `removeCollection` and `getCollectionMemberships` / `setCollectionMembership` / `removeCollectionMembership` to support definitions and memberships. Provider collection creation, renaming, and removal reject before changing item assignments when definition methods are incomplete.

Browser writes to localStorage history, viewing records, and progress require the Web Locks API. Unsupported locks or unavailable storage produce errors. Construction is SSR-safe; persistent operations run in the browser.
Namespace history and progress keys per account, and pass matching language, content version, and audio ID when reading progress.

See the [repository README](../../README.md) for demos and development, and the [release notes](../../RELEASE_NOTES.md) for changes.
