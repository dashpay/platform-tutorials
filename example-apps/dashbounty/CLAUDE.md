# CLAUDE.md

This file provides guidance to Claude Code when working in [example-apps/dashbounty/](.).

## Project Overview

React + TypeScript + Vite app for a token-gated bug bounty program on Dash Platform testnet. Security researchers spend a "Researcher Credit" token to file a bug report — friction that deters low-effort/AI-slop mass submissions. A 3-person "Triage Panel" (a Platform _group_, 2-of-3 threshold, equal power) can freeze a suspected bad-faith researcher's remaining credit balance and, on confirmed bad faith, permanently destroy (slash) it.

This is the first app in the repo to demonstrate two SDK primitives that had zero prior coverage: `AuthorizedActionTakers.Group(...)` / `sdk.group.*`, and `sdk.tokens.freeze` / `.unfreeze` / `.destroyFrozen`. See [sdk-coverage-matrix.md](../../sdk-coverage-matrix.md) at the repo root.

Slashed credits are burned, not paid to anyone — `sdk.tokens.destroyFrozen` has no destination parameter at the protocol level. This mirrors real stake-slashing in proof-of-stake systems: paying the panel (or anyone) from a slash would corrupt its incentive to freeze/destroy fairly.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/)
- `npm run test:coverage` — Vitest with v8 coverage
- `npm run test:e2e` — Playwright suite in [test/e2e/](test/e2e/) (auto-boots Vite on :5183)
- `npm run test:e2e:ui` — Playwright with the interactive UI runner
- `npm run bootstrap:identities` — one-time setup: registers 4 identities (1 researcher + 3 panelists) from `PLATFORM_MNEMONIC`, see [Identity bootstrapping](#identity-bootstrapping)
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

- **[src/dash/](src/dash/)** — one file per Platform SDK operation, each with a leading JSDoc block naming the SDK method(s) it wraps:
  - `client.ts` / `keyManager.ts` — re-export `createClient` / `IdentityKeyManager` from `../../../../setupDashClient-core.mjs`
  - `types.ts` — hand-typed `DashSdk`/`DashKeyManager` subset, extended with `tokens.freeze/unfreeze/destroyFrozen/identityTokenInfos/configUpdate`, `group.info/members/actions/actionSigners`, `contracts.update`
  - `logger.ts` — `Logger`/`LogLevel`, `errorMessage`
  - `researcherCredit.ts` — token constants, `RESEARCHER_CREDIT_PAYMENT_INFO`, `fetchCreditBalance`
  - `contract.ts` — `REPORT_SCHEMAS`, `createResearcherCreditConfiguration`, `createTriagePanelGroup`, `registerContract`, `ensureContract` (re-exports contract-ID storage helpers from `contractStorage.ts`)
  - `submitReport.ts` / `updateReport.ts` — create/edit a report
  - `queries.ts` — `listReportsByOwner/BySeverity/ByComponent/All`, `findReportById`, `normalizeReports`
  - `freezeCredit.ts` / `unfreezeCredit.ts` / `destroyFrozenCredit.ts` — propose-or-co-sign a group action (one file per action, unified propose/co-sign — see [Panel & Group](#panel--group))
  - `groupActions.ts` — `listPendingActions`, `listActionSigners`, `describeGroupAction`
  - `panel.ts` — `fetchActivePanelPosition` (resolves the token's current `mainControlGroup` position), `fetchPanelInfo`, `fetchPanelMembers`, `isPanelMember`
  - `rotatePanelRoster.ts` — owner-signed roster rotation: append a new group + repoint the token's main control group (see [Panel & Group](#panel--group))
  - `frozenStatus.ts` — per-identity frozen check via `identityTokenInfos`
- **Shared SDK core** — `src/dash/client.ts` and `src/dash/keyManager.ts` re-export directly from `../../../../setupDashClient-core.mjs`. The `@dashevo/evo-sdk` bare specifier is aliased in [vite.config.ts](vite.config.ts) to this app's locally installed browser bundle. **Note**: unlike dashrate/dashnote/dashproof-lab, this app does NOT route `@dashevo/evo-sdk` imports through a `sdkModule.ts` dynamic-import wrapper — `contract.ts`/`submitReport.ts`/etc. import it statically, same as `dashmint-lab`'s `contract.ts`/`mintCard.ts` do. This is a deliberate, documented trade-off (see [Gotchas](#gotchas)), not an oversight.
- **[src/session/](src/session/)** — `SessionContext.tsx` provides the context (`status`, `error`, `sdk`, `keyManager`, `identityId`, `contractId`, `setContractId`, `log`, `login`, `enterReadOnly`, `logout`); `useSession.ts` is the consumer hook. `App.tsx` auto-calls `enterReadOnly()` on `status === "idle"` so the app boots into a connected read-only state.
- **[src/components/](src/components/)** — `SubmitReportForm` (title/severity/component/description + optional local-file PoC hash), `ReportsView` (browse/filter, read-only friendly), `MyReportsView` (own reports + edit-while-open), `PanelView` (propose an action; lists pending actions with signer progress and a co-sign form), `RosterView` (current panel members + owner-gated rotation form — see [Panel & Group](#panel--group)), `AccountView` (sign in, contract registration/selection), `TopNav`, `AppNotices`.
- **[src/lib/](src/lib/)** — `hash.ts` (`hashFile`, `bytesToBase64` — client-side SHA-256 for the optional `pocHash` field), `format.ts` (`shortId`, `formatDate`, `severityLabel`).
- **[test/](test/)** — Vitest + Testing Library, flat directory, named after subject. Mocks `@dashevo/evo-sdk` entirely (`vi.mock`) — see [Testing](#testing).
- **[test/e2e/](test/e2e/)** — Playwright specs (`browse`, `submit`, `panel`) plus shared `fixtures.ts`. Driven by [playwright.config.ts](playwright.config.ts), which loads `PLATFORM_MNEMONIC` from `../../.env` (repo root, with optional local `.env` override) and auto-starts `npx vite` on port 5183.
- **[public/dashbounty-lite.html](public/dashbounty-lite.html)** — single-file zero-build companion. Read-only report browsing + Triage Panel state (members, pending actions), loads `@dashevo/evo-sdk` from `esm.sh`. No signer buttons — intentionally self-contained as a learning reference, don't import app code into it.
- **[scripts/bootstrap-identities.mjs](scripts/bootstrap-identities.mjs)** — one-time Node setup script, see [Identity bootstrapping](#identity-bootstrapping).

## Bounty contract

Schema lives in [src/dash/contract.ts](src/dash/contract.ts) as `REPORT_SCHEMAS`. One document type, `report`:

- `title`, `severity` (`low`/`medium`/`high`/`critical`), `component`, `description` — required
- `pocHash` — optional base64 SHA-256 of a locally-hashed proof-of-concept file. **Not indexed** — it's evidence metadata, never queried by exact match, so the base64-not-byteArray workaround for [dashpay/platform#3540](https://github.com/dashpay/platform/issues/3540) (documented in dashproof-lab's CLAUDE.md) doesn't apply here.
- `tokenCost.create` — 1 Researcher Credit, `effect: 0` (`TransferTokenToContractOwner`, **not** `BurnToken`) — see [Panel & Group](#panel--group) for why this specific effect value matters.
- `documentsMutable: true`, `documentsKeepHistory: true`, `canBeDeleted: false` — researchers can edit their own report while it's open; edit history is preserved; no report is ever deletable, including post-slash, so enforcement stays visible as a public record.
- Indices: `byOwner`, `bySeverity`, `byComponent` (all plain equality+sort — **no aggregation indices**, deliberately, to avoid [dashpay/platform#3960](https://github.com/dashpay/platform/issues/3960), the shared-prefix aggregation-type conflict documented in `example-apps/dashrate/PLATFORM_ISSUE_index_aggregation_conflict.md`).

`DEFAULT_CONTRACT_ID` in `src/dash/contractStorage.ts` starts `null` — populate it once a bounty contract is registered and confirmed stable, mirroring every sibling app's pattern of shipping a pre-published testnet contract for read-only browsing.

## Panel & Group

The Triage Panel is `new Group(members, 2)` — 3 members at power `1` each, `requiredPower: 2`. Verified against Platform's actual consensus validation rule (`GroupV0::validate` in `rs-dpp`): total power (3) ≥ required (2), and no single member's power (1) alone meets the threshold — genuine 2-of-3, not just a naming convention.

- **`DataContract.groups` is a plain settable property**, unlike `.schemas` (which requires `.setSchemas(...)`). `registerContract` constructs the contract normally, then assigns `dataContract.groups = { 0: createTriagePanelGroup(panelMemberIds) }` before publishing.
- **`freezeRules` / `unfreezeRules` / `destroyFrozenFundsRules`** are all `ChangeControlRules({ authorizedToMakeChange: AuthorizedActionTakers.MainGroup(), adminActionTakers: AuthorizedActionTakers.MainGroup() })` — only the token's _current_ main control group (the active panel), acting together, can freeze/unfreeze/destroy. `MainGroup()` rather than `Group(0)` is what makes roster rotation possible: repointing `mainControlGroup` moves these powers to the new group without touching the rules.
- **Propose vs. co-sign**: `GroupStateTransitionInfoStatus.proposer(0)` for the first signer, `.otherSigner(0, actionId)` for subsequent signers. `freezeCredit.ts`/`unfreezeCredit.ts`/`destroyFrozenCredit.ts` each unify both roles behind one function — presence/absence of `actionId` selects which — since the SDK call shape is identical modulo `groupInfo` and the caller-side "am I proposing or co-signing?" decision has to happen once regardless of file boundaries.
- **Discovering a pending action's `actionId`**: `sdk.group.actions({ ..., status: 'ACTIVE' })`. **Signer progress**: `sdk.group.actionSigners(...)`.
- **Roster rotation = append a group + repoint the token, never edit a group in place.** Platform's contract-update validation rejects any change to an existing group with `DataContractUpdateActionNotAllowedError` ("change group at position 0 is not allowed") — a published group is immutable forever, and there is no add/remove/swap-member operation on it. But new groups CAN be appended at the next contiguous position, and this token sets `mainControlGroupCanBeModified` to `ContractOwner`, so the bounty operator can repoint `mainControlGroup` at the appended group via `sdk.tokens.configUpdate` with `TokenConfigurationChangeItem.MainControlGroupItem(newPosition)`. Since the action rules use `MainGroup()`, the new roster takes over freeze/unfreeze/destroy the moment the repoint lands. `rotatePanelRoster.ts` does both steps (contract update first — the group must exist before the config can point at it); `RosterView` exposes the flow to the signed-in contract owner only. The active position is dynamic — resolve it with `fetchActivePanelPosition` and pass it to every group query/action; never hard-code group 0 at runtime.
- **Why `tokenCost.create.effect` is `0` (`TransferTokenToContractOwner`) and not `1` (`BurnToken`)**: traced to the protocol source (`rs-dpp/src/tokens/token_amount_on_contract_token.rs`), `tokenCost.create` charges the token _immediately and irreversibly_ at submission time — a per-report charge can never later be "returned." So the per-report filing fee (transferred to the operator) and the freezable/slashable value (the researcher's separately-held, ongoing credit balance) are two genuinely different token flows, not the same value wearing two hats.

## Identity bootstrapping

A 2-of-3 group inherently needs 3 different signing identities available to whoever runs the demo — unlike a single hardcoded owner identity, this can't be baked into one shared `DEFAULT_CONTRACT_ID` for write flows. `scripts/bootstrap-identities.mjs` registers 4 identities (index 0 = researcher, indices 1–3 = panelists) from **one** `PLATFORM_MNEMONIC`, using `identityIndex` as a distinct DIP-13 path component — different indices genuinely are different identities, not just different keys under one identity, but each still needs its own funded on-chain registration (this does not make registration free, only saves managing 4 separate seed phrases). Idempotent: re-running skips any index that already resolves to an on-chain identity. Writes the 3 panelist IDs to a local `.env` as `VITE_PANELIST_1_ID`/`_2_ID`/`_3_ID`, read by `AccountView.tsx` (registration) and `test/e2e/fixtures.ts` (the group-signing spec).

## SDK Patterns

- **Register contract**: `new DataContract({ ownerId, identityNonce, schemas: REPORT_SCHEMAS, tokens: {...}, fullValidation: true })`, then `dataContract.groups = {...}`, then `sdk.contracts.publish({ dataContract, identityKey, signer })`
- **Submit report**: `sdk.documents.create({ document, identityKey, signer, tokenPaymentInfo: RESEARCHER_CREDIT_PAYMENT_INFO })`
- **Edit report**: fetch → bump `revision` → `sdk.documents.replace({ document, identityKey, signer })`
- **Propose/co-sign freeze**: `sdk.tokens.freeze({ dataContractId, tokenPosition, authorityId, frozenIdentityId, identityKey, signer, groupInfo })` (same shape for `unfreeze`/`destroyFrozen`)
- **Per-identity frozen check**: `sdk.tokens.identityTokenInfos(identityId, [tokenId])` → `.get(tokenId)?.isFrozen`
- **Panel info**: `sdk.group.info(contractId, groupContractPosition)`, `sdk.group.members(...)`
- **Pending actions**: `sdk.group.actions({ ..., status: 'ACTIVE' })`, `sdk.group.actionSigners(...)`
- **Active panel position**: `sdk.contracts.fetch(contractId)` → `.tokens[0].mainControlGroup`
- **Rotate roster (owner-signed)**: fetch → append `new Group(...)` at next contiguous position + bump `.version` → `sdk.contracts.update(...)` → `sdk.tokens.configUpdate({ ..., configurationChangeItem: TokenConfigurationChangeItem.MainControlGroupItem(newPosition) })`
- **Credit balance**: `sdk.tokens.calculateId(contractId, 0)` + `sdk.tokens.identityBalances(identityId, [tokenId])`

## Testing

**Vitest** mocks `@dashevo/evo-sdk` entirely, extending dashmint-lab's `test/tokenPayment.test.ts` pattern with mocked `Group`, `AuthorizedActionTakers.Group`, and `GroupStateTransitionInfoStatus` (`.proposer`/`.otherSigner` as distinguishable sentinel objects). The highest-value assertions: `freezeCredit({ actionId: undefined })` calls `sdk.tokens.freeze` with the `proposer(0)` sentinel while `freezeCredit({ actionId: 'x' })` calls it with `otherSigner(0, 'x')` — same for `unfreezeCredit`/`destroyFrozenCredit` ([test/groupActions.test.ts](test/groupActions.test.ts)). Mocked constructor classes store their whole options object under `.options` (e.g. `new TokenConfiguration(opts)` → `.options`), so assertions dig through `config.options.freezeRules.options.authorizedToMakeChange`, not `config.freezeRules`. `registerContract`'s test stubs `localStorage` via `vi.stubGlobal` (needed because `saveContractId` touches it, and the default Vitest environment is `node`).

**Playwright** is two-tier: `submit.spec.ts` is `HAS_MNEMONIC`-gated (single identity, same as every sibling app). `panel.spec.ts` is gated behind a **stricter** `HAS_PANEL_IDENTITIES` flag (true only when all 3 `VITE_PANELIST_*_ID` env vars are set) so casual contributors/CI aren't blocked by the heavier 4-identity setup cost. It drives a genuine freeze→unfreeze round-trip across 2 different panelist identities (log out/in within one browser context) — reversible, matching dashmint-lab's SetPrice list→update→unlist philosophy. Destroy (an irreversible slash) is deliberately excluded from automated e2e, the same reason marketplace/burn writes are excluded elsewhere.

## Gotchas

- **`DataContract.groups` is a plain settable field** — unlike `.schemas`, there's no `setGroups()` method. Assign it directly: `dataContract.groups = { 0: new Group(...) }`.
- **`sdk.tokens.statuses()` → `TokenStatus.isPaused` is contract-wide**, unrelated to per-identity freeze. Use `sdk.tokens.identityTokenInfos(...)` → `.isFrozen` for "is this specific researcher frozen."
- **Existing groups cannot be changed after registration — at all.** A `sdk.contracts.update(...)` that touches an existing group is rejected on-chain with `DataContractUpdateActionNotAllowedError` ("change group at position N is not allowed"). Rotation never mutates `dataContract.groups[n].members` in place — it spreads the existing groups untouched and appends a new one at the next contiguous position (positions must stay contiguous to validate). Old groups stay in the contract forever, immutable but powerless once `mainControlGroup` moves on.
- **The founding `PANEL_GROUP_POSITION = 0` is registration-time only.** After a rotation the active group lives at a higher position; every runtime group query and `groupInfo` must use the position resolved by `fetchActivePanelPosition` (the token's current `mainControlGroup`), which all the freeze/unfreeze/destroy/groupActions helpers take as a required `groupPosition` parameter.
- **`TokenFreezeResult`/`TokenUnfreezeResult`/`TokenDestroyFrozenResult` signal pending-vs-executed via field presence**: `groupPower` is set while an action still needs more signatures; `document` is set once it has executed. Branch UI logic on that instead of always re-querying.
- **A 2-of-3 action needs a genuinely different signing identity for the second signature** — the same key re-proposing/re-signing does not advance the action's accumulated power.
- **Co-signing requires independently confirming the target identity ID.** `GroupActionEvent.tokenEvent()` → `TokenEvent.toJSON().data` is typed `unknown` in the SDK bindings — its payload shape isn't documented, so `PanelView` doesn't attempt to auto-extract the frozen/destroyed identity from a pending action. A co-signer types in the target ID themselves (which they'd know from out-of-band coordination with the proposer).
- **`effect: 1` (`BurnToken`) on `tokenCost.create` is NOT what this app uses** — it would burn the filing fee immediately, same non-refundability as `effect: 0`, but into nothing rather than to the operator. Don't "simplify" this to `1` — see [Panel & Group](#panel--group) for the reasoning.
- **This app statically imports `@dashevo/evo-sdk`** in `contract.ts`/`submitReport.ts`/etc. (no `sdkModule.ts` dynamic-import wrapper), matching `dashmint-lab`'s actual convention rather than dashrate/dashnote/dashproof-lab's. This means the ~8MB WASM chunk isn't deferred off the boot-critical path here — a deliberate scope trade-off, not an oversight, given this app's teaching focus is the token/group mechanics rather than FCP optimization.
- The Evo SDK WASM bundle is ~8MB; this is expected, not a build error.
- `allowJs: true` in [tsconfig.app.json](tsconfig.app.json) so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root.
