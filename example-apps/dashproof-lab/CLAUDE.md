# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashproof-lab/](.).

## Project Overview

React + TypeScript + Vite app demonstrating proof-of-existence on Dash Platform testnet. Users select a file, the browser hashes it locally with `crypto.subtle.digest("SHA-256", ...)`, and only the 32-byte digest plus small metadata is anchored on Platform. Verification queries by exact hash.

Files never leave the browser. `$createdAt` from the resulting document is the proof timestamp shown in the UI.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/)
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

- **[src/dash/](src/dash/)** — one file per Platform SDK operation. Each exports an async function with a leading JSDoc block naming the SDK method it wraps. No hooks, no wrappers — the SDK call is the function.
- **Shared SDK core** — [src/dash/client.ts](src/dash/client.ts) and [src/dash/keyManager.ts](src/dash/keyManager.ts) re-export `createClient` and `IdentityKeyManager` from `../../../../setupDashClient-core.mjs` (the canonical browser-safe core at the host repo root). No vendoring. The `@dashevo/evo-sdk` bare specifier is aliased in [vite.config.ts](vite.config.ts) to this app's locally installed browser bundle so the shared core resolves the SDK from here.
- **[src/session/](src/session/)** — `SessionContext.tsx` provides the context (`status`, `error`, `sdk`, `keyManager`, `identityId`, `contractId`, `setContractId`, `log`, `login`, `browseOnly`, `logout`) and `useSession.ts` is the consumer hook. Session statuses: `idle | connecting | browsing | authenticated | error`. Mnemonic lives only in the keyManager closure — never in state, never in localStorage. [App.tsx](src/App.tsx) auto-calls `browseOnly()` on `status === "idle"`, so the app boots into a connected read-only state without a login prompt.
- **[src/components/](src/components/)** — standard React. Modals/panels call `src/dash/` functions directly. Notable: [AnchorForm.tsx](src/components/AnchorForm.tsx) (hash + submit), [VerifyPanel.tsx](src/components/VerifyPanel.tsx) (lookup by hash), [HistoryPanel.tsx](src/components/HistoryPanel.tsx) (list by owner / chain), [ExampleFilesPanel.tsx](src/components/ExampleFilesPanel.tsx) (starter fixtures).
- **[src/lib/](src/lib/)** — pure utilities: [hash.ts](src/lib/hash.ts) (SHA-256 + base64/hex/bytes coercion), [chainId.ts](src/lib/chainId.ts) (`suggestChainId` with fixture lookup + slugify fallback), [format.ts](src/lib/format.ts).
- **[src/data/exampleFiles.ts](src/data/exampleFiles.ts)** — manifest of starter fixtures under [public/example-files/](public/example-files/) with known SHA-256 values; `suggestChainId` uses these to round-trip a stable chainId for the fixtures.
- **[src/dash/types.ts](src/dash/types.ts)** / **[src/dash/logger.ts](src/dash/logger.ts)** — shared SDK types and the `Logger` interface (`(message, level?) => void`) wired through every dash helper.
- **[test/](test/)** — Vitest + Testing Library. Co-located by subject (e.g. `AnchorForm.test.tsx`, `SessionContext.test.tsx`, `dash.test.ts`). Default Vitest env is `node` ([vite.config.ts](vite.config.ts)); component tests opt into DOM with a `// @vitest-environment jsdom` pragma at the top of the file.

## Anchor contract

Schema lives in [src/dash/contract.ts](src/dash/contract.ts) as `ANCHOR_CONTRACT`. One document type, `anchor`:

- `entryHash` — base64 SHA-256 string, exactly 44 chars, indexed unique via `byHash` (the canonical query key)
- `chainId` — user-supplied bucket, indexed via `byChain`
- `filename`, `mimeType`, `size`, `note` — optional metadata
- `previousId` — optional 32-byte byteArray pointer for chained proofs
- Owner index `byOwner` for history queries
- `documentsMutable: false`, `canBeDeleted: false` — anchors are immutable by design

`DEFAULT_CONTRACT_ID` is `null`. The app stores a registered ID under `localStorage['dashproof-lab.contractId']`. Browse-only verification needs a contract ID set in Settings unless a default is hardcoded in [contract.ts](src/dash/contract.ts).

