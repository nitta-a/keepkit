# Authenticated sync recipe

`createAuthenticatedSyncKit` keeps authentication and HTTP details in the host application. The token getter runs for every push and pull, so token refresh remains the responsibility of the host auth layer.

```tsx
import { createAuthenticatedSyncKit } from "@keepkit/core/core";

const keepKit = createAuthenticatedSyncKit({
  scope: { userId: currentUserId, tenantId: currentTenantId },
  getAuthToken: () => auth.getToken(),
  transport: {
    async push(operation, { token }) {
      const response = await fetch("/api/keep/sync", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(operation),
      });
      if (!response.ok) throw Object.assign(new Error("Sync request failed."), { status: response.status });
      return response.json();
    },
    async pull({ token }) {
      const response = await fetch("/api/keep/sync", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw Object.assign(new Error("Sync request failed."), { status: response.status });
      return response.json();
    },
  },
  onReauthenticate: () => auth.signIn(),
});
```

Pass `keepKit.storage` to `KeepProvider`. When the account changes, call `await keepKit.setScope(nextScope)` and remount or reset the provider using `keepKit.scopeKey`; the old account's storage and pending queue remain isolated.

If the account is only known asynchronously, pass `getScope` instead of `scope`. KeepKit resolves it before the first storage operation and does not resume or send the pending queue until then, so queued writes are never sent with another account's token after a restart. When `getScope` resolves to `undefined`, a shared `queue` only synchronizes operations without a user or tenant scope.

Once the kit knows about accounts (`scope`, `getScope`, or `setScope`), a signed-out session over a shared `local` adapter only reads and removes records without a user or tenant scope, so `clear()` never deletes another account's local data.

Return the server result from `transport.pushCollection` so collection revisions are stored and conflicts appear in `getSyncState().collectionConflicts`; resolve them with `keepKit.storage.resolveCollectionSyncConflict(id, "local" | "remote")`. If `transport.pull` returns every item for the account, pass `itemPullMode: "snapshot"` so items removed on another device are removed locally.

Permanent non-authentication 4xx push failures stay queued and appear in `keepKit.storage.getSyncState().rejectedOperations`; later independent operations continue syncing. The host can retry or discard one with `keepKit.storage.resolveRejectedSyncOperation(operationId, "retry" | "discard")`.

## 認証付き同期レシピ

`createAuthenticatedSyncKit`は認証方式やHTTPクライアントを固定しません。トークン取得はpush/pullごとに実行されるため、トークン更新はホスト側の認証基盤に任せられます。Cookie認証ではtokenを`null`にして`credentials: "include"`を利用できます。

アカウント変更時は`await keepKit.setScope(nextScope)`を呼び、`keepKit.scopeKey`をProviderの`key`などに利用して表示中のキャッシュも切り替えます。旧アカウントの保存領域と未送信キューは自動的に分離されます。

アカウントが非同期にしか判明しない場合は、`scope`の代わりに`getScope`を渡します。最初のストレージ操作の前にscopeを解決し、それまでは未送信キューの再開や送信を行わないため、再起動直後にキュー内の書き込みが別アカウントのトークンで送信されることはありません。`getScope`が`undefined`を返す場合、共有`queue`ではuser・tenant scopeを持たない操作だけを同期します。

アカウントを扱う構成（`scope`・`getScope`・`setScope`）では、未ログインのセッションが共有`local`を使っても、user・tenant scopeを持たないデータだけを読み取り・削除します。ログアウト中の`clear()`で他アカウントのローカルデータは消えません。

`transport.pushCollection`ではサーバーの結果を返してください。コレクションのrevisionを保存し、競合を`getSyncState().collectionConflicts`に通知します。競合は`keepKit.storage.resolveCollectionSyncConflict(id, "local" | "remote")`で解決します。`transport.pull`がアカウントの全アイテムを返す場合は`itemPullMode: "snapshot"`を指定すると、他の端末で削除したアイテムがローカルからも削除されます。

認証エラーなど一時的でない4xx push失敗はキューに残り、`keepKit.storage.getSyncState().rejectedOperations`で確認できます。後続の独立した操作は同期を続けます。ホストは`keepKit.storage.resolveRejectedSyncOperation(operationId, "retry" | "discard")`で再試行または破棄できます。
