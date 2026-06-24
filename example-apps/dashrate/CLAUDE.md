# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashrate/](.).

## Project Overview

React + TypeScript + Vite app for rating and reviewing Dash Platform resources (tutorials and example apps) on testnet. A review has a required integer `rating` (1–5), an optional `reviewText`, and a `resourceId` pointing at a catalog entry. One review per identity per resource (enforced by a unique index) — saving again edits the existing document. The shell is a four-view app (`resources` / `my-reviews` / `settings` / `how`): the Resources view is a sidebar resource list + a detail panel showing the aggregate rating, a per-star distribution histogram, a review form, and recent reviews. Read-only browse works without auth; writing a review requires signing in with a mnemonic in Settings.

This app is the showcase for Platform 4.0's relational query features — provable `count`, grouped `count` (`GROUP BY`), range counts, and `where` filtering. See [SDK query patterns](#sdk-query-patterns).

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/)
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

- **[src/dash/](src/dash/)** — one file per Platform SDK concern, each with a leading JSDoc block naming the SDK method it wraps: [contract.ts](src/dash/contract.ts) (schema + register/store contract ID), [queries.ts](src/dash/queries.ts) (all reads — count, grouped count, document query, normalization, summary derivation), [review.ts](src/dash/review.ts) (create/replace a review), [history.ts](src/dash/history.ts) (document revision history), [resolveDpnsName.ts](src/dash/resolveDpnsName.ts) (DPNS username lookup for reviewer names, via `sdk.dpns.username`), [types.ts](src/dash/types.ts) (shared SDK type aliases incl. the `DashSdk` shape), [sdkModule.ts](src/dash/sdkModule.ts) (cached dynamic `import("@dashevo/evo-sdk")`), [client.ts](src/dash/client.ts) / [keyManager.ts](src/dash/keyManager.ts) (re-export `createClient` / `IdentityKeyManager` from the shared core at `../../../../setupDashClient-core.mjs`).
- **[src/catalog/resources.ts](src/catalog/resources.ts)** — the hardcoded `RESOURCES` list (tutorials + example apps). Each has `id` (used as `resourceId`), `title`, `category`, `summary`, `href`. Resources are compile-time static — there's no user-facing "add a resource" flow.
- **[src/App.tsx](src/App.tsx)** — the entire UI is one component (no separate components/ dir). Holds all state (session, `summaries`, `distributions`, `reviews`, `reviewFilter`, `dpnsNames` reviewer-name cache, view, contract input), the `loadResourceData` effect, the lazy DPNS-resolution effect, and the four view blocks. The shared SDK core is loaded via a local `loadSdkCore()` dynamic import.
- **[src/lib/](src/lib/)** — pure utilities, no SDK references: [logger.ts](src/lib/logger.ts) (`Logger` type, `errorMessage`, `consoleLogger`), [format.ts](src/lib/format.ts) (`formatAverage`, `formatDate`, `shortId`).
- **[test/](test/)** — Vitest, flat directory, named after the subject (`queries.test.ts`, `contract.test.ts`, `history.test.ts`, `logger.test.ts`). Env is `node`. Tests stub the `DashSdk` shape rather than hitting the network.

## Review contract

Schema lives in [src/dash/contract.ts](src/dash/contract.ts) as `REVIEW_SCHEMAS`. One document type, `review`:

- `resourceId` — required string, 1–63 chars, position 0
- `rating` — required integer, 1–5, position 1
- `reviewText` — optional string, max 1000 chars, position 2
- `$createdAt`, `$updatedAt` — required (Platform-managed)
- `documentsMutable: true`, `documentsKeepHistory: true`, `canBeDeleted: false` — reviews are editable, keep revision history, and can't be deleted

Indices:

- `ownerAndResource` — unique (`$ownerId`, `resourceId`); enforces one review per identity per resource
- `ownerReviews` — (`$ownerId`, `$updatedAt`); lists a user's reviews
- `resourceRatingAggregate` — (`resourceId`), `countable`; total review count per resource
- `resourceRatingDistribution` — (`resourceId`, `rating`), `countable` + `rangeCountable: true`; backs the grouped rating distribution AND the `rating == N` filter

`DEFAULT_CONTRACT_ID` is `BdgTqaTAPYMyhp1WdeWdcvYSgoD7AuJ7tVCaCSXyQgyP`. Overrides are stored under `localStorage['dashrate.contractId']`. Settings can register a fresh contract and switch to it; the contract-ID input is controlled and auto-fills on register.

## SDK query patterns

This app deliberately demonstrates the relational query surface. The query types in play:

