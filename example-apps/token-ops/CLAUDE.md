# TokenOps

React + TypeScript + Vite app demonstrating Dash Platform token operations governed by groups and `ChangeControlRules`. The default contract assigns every token capability (mint, burn, freeze, unfreeze, destroy-frozen, emergency pause/resume) to a multi-signer group; the app can also browse contracts whose live operators are ContractOwner, Identity, MainGroup, or NoOne. It lets you propose an action, co-sign it, watch signing progress, and reassign or append authorities. Read-only browse-only mode works with no identity via a baked-in default contract.

## Commands

- `npm run dev` — Vite dev server (default port 5173)
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint (flat config, `typescript-eslint` + react-hooks)
- `npm run test` — Vitest unit + component suite in [test/](test/)
- `npm run test:coverage` — Vitest under v8 coverage (text + HTML in `coverage/`)
- `npm run test:e2e` — Playwright suite in [test/e2e/](test/e2e/) on port 5184 (real testnet)
- `npm run test:e2e:ui` — Playwright interactive runner
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally
- `npm run bootstrap:identities` — register + fund identity index 0 (owner) plus three group-member identities from one mnemonic

## Architecture

- **Shared SDK core** — `createClient` and `IdentityKeyManager` come from `../../../../setupDashClient-core.mjs` (the canonical browser-safe core at the host repo root — the same one the Node tutorials use), loaded lazily via `SessionContext`'s cached `loadSdkCore()` dynamic import (there are no static `client.ts`/`keyManager.ts` re-export files — a static value re-export would anchor the SDK to the entry chunk; see [Performance](#performance--load-anchor-rules-dont-unwind-these)). No vendoring. The `@dashevo/evo-sdk` bare specifier is aliased in [vite.config.ts](vite.config.ts) to this app's locally installed browser bundle so the shared core resolves the SDK from here. The app only ever calls `keyManager.getAuth()` (signs with the CRITICAL auth key).
- **[src/dash/](src/dash/)** — one file per Platform SDK concern, each with a leading JSDoc block naming the SDK method it wraps:
  - [contract.ts](src/dash/contract.ts) — token config, the five named rule presets, group builders, and contract registration (`registerContract` always publishes; `ensureContract` reuses a stored/passed ID or falls back to publish). The SDK-value builders (`createRulePresets`, `createTokenOpsTokenConfiguration`, `buildTokenOpsGroup`, `createTokenOpsGroup`/`createTokenOpsGroups`) are **async** — they `await loadSdkModule()` for the evo-sdk constructors rather than importing them at module top level. `sdkModule.ts` is the cached `import("@dashevo/evo-sdk")` loader.
  - [contractStorage.ts](src/dash/contractStorage.ts) — contract-ID localStorage persistence (`token-ops.contractId`), `DEFAULT_CONTRACT_ID`, and `fetchContractOwnerId`. **Split out of `contract.ts` on purpose** so the session bootstrap can import ID helpers without pulling the `@dashevo/evo-sdk` WASM bundle into the entry chunk.
  - [governance.ts](src/dash/governance.ts) — reads groups and all displayed `ChangeControlRules` rows from a fetched contract, derives the rule matrix (`RULE_DEFINITIONS`), and appends new groups (`appendTokenOpsGroup` via `sdk.contracts.update`).
  - [groupActions.ts](src/dash/groupActions.ts) — lists ACTIVE pending group actions and per-action signer progress; parses token-event params out of a `GroupAction`.
  - [groupDisplay.ts](src/dash/groupDisplay.ts) — pure UI helper: rule key → capability category/accent, and a group's live domains/capabilities derived from its operator rules. No SDK calls.
  - [token.ts](src/dash/token.ts) — token constants + read helpers: ID, total supply, pause status, per-identity balances, frozen state, localized name/description, and supply config (capped/uncapped, perpetual/pre-programmed distribution).
  - [tokenOperations.ts](src/dash/tokenOperations.ts) — group-managed mutations and operator reassignment. Each helper's optional `actionId`: omitted → propose; present → co-sign.
  - [loginWithPrivateKey.ts](src/dash/loginWithPrivateKey.ts) — **WIF private-key sign-in**. `resolveIdentityFromWif` derives the pubkey hash (`PrivateKey.fromWIF`), finds the owning identity (`sdk.identities.byPublicKeyHash`, falling back to `byNonUniquePublicKeyHash`), matches the key entry against either full public-key bytes or the 20-byte public-key hash, and validates it: purpose must be AUTHENTICATION at HIGH/CRITICAL security level and not disabled. Throws the typed `UnknownIdentityError` / `AmbiguousIdentityError` / `WrongKeyPurposeError` / `KeyDisabledError` / `InvalidPrivateKeyError`. `loginWithPrivateKey` then builds an `IdentitySigner` (`addKeyFromWif`) and returns a `DashAuth & { identityId }` tuple. This file statically imports `@dashevo/evo-sdk` value symbols (`PrivateKey`, `IdentitySigner`, `Purpose`, `SecurityLevel`), which is fine because `SessionContext` reaches it **only** through a dynamic `import("../dash/loginWithPrivateKey")` inside `login()`'s WIF branch — Vite puts it (and its SDK dependency) in an async chunk, not the entry graph (see [Performance](#performance--load-anchor-rules-dont-unwind-these) rule 3).
  - [resolveTokenRef.ts](src/dash/resolveTokenRef.ts) — resolves a pasted **contract ID _or_ token ID** to a contract ID (token-first via `contractInfo`, contract fallback).
  - [resolveDpnsName.ts](src/dash/resolveDpnsName.ts) — DPNS username lookup, `.dash` stripped.
  - [logger.ts](src/dash/logger.ts) — `Logger` type, `consoleLogger`, `errorMessage()` for wasm-bindgen errors.
  - [types.ts](src/dash/types.ts) — the app's SDK-surface type aliases (`DashSdk`, `DashKeyManager`, `DashContractLike`, `DashTokenGroupActionResult`, …).
