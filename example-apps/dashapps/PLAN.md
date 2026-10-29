# dashapps — metadata registry for Dash Platform

## Accepted scope

Target the repository's pinned evo-sdk 4.1.1, Platform 4.1 / protocol 13.
Testnet first, mainnet read-only until explicitly enabled later.

Anyone may propose metadata for a target data contract. The target contract
owner's entry is canonical; other entries remain community proposals. Enforce
one entry **per identity per target contract**, not one entry total per contract.
There is no voting. Remove the proposal-count leaderboard. Defer all proposal
counts and target-contract document counts; no aggregate indices or grouped-count
probes are needed in this version. Ratings remain out of scope.

Metadata properties:

| Property      | Required | Constraint                                                                       |
| ------------- | -------- | -------------------------------------------------------------------------------- |
| `contractId`  | Yes      | 32-byte identifier of the target contract                                        |
| `name`        | Yes      | 1–63 characters                                                                  |
| `description` | No       | Up to 1,000 characters                                                           |
| `website`     | No       | HTTP(S), up to 256 characters                                                    |
| `repository`  | No       | HTTP(S), up to 256 characters                                                    |
| `docs`        | No       | HTTP(S), up to 256 characters                                                    |
| `tagline`     | Yes      | 1–120 characters                                                                 |
| `category`    | Yes      | One registry category enum value                                                 |
| `tags`        | No       | Comma-separated encoding of up to 5 unique lowercase slugs, 1–32 characters each |
| `appUrl`      | Yes      | HTTP(S), up to 256 characters                                                    |
| `iconUrl`     | Yes      | HTTPS, up to 256 characters; stored but not fetched directly                     |

Platform supplies document ID, owner identity, revision and timestamps.
Canonicality is derived at read time, never written as a flag. Registry entries
do not modify the target contract. Blank optional properties are omitted.

## Contract candidate and deployment gate

One mutable, deletable `appMetadata` document type, with property positions 0–5
in the table's order and `additionalProperties: false`. Required fields include
`$createdAt` and `$updatedAt`, as well as `contractId` and `name`.
Use the identifier media type on `contractId`, byteArray true, min/maxItems 32.
Each URL has `pattern: "^https?://"` and `maxLength: 256`.

Candidate indices (no aggregate flags):

1. `ownerContract`, unique: `$ownerId asc, contractId asc`.
2. `byContractCreated`: `contractId asc, $createdAt asc`.
3. `byName`: `name asc`.
4. `recent`: `$createdAt asc`.
5. `byCategoryCreated`: `category asc, $createdAt asc`.

The previous aggregate-index variants A/B and their sampled fallback are removed.
The compound index must support complete proposal pagination before deployment.
Contract config: `documentsMutableContractDefault: true`,
`documentsCanBeDeletedContractDefault: true`, `keepsHistory: false`.
Indices and config are frozen after deployment: validate before final registration.
This schema is the sole supported registry shape. The unreleased v1 candidate is
not read or migrated. A newly deployed contract is required because category
browsing adds an index.

Retain opt-in, testnet-credit-spending scripts under `scripts/probes/`:

- **Index and mutation probe:** check tutorial identity balance, obtain two distinct
  signing identities, register the candidate, and create entries for a shared
  target and several other targets. Verify unique identity-target pairs, direct
  owner/target lookups, and explicit rejection of a duplicate pair. Replace an
  entry including its indexed name, verify revision/data, delete and verify
  disappearance, and recreate the freed pair. Force small-page compound-index
  pagination and assert complete, duplicate-free results using document IDs.
  Check descending ordering and cursor continuation on the recent index. Record
  whether the live sample contains timestamps shared across page boundaries; do
  not require paid mutations solely to manufacture a collision. Retain exact
  inputs, IDs, error codes, SDK version, active protocol and block height in
  CLAUDE.md.
- **Declared metadata probe:** reconstruct a new candidate via `toObject(pv)` →
  add `keywords: ["registry", "apps", "dapps"]` and registry description →
  `DataContract.fromObject(obj, true, pv)` with `$formatVersion: "1"`.
  Prove that ID, owner, schemas and config survive reconstruction and publication.
  Verify declared metadata via fetched `toObject` and Keyword Search. If retained,
  rerun mutation and paging checks on the reconstructed candidate. A reproducible
  metadata incompatibility may drop registry self-discovery; network/proof errors
  are inconclusive, not evidence of incompatibility.

