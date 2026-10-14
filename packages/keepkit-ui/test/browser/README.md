# Browser regressions

```bash
pnpm build
pnpm exec playwright install chromium firefox webkit
pnpm typecheck:browser
pnpm test:browser
```

Playwright starts a dedicated Vite fixture on port 4189. Each test has an isolated browser context and uses native
IndexedDB, localStorage, storage events, BroadcastChannel and Web Locks. The fixture injects availability and quota
errors at backend boundaries while preserving the browser's actual persistence implementation. Session storage keeps
fault controls across reloads; concurrent tabs share the persistence backend and journal.

On macOS, Firefox's `MOZ_APP_DATA` and `MOZ_LOCAL_APP_DATA` point to fresh temporary directories so tests do not use
the installed Firefox application's protected data directory. Browser profiles remain Playwright-managed.

The suite covers durable snapshots, failed projections, operation replay after reload, scope isolation, concurrent tabs,
missing Web Locks, checkpoint retries, approved repair recovery and retained backups. UI cases exercise compound links,
open recording, removal confirmation, keyboard focus, retry, Undo and explicit recovery approval.

CI runs Chromium, Firefox and WebKit independently of the unit-test job. Failure reports, screenshots and traces are
retained in the `browser-failure-report` artifact. Local results use `playwright-report/` and `test-results/`.
