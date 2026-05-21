# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashnote/](.).

## Project Overview

React + TypeScript + Vite app for personal notes on Dash Platform testnet. Notes have an optional `title`, a required `message`, and Platform-managed `$createdAt` / `$updatedAt` / `$revision`. The shell is a three-tab `AppShell` (`notes` / `how-it-works` / `settings`); the Notes tab is a two-pane list + editor workspace. Auth is required to create/update/delete and accepts either a BIP-39 mnemonic _or_ a WIF private key for a HIGH/CRITICAL authentication key. Read-only browse works without auth — including a "browse as the previous user" path keyed off the last-logged-in identity ID.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/)
- `npm run test:e2e` — Playwright suite in [test/e2e/](test/e2e/) (auto-boots Vite on :5181)
- `npm run test:e2e:ui` — Playwright with the interactive UI runner
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

- **[src/dash/](src/dash/)** — one file per Platform SDK operation: [createNote.ts](src/dash/createNote.ts), [updateNote.ts](src/dash/updateNote.ts), [deleteNote.ts](src/dash/deleteNote.ts), [queries.ts](src/dash/queries.ts), [contract.ts](src/dash/contract.ts), [loginWithPrivateKey.ts](src/dash/loginWithPrivateKey.ts), [resolveDpnsName.ts](src/dash/resolveDpnsName.ts). Each exports an async function with a leading JSDoc block naming the SDK method it wraps. No hooks, no UI wrappers — the SDK call is the function. Files in this folder always reference `@dashevo/evo-sdk` (or shared core re-exports / SDK-shape types). App-shell utilities that don't touch the SDK live in [src/lib/](src/lib/) instead. Two deferred-import loaders live alongside the operations: [sdkModule.ts](src/dash/sdkModule.ts) caches a `import("@dashevo/evo-sdk")` so value imports (`Document`, `DataContract`, `Identifier`) stay out of the entry chunk, and [types.ts](src/dash/types.ts) holds the shared SDK type aliases used everywhere.
- **Shared SDK core** — [src/dash/client.ts](src/dash/client.ts) and [src/dash/keyManager.ts](src/dash/keyManager.ts) re-export `createClient` and `IdentityKeyManager` from `../../../../setupDashClient-core.mjs` (the canonical browser-safe core at the host repo root). No vendoring. The `@dashevo/evo-sdk` bare specifier is aliased in [vite.config.ts](vite.config.ts) to this app's locally installed browser bundle so the shared core resolves the SDK from here.
- **[src/session/](src/session/)** — `SessionContext.tsx` provides the context (`status`, `error`, `sdk`, `keyManager`, `identityId`, `contractId`, `rememberedIdentityId`, `dpnsName`, `setContractId`, `log`, `login`, `enterReadOnly`, `viewAsRemembered`, `forgetIdentity`, `logout`) and `useSession.ts` is the consumer hook. `login(secret, options)` auto-detects mnemonic vs WIF via [detectSecretShape](src/lib/detectSecretShape.ts): mnemonics use `IdentityKeyManager` (DIP-13 derivation with optional `identityIndex`); WIF dispatches to `loginWithPrivateKey` (dynamic-imported to keep its SDK dependency off the app shell), which produces a single-key manager via [keyManagerFromKey.ts](src/session/keyManagerFromKey.ts). Mnemonic + WIF live only in the keyManager closure — never in state, never in localStorage. `SessionContext` has its own small loader for the shared core (`createClient`, `IdentityKeyManager`); the `@dashevo/evo-sdk` value-import loader is the separate [sdkModule.ts](src/dash/sdkModule.ts) used by `createNote` / `updateNote` / `deleteNote` / `contract.ts`. Both are dynamically imported on first use so the ~8MB WASM bundle doesn't block initial paint. After a successful login the context also resolves the identity's DPNS name via [resolveDpnsName.ts](src/dash/resolveDpnsName.ts) and persists it alongside the remembered identity ID.
- **[src/components/](src/components/)** — standard React. Modals/panels call `src/dash/` functions directly. Shell: [AppShell.tsx](src/components/AppShell.tsx), [Tabs.tsx](src/components/Tabs.tsx), [NavButton.tsx](src/components/NavButton.tsx), [HowItWorks.tsx](src/components/HowItWorks.tsx). Workspace: [NotesWorkspace.tsx](src/components/NotesWorkspace.tsx) (two-pane list + editor with optimistic cache + background revalidation), [NoteList.tsx](src/components/NoteList.tsx), [NoteEditor.tsx](src/components/NoteEditor.tsx) (fused title/body editor with byte-budget progress bar), [DeleteNoteModal.tsx](src/components/DeleteNoteModal.tsx) (confirmation modal for deletes). Auth + settings: [LoginModal.tsx](src/components/LoginModal.tsx) (mnemonic-or-WIF paste flow with remembered-identity panel), [SettingsPanel.tsx](src/components/SettingsPanel.tsx) (settings tab — contract paste / register, identity card, local-data controls), [IdentityCard.tsx](src/components/IdentityCard.tsx). Shared primitives: [Modal.tsx](src/components/Modal.tsx), [OperationResultNotice.tsx](src/components/OperationResultNotice.tsx).
- **[src/hooks/](src/hooks/)** — app-specific hooks: [useTheme.ts](src/hooks/useTheme.ts) (dark mode toggle), [useMediaQuery.ts](src/hooks/useMediaQuery.ts) (`window.matchMedia` via `useSyncExternalStore`), [useContractRegistration.ts](src/hooks/useContractRegistration.ts) (Settings flow for paste-or-register), [useWifPreview.ts](src/hooks/useWifPreview.ts) (eager identity + key-fitness preview on WIF paste in the login modal).
- **[src/lib/](src/lib/)** — pure utilities, no SDK references: [logger.ts](src/lib/logger.ts) (`Logger` type + `errorMessage(err)`), [notesCache.ts](src/lib/notesCache.ts) (localStorage-backed note list keyed by identity + contract + network), [rememberedIdentity.ts](src/lib/rememberedIdentity.ts) (last-logged-in identity ID + DPNS name for read-only browse), [fieldLimits.ts](src/lib/fieldLimits.ts) (UTF-8 byte counters for title/message), [format.ts](src/lib/format.ts), [detectSecretShape.ts](src/lib/detectSecretShape.ts) (mnemonic-vs-WIF classifier used by `login` and the login modal preview).
- **[src/dash/types.ts](src/dash/types.ts)** — shared SDK types (`DashSdk`, `DashKeyManager`, query result shapes) used across every dash helper.
- **[public/dashnote-lite.html](public/dashnote-lite.html)** — single-file zero-build companion. Read-only Recent notes (with optional owner filter) + Get-by-ID only, loads `@dashevo/evo-sdk` from `esm.sh`, and ships alongside the React app at `<...>/dashnote/dashnote-lite.html` (Vite copies `public/*` into `dist/`). Intentionally self-contained as a learning reference — don't import app code into it.
- **[test/](test/)** — Vitest + Testing Library. All test files live in this flat directory and are named after the subject under test (e.g. `NotesWorkspace.test.tsx`, `SessionContext.test.tsx`, `notesCache.test.ts`) — they are **not** co-located next to source files, and the directory is **not** mirrored against `src/`. Default Vitest env is `node`; component tests opt into DOM with a `// @vitest-environment jsdom` pragma at the top of the file.
- **[test/e2e/](test/e2e/)** — Playwright specs plus shared `fixtures.ts`. Driven by [playwright.config.ts](playwright.config.ts), which loads `PLATFORM_MNEMONIC` from `../../.env` (repo root, with optional `dashnote/.env` override) and auto-starts `npx vite` on port 5181. The suite runs against real testnet — no SDK mocks. Two projects (`chromium-desktop` using `Desktop Chrome` and `chromium-mobile` using `Pixel 7`) so every spec exercises both layouts; viewport-only flows are guarded inline with `test.skip(testInfo.project.name !== "chromium-mobile", …)` rather than living in a dedicated file. Auth-gated specs sit in `test.describe.configure({ mode: "serial" })` and `test.skip` cleanly when `PLATFORM_MNEMONIC` is unset (via the `HAS_MNEMONIC` flag from `fixtures.ts`).