- **[src/session/](src/session/)** — `SessionContext.tsx` provides `{ status, error, sdk, keyManager, identityId, contractId, setContractId, log, login, enterReadOnly, logout }`. It owns the cached `loadSdkCore()` dynamic import of the shared core (`createClient` + `IdentityKeyManager`) — a **distinct loader** from `dash/sdkModule.ts` (the evo-sdk value-import loader) on purpose (see [Performance](#performance--load-anchor-rules-dont-unwind-these) rule 2). `login(secret, { identityIndex? })` dispatches on secret shape (`detectSecretShape`): a **mnemonic** builds an `IdentityKeyManager` (from `loadSdkCore()`); a **WIF** dynamic-imports `loginWithPrivateKey` inside `login()` and then runs `keyManagerFromKey` (adapts the resolved `DashAuth` tuple into the minimal `DashKeyManager` shape — `{ identityId, getAuth: async () => auth }`; `identityIndex` is ignored for WIF, the identity is whichever holds the key). `enterReadOnly()` connects the SDK with no keys (`App.tsx` auto-enters it on `status === "idle"`). Network is hardcoded to **testnet**. The secret is never stored in state or localStorage — only `contractId` is persisted. Consumer hook: `useSession.ts`. `keyManagerFromKey.ts` is the WIF adapter; `../lib/detectSecretShape.ts` is the mnemonic-vs-WIF heuristic (mnemonics have whitespace, WIFs are a single token).
- **[src/hooks/useDpnsNames.ts](src/hooks/useDpnsNames.ts)** — resolves a set of identity IDs to DPNS names, keyed/deduped by a normalized sorted `idsKey`, backed by a **module-level cache** so names survive remounts. Transient failures are left uncached for retry.
- **[src/components/](src/components/)** — four views rendered by tab in [App.tsx](src/App.tsx) (remounted via `key={refreshKey}` on op completion): `OverviewView` (the visible **Dashboard** tab: personalized proposal counts, membership, operator-authority cards with non-group authorities aggregated as pseudo-groups, compact token details, and a lazy collapsible identity balance/freeze-status inspector), `ActionsView` (owns one governance fetch shared by `ProposeActionPanel` and `PendingActionsView`; manual queue refresh updates the shared snapshot), `GovernanceView` (Access-control + Groups tabs), and `SettingsView` (signed-in status + balance _or_ read-only notice, contract/token-ID resolver, register-contract — **no longer holds the sign-in form**). `ProposeActionPanel` renders the conditional group-action/direct-transfer form, while `PendingActionsView` renders ACTIVE actions, signer progress, and co-sign controls. Sign-in lives in `LoginModal`, a top-bar modal opened by `TopNav`'s "Sign in" button (`App.tsx` owns the `loginOpen` state); `TopNav` also renders "Sign out" when authenticated. Supporting: `ConfirmActionPanel`, `CopyableId`, `IdentityLabel` (renders `@dpnsname`), `AppNotices`.
- **[src/lib/](src/lib/)** — [capabilityIcon.tsx](src/lib/capabilityIcon.tsx) (per-capability SVG glyph), [explorer.ts](src/lib/explorer.ts) (testnet Platform Explorer URLs — base is hardcoded testnet), [format.ts](src/lib/format.ts) (`shortId`).
- **[scripts/bootstrap-identities.mjs](scripts/bootstrap-identities.mjs)** — derives/registers four identities (indices 0–3) from one `PLATFORM_MNEMONIC`, tops each up to its role floor, and writes member IDs to `token-ops/.env`. See [Bootstrap](#bootstrap-script).
- **Config** — [vite.config.ts](vite.config.ts) doubles as the Vitest config (see [Performance](#performance--load-anchor-rules-dont-unwind-these) for its SDK alias / preload role). [tsconfig.app.json](tsconfig.app.json) targets `src`; `tsconfig.node.json` targets the config files.

## Performance — load-anchor rules (don't unwind these)

The `@dashevo/evo-sdk` browser bundle is ~8 MB and must stay off the boot critical path. A single top-level **value** import of `@dashevo/evo-sdk` (or of the shared core that pulls it) in any file statically reachable from `App.tsx` anchors that whole chunk to the entry graph — even when it's only used inside an async function, because Vite hoists the static import. Keeping the SDK behind dynamic-import boundaries splits it into its own chunk: after `npm run build` the entry chunk is **~315 kB** and `evo-sdk.module-*.js` (~9.9 MB) is a separate, lazily-fetched chunk. Collapsing any of these boundaries back to a static import re-merges the SDK into the entry chunk (~10.2 MB) and re-blocks first paint. This mirrors the sibling apps (dashnote / dashmint-lab / dashrate) — see [dashpay/platform-tutorials#77](https://github.com/dashpay/platform-tutorials/pull/77) for the Lighthouse measurements behind the pattern.

Four rules keep the split in place:

1. **Never add a top-level value import of `@dashevo/evo-sdk` to any file in [src/dash/](src/dash/) or [src/session/](src/session/) statically reachable from `App.tsx`.** Type-only imports are fine (erased). Value symbols — `DataContract`, `Group`, `AuthorizedActionTakers`, `ChangeControlRules`, `TokenConfiguration*`, `GroupStateTransitionInfoStatus`, `TokenConfigurationChangeItem`, etc. — must be pulled from [sdkModule.ts](src/dash/sdkModule.ts)'s cached dynamic `import("@dashevo/evo-sdk")`. This is why the SDK-value builders in [contract.ts](src/dash/contract.ts) and [tokenOperations.ts](src/dash/tokenOperations.ts) are async.
2. **Two distinct SDK loaders exist on purpose — don't merge them.** [sdkModule.ts](src/dash/sdkModule.ts) loads the `@dashevo/evo-sdk` package for the contract/token helpers; `SessionContext.tsx` has its own cached `loadSdkCore()` for the shared core (`createClient` + `IdentityKeyManager`) at `../../../../setupDashClient-core.mjs`. Different specifiers, different concerns — collapsing them would force one async load to wait on the other.
3. **`SessionContext` dynamic-imports `loginWithPrivateKey` from inside `login()`** (not at the top of the file). That file value-imports `PrivateKey` / `IdentitySigner` / `Purpose` / `SecurityLevel`; a static import in `SessionContext` would drag the SDK into the entry chunk. The mnemonic branch already triggers the SDK fetch via `loadSdkCore()`, so only the WIF path needs this guard.
4. **The `modulePreload.resolveDependencies` filter in [vite.config.ts](vite.config.ts) must keep stripping the `evo-sdk` chunk.** Vite auto-injects `<link rel="modulepreload">` for every dynamic-import dependency it finds at build time; without the filter the browser races to fetch the 8 MB SDK in parallel with the entry chunk, re-blocking first paint even though the import is syntactically dynamic. That same file aliases the `@dashevo/evo-sdk` bare specifier to this app's local `dist/evo-sdk.module.js`.

Adjacent invariant: the synchronous exports of [contractStorage.ts](src/dash/contractStorage.ts) (`loadStoredContractId`, `saveContractId`, `clearStoredContractId`, `DEFAULT_CONTRACT_ID`) must stay synchronous — the session bootstrap imports them at render time before the SDK loads. They're split out of [contract.ts](src/dash/contract.ts) for exactly this reason. Regression check after any change to `src/dash/` or `src/session/`: `dist/assets/index-*.js` must contain **zero** static `from "...evo-sdk..."` references (a dynamic `import()` ref is fine) and `dist/index.html` must carry **no** modulepreload link for the evo-sdk chunk.

## Contract

One token at position `0` and a minimal placeholder `note` document schema. The app is about token operations, not documents.

Token config in [contract.ts](src/dash/contract.ts): `TOKEN_BASE_SUPPLY = 100n`, `TOKEN_MAX_SUPPLY = 10_000n`, all history-keeping on, `isStartedAsPaused: false`, `NotTradeable`.

Rule presets (operator = `authorizedToMakeChange`, admin = `adminActionTakers`):

- `lockedRules`: NoOne / NoOne
- `ownerRules`: ContractOwner / ContractOwner
- `treasuryRules`: Group(Treasury) / ContractOwner
- `accessRules`: Group(Access) / ContractOwner
- `emergencyRules`: Group(Emergency) / ContractOwner

**Initial** groups (positions 0–2, unit power per member so `requiredPower` is the threshold):

- Treasury Group: position `0`, 2-of-3 — `manualMintingRules`, `manualBurningRules`
- Access Group: position `1`, 2-of-3 — `freezeRules`, `unfreezeRules`
- Emergency Group: position `2`, 3-of-3 — `destroyFrozenFundsRules`, `emergencyActionRules`

These 2/2/3 thresholds describe the **initial** contract, not a system invariant. Platform groups are immutable after registration, so the app never edits a group in place — it **appends** a new group (`buildTokenOpsGroup` accepts any Platform-valid size, `MIN_GROUP_MEMBERS = 2` .. `MAX_GROUP_MEMBERS = 256`) and remaps token functions to it. (`createTokenOpsGroup` still hard-requires exactly 3 members — it builds only the _initial_ three groups; new groups go through `buildTokenOpsGroup`.)

`DEFAULT_CONTRACT_ID` in [contractStorage.ts](src/dash/contractStorage.ts) is a published testnet contract (`KMMJJdJo9LTjjevsuJ4jkbNZEY8xCq8n44cDmba7o2A`) so browse-only mode has something queryable on a fresh machine. Overrides live in `localStorage['token-ops.contractId']`; clearing falls back to the default.

Remember a `ChangeControlRules` object has two authorities: `authorizedToMakeChange` (who performs the action / changes the config value) and `adminActionTakers` (who can later change that authority). The Governance view must keep those separate in the rule matrix.

## SDK Patterns

- **Group actions** use `GroupStateTransitionInfoStatus.proposer(groupPosition)` for the first signer and `.otherSigner(groupPosition, actionId)` for later signatures. In [tokenOperations.ts](src/dash/tokenOperations.ts), passing an `actionId` switches propose → co-sign and suppresses the `publicNote` (a note is only attached at proposal time).
- **Token reads** ([token.ts](src/dash/token.ts)): `sdk.tokens.calculateId` / `totalSupply` / `statuses` / `identityBalances` / `identityTokenInfos` / `contractInfo`. Name/description/supply config are parsed out of the fetched contract's `tokens[0]`, not a dedicated API — read `maxSupply` off the fetched contract, **not** the static `TOKEN_MAX_SUPPLY` (that only describes contracts this app registers).
- **Token mutations** ([tokenOperations.ts](src/dash/tokenOperations.ts)): `sdk.tokens.mint` / `burn` / `transfer` / `freeze` / `unfreeze` / `destroyFrozen` / `emergencyAction` / `configUpdate`. `transfer` is direct (no group action).
- **Config reassignment** supports only the six high-signal operator changes: `ManualMintingItem`, `ManualBurningItem`, `FreezeItem`, `UnfreezeItem`, `DestroyFrozenFundsItem`, `EmergencyActionItem` (built by `configurationChangeItemForRule`). Other rows in the Governance **Config authority** matrix (maxSupply, conventions, distribution destinations, trade mode, perpetual distribution) are `deferred: true` — displayed and documented but not reassignable in v1.
- **Governance reads**: `sdk.contracts.fetch` for groups + token config; `sdk.group.info(contractId, position)` to backfill any group missing from the contract body; `sdk.contracts.update` to append a group. `governance.ts` normalizes both Map and plain-object shapes and both camelCase and snake_case rule keys because the SDK serialization varies.
- **Pending actions**: `sdk.group.actions({ …, status: "ACTIVE", limit: 100 })` (single query per group; no cursor pagination) and `sdk.group.actionSigners({ …, status: "ACTIVE", actionId })`.
- **WIF sign-in** ([loginWithPrivateKey.ts](src/dash/loginWithPrivateKey.ts)): `PrivateKey.fromWIF` → `privateKey.getPublicKeyHash()` → `sdk.identities.byPublicKeyHash(hash)` first, then `byNonUniquePublicKeyHash(hash)` if the unique lookup misses. The resolver matches the WIF against the identity's `publicKeys[]` by decoding `entry.data` as hex-or-base64 and comparing either full public-key bytes or the 20-byte public-key hash, since SDK serialization varies. It then gates on `purpose === AUTHENTICATION` + `securityLevel ∈ {HIGH, CRITICAL}` + not disabled, and throws `AmbiguousIdentityError` instead of guessing if non-unique lookup returns multiple valid auth matches. `IdentitySigner.addKeyFromWif` builds the signer. `DashSdk.identities` includes `byPublicKeyHash(...)` and `byNonUniquePublicKeyHash(...)` members in [types.ts](src/dash/types.ts) for this.
- Direct purchase, distribution claims, and admin/control-group updates are displayed or documented but intentionally deferred from v1.

## Limitations

The authoritative, user-facing limitations list lives in [README.md](README.md#limitations) — keep the two in sync when you change scope. Two items worth restating here for contributors:

- **Reassignment only touches the operator (`authorizedToMakeChange`), never the admin (`adminActionTakers`).** The reassign modal is titled "Reassign operator" and `configurationChangeItemForRule` only builds operator changes; the admin column in the Governance matrix is read-only.
- **Group-admin reassignment is not supported.** `hasAuthority` only enables direct `configUpdate` for `ContractOwner` / `Identity` admins. Group admins need a propose/co-sign path (`groupInfo` + pending configuration actions) that TokenOps does not implement yet, so group membership must not unlock the confirm button.
- **Pending actions are limited to 100 ACTIVE proposals per group.** `listPendingActions` issues one `sdk.group.actions` call with `limit: PENDING_ACTIONS_QUERY_LIMIT` (100) and does not paginate further pages.

## Bootstrap script

`npm run bootstrap:identities` ([scripts/bootstrap-identities.mjs](scripts/bootstrap-identities.mjs)) registers four identities from one mnemonic. Each `identityIndex` (0–3) is a distinct DIP-13 path, so one mnemonic yields four genuinely distinct, independently-registerable identities — it saves managing four seed phrases, **not** the on-chain cost (each still needs its own funded identity-create tx).

**Prerequisite:** a repository-root `npm install` (in addition to this app's local `npm install`). The script loads `../../../setupDashClient.mjs` and imports `Identity`/`Identifier` from `../../../node_modules/@dashevo/evo-sdk/...` so it shares the same SDK module instance as the root tutorials. App-local deps alone leave those paths missing (`ERR_MODULE_NOT_FOUND`). User-facing wording lives in [README.md](README.md#group-members).

- Reads `PLATFORM_MNEMONIC` from the **repo-root** `.env` (loaded via `dotenv` before `setupDashClient.mjs`'s own `dotenv.config()`).
- Writes the three member IDs to **`token-ops/.env`** as `VITE_TOKEN_OPS_MEMBER_1_ID` / `_2_ID` / `_3_ID` (owner index 0 gets no env key). The Settings tab defaults its register-contract group members to these.
- Imports `Identity`/`Identifier` from the **repo-root** SDK copy (not the bare specifier) to avoid a dual-module `instanceof` break under Node 22.
- Idempotent on both axes: skips creating any identity that already resolves on-chain; only tops up balances below the role floor (`OWNER_MIN_CREDITS = 60_000_000_000n`, `MEMBER_MIN_CREDITS = 1_000_000_000n`).
- Carries the platform issue #3095 workaround (proof verification fails but the identity was created — the created ID is recovered from the error message).

## Testing

Vitest ([test/](test/), `test/**/*.test.{ts,tsx}`, default env `node`, jsdom via per-file `// @vitest-environment jsdom`) covers:

> **Test scope:** Component scenarios use groups created by TokenOps, where every member has unit power and `requiredPower` is therefore a signature-count threshold. Broader weighted-member group behavior and presentation are intentionally out of scope for this test pass.

- rule preset operator-vs-admin separation and initial token config wiring ([contract.test.ts](test/contract.test.ts) — still asserts the literal 2/2/3 thresholds and "exactly 3 members" for the _initial_ groups; keep that product-invariant intent when editing the docs)
- governance rule derivation, authority classification, deferred rows, and `appendTokenOpsGroup` (Map + object shapes, larger-than-3 groups) ([governance.test.ts](test/governance.test.ts))
- proposer/co-signer `groupInfo` call shapes, publicNote policy, and config-item mapping ([tokenOperations.test.ts](test/tokenOperations.test.ts))
- pending-action param parsing and signer progress ([groupActions.test.ts](test/groupActions.test.ts))
- supply config parsing ([tokenSupplyConfig.test.ts](test/tokenSupplyConfig.test.ts)), token-ref/DPNS resolution, logger
- WIF sign-in: the mnemonic-vs-WIF heuristic ([detectSecretShape.test.ts](test/detectSecretShape.test.ts)), the key-validation branches of `resolveIdentityFromWif`/`loginWithPrivateKey` with `@dashevo/evo-sdk` mocked ([loginWithPrivateKey.test.ts](test/loginWithPrivateKey.test.ts)), and the auth-tuple adapter ([keyManagerFromKey.test.ts](test/keyManagerFromKey.test.ts))
- component tests for `LoginModal` / `TopNav` / `OverviewView` / `GovernanceView` / `ActionsView` / `ProposeActionPanel` / `PendingActionsView` (mock the dash modules + `useSession`; `ActionsView.test.tsx` asserts one shared governance fetch and refresh propagation; `OverviewView.test.tsx` covers authority aggregation, personalized counts/membership, navigation, loading/errors, and lazy balance inspection; `LoginModal.test.tsx` also covers the mnemonic-only "advanced settings" toggle)

E2E ([test/e2e/](test/e2e/), Playwright, port 5184, real testnet, chromium only, serial): the suite is **read-only** and performs no chain writes. `browse.spec.ts` is the boot/nav/mobile smoke baseline (nav expects **Dashboard** and **Settings**; the Dashboard assertion checks its governance summary and token context); [actions.spec.ts](test/e2e/actions.spec.ts) (two describes — propose form + pending queue, the two panels of the merged Actions tab), [settings.spec.ts](test/e2e/settings.spec.ts), [governance.spec.ts](test/e2e/governance.spec.ts), and [overview.spec.ts](test/e2e/overview.spec.ts) broaden per-view read coverage (read-only notices/gating, the live contract-ID resolver, Groups search/filter/sort/expand, the Access matrices, the lazy identity-balance inspector). These are **ungated** and always run — no credentials needed — mirroring the fully-read-only dashrate suite. The one gated spec, [authenticated-readonly.spec.ts](test/e2e/authenticated-readonly.spec.ts), signs in (identity index 0) only to observe the authenticated read state and sign out, and asserts the **mnemonic and WIF sign-in paths resolve to the same identity**; it uses `loginAs` (mnemonic + "Show advanced settings" identity index) and `loginWithWif` (the WIF is derived from the same mnemonic via `deriveWifFromMnemonic` — DIP-13 identity index 0, CRITICAL auth key 2 — so one funded mnemonic drives both paths), both in [fixtures.ts](test/e2e/fixtures.ts), and `test.skip(!HAS_MNEMONIC, …)` cleanly when `PLATFORM_MNEMONIC` (repo-root `.env`) is unset. Data-dependent reads (e.g. the inspector's live balance lookup, keyed off the three `VITE_TOKEN_OPS_MEMBER_*_ID` vars / `HAS_GROUP_IDENTITIES`) `test.skip(true, …)` when the live state has nothing to assert on. **Write flows (propose / co-sign→execute round-trip / transfer / reassign / append group / register contract) are deferred to a future pass** — see the header comment in [actions.spec.ts](test/e2e/actions.spec.ts). Any chain-mutating e2e must avoid the irreversible `destroyFrozen` path unless behind an explicit manual flag.

## Gotchas

- **Read `maxSupply` from the fetched contract**, not the static `TOKEN_MAX_SUPPLY` constant — the app browses arbitrary contracts, and the constant only describes ones it registers.
- Group members carry **unit power** in contracts created by TokenOps, so `requiredPower` reads as an N-of-M threshold. SDK signer progress still exposes `signedPower`, but weighted-member group presentation and component-test coverage are not currently supported; do not describe unit power as a Dash Platform invariant.
- `explorer.ts` and the whole app are **testnet-only** — the explorer base and `createClient("testnet")` are hardcoded.
- The `@dashevo/evo-sdk` WASM bundle is ~8MB; this is expected and not a build error. See [Performance](#performance--load-anchor-rules-dont-unwind-these) for the load-anchor rules that keep it off the boot critical path.
- `allowJs: true` in [tsconfig.app.json](tsconfig.app.json) so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root.
