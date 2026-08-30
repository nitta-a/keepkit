# Repository Guide for Coding Agents

## Scope

This file applies to the entire repository. Keep changes focused on the requested task and preserve unrelated working-tree changes.

## Repository Overview

KeepKit is a pnpm/Turborepo monorepo for a headless, async-first save-and-collect toolkit for React applications.

- `packages/keepkit` is the single publishable package, named `@keepkit/core`.
- `apps/demo` is the Vite/React example application and integration test surface.
- `packages/keepkit/src` contains the package implementation; `packages/keepkit/test` contains framework-neutral tests.
- `apps/demo/src` contains the demo application and React/browser tests.
- `scripts/check-package.mjs` validates the publishable package, and `scripts/check-release-version.mjs` validates release tags.

The package is split into public entry points:

- `@keepkit/core/core` contains framework-neutral primitives such as the store, item types, storage adapters, schema validation, migrations, backups, and integrations. It must not import React.
- `@keepkit/core/react` contains `KeepProvider`, `KeepButton`, React hooks, and `createKeepKit`.
- `@keepkit/core/storage` exposes storage adapters, including localStorage, IndexedDB, fallback, and sync-queue adapters.
- `@keepkit/core/schema` exposes schema parsing and validation helpers.
- The package exposes explicit `@keepkit/core/core`, `@keepkit/core/react`, `@keepkit/core/storage`, and `@keepkit/core/schema` entry points. There is no root package export.

Persistence is abstracted behind `StorageAdapter`. Browser storage is IndexedDB-first with localStorage fallback, while remote synchronization is supplied through an injectable `RemoteSyncDriver` and `SyncStorageAdapter`. Authentication, server APIs, and vendor-specific integrations remain outside the package.

## Toolchain and Commands

- Use Node.js `>=22.22.2` and pnpm `11.24.0` as declared by the repository configuration.
- pnpm is the only supported package manager. Do not use npm or yarn, and do not replace `pnpm-lock.yaml` with another lockfile.
- Install dependencies with `pnpm install --frozen-lockfile` when the lockfile is expected to be current.
- Start the workspace development tasks with `pnpm dev`; this runs the demo and package watch tasks through Turbo.
- Run the demo alone with `pnpm --filter @keepkit/demo dev`.
- Run package tests with `pnpm --filter @keepkit/core test`. These use Node's built-in `node:test` runner against the built `dist` files.
- Run demo tests with `pnpm --filter @keepkit/demo test`. These use Vitest with a jsdom environment and Testing Library.

Repository-level commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm lint` runs each workspace package's TypeScript no-emit check. For Biome formatting and linting, use `pnpm check` or the narrower `pnpm format:check` and `pnpm lint:biome` commands. During development, prefer the narrowest relevant package command; before handoff, run the checks covering changed behavior and report anything that could not be run.

Other useful commands include `pnpm package:check`, `pnpm release:check -- v0.1.0`, `pnpm format`, and `pnpm clean`.

Do not commit generated `dist/`, `.turbo/`, Vite cache output, or other ignored build artifacts. Update `pnpm-lock.yaml` only when dependency metadata changes.

## Code Conventions

- Keep the project ESM-only and compatible with the repository TypeScript settings.
- Preserve strict typing. Avoid `any`, non-null assertions, and casts that bypass validation when a type guard or explicit check can express the invariant.
- Use `import type` for type-only imports and keep public imports routed through `@keepkit/core` entry points when consuming the package.
- Use Biome's configured style: two-space indentation, double quotes, semicolons, and a 120-column line width. End source and configuration files with a newline.
- Keep framework-neutral behavior in `src/core.ts` and the modules it exports. React behavior belongs in `src/react.ts`, hooks, components, and provider modules.
- Keep browser-specific access guarded or injectable so framework-neutral code and SSR/RSC consumers can import it safely.
- Treat `KeepItem`, serialized backups, storage adapter contracts, sync operations, schema contracts, exports, and error classes as public API. Avoid accidental breaking changes and update tests and README examples for deliberate API changes.
- Keep storage, sync, schema, and migration logic deterministic and independently testable. Do not add authentication, network calls, or vendor SDKs to the core package.
- Preserve the package `exports` map and the `dist`-only publish layout when changing package entry points.

### Function and data-shaping style

- Prefer early returns and explicit `if` statements for simple branches.
- Keep short expressions and object literals on one line when they fit the configured width.
- Destructure values before building related objects and use shorthand properties where clear.
- For calls with several derived arguments, calculate named values first and pass a meaningful object when that improves readability.
- Extract complex callbacks passed to `map`, `filter`, `flatMap`, or similar methods into named functions; short predicates and projections may remain inline.

### React and browser behavior

- Keep components accessible and style-free unless styling is explicitly part of the requested change.
- Preserve `KeepButton` keyboard behavior, ARIA state, `asChild`, and render-props behavior.
- Keep hooks focused and ensure effects do not run against unavailable browser globals during SSR.
- Prefer observable behavior and accessible roles/labels in React tests. Cover focus and keyboard behavior when changing interactive components.
- Do not introduce a framework dependency into the framework-neutral entry point.

## Testing Expectations

- Add or update tests for every behavior change, including failure paths and boundary cases.
- Core tests use `node:test` and `node:assert/strict`; they import built files from `packages/keepkit/dist`, so build the package before running or use its package test script.
- Demo tests use Vitest, jsdom, `@testing-library/react`, and `@testing-library/jest-dom`.
- Prefer deterministic fixtures and injected storage/browser implementations. Tests must not depend on live network services, real databases, authentication, wall-clock timing, or test order.
- Test adapter contracts such as CRUD behavior, defensive copying, fallback behavior, malformed data, quota/access errors, duplicate handling, synchronization, and retry/conflict paths where relevant.
- When changing shared public types or package exports, validate both `@keepkit/core` and `@keepkit/demo`.

## Documentation and Releases

- Update `README.md` and `packages/keepkit/README.md` when changing public APIs, package entry points, installation, behavior, or development commands. Keep the Japanese and English sections aligned.
- Keep package manifests, the `exports` map, published files, README examples, and release notes synchronized with public changes.
- Do not change package versions or release workflow behavior unless the task explicitly concerns a release.
- Use `pnpm package:check` to verify the publishable package and `pnpm release:check -- vX.Y.Z` to verify that a release tag matches all publishable package versions.
