# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashapps/](.).

## Project Overview

React + TypeScript + Vite app for discovering Dash Platform applications on testnet. A registry data contract holds one `appMetadata` document per identity per target contract (name, tagline, category, tags, links, icon) plus an `appRating` document type (1–5 `stars`, optional `title`/`body`). Because anyone may describe any contract, an entry whose `$ownerId` matches the target contract's owner is **canonical**; other entries for the same target are **community proposals** — [canonical.ts](src/dash/canonical.ts) classifies them. Entries are cross-referenced with contract-declared metadata (description + keywords baked into the target contract) and the system Keyword Search contract.

The shell is a six-view app (`discover` / `search` / `category` / `mine` / `add` / `settings`) in [App.tsx](src/App.tsx). Browsing and rating histograms are read-only and need no auth; listing an app or leaving a rating requires signing in with a mnemonic or WIF. Testnet only — mainnet has no default registry and sign-in is rejected there.

## Commands

- `npm run dev` — start Vite dev server on :5187
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/) (unit, component, and hook tests)
- `npm run test:coverage` — Vitest suite under v8 coverage
- `npm run test:e2e` — Playwright suite in [test/e2e/](test/e2e/) (auto-boots Vite on :5187)
- `npm run test:e2e:ui` — Playwright with the interactive UI runner
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

`App.tsx` is the orchestrator: it owns view routing and the selected-app detail state, and renders one presentational component per view. Session and network state live in a context provider rather than in `App`. The layers:

- **[src/dash/](src/dash/)** — one file per Platform SDK concern: [contract.ts](src/dash/contract.ts) (`APP_METADATA_SCHEMAS`, `CONTRACT_CONFIG`, `DECLARED_METADATA`, `registerContract`), [registryReads.ts](src/dash/registryReads.ts) / [registryWrites.ts](src/dash/registryWrites.ts) (metadata queries and create/edit/withdraw), [ratingReads.ts](src/dash/ratingReads.ts) / [ratingWrites.ts](src/dash/ratingWrites.ts) (grouped count, rating list, save/remove), [documentWrites.ts](src/dash/documentWrites.ts) (the shared `freshTarget`/`prepare` write path and 40105 classification), [keywordSearch.ts](src/dash/keywordSearch.ts) (system Keyword Search contract — `contractKeywords` and `shortDescription`), [contractFacts.ts](src/dash/contractFacts.ts) (declared description/keywords/document types off a fetched contract), [canonical.ts](src/dash/canonical.ts) (canonical-vs-proposal classification), [ids.ts](src/dash/ids.ts) (base58 ↔ 32-byte conversion and validation, `requireId`), [contractStore.ts](src/dash/contractStore.ts) (per-network registry ID + network in `localStorage`), [contractSummaryStore.ts](src/dash/contractSummaryStore.ts) (cached contract summaries), [ownerResolver.ts](src/dash/ownerResolver.ts) / [resolveDpnsName.ts](src/dash/resolveDpnsName.ts) (owner and DPNS name resolution with stale-request guards), [systemContractMetadata.ts](src/dash/systemContractMetadata.ts) (curated seed entries), [types.ts](src/dash/types.ts) (`ReadSdk`/`DashSdk`/`Network` shapes), [sdkModule.ts](src/dash/sdkModule.ts) and [sdkCore.ts](src/dash/sdkCore.ts) (the two cached dynamic imports), [client.ts](src/dash/client.ts) / [keyManager.ts](src/dash/keyManager.ts) (re-exports from the shared core).
- **[src/session/](src/session/)** — [SessionContext.tsx](src/session/SessionContext.tsx) owns network, connection, identity, and balance behind generation guards; [context.ts](src/session/context.ts), [useSession.ts](src/session/useSession.ts), [types.ts](src/session/types.ts), and [keyManagerFromKey.ts](src/session/keyManagerFromKey.ts) complete it.
- **[src/components/](src/components/)** — presentational, props-or-context only: the view shells [RegistryViews.tsx](src/components/RegistryViews.tsx) (`ContractRegistry`, `RegistryExplorer`, `CategoryBrowser`) and [SettingsView](src/components/SettingsView.tsx); [AppRatings.tsx](src/components/AppRatings.tsx) (`AppRatings` + `StarPicker`), [StarMeter](src/components/StarMeter.tsx), [SignInForm](src/components/SignInForm.tsx), [HeaderAccount](src/components/HeaderAccount.tsx), [IdentityChip](src/components/IdentityChip.tsx), [DpnsName](src/components/DpnsName.tsx), [ProvenanceIcon](src/components/ProvenanceIcon.tsx), [ExternalLaunch](src/components/ExternalLaunch.tsx), [ContractCopyButton](src/components/ContractCopyButton.tsx), [ModalDialog](src/components/ModalDialog.tsx).
- **[src/lib/](src/lib/)** — pure utilities, no SDK references: [logger.ts](src/lib/logger.ts) (`Logger`/`LogLevel`, `errorMessage`, `consoleLogger`), [format.ts](src/lib/format.ts) (`formatAverage`, `pluralize`, `timeAgo`), [safeDoc.ts](src/lib/safeDoc.ts) (`toDocumentArray` — normalizes whatever shape a query returns), [urls.ts](src/lib/urls.ts) (`normalizeUrl`), [appDetails.ts](src/lib/appDetails.ts) (`summarizeSchemas`, `resourceLabel`), [detectSecretShape.ts](src/lib/detectSecretShape.ts).
- **[test/](test/)** — Vitest + Testing Library, flat directory, named after the subject. Unit tests over `src/dash/` and `src/lib/` stub the SDK shape (`*.test.ts`); component tests render with Testing Library (`*.test.tsx`). Default Vitest env is `node`; DOM tests opt in with a `// @vitest-environment jsdom` pragma. Component tests **mock the SDK loaders** so the 8 MB bundle never imports — never let a test pull `@dashevo/evo-sdk` into the jsdom process. [test/contractSchema.test.ts](test/contractSchema.test.ts) encodes the schema invariants (see [Gotchas](#gotchas)).
- **[test/e2e/](test/e2e/)** — Playwright specs driven by [playwright.config.ts](playwright.config.ts), which auto-starts Vite on port 5187. One `chromium-desktop` project whose specs resize the viewport for the responsive rules — not a device matrix. Runs against real testnet, no SDK mocks; read-only shell smoke tests that assert rendering, not live registry data.
- **[scripts/](scripts/)** — Node maintenance scripts outside the app build: [backup-registry.mjs](scripts/backup-registry.mjs) snapshots the registry's documents to JSON.

## Registry contract

Schema lives in [src/dash/contract.ts](src/dash/contract.ts) as `APP_METADATA_SCHEMAS`. Both document types are mutable and deletable; the contract itself is `keepsHistory: false`.

`appMetadata` — `contractId` (required identifier, position 0), `name` (required, 1–63), `description` (≤1000), `website` / `repository` / `docs` / `appUrl` (`^https?://`, ≤256), `tagline` (required, 1–120), `category` (required, 16-value enum), `tags` (≤5 comma-separated kebab-case terms), `iconUrl` (`^https://` only), plus required `$createdAt` / `$updatedAt`. Indices:

- `ownerContract` — unique (`$ownerId`, `contractId`); one entry per identity per target contract
- `byContractCreated` — (`contractId`, `$createdAt`); the entries describing one target
- `byName` — (`name`); the name-prefix search
- `recent` — (`$createdAt`); the Discover feed
- `byCategoryCreated` — (`category`, `$createdAt`); the category browser

`appRating` — `contractId` (required identifier), `stars` (required integer 1–5), optional `title` (≤120) and `body` (≤1000). Indices:

- `ownerContract` — unique (`$ownerId`, `contractId`); one rating per identity per app
- `byContractStars` — (`contractId`, `stars`), `countable` + `rangeCountable`; backs the grouped histogram, the total, the derived average, the `stars == N` filter, and star ordering
- `byContractCreated` — (`contractId`, `$createdAt`); recency ordering

`DEFAULT_CONTRACT_IDS.testnet` is `BXcWyLZDtcPrEmd8tmPt6A7h4YuqgPGVJU1PBvs1dYiS`; mainnet has no default. Overrides are stored per network under `localStorage['dashapps.contractId.<network>']`. The registry's own declared metadata (`DECLARED_METADATA`) makes it discoverable through Keyword Search.

## SDK Patterns

- **Grouped distribution count** — `sdk.documents.count({ where: [["contractId","==",id], ["stars","between",[1,5]]], groupBy: ["stars"], orderBy: [["stars","asc"]] })` over `byContractStars`. The `between` puts the query in range-distinct mode, returning one entry per present star value. `summarize` in [ratingReads.ts](src/dash/ratingReads.ts) derives both the total and the average in JS — there is no `sum`/`average` query.
- **Rating list** — `listRatings` scans an app's ratings to completion through the serving index (`byContractCreated` for recency, `byContractStars` for star ordering and the `stars == N` point filter), 100 per page via document-ID `startAfter`, then sorts client-side. See the `desc` gotcha below.
- **Declared contract metadata** — `contractFacts` reads `description`, `keywords`, `version`, and document types off a fetched `DataContract` via `toObject(sdk.version())`; `registerContract` injects them through `DataContract.fromObject` after `setConfig`, since the constructor does not take them.
- **Keyword Search** — the system contract at `BsjE6tQxG47wffZCRQCovFx5rYrAYYC3rTVRWKro27LA`: `contractKeywords` (`keyword == term`, 3–50 chars, paged) and `shortDescription` (`contractId == id`).
- **Document writes** — every create/edit/withdraw goes through `freshTarget` + `prepare` in [documentWrites.ts](src/dash/documentWrites.ts): evict the target contract from the SDK cache, refetch, then a contract-aware `toBytes`/`fromBytes` round trip before the facade validates. See the identifier-media gotcha.
- **Document shapes** — `toDocumentArray` in [safeDoc.ts](src/lib/safeDoc.ts) flattens whatever `query` returns (array, `Map`, plain object); `requireId` in [ids.ts](src/dash/ids.ts) validates every identifier crossing a boundary.

## Performance — load-anchor rules

Same as the sibling apps: the `@dashevo/evo-sdk` browser bundle is ~8 MB and must stay off the boot critical path. **Never add a top-level value import from `@dashevo/evo-sdk`** to any file reachable from `App.tsx` — go through [sdkModule.ts](src/dash/sdkModule.ts)'s cached dynamic import (type-only imports are fine). The shared core is loaded via [sdkCore.ts](src/dash/sdkCore.ts)'s `loadSdkCore()` — two distinct loaders, don't merge. The `modulePreload.resolveDependencies` filter in [vite.config.ts](vite.config.ts) strips the `evo-sdk` chunk so Vite doesn't inject a `<link rel="modulepreload">` that re-blocks first paint. The synchronous exports of [contractStore.ts](src/dash/contractStore.ts) must stay synchronous — they run during initial render before the SDK loads.

## Gotchas

- **Identifier query filters must be base58 strings, never `Uint8Array`.** The document-query filter passes through JSON deserialization; a byte array fails with `Invalid documents query: fromObject: serde deserialization error: invalid type: byte array, expected any valid JSON value`. Verified on testnet against Keyword Search's `shortDescription`.
- **Identifier-media `Document` _properties_ also need canonical base58, then a round trip.** Passing a `Uint8Array` — or a plain number array — for `contractId` on a write fails in Drive with `structure error: not an array of bytes`. The evo-sdk contract-aware serializer wants base58 at the boundary, then a fetched-contract `toBytes`/`fromBytes` round trip to produce the typed identifier before facade validation. Because that serializes before the facade populates timestamps, `prepare` seeds create timestamps and preserves `$createdAt` while advancing `$updatedAt` on replace; because `fromBytes` drops wrapper-only creation entropy (`Document must have entropy set for creation`), it restores the draft's entropy after the round trip. Don't unwind either step.
- **Grouped-count map keys are raw index-key bytes, NOT the value.** `count` with `groupBy: ["stars"]` returns a `Map` keyed by the hex of the property's order-preserving index-key encoding. For a small positive integer that's the sign-flipped single byte `0x80 | value` → 5 stars is key `"85"`, 1 star is `"81"`. `starsKeyHex` in [ratingReads.ts](src/dash/ratingReads.ts) re-encodes each known value to look it up; the SDK exposes no decoder, so the client encodes what it wants rather than decoding what comes back.
- **Platform silently ignores `desc` in `orderBy`.** Seen live: "Highest rated" and "Most recent" both came back ascending. That's why `listRatings` scans and sorts client-side (2,000-document ceiling, 25 revealed per "Show more"). Do not reintroduce server-side `desc` paging for ratings.
- **Count index flags are fussy.** `rangeCountable` is separate from `countable` and needs the range field as the **last** index property — a `countable`-only index fails at query time. And never mix `summable` with a count-only index on a shared prefix: it registers fine but breaks every document insert. No `appRating` index is `summable`, which is why the shared `contractId` prefix can host `byContractStars`; the average is derived from the distribution instead. [test/contractSchema.test.ts](test/contractSchema.test.ts) encodes both rules. Full analysis: [dashpay/platform#3960](https://github.com/dashpay/platform/issues/3960).
- **Read errors need care in both directions.** SDK errors can be WASM objects with a `message()` method, so use `errorMessage` from [logger.ts](src/lib/logger.ts) rather than `String(error)` — including before wrapping one. And a failed read is not an empty one: Keyword Search short descriptions fail independently of successfully loaded contract facts, so show that field's own error beside it and let Refresh retry, rather than rendering it as absent.
- **Unique-index violations (40105) are an edit prompt, not a failure.** `createMetadata` checks for an existing owner/contract pair first; `saveRating` resolves a 40105 race by re-reading and replacing.
- **Session state is generation-guarded, and secrets never enter it.** [SessionContext.tsx](src/session/SessionContext.tsx) invalidates connection/auth/balance on network change and resets dependent views and pending sign-in on registry change (an already-authenticated identity stays signed in); registry selection survives a network switch in memory even when `localStorage` is unavailable, and mainnet sign-in is rejected in the session API, not only hidden in the UI. Recovery phrases and WIFs are passed to login as parameters and cleared from the form immediately — never put them in React state, refs, storage, or logs.
- **Shared auth files are byte-identical across apps.** `src/dash/loginWithPrivateKey.ts`, `src/lib/detectSecretShape.ts`, `src/session/keyManagerFromKey.ts`, and `test/loginWithPrivateKey.test.ts` match Dashnote, TokenOps, and DashNames exactly. Keep app-specific session and form behavior out of those four files.
- The Evo SDK WASM bundle is ~8 MB; that's expected, not a build error. See [Performance](#performance--load-anchor-rules).
