# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashrate/](.).

## Project Overview

React + TypeScript + Vite app for rating and reviewing Dash Platform resources (tutorials and example apps) on testnet. A review has a required integer `rating` (1–5), an optional `reviewText`, and a `resourceId` pointing at a catalog entry. One review per identity per resource (enforced by a unique index) — saving again edits the existing document. The shell is a four-view app (`resources` / `my-reviews` / `settings` / `how`): the Resources view is a sidebar resource list + a detail panel showing the aggregate rating, a per-star distribution histogram, a review form, and recent reviews (newest first, "Load more" paging). Read-only browse works without auth; writing a review requires signing in with a mnemonic in Settings.

This app is the showcase for Platform's aggregate and relational query features at protocol version 14 — proven `average`, grouped `count` (`GROUP BY`), `where` filtering, and newest-first cursor paging. See [SDK query patterns](#sdk-query-patterns).

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/) (unit, component, and hook tests)
- `npm run test:coverage` — Vitest suite under v8 coverage
- `npm run test:e2e` — Playwright suite in [test/e2e/](test/e2e/) (auto-boots Vite on :5182)
- `npm run test:e2e:ui` — Playwright with the interactive UI runner
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

`App.tsx` is the orchestrator: it owns the cross-cutting state and handlers, calls the data hooks, and renders one presentational view component per `view`. The layers:

- **[src/dash/](src/dash/)** — one file per Platform SDK concern, each with a leading JSDoc block naming the SDK method it wraps: [contract.ts](src/dash/contract.ts) (schema + register/store contract ID), [queries.ts](src/dash/queries.ts) (one resource's reads — average, grouped count, paged document queries, normalization), [review.ts](src/dash/review.ts) (create/replace a review), [history.ts](src/dash/history.ts) (document revision history), [resolveDpnsName.ts](src/dash/resolveDpnsName.ts) (DPNS username lookup for reviewer names, via `sdk.dpns.username`), [types.ts](src/dash/types.ts) (shared SDK type aliases incl. the `DashSdk` shape), [sdkModule.ts](src/dash/sdkModule.ts) (cached dynamic `import("@dashevo/evo-sdk")`), [sdkCore.ts](src/dash/sdkCore.ts) (cached dynamic `import` of the shared core at `../../../../setupDashClient-core.mjs`, exposing `loadSdkCore()`), [client.ts](src/dash/client.ts) / [keyManager.ts](src/dash/keyManager.ts) (re-export `createClient` / `IdentityKeyManager` from that shared core).
- **[src/catalog/resources.ts](src/catalog/resources.ts)** — the hardcoded `RESOURCES` list (tutorials + example apps). Each has `id` (used as `resourceId`), `title`, `category`, `summary`, `href`. Resources are compile-time static — there's no user-facing "add a resource" flow.
- **[src/App.tsx](src/App.tsx)** — owns top-level state (session, `contractId`/`contractInput`, `selectedResourceId`, `view`, sign-in form fields, `history`, `status`, `busy`, `refreshToken`), the action handlers (`handleSignIn`, `handleSaveReview`, `handleRegisterContract`, `handleLoadHistory`, contract submit/clear, sign-out, resource select, edit-my-review), and `connectReadOnly`, which caches one shared read-only client. It loads the shared SDK core via [sdkCore.ts](src/dash/sdkCore.ts)'s `loadSdkCore()`.
- **[src/hooks/](src/hooks/)** — data-fetching hooks, each returning state plus refresh callbacks: [useResourceRatings.ts](src/hooks/useResourceRatings.ts) (per-resource summaries/distributions, the paged review list — `reviews`/`hasMoreReviews`/`loadMoreReviews` — the review-composer state — `rating`/`hoverRating`/`reviewText`/`mySelectedReview` — `reviewFilter`, and the loading effects, with request-id guards against stale responses), [useMyReviews.ts](src/hooks/useMyReviews.ts) (the signed-in user's reviews + derived average, loaded lazily when the `my-reviews` view is active), [useDpnsNames.ts](src/hooks/useDpnsNames.ts) (best-effort DPNS name cache keyed by owner ID, resolved lazily for reviewers in view).
- **[src/components/](src/components/)** — presentational components, props-only (no SDK imports): the four view shells [ResourcesView](src/components/ResourcesView.tsx), [MyReviewsView](src/components/MyReviewsView.tsx), [SettingsView](src/components/SettingsView.tsx), [HowItWorks](src/components/HowItWorks.tsx); [TopNav](src/components/TopNav.tsx) (owns the `View` type); [AppNotices](src/components/AppNotices.tsx) (status banner + "no contract" notice); and the pieces [ReviewForm](src/components/ReviewForm.tsx), [RecentReviews](src/components/RecentReviews.tsx), [ReviewRow](src/components/ReviewRow.tsx), [MyReviewCard](src/components/MyReviewCard.tsx), [ReviewHistory](src/components/ReviewHistory.tsx), [StarMeter](src/components/StarMeter.tsx) (partial-fill star renderer).
- **[src/session/types.ts](src/session/types.ts)** — the `Session` shape (`{ sdk, keyManager, identityId }`) shared by App and the hooks.
- **[src/lib/](src/lib/)** — pure utilities, no SDK references: [logger.ts](src/lib/logger.ts) (`Logger`/`LogLevel` types, `errorMessage`, `consoleLogger`), [format.ts](src/lib/format.ts) (`formatAverage`, `formatDate`, `shortId`), [ratings.ts](src/lib/ratings.ts) (`RATING_ROWS`, `emptySummary`/`emptyDistribution`, `ownerLabel`, `reviewCountLine`, text `stars`).
- **[test/](test/)** — Vitest + Testing Library, flat directory, named after the subject. Three kinds: unit tests over `src/dash/` and `src/lib/` that stub the `DashSdk` shape (`*.test.ts`); component tests rendered with Testing Library (`*.test.tsx`); and hook tests via `renderHook`. Default Vitest env is `node`; component/hook tests opt into DOM with a `// @vitest-environment jsdom` pragma at the top of the file (the vitest `include` covers `**/*.test.{ts,tsx}`). Component/hook tests **mock the SDK loaders** (`vi.mock("../src/dash/sdkModule", …)` / `vi.mock("../src/dash/sdkCore", …)`) so the 8 MB bundle never imports — never let a test pull `@dashevo/evo-sdk` into the jsdom process. [tsconfig.app.json](tsconfig.app.json) includes `test`, so `tsc -b` (run by `build`) strict-typechecks the `.test.tsx` files — keep mock factories and stub props fully typed. Hook tests must pass **stable** args (build them once, outside the `renderHook` callback): the hooks' callbacks depend on `connectReadOnly`/`log` identity, so fresh functions per render re-run the load effect forever. `npm run test:coverage` runs the suite under v8 coverage.
- **[test/e2e/](test/e2e/)** — Playwright specs plus shared `fixtures.ts`, driven by [playwright.config.ts](playwright.config.ts), which auto-starts `npx vite` on port 5182. Two projects (`chromium-desktop` / `chromium-mobile`) so every spec exercises both layouts. Runs against real testnet — no SDK mocks. The specs are read-only: shell smoke tests ([smoke](test/e2e/smoke.spec.ts) — navigation, browse a resource, How-it-works; [settings](test/e2e/settings.spec.ts) — the sign-in form renders/gates without signing in; [lite](test/e2e/lite.spec.ts) — the single-file companion) assert rendering, not live rating data. The exception is [ratings](test/e2e/ratings.spec.ts), which checks a data-independent invariant between independent queries on live data: Σ grouped per-star distribution == `average` count (app and lite — the only test that would catch a network-side change to grouped-count key encoding). Run locally via `npm run test:e2e`. [tsconfig.app.json](tsconfig.app.json)'s `exclude: ["test/e2e"]` keeps these out of the app `tsc -b` (Playwright typechecks them itself).

## Review contract

Schema lives in [src/dash/contract.ts](src/dash/contract.ts) as `REVIEW_SCHEMAS` and must match the published default contract exactly (a unit test in [contract.test.ts](test/contract.test.ts) pins the indices), so "Register a fresh contract" in Settings produces an equivalent contract. One document type, `review`:

- `resourceId` — required string, 1–59 chars, position 0 (59, not 63 — see [Gotchas](#gotchas))
- `rating` — required integer, 1–5, position 1
- `reviewText` — optional string, max 1000 chars, position 2
- `$createdAt`, `$updatedAt` — required (Platform-managed)
- `documentsMutable: true`, `documentsKeepHistory: true`, `canBeDeleted: false` — reviews are editable, keep revision history, and can't be deleted

Indices:

- `ownerAndResource` — unique (`$ownerId`, `resourceId`); enforces one review per identity per resource
- `ownerReviews` — (`$ownerId`, `$updatedAt`); a user's reviews, newest first
- `resourceRating` — (`resourceId`), `averageable: "rating"` + `rangeAverageable` + `rankedAverageable` + `rankedCountable`; the per-resource proven (count, sum), and the avg/count ranking axes behind `ranked` and `having`
- `resourceRatingDistribution` — (`resourceId`, `rating`), `countable` + `rangeCountable: true`; the grouped rating distribution (deliberately unranked)
- `resourceRecent` — (`resourceId`, `$updatedAt`); a resource's reviews newest first, paged
- `resourceRatingRecent` — (`resourceId`, `rating`, `$updatedAt`); the same within the `rating == N` filter

The ranked/aggregate keywords need document meta-schema v3, i.e. a **protocol version 14** network. `DEFAULT_CONTRACT_ID` is `EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz` (testnet). Overrides are stored under `localStorage['dashrate.contractId']`. Settings can register a fresh contract and switch to it; the contract-ID input is controlled and auto-fills on register.

## SDK query patterns

This app deliberately demonstrates the aggregate/relational query surface. The query types in play (`base` = `{ dataContractId, documentTypeName: "review" }`):

- **Proven average** — `sdk.documents.average({ ...base, where: [["resourceId","==",id]], orderBy: [["resourceId","asc"]] }, "rating")` over `resourceRating`. Returns the exact integers, `Map { "" => { count, sum } }` — divide in JS. Zero reviews returns an **empty** `Map`, so fall back to `{ count: 0n, sum: 0n }`. (`getRatingSummary` in [queries.ts](src/dash/queries.ts).)
- **Grouped distribution count** — `sdk.documents.count({ ...base, where: [["resourceId","==",id], ["rating","between",[1,5]]], groupBy: ["rating"], orderBy: [["rating","asc"]] })` over `resourceRatingDistribution`. One entry per present rating, keyed by raw index-key hex (decode with `ratingFromKeyHex`). One call per resource. (`getRatingDistribution`.)
- **Newest-first paging** — `sdk.documents.query({ ...base, where: [["resourceId","==",id]] (+ ["rating","==",N]), orderBy: [["$updatedAt","desc"]], limit: 10 + 1, startAfter: lastShownId })`, served by `resourceRecent` / `resourceRatingRecent`. The returned `Map` is already in server order — don't re-sort. It fetches one extra row only to learn whether another page exists (so a total that's an exact multiple of 10 doesn't end on an empty "Load more"); it shows 10, and the cursor is the last one shown. (`listResourceReviews`.) "My reviews" uses the same shape over `ownerReviews` (`listMyReviews`).
- **History** — `sdk.documents.history` for revisions ([history.ts](src/dash/history.ts)).

`documents.composite` is **not used**. Its sub-queries can only be `documents` or per-bound-value `counts`, so it can't carry the average or the distribution. The one clean fit (a reviews page plus the viewer's own review in one proof) has no `startAfter` cursor (it pages by a `$updatedAt <` range clause, which can skip reviews sharing a millisecond), and the "my review" lookup is needed on its own by `saveReview` anyway.

`normalizeReviews` / `normalizeSingleReview` in [queries.ts](src/dash/queries.ts) flatten whatever shape `query`/`get` returns (array, Map, plain object) into `ReviewRecord[]`.

## Performance — load-anchor rules

Same as the sibling apps: the `@dashevo/evo-sdk` browser bundle is ~8 MB and must stay off the boot critical path. **Never add a top-level value import from `@dashevo/evo-sdk`** to any file reachable from `App.tsx` — go through [sdkModule.ts](src/dash/sdkModule.ts)'s cached dynamic import (type-only imports are fine). The shared core is loaded via [sdkCore.ts](src/dash/sdkCore.ts)'s `loadSdkCore()` — two distinct loaders, don't merge. The `modulePreload.resolveDependencies` filter in [vite.config.ts](vite.config.ts) strips the `evo-sdk` chunk so Vite doesn't inject a `<link rel="modulepreload">` that re-blocks first paint. The synchronous exports of [contract.ts](src/dash/contract.ts) (`REVIEW_SCHEMAS`, `loadStoredContractId`, `saveContractId`, `clearStoredContractId`, `DEFAULT_CONTRACT_ID`) must stay synchronous — they run during initial render before the SDK loads.

**Lighthouse LCP depends on the data, and that's expected.** These rules protect first paint (~0.4 s), not LCP. Everything from testnet (ratings, histogram, reviews) renders only after the SDK loads and connects, which takes seconds under Lighthouse throttling. LCP takes the largest element painted, even a late one. When the newest review on the default resource is a full line of text, it outgrows the first-paint `p.detail-summary` and becomes the LCP element. Lighthouse then reports ~8–9 s and a Performance score in the 70s. When the top reviews are short, the score stays ~99. Load time is the same either way. Before treating a low LCP as a regression, check which element Lighthouse picked: a late `p.review-row-text` is this effect, not a critical-path leak. Don't shrink or hide review text to move the metric. The remaining cost is SDK size and connect time.

## Gotchas

- **Grouped-count map keys are raw index-key bytes, NOT the value.** `count` with `groupBy: ["rating"]` returns a `Map` keyed by the hex of the property's order-preserving index-key encoding, not the integer. `rating` is a single unsigned byte holding the value (rating 5 → `"05"`); `ratingFromKeyHex` in [queries.ts](src/dash/queries.ts) decodes it and rejects anything outside 1–5. The SDK exposes no decoder, and the encoding has changed before ([dashpay/platform#5350](https://github.com/dashpay/platform/pull/5350)). Unit tests feed literal network-format keys and result shapes — never build stubs with the app's own encoder, or an encoding change goes unnoticed.
- **Don't fetch every histogram in one call.** `count` with `resourceId in [...]` + `rating between` and `groupBy: ["resourceId","rating"]` returns keys of the rating byte only, with counts **merged across resources**. Keep one distribution call per resource. (`in` with `groupBy: ["resourceId"]` alone is fine.)
- **Ungrouped range totals are refused through a ranked level.** `count where resourceId == X AND rating >= 4` (no `groupBy`) fails with `a range total over the index … passes through a ranked level`, because `resourceRating` is ranked. Group by `rating` and add the buckets instead.
- **`resourceId.maxLength` is 59 on a ranked index.** A ranked axis caps its group key (the property's UTF-8 bytes, up to 4 per char) at 239 bytes, so 63 is rejected at publish (consensus error 10205). Offline `new DataContract({ fullValidation: true })` does **not** catch this — the node does.
- **Index layout rules at PV14.** An aggregating `[resourceId]` index next to `[resourceId, rating]` and `[resourceId, $updatedAt]` continuations is fine. A **compound ranked** index whose prefix also ends a countable/summable index (e.g. ranking `[resourceId, rating]` here) is rejected at registration — keep `resourceRatingDistribution` unranked. Indices can't change on a published contract; a schema change means registering a new contract.
- **`rangeCountable` is a separate flag from `countable`, required for range/grouped counts**, with the range field as the **last** index property. A `countable`-only index fails at query time with `range count requires a range_countable: true index whose last property matches the range field`.
- **`between` value is a 2-element array, inclusive.** `["rating","between",[1,5]]` matches `1 <= rating <= 5`.
- **A document query's `orderBy` field must be the serving index's TRAILING property — even for equality filters.** The index matcher reserves the order-by field from the _back_ of the index. That's why the timestamp indices end in `$updatedAt`: `orderBy: [["$updatedAt","desc"]]` selects `resourceRecent` or (with `rating ==`) `resourceRatingRecent`. Ordering by a field that isn't trailing is rejected as `where clause on non indexed property … query must be for valid indexes`, and `orderBy resourceId desc` within an equality-pinned value does not reverse anything.
- **Reads can lag a write by about a block.** Right after a replace, `documents.get` has returned the old revision, so the refresh after a save can briefly show the previous state — including the review form reverting to the old (or empty) review. The app accepts that rather than polling; the next reload catches up.
- **Refresh after save through `refreshToken`, never captured callbacks.** The user can select another resource while a save is in flight. `handleSaveReview` bumps App's `refreshToken`, an effect dependency of `useResourceRatings`, so it reloads for whatever is selected _then_. Calling a loader captured when Save was clicked would load the saved resource's review into the newly selected resource's form.
- **One read-only client.** `connectReadOnly` in `App.tsx` caches a single client promise (cleared on a failed connect); every read-only load and "Load more" reuses it.
- **Loads degrade per resource.** One resource's failed `average`/distribution (testnet nodes occasionally answer `Operation is not implemented or not supported`) keeps that resource's previous data and logs the error; the rest still load.
- **Update flow** (`saveReview` replacing an existing review) bumps the revision off the fetched document; the unique `ownerAndResource` index means a second save edits rather than duplicates.
- **The contract-ID input is controlled** (`contractInput` state in `App.tsx`). Register/Use/Clear all sync it; an uncontrolled `defaultValue` would not reflect a freshly-registered ID.
- The Evo SDK WASM bundle is ~8 MB; that's expected, not a build error. See [Performance](#performance--load-anchor-rules).
