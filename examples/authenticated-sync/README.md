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

## 認証付き同期レシピ

`createAuthenticatedSyncKit`は認証方式やHTTPクライアントを固定しません。トークン取得はpush/pullごとに実行されるため、トークン更新はホスト側の認証基盤に任せられます。Cookie認証ではtokenを`null`にして`credentials: "include"`を利用できます。

アカウント変更時は`await keepKit.setScope(nextScope)`を呼び、`keepKit.scopeKey`をProviderの`key`などに利用して表示中のキャッシュも切り替えます。旧アカウントの保存領域と未送信キューは自動的に分離されます。