- **Total count** — `sdk.documents.count({ where: [["resourceId","==",id]] })` over the single-property `resourceRatingAggregate` index. Ungrouped result is a one-entry `Map` keyed `""`; read with `firstMapValue`. (`getRatingCount` in [queries.ts](src/dash/queries.ts).)
- **Grouped distribution count** — `sdk.documents.count({ where: [["resourceId","==",id], ["rating","between",[1,5]]], groupBy: ["rating"], orderBy: [["rating","asc"]] })` over `resourceRatingDistribution`. Returns one entry per present rating. The average is **derived in JS** from these per-star counts (`summaryFromDistribution`) — there is no `sum`/`average` query. (`getRatingDistribution` in [queries.ts](src/dash/queries.ts).)
- **Filter by rating** — `listResourceReviews` adds `["rating","==",N]` to the `where` (a point lookup covered by `[resourceId, rating]`). Server-side on purpose, to demonstrate `where` filtering and stay correct past the fetch limit.
- **Document query / history** — `sdk.documents.query` for the review list; `sdk.documents.history` for revisions.

`normalizeReviews` / `normalizeSingleReview` in [queries.ts](src/dash/queries.ts) flatten whatever shape `query`/`get` returns (array, Map, plain object) into `ReviewRecord[]`.

## Performance — load-anchor rules

Same as the sibling apps: the `@dashevo/evo-sdk` browser bundle is ~8 MB and must stay off the boot critical path. **Never add a top-level value import from `@dashevo/evo-sdk`** to any file reachable from `App.tsx` — go through [sdkModule.ts](src/dash/sdkModule.ts)'s cached dynamic import (type-only imports are fine). The shared core is loaded via `App.tsx`'s separate `loadSdkCore()` dynamic import — two distinct loaders, don't merge. The `modulePreload.resolveDependencies` filter in [vite.config.ts](vite.config.ts) strips the `evo-sdk` chunk so Vite doesn't inject a `<link rel="modulepreload">` that re-blocks first paint. The synchronous exports of [contract.ts](src/dash/contract.ts) (`REVIEW_SCHEMAS`, `loadStoredContractId`, `saveContractId`, `clearStoredContractId`, `DEFAULT_CONTRACT_ID`) must stay synchronous — they run during initial render before the SDK loads.

## Gotchas

- **Grouped-count map keys are raw index-key bytes, NOT the value.** `count` with `groupBy: ["rating"]` returns a `Map` keyed by the hex of the property's order-preserving index-key encoding, not the integer. For a small positive integer that's the sign-flipped single byte `0x80 | value` → rating 5 is key `"85"`, rating 1 is `"81"` (verified against the live contract — it is _not_ an 8-byte big-endian form). `ratingKeyHex(r) = (0x80 | r).toString(16)` in [queries.ts](src/dash/queries.ts) re-encodes each known rating to look it up. The SDK exposes no decoder, so the client encodes the values it's looking for rather than decoding what comes back.
- **`rangeCountable` is a separate flag from `countable`, required for range/grouped counts.** A range count (the `between` on `rating` that drives the grouped distinct walk) needs `rangeCountable: true` on the index, with the range field as the **last** index property. A `countable`-only index fails at query time with `range count requires a range_countable: true index whose last property matches the range field`.
- **Don't mix `summable` and a deeper count-only index on a shared prefix** — it registers fine but breaks every document insert (`NotCountedOrSummed-wrapping is only supported for the six sum-bearing tree variants`). `resourceRatingAggregate` is intentionally count-only (no `summable`) so its `resourceId` value tree isn't count+sum and can host `resourceRatingDistribution`'s count-only `rating` continuation. The average is derived from the distribution instead of a `sum`/`average` query. Full analysis: [dashpay/platform#3960](https://github.com/dashpay/platform/issues/3960).
- **`between` value is a 2-element array, inclusive.** `["rating","between",[1,5]]` matches `1 <= rating <= 5`. The drive expects exactly two bounds.
- **A document query's `orderBy` field must be the serving index's TRAILING property — even for equality filters.** The index matcher (`Index::matches`) reserves the order-by field from the _back_ of the index. So filtering reviews by rating (`where resourceId== AND rating==`) must use `orderBy: [["rating","asc"]]` (the last property of `[resourceId, rating]`); ordering by `resourceId` there strips `rating` from the usable prefix and the query is rejected as `where clause on non indexed property … query must be for valid indexes`. `listResourceReviews` switches `orderBy` based on whether a `ratingFilter` is set. (Server `orderBy` only drives index selection here; the list is re-sorted client-side by `createdAt`.)
- **Update flow** (`saveReview` replacing an existing review) bumps the revision off the fetched document; the unique `ownerAndResource` index means a second save edits rather than duplicates.
- **The contract-ID input is controlled** (`contractInput` state in `App.tsx`). Register/Use/Clear all sync it; an uncontrolled `defaultValue` would not reflect a freshly-registered ID.
- The Evo SDK WASM bundle is ~8 MB; that's expected, not a build error. See [Performance](#performance--load-anchor-rules).