No grouped-count probe. No final registration until all required writes, unique
lookups and document pagination pass. Diagnose failures and revise the candidate;
do not silently fall back to sampled proposals or remove required features.

## Reads and correctness boundaries

- Normalize identifiers once through strict `ids.ts`: base58 strings must decode
  to exactly 32 bytes; handles and bytes normalize to validated strings. Reject
  malformed non-null values, sparse arrays, noninteger/out-of-range bytes, and
  wrong byte lengths. `pickCanonical` requires validated base58 strings.
- SDK query `where` filters use validated base58 strings for identifier values.
  For writes, construct with base58 and use the fetched contract in a
  `toBytes`/`fromBytes` round trip so evo-sdk produces a typed identifier before
  facade validation; raw strings fail JSON Schema while typed or plain arrays
  reach Drive as the wrong Platform value type. Validate each new query and write
  shape on testnet. Read SDK/WASM errors with `errorMessage`, including `message()`.
- `ownerResolver` deduplicates contract IDs, processes batches of at most 100
  sequentially and returns found/missing/error. Only absent values in successful
  batch responses establish missing contracts. Never convert thrown failures into
  absence. Retain fetched contract handles for facts without another batch fetch.
- Positive contract/name caches expire after 60 seconds, negative results after
  5 seconds, using an injectable clock. Never cache errors as missing. Force fresh
  contract reads on detail entry, Refresh and every write preflight. Expired facts
  and badges require revalidation before being presented as current.
