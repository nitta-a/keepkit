# Next.js App Router example

This example shows the recommended App Router boundary for `@keepkit/ui`:

- `app/page.tsx` stays a Server Component and provides an `initialItems` snapshot.
- `app/saved-collection.tsx` is the small `"use client"` boundary that owns the browser storage adapter and UI provider.
- `KeepKitProvider` hydrates the snapshot first, then refreshes from the local adapter.

```bash
pnpm install
pnpm --dir examples/next-app-router dev
```

The example uses `@keepkit/core@^0.6.0` and `@keepkit/ui@^0.6.0`. Replace the static snapshot with a server loader or route handler in a real application; authentication and remote APIs remain application concerns.
