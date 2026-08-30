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

`useKeepItem(id, payload)` では保存、切り替え、削除、ノート更新を行えます。`useKeepList()` ではコレクションの取得、絞り込み、クリアができます。`LocalStorageAdapter` はSSR環境からimportでき、`StorageAdapter<TMeta>` を実装することでサーバー側のストアに接続できます。

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

Use `useKeepItem(id, payload)` for saving, toggling, removing, and updating notes. Use `useKeepList()` to read, filter, or clear the collection. `LocalStorageAdapter` is safe to import in SSR environments; implement `StorageAdapter<TMeta>` to connect a server-backed store.

See the [root README](../../README.md) for detailed usage and development commands, and the [release notes](../../RELEASE_NOTES.md) for the current changes.