- Read contract facts through direct getters plus `toObject(pv)`, never bulk
  `toJSON()` (token u64 fields can exceed JavaScript's safe integer range).
  Show owner, version, document types, description, keywords and the independently
  queried Keyword Search short description, labelled “Declared by contract”.
- Canonical and signed-in user's entry are independent `ownerContract` lookups;
  they must not depend on proposal pagination. Preserve pending/error states;
  only a successful empty lookup means no owner entry. `no-entries` requires
  successful complete registry reads. Deduplicate canonical from community by ID.
- Target existence is not enforced on protocol 13: render dangling proposals,
  show contract-missing only on successful absence, and mark canonicality
  unresolvable. Future 4.2 `refersTo: { type: "contract" }` is an upgrade note,
  not part of this implementation.

## Paging

Every list has a limit and explicitly communicates completeness. Document
continuations use `startAfter` of the last document ID, never a timestamp.

| List                   | Query / index                                           | Page size | Completion                                    |
| ---------------------- | ------------------------------------------------------- | --------- | --------------------------------------------- |
| Community proposals    | target equality, `$createdAt asc` / `byContractCreated` | 100       | Scan to completion, then reverse newest first |
| Name search            | name startsWith, name asc / `byName`                    | 25        | Paged with Load more                          |
| Canonical or own entry | owner equality + target equality / `ownerContract`      | 1         | Exact unique lookup                           |
| My submissions         | owner equality, contractId asc / `ownerContract`        | 100       | Scan to completion                            |
| Keyword Search         | lowercased keyword equality / system `byKeyword`        | 100       | Paged with Load more                          |
| Recent                 | `$createdAt` / `recent`                                 | 50        | Descending only if verified by probe          |

If descending ordering is ignored, scan a fixed recent time window ascending to
completion, reverse, and reveal 50 at a time. Load older exhausts the completed
window before widening 7d → 30d → 90d → all. Widening preserves revealed entries,
deduplicates IDs, and keeps the original upper bound until Refresh. A 2,000-document
safety ceiling or failed scan must never label an incomplete prefix as newest.
Keep previously completed results with their original window label on failed
widening. Detect nonadvancing/cyclic cursors and allow superseding requests.

## Session, Settings and writes

Use the shared SDK core and cached dynamic imports, following dashnames. Testnet
mnemonic sign-in uses `IdentityKeyManager.create`; recovery phrases are parameters
only, never persisted, logged, or stored in React state/refs. Sign-out clears
credentials; mainnet sign-in is disabled at both the UI and session boundary.
Display identity, optional DPNS name and credit balance; guard balance refreshes.

Network changes invalidate the connection/authentication generations, clear
contract/name caches and reset views' pending results. Registry override changes
increment an independent registry generation and clear registry-dependent reads,
cursors and pending forms. Same-network registry changes may retain fresh target
contract/name caches. Superseded results cannot update current UI or caches.
Storage keys are `dashapps.contractId.<network>`; mainnet never inherits testnet's
registry. Validate on load/save and retain in-memory overrides when storage fails.

Create/edit/withdraw follow the sibling SDK document patterns. Before every write,
force an uncached target lookup; absence disables submission, errors are retryable.
Edit fetches the current document and increments revision. Explicitly classify an
`ownerContract` uniqueness violation as “edit your existing entry”. Successful
mutations invalidate detail, own-entry and relevant discovery reads.

Views: Discover (recent submissions and keyword browsing), name search/ID jump,
app detail (canonical, declared facts, proposals), submit/edit, My submissions,
and Settings (network, registry override, registration after the deployment gate).

## Implementation sequence and verification

1. Scaffold, SDK loaders, strict IDs, URLs, canonical classification and read-only
   keyword/contract discovery. Run the live read-only discovery check.
2. Session and Settings shell, testnet sign-in, identity display, registry selection,
   and request isolation. Maintain README and IMPLEMENTATION.md with actual status.
3. Revised testnet probes, then freeze/register the passing candidate and set the
   testnet default. Mainnet default remains empty.
4. Registry query helpers and index-shape tests, paging, canonical/own-entry reads,
   recent/search/my-submissions views.
5. Create/edit/withdraw and explicit error classification; test two identities,
   canonical selection, uniqueness, dangling proposals, and refresh/invalidation.

Run build, lint and Vitest for each milestone, plus relevant Playwright coverage
and bundle-import checks. Mock failures/races and verify actual SDK query shapes
with read-only checks or opt-in probes. Live spending tests require explicit
opt-in and sufficient testnet credits; never deploy an untested schema.

## App ratings

Ratings are now in scope. The registry contract gains a second document type,
`appRating`, alongside `appMetadata`. Because indices are immutable, this requires
publishing a new registry contract; the previous registry is not migrated or read.

| Property     | Required | Constraint                               |
| ------------ | -------- | ---------------------------------------- |
| `contractId` | Yes      | 32-byte identifier of the rated contract |
| `stars`      | Yes      | Integer 1–5                              |
| `title`      | No       | Up to 120 characters                     |
| `body`       | No       | Up to 1,000 characters                   |

Documents are mutable and deletable; there is no revision history. One rating per
identity per contract, enforced by a unique index. Saving again edits the existing
rating; the owner can remove it.

Indices (no `summable` anywhere, so no shared-prefix aggregation conflict — see
dashpay/platform#3960):

1. `ownerContract`, unique: `$ownerId asc, contractId asc` — own rating lookup.
2. `byContractStars`: `contractId asc, stars asc`, `countable` + `rangeCountable` —
   grouped count (`GROUP BY stars`, `between [1, 5]`) drives the histogram, the
   total and the derived average; `stars == N` filters; `stars` ordering gives
   highest/lowest sorting.
3. `byContractCreated`: `contractId asc, $createdAt asc` — most-recent listing.

Platform ignores `desc` ordering, so lists scan to completion through the
serving index (100 per page, document-ID `startAfter`, 2,000-document ceiling)
and sort client-side; the UI reveals 25 at a time.

Reads live in `src/dash/ratingReads.ts` (strict parser, distribution, summary,
sorted/filtered pages, own lookup). Writes live in `src/dash/ratingWrites.ts`
and follow the metadata write path: fresh uncached target lookup, contract-aware
`toBytes`/`fromBytes` preparation, revision bump on replace, 40105 classified as
"edit your existing rating", delete of the fetched document.

UI: the app detail page shows the average in the hero and a "Ratings & reviews"
section under the metadata strip — average, star meter, clickable histogram
(star filter), a "Used this app?" card with star picker and review editor modal,
sort chips (Most recent / Highest / Lowest / Written only), review cards with DPNS
names, relative time and Edit/Remove for the signed-in user's own rating. Signed
out users see a sign-in prompt. Mainnet stays read-only.

Out of scope: developer responses, helpful votes, reporting, written-review counts.

Verification: schema invariant tests (including a shared-prefix aggregation check),
query-shape and parser tests, write validation/revision tests, component tests,
and the opt-in `scripts/probes/ratings.mjs` testnet probe that publishes the new
contract and verifies create, uniqueness, grouped count keys, replace, sort/filter
shapes and delete before the testnet default is updated.
