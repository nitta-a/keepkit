# KeepKit Next.js Pages Router example

This example documents the Pages Router integration. Copy the directory into a Next.js application and install its dependencies; it is intentionally not part of the pnpm workspace.

## Provider placement and SSR/hydration

`pages/_app.tsx` is the single provider boundary. It creates the browser storage adapter once with `useRef`, passes the server snapshot through `initialItems`, and lets `KeepProvider` refresh from storage after hydration. The server snapshot is therefore deterministic for the first render; browser-only storage is never read while rendering on the server.

`pages/index.tsx` uses `getServerSideProps` to load the authenticated list. Keep mutations run through the client `SyncStorageAdapter`, so offline writes remain local and the adapter flushes its durable queue when the browser emits `online`.

## Authenticated API

`pages/api/keep.ts` is a small same-origin boundary. It reads the session cookie, rejects unauthenticated requests, and forwards the operation to an upstream service with a bearer token. Replace `lib/auth.ts` with the application's real session verification and set `KEEP_API_URL` before starting the app. The client sends `credentials: "include"`; it does not put tokens in browser JavaScript.

The upstream sync endpoint should return `RemoteSyncResult` (`synced` or `conflict`) and the list endpoint should return `KeepItem[]`. Implement authorization and ownership checks on every request.

## Jest and jsdom

`jest.config.cjs` uses `next/jest` and `jest-environment-jsdom`; `jest.setup.ts` installs Testing Library matchers. The test renders the provider with `initialItems`, clicks an accessible button, waits for the async state transition, and inspects the injected storage adapter. For hydration tests, render the same `initialItems` on the server and client, then assert the post-hydration adapter state after `waitFor`.

```bash
pnpm install
pnpm typecheck
pnpm test
```
