# @keepkit/core

[日本語](#日本語) | [English](#english)

## 日本語

フレームワーク中立の保存・コレクションプリミティブとReactの低レベルbindingを提供します。通常のReactアプリケーションでは、より少ないコードで利用できる`@keepkit/ui`を推奨します。

```tsx
import { KeepButton, KeepProvider, useKeepItem, useKeepList } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

const storage = createBrowserStorageAdapter({ key: "my-app:items" });
const article = { id: "article-123", targetType: "article", meta: { title: "Example", url: "/article" } };

<KeepProvider storage={storage}>
  <KeepButton item={article} />
</KeepProvider>;

const item = useKeepItem(article);
const list = useKeepList({
  targetType: "article",
  search: { query: "react" },
  sort: { by: "updatedAt", direction: "desc" },
  pagination: { page: 1, pageSize: 20 },
});
```

`KeepItemInput`は`id`、`meta`、`targetType`、`note`、`tags`だけを持つ最小入力です。保存時刻・更新時刻・タグ正規化は内部で処理されます。

`KeepListQuery`は`targetType`、`tags`、`search`、`sort`、`pagination`、`filter`、`savedBetween`で構成されます。`queryKeepItems`はReactなしで同じ条件を適用できます。

`@keepkit/core/core`はフレームワーク中立、`@keepkit/core/react`はReact、`@keepkit/core/storage`はlocalStorage、IndexedDB、fallback、同期adapter、`@keepkit/core/schema`はschema処理を公開します。パッケージルートにはexportがありません。

`KeepProvider`には描画エラーを局所化する`fallback`、`onBoundaryError`、`boundaryResetKey`を指定できます。より細かい境界が必要な場合は`KeepErrorBoundary`を`@keepkit/core/react`から利用できます。

保存対象の公開状態は`KeepItem.status`（`expired`、`removed`、`private`など）と`statusReason`で保持できます。`KeepProvider`の`validateItem` / `resolveItem`を指定すると、引数なしの`revalidateItems()`で検証できます。`revalidateItems`に`removeStatuses`を渡すと検出したアイテムを保存一覧から削除します。`SyncStorageAdapter`は`userId`、`tenantId`、`maxRetries`、`retryDelayMs`、`retryBackoff`に対応し、`retrySync()`で失敗後の同期を再開できます。

### 0.4.xからの変更

- `createKeepKit`は`Provider`、`Button`、`useContext`、`useItem`、`useList`、`useShortcut`を返します。
- `useKeepItem(id, payload)`は`useKeepItem(item)`に変わりました。
- `useKeepShortcut({ id, itemPayload })`は`useKeepShortcut({ item })`に変わりました。
- `KeepListOptions`は`KeepListQuery`に変わり、一覧条件は`search`、`sort`、`pagination`へ統一されました。

## English

`@keepkit/core` provides framework-neutral saved-collection primitives and low-level React bindings. For standard React applications, use `@keepkit/ui` for the shortest integration path.

```tsx
import { KeepButton, KeepProvider, useKeepItem, useKeepList } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

const storage = createBrowserStorageAdapter({ key: "my-app:items" });
const article = { id: "article-123", targetType: "article", meta: { title: "Example", url: "/article" } };

<KeepProvider storage={storage}>
  <KeepButton item={article} />
</KeepProvider>;

const item = useKeepItem(article);
const list = useKeepList({
  targetType: "article",
  search: { query: "react" },
  sort: { by: "updatedAt", direction: "desc" },
  pagination: { page: 1, pageSize: 20 },
});
```

`KeepItemInput` is a minimal input containing `id`, `meta`, `targetType`, `note`, and `tags`. KeepKit owns persistence timestamps and tag normalization. `KeepListQuery` uses the canonical `targetType`, `tags`, `search`, `sort`, `pagination`, `filter`, and `savedBetween` fields.

Use `@keepkit/core/core` for framework-neutral code, `@keepkit/core/react` for React bindings, `@keepkit/core/storage` for browser/fallback/sync adapters, and `@keepkit/core/schema` for schema validation. The package root has no export.

`KeepProvider` accepts `fallback`, `onBoundaryError`, and `boundaryResetKey` to isolate unexpected render errors. Use the standalone `KeepErrorBoundary` from `@keepkit/core/react` when a smaller boundary is appropriate.

`KeepItem.status` and `statusReason` preserve source availability such as `expired`, `removed`, and `private`. Configure `KeepProvider` with `validateItem` / `resolveItem` to make `revalidateItems()` use those hooks by default. Pass `removeStatuses` to remove detected items from storage. `SyncStorageAdapter` supports scoped queues with `userId` and `tenantId`, configurable retries/backoff, and explicit `retrySync()` recovery.

The v0.5 factory returns `Provider`, `Button`, `useContext`, `useItem`, `useList`, and `useShortcut`. Existing v0.4 applications should follow the migration guide in the repository root.