## Note contract

Schema lives in [src/dash/contract.ts](src/dash/contract.ts) as `NOTE_SCHEMAS`. One document type, `note`:

- `title` — optional string, max 120 chars, position 0
- `message` — required string, no schema `maxLength`; the real cap is the system-level `max_field_value_size` (5120 bytes / 5 KiB), enforced by the network. The UI gates input to that byte limit via [src/lib/fieldLimits.ts](src/lib/fieldLimits.ts).
- `$createdAt`, `$updatedAt` — required (Platform-managed)
- Indices: `byOwnerUpdated` (`$ownerId`, `$updatedAt`) and `byOwnerCreated` (`$ownerId`, `$createdAt`)
- `documentsMutable: true`, `canBeDeleted: true` — notes are editable and deletable

`DEFAULT_CONTRACT_ID` is `8d6heK6CoskLBi6Rs7cChRG9RuckcZqZst28BdviBe8y`. Overrides are stored under `localStorage['dashnote.contractId']`. Settings can also register a fresh contract for the logged-in identity and immediately switch the app to it.

## SDK Patterns

- **Connect**: `await createClient("testnet")` from [client.ts](src/dash/client.ts) — re-exported from the shared core, which internally does `EvoSDK.testnetTrusted()` + `sdk.connect()`. App code never constructs the SDK directly.
- **Key derivation**: `IdentityKeyManager` from the shared core; `keyManager.getAuth()` returns `{ identity, identityKey, signer }`
- **Register contract**: `new DataContract({ ownerId, identityNonce, schemas, fullValidation })` then `sdk.contracts.publish({ dataContract, identityKey, signer })`. Nonce is `(sdk.identities.nonce(id) || 0n) + 1n`.
- **Create note**: `sdk.documents.create({ document, identityKey, signer })` where `document = new Document({ properties: { title?, message }, documentTypeName: "note", dataContractId, ownerId })`
- **Update note**: fetch existing via `sdk.documents.get(...)`, bump `revision = BigInt(existing.revision) + 1n`, then `sdk.documents.replace({ document, identityKey, signer })`
- **Delete note**: `sdk.documents.delete({ document: { id, ownerId, dataContractId, documentTypeName: "note" }, identityKey, signer })`
- **List my notes**: `sdk.documents.query({ dataContractId, documentTypeName: "note", where: [["$ownerId", "==", ownerId]], orderBy: [["$ownerId", "asc"], ["$updatedAt", "asc"]], limit })`
- **Get one note**: `sdk.documents.get(contractId, "note", noteId)`

