# Implementation status

The storefront registry schema now requires category, tagline, launch URL and
HTTPS icon URL, with optional normalized tags. Production reads and writes use
only this shape. The production contract is deployed on testnet as
`BXcWyLZDtcPrEmd8tmPt6A7h4YuqgPGVJU1PBvs1dYiS` and selected as the sole default.

- [x] Vite/React scaffold and pinned evo-sdk 4.1.1.
- [x] Strict IDs, URLs, canonical classification, contract facts and resolver tests.
- [x] Read-only keyword discovery and contract details on both networks.
- [x] JSON-safe short-description queries verified on testnet.
- [x] Session provider, testnet mnemonic sign-in, sign-out, identity/name/balance.
- [x] Mainnet sign-in disabled; network, auth and balance request isolation.
- [x] Settings with per-network registry overrides and storage failure handling.
- [x] Separate registry generation; pending views/forms discarded on switches.
- [x] Remove leaderboard and all document/proposal counting from scope and probes.
- [x] Credit-spending index/mutation/pagination and declared-metadata probes.
- [x] Freeze and register a passing schema; configure testnet default.
- [x] Registry queries, recent/name search, canonical/own-entry and My submissions.
- [x] Submit, edit, withdraw, plus two-identity end-to-end write verification.
- [x] App ratings: `appRating` document type, grouped-count summary, sorted and
      filtered review pages, rate/edit/remove, detail-page UI, probe and tests.

## Session log

Read-only discovery, including the Sansnote short-description lookup, was verified
against testnet protocol 13. A typed byte-array filter failed in SDK JSON decoding;
validated base58 identifiers fixed it. See CLAUDE.md.

The session and Settings milestone is implemented. Authentication follows the
shared mnemonic key-manager pattern. The earlier registry probe established the
write mechanics but is no longer a supported application registry. Testnet now
uses the current production registry; mainnet remains unset and read-only.

## Verification for this milestone

Build, lint, 40 Vitest unit/component tests, and the Chromium Playwright smoke
test passed after configuring the registry default. The duplicate React sibling
keys exposed by that run were component-prefixed, and the focused Vitest rerun
passed cleanly.

The final milestone adds fresh uncached target preflights, contract-aware metadata
create/edit/withdraw, owner and revision checks, duplicate classification, balance
refresh and registry-view invalidation. The final contract's two-identity live
probe already verified create, uniqueness, replace, delete, recreate and paging;
the production write layer follows that verified serialization path and has
focused failure/mutation tests.

Final verification: build and lint passed; 46 Vitest tests passed across 11 files;
the Chromium Playwright smoke test passed. The expected Vite warning is confined
to the separately loaded evo-sdk/WASM chunk.

## App ratings

Ratings live on the same registry contract as a second document type. Reads
(`ratingReads.ts`), writes (`ratingWrites.ts`), the `AppRatings` detail-page
section, the hero average, styles, and 26 new Vitest cases (schema invariants,
query shapes, parser, write validation/revision/duplicate handling, component
behaviour, app integration) are complete. The maintainer published the contract
(`BXcWyLZDtcPrEmd8tmPt6A7h4YuqgPGVJU1PBvs1dYiS`); a read-only check confirmed the
schema, indices, grouped count and list shapes. The live write probe has not run.
