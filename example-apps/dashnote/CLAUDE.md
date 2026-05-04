# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashnote/](.).

## Project Overview

React + TypeScript + Vite app for personal notes on Dash Platform testnet. Notes have an optional `title`, a required `message`, and Platform-managed `$createdAt` / `$updatedAt` / `$revision`. The UI is a flat recent-notes list plus a single editor/detail pane; auth is required to create/update/delete, but read-only browse works without a mnemonic.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/)
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

- **[src/dash/](src/dash/)** — one file per Platform SDK operation. Each exports an async function with a leading JSDoc block naming the SDK method it wraps. No hooks, no UI wrappers — the SDK call is the function. Files in this folder always reference `@dashevo/evo-sdk` (or shared core re-exports / SDK-shape types). App-shell utilities that don't touch the SDK live in [src/lib/](src/lib/) instead.
- **Shared SDK core** — [src/dash/client.ts](src/dash/client.ts) and [src/dash/keyManager.ts](src/dash/keyManager.ts) re-export `createClient` and `IdentityKeyManager` from `../../../../setupDashClient-core.mjs` (the canonical browser-safe core at the host repo root). No vendoring. The `@dashevo/evo-sdk` bare specifier is aliased in [vite.config.ts](vite.config.ts) to this app's locally installed browser bundle so the shared core resolves the SDK from here.
- **[src/session/](src/session/)** — `SessionContext.tsx` provides the context (`status`, `error`, `sdk`, `keyManager`, `identityId`, `contractId`, `setContractId`, `log`, `login`, `enterReadOnly`, `logout`) and `useSession.ts` is the consumer hook. Mnemonic lives only in the keyManager closure — never in state, never in localStorage. The SDK + `IdentityKeyManager` are dynamically imported on first auth so the ~8MB WASM bundle doesn't block initial paint.
- **[src/components/](src/components/)** — standard React. Modals/panels call `src/dash/` functions directly. Notable: [NotesWorkspace.tsx](src/components/NotesWorkspace.tsx) (two-pane list + editor with optimistic cache + background revalidation), [NoteEditor.tsx](src/components/NoteEditor.tsx) (fused title/body editor with byte-budget progress bar), [LoginModal.tsx](src/components/LoginModal.tsx) (paste-or-register contract flow).
- **[src/hooks/](src/hooks/)** — app-specific hooks: [useTheme.ts](src/hooks/useTheme.ts) (dark mode toggle), [useMediaQuery.ts](src/hooks/useMediaQuery.ts) (`window.matchMedia` via `useSyncExternalStore`).
- **[src/lib/](src/lib/)** — pure utilities, no SDK references: [logger.ts](src/lib/logger.ts) (`Logger` type + `errorMessage(err)`), [notesCache.ts](src/lib/notesCache.ts) (localStorage-backed note list keyed by identity + contract + network), [rememberedIdentity.ts](src/lib/rememberedIdentity.ts) (last-logged-in identity ID for read-only browse), [fieldLimits.ts](src/lib/fieldLimits.ts) (UTF-8 byte counters for title/message), [format.ts](src/lib/format.ts).
- **[src/dash/types.ts](src/dash/types.ts)** — shared SDK types (`DashSdk`, `DashKeyManager`, query result shapes) used across every dash helper.
- **[test/](test/)** — Vitest + Testing Library. All test files live in this flat directory and are named after the subject under test (e.g. `NotesWorkspace.test.tsx`, `SessionContext.test.tsx`, `notesCache.test.ts`) — they are **not** co-located next to source files, and the directory is **not** mirrored against `src/`. Default Vitest env is `node`; component tests opt into DOM with a `// @vitest-environment jsdom` pragma at the top of the file.

## Note contract

Schema lives in [src/dash/contract.ts](src/dash/contract.ts) as `NOTE_SCHEMAS`. One document type, `note`:

- `title` — optional string, max 120 chars, position 0
- `message` — required string, max 10000 chars, position 1
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

## Gotchas

- Update flow **must** fetch the document first to get the current revision; submitting a replace with the wrong `revision` will fail the state transition. The pattern is `BigInt(existing.revision ?? 0) + 1n`.
- `keepsHistory` on the contract is forced to `false`. `keepsHistory: true` triggers [dashpay/platform#3165](https://github.com/dashpay/platform/issues/3165) — `sdk.contracts.fetch()` returns undefined and breaks `sdk.documents.query` with "Data contract not found". v1 of dashnote shows revision metadata only — older note bodies are not reconstructable from the network.
- Read-only mode (`session.status === "readonly"`) sets `keyManager` to `null`. Any write path (`createNote`, `updateNote`, `deleteNote`, `registerContract`) must guard for an authenticated session.
- The notes cache in [src/lib/notesCache.ts](src/lib/notesCache.ts) is keyed by `identityId + contractId + network`. Switching identity, contract, or network invalidates the cache. Schema is versioned (`SCHEMA_VERSION = 1`); bumping it discards prior cached payloads.
- Background revalidation runs every `BACKGROUND_REFRESH_MS` (30s); refocus revalidation is throttled to `FOCUS_REFRESH_MIN_MS` (10s). Both compare via `notesEqualByRevision` so identical results don't trigger re-renders.
- Title/message length is enforced in **bytes**, not chars — emoji and non-ASCII multi-byte sequences eat budget. [src/lib/fieldLimits.ts](src/lib/fieldLimits.ts) is the source of truth; the editor's progress bar and the contract `maxLength` should stay in sync.
- The `Logger` from [src/lib/logger.ts](src/lib/logger.ts) is plumbed through every dash helper. `level: "success"` and `level: "error"` also raise sonner toasts via `SessionContext.log`.
- The Evo SDK WASM bundle is ~8MB; this is expected and not a build error.
- `allowJs: true` in [tsconfig.app.json](tsconfig.app.json) so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root.