`normalizeNotes()` and `normalizeSingleNote()` in [queries.ts](src/dash/queries.ts) flatten whatever shape `sdk.documents.query` / `sdk.documents.get` returns (array, Map, or plain object) into `NoteRecord[]` so UI code never branches on it.

## Performance — load-anchor rules (don't unwind these)

The `@dashevo/evo-sdk` browser bundle is ~8 MB. A single top-level `import { … } from "@dashevo/evo-sdk"` in any file reachable from `App.tsx` anchors that chunk to the entry graph, even when the import is only used inside an async function — Vite hoists the static import and the SDK becomes a boot-critical dependency. [dashpay/platform-tutorials#77](https://github.com/dashpay/platform-tutorials/pull/77) measured the difference on a throttled Slow-4G + 4× CPU Lighthouse run: First Contentful Paint **16.1 s → 1.7 s**, Largest Contentful Paint **30.8 s → 2.0 s**, Performance score **0.55 → 0.98**. Total bytes are unchanged — the win is that the SDK no longer blocks first paint.

Four rules keep that win in place. Don't undo them without re-running Lighthouse:

1. **Never add a top-level value import from `@dashevo/evo-sdk` to any file in [src/dash/](src/dash/) or [src/session/](src/session/) that is statically reachable from `App.tsx`.** Type-only imports are fine (they're erased). Value imports — `Document`, `DataContract`, `Identifier`, `PrivateKey`, `IdentitySigner`, `Purpose`, `SecurityLevel`, etc. — must go through [src/dash/sdkModule.ts](src/dash/sdkModule.ts)'s cached dynamic `import("@dashevo/evo-sdk")`.
2. **Two distinct SDK loaders exist on purpose — don't merge them.** [src/dash/sdkModule.ts](src/dash/sdkModule.ts) loads the SDK package for the document/contract helpers. `SessionContext.tsx` has a separate cached `import("../../../../setupDashClient-core.mjs")` for `createClient` + `IdentityKeyManager` (the shared browser-safe core). Different specifiers, different concerns — collapsing them would force one async load to wait on the other.
3. **`SessionContext` dynamic-imports `loginWithPrivateKey` from inside `login()`** (not at the top of the file). That file pulls `PrivateKey`/`IdentitySigner`/`Purpose`/`SecurityLevel` from `@dashevo/evo-sdk` as value imports; a static import in `SessionContext` would drag the SDK into the entry chunk and defeat #1. The mnemonic branch already triggers the SDK fetch via the core loader, so only the WIF path needs this guard.
4. **The `modulePreload.resolveDependencies` filter in [vite.config.ts](vite.config.ts) must keep stripping the `evo-sdk` chunk.** Vite auto-injects `<link rel="modulepreload">` for every dynamic-import dependency it discovers at build time — without the filter, the browser races to fetch the 8 MB SDK in parallel with the entry chunk, which silently re-blocks FCP even though all the imports are syntactically dynamic. The `<link>` is the regression vector, not the `import()` call.

Adjacent invariants that fall out of the same design:

- The synchronous exports of [src/dash/contract.ts](src/dash/contract.ts) — `NOTE_SCHEMAS`, `loadStoredContractId`, `saveContractId`, `clearStoredContractId`, `DEFAULT_CONTRACT_ID` — must stay synchronous. `SessionContext` and `App.tsx` call them during initial render before the SDK has loaded. The SDK-dependent helpers in the same file (`registerContract`, `refreshContractCache`) are async and await `loadSdkModule()` internally.
- After build, `dist/assets/index-*.js` should contain **zero** static `from "./evo-sdk.module-*.js"` references and the SDK should only appear behind dynamic `import()` calls. That's the regression check from #77 — worth re-running if anything in [src/dash/](src/dash/) or [src/session/](src/session/) grows a new top-level SDK import.

## Gotchas

- Update flow **must** fetch the document first to get the current revision; submitting a replace with the wrong `revision` will fail the state transition. The pattern is `BigInt(existing.revision ?? 0) + 1n`.
- `keepsHistory` on the contract is forced to `false`. `keepsHistory: true` triggers [dashpay/platform#3165](https://github.com/dashpay/platform/issues/3165) — `sdk.contracts.fetch()` returns undefined and breaks `sdk.documents.query` with "Data contract not found". v1 of dashnote shows revision metadata only — older note bodies are not reconstructable from the network.
- Read-only mode (`session.status === "readonly"`) sets `keyManager` to `null`. Any write path (`createNote`, `updateNote`, `deleteNote`, `registerContract`) must guard for an authenticated session.
- The notes cache in [src/lib/notesCache.ts](src/lib/notesCache.ts) is keyed by `identityId + contractId + network`. Switching identity, contract, or network invalidates the cache. Schema is versioned (`SCHEMA_VERSION = 1`); bumping it discards prior cached payloads.
- Background revalidation runs every `BACKGROUND_REFRESH_MS` (30s); refocus revalidation is throttled to `FOCUS_REFRESH_MIN_MS` (10s). Both compare via `notesEqualByRevision` so identical results don't trigger re-renders.
- Title/message length is enforced in **bytes**, not chars — emoji and non-ASCII multi-byte sequences eat budget. [src/lib/fieldLimits.ts](src/lib/fieldLimits.ts) is the source of truth and matches the network's `max_field_value_size` (5120 B). JSON Schema `maxLength` counts characters not bytes, so it can't accurately mirror this — the message field intentionally has no `maxLength` to avoid promising a cap the network doesn't honor.
- The `Logger` from [src/lib/logger.ts](src/lib/logger.ts) is plumbed through every dash helper. `level: "success"` and `level: "error"` also raise sonner toasts via `SessionContext.log`.
- The Evo SDK WASM bundle is ~8MB; this is expected and not a build error. See the [Performance](#performance--load-anchor-rules-dont-unwind-these) section above for the load-anchor rules that keep it off the boot critical path.
- `allowJs: true` in [tsconfig.app.json](tsconfig.app.json) so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root.
