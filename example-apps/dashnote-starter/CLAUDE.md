# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashnote-starter/](.).

## Project Overview

React + TypeScript + Vite example for Dash Platform notes. Sits between [dashnote-lite.html](../dashnote/public/dashnote-lite.html) (read-only, no build) and the full [dashnote](../dashnote/) app (mobile layouts, activity log, theming, optimistic UI). The starter does full CRUD with mnemonic auth and React as a thin render layer — no Context, no custom hooks, no Tailwind, no state libraries.

The bar for changes here is "would a learner reading this top-to-bottom be helped by this?" If the answer is no, the change probably belongs in the full app, not here.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run format` / `format:check` — Prettier (double quotes; an empty `.prettierrc.json` shields this app from the repo-root single-quote config)
- `npm run preview` — serve production build locally

No test suite. Lint + tsc + manual smoke is the floor.

## Architecture

- **[src/dash/](src/dash/)** — one file per Platform SDK operation. Copied verbatim from the full app's `src/dash/` (minus `loginWithPrivateKey.ts` and `resolveDpnsName.ts`). Each exports an async function with a leading JSDoc block naming the SDK method it wraps.
- **Shared SDK core** — [src/dash/client.ts](src/dash/client.ts) and [src/dash/keyManager.ts](src/dash/keyManager.ts) re-export `createClient` and `IdentityKeyManager` from `../../../../setupDashClient-core.mjs` at the repo root. Same arrangement as the full app — no vendoring. The `@dashevo/evo-sdk` bare specifier is aliased in [vite.config.ts](vite.config.ts) to this app's local browser bundle.
- **[src/App.tsx](src/App.tsx)** — top-level component. Holds session state (sdk, keyManager, identityId), notes list, editing state, and the four CRUD handlers + sign-in + sign-out + refresh. **No Context**: state lives here and flows down via props. Mnemonic never enters App state — it lives only in `SignIn`'s local input until it's passed up to `handleSignIn`, where it's consumed by `IdentityKeyManager.create` and immediately discarded.
- **[src/components/](src/components/)** — three components: `SignIn`, `NoteEditor` (single component for create + edit, mode switched by the `note` prop), and `NoteList`. All functional, all local state via `useState`. No custom hooks.
- **[src/dash/contract.ts](src/dash/contract.ts)** — only exports `DEFAULT_CONTRACT_ID` (hardcoded testnet contract). The schema lives in the full app's `contract.ts`; if the schema ever changes, both apps need to publish a new contract anyway, so duplicating it here adds maintenance cost with no upside.
- **[src/lib/logger.ts](src/lib/logger.ts)** — a trimmed copy of the full app's `Logger` type, just enough for the dash/ helpers' `log?.()` calls. The starter wires `log` to a single status string rather than an activity log.

## SDK Patterns

- **Connect**: `createClient("testnet")` from the shared core, dynamically imported in [App.tsx](src/App.tsx) inside `handleSignIn`.
- **Mnemonic auth**: `IdentityKeyManager.create({ sdk, mnemonic, network, identityIndex })`. Always identity index 0; multi-identity wallets are out of scope.
- **Create / update / delete** match the full app: `sdk.documents.create`, `sdk.documents.get` + `sdk.documents.replace` (with `revision = BigInt(existing.revision) + 1n`), `sdk.documents.delete`.
- **List**: `sdk.documents.query` with `where: [["$ownerId", "==", ownerId]]` and `orderBy: [["$ownerId", "asc"], ["$updatedAt", "asc"]]`.
- **Stale-revision check**: [updateNote.ts](src/dash/updateNote.ts) accepts an optional `expectedRevision`. If the network's revision doesn't match, the write is refused before submitting — basic optimistic concurrency. This is the one SDK pattern the starter teaches that the lite app doesn't and the full app handles with a fancier conflict UI.

## Performance — load-anchor rules

Same as the full app. The `@dashevo/evo-sdk` browser bundle is ~8MB; a top-level value import in any file reachable from `App.tsx` anchors that chunk to the entry graph and silently regresses FCP.

Three guards keep that win:

1. **No top-level value imports from `@dashevo/evo-sdk`** in any file reachable from `App.tsx`. Type-only imports are fine. Value imports (`Document`, `Identifier`) must go through [src/dash/sdkModule.ts](src/dash/sdkModule.ts)'s cached dynamic `import("@dashevo/evo-sdk")`.
2. **`App.tsx` dynamically imports `setupDashClient-core.mjs`** via a module-level `loadSdkCore()`. The shared-core import is distinct from the SDK-module import — collapsing them would force one async load to wait on the other.
3. **`modulePreload.resolveDependencies` filter in [vite.config.ts](vite.config.ts)** strips the `evo-sdk` chunk from auto-injected `<link rel="modulepreload">` tags. The `<link>` is the regression vector, not the `import()` call.

Regression check: `grep 'from "[^"]*evo-sdk' dist/assets/index-*.js` after `npm run build` should return nothing — the SDK should appear only behind a dynamic `import()`.

## Note contract

Hardcoded to the same default the full app uses. Notes created here interoperate with the full app and vice versa. Schema and registration logic live in the full app's [contract.ts](../dashnote/src/dash/contract.ts).

## Gotchas

- Update flow **must** fetch the document first to get the current revision. Submitting a replace with the wrong `revision` will fail the state transition. The pattern is `BigInt(existing.revision ?? 0) + 1n` — see [updateNote.ts](src/dash/updateNote.ts).
- The 8MB WASM bundle is expected on first SDK load; this is not a build error.
- `allowJs: true` in [tsconfig.app.json](tsconfig.app.json) so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root.
- Identity-nonce collisions (the network reporting "nonce already present at tip") can happen if writes are submitted faster than the network's nonce propagation. The starter shows the raw error and lets the user retry rather than implementing a conflict UI — see the full app for the resolution pattern.
- React is treated as a render layer, not the subject. Resist the urge to introduce Context, custom hooks, a state library, Tailwind, a toast library, or animation libraries. The full app exists for those patterns.