## SDK Patterns

- **Connect**: `await createClient("testnet")` from [client.ts](src/dash/client.ts) — re-exported from the shared core, which internally does `EvoSDK.testnetTrusted()` + `sdk.connect()`. App code never constructs the SDK directly.
- **Key derivation**: `IdentityKeyManager` from the shared core; `keyManager.getAuth()` returns `{ identity, identityKey, signer }`
- **Register contract**: `new DataContract({ ownerId, identityNonce, schemas, fullValidation })` then `sdk.contracts.publish({ dataContract, identityKey, signer })`. Nonce is `(sdk.identities.nonce(id) || 0n) + 1n`.
- **Submit anchor**: `sdk.documents.create({ document, identityKey, signer })` where `document = new Document({ properties, documentTypeName: "anchor", dataContractId, ownerId })`
- **Query by hash**: `sdk.documents.query({ where: [["entryHash", "==", base64]], orderBy: [["entryHash", "asc"]], limit: 1 })`
- **Query by owner**: `where: [["$ownerId", "==", id]], orderBy: [["$ownerId", "asc"], ["$createdAt", "asc"]]`
- **Query by chain**: `where: [["chainId", "==", trimmed]], orderBy: [["chainId", "asc"], ["$createdAt", "asc"]]`

`normalizeAnchors()` in [queries.ts](src/dash/queries.ts) flattens whatever shape `sdk.documents.query` returns (array, Map, or plain object) into `AnchorRecord[]` so UI code never branches on it.

## Gotchas

- `entryHash` is stored as a **base64 string**, not a 32-byte byteArray, specifically because indexed queries on byteArray fields currently fail (see [dashpay/platform#3540](https://github.com/dashpay/platform/issues/3540)). The 44-char base64 form is the workaround — converting back to a byte array would break `findAnchorByHash`. UI displays the value as hex; always convert via [src/lib/hash.ts](src/lib/hash.ts) helpers (`bytesToBase64`, `bytesToHex`, `coerceBytes`) rather than hand-rolling.
- The hash index is unique. Anchoring the same bytes twice fails on the second call; this is the intended invariant, not a bug.
- `previousId` must be **exactly 32 bytes** when provided — it's the doc-id byteArray of a prior anchor, not a hash. `createAnchor` validates length. (This field is a byteArray and is not queried, so #3540 doesn't apply.)
- Every read query calls `refreshContractCache({ sdk, contractId })` first to evict the WASM SDK's cached copy of the contract — without this, recently-published contracts can return stale schema.
- Browse-only mode (`session.status === "browsing"`) sets `keyManager` to `null`. Any write path (`createAnchor`, `registerContract`) must guard for an authenticated session.
- `suggestChainId` in [chainId.ts](src/lib/chainId.ts) prefers a fixture match by hash, then by filename, then falls back to a slugified filename stem (or `"proof"`). Fixture-based chainIds must stay stable so verification round-trips.
- [AnchorForm](src/components/AnchorForm.tsx) tracks `chainIdAutoManagedRef`: as soon as the user types into the chainId field, auto-suggestion is suppressed for that file selection until they clear the field. Don't replace this ref with naive "always auto-suggest on file change" — it would clobber user edits.
- `coerceBytes` in [hash.ts](src/lib/hash.ts) accepts `Uint8Array`, `ArrayBuffer`, typed arrays, plain number arrays, hex strings, base64 strings, and `{ data: number[] }` objects (the legacy SDK shape). The hex-vs-base64 branch is character-class based — even-length hex wins over base64 for ambiguous inputs.
- The `Logger` from [src/dash/logger.ts](src/dash/logger.ts) is plumbed through every dash helper. `level: "success"` and `level: "error"` also raise sonner toasts via `SessionContext.log`.
- The Evo SDK WASM bundle is ~8MB; this is expected and not a build error.
- `allowJs: true` in [tsconfig.app.json](tsconfig.app.json) so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root.
- `VITE_BASE_PATH` is honored in [vite.config.ts](vite.config.ts) so the app can deploy under a sub-path on GitHub Pages (mirrors dashmint-lab's deploy setup); local dev works fine with the default `/`.
