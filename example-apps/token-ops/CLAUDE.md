# TokenOps

React + TypeScript + Vite app demonstrating Dash Platform token operations governed by groups and `ChangeControlRules`. Every token capability (mint, burn, freeze, unfreeze, destroy-frozen, emergency pause/resume) is owned by a multi-signer group; the app lets you propose an action, co-sign it, watch signing progress, and reassign or append authorities. Read-only browse-only mode works with no identity via a baked-in default contract.

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

- **Shared SDK core** — [src/dash/client.ts](src/dash/client.ts) and [src/dash/keyManager.ts](src/dash/keyManager.ts) re-export `createClient` and `IdentityKeyManager` from `../../../../setupDashClient-core.mjs` (the canonical browser-safe core at the host repo root — the same one the Node tutorials use). No vendoring. The `@dashevo/evo-sdk` bare specifier is aliased in [vite.config.ts](vite.config.ts) to this app's locally installed browser bundle so the shared core resolves the SDK from here. The app only ever calls `keyManager.getAuth()` (signs with the CRITICAL auth key).
- **[src/dash/](src/dash/)** — one file per Platform SDK concern, each with a leading JSDoc block naming the SDK method it wraps:
  - [contract.ts](src/dash/contract.ts) — token config, the five named rule presets, group builders, and contract registration (`registerContract` always publishes; `ensureContract` reuses a stored/passed ID or falls back to publish).
  - [contractStorage.ts](src/dash/contractStorage.ts) — contract-ID localStorage persistence (`token-ops.contractId`), `DEFAULT_CONTRACT_ID`, and `fetchContractOwnerId`. **Split out of `contract.ts` on purpose** so the session bootstrap can import ID helpers without pulling the `@dashevo/evo-sdk` WASM bundle into the entry chunk.
  - [governance.ts](src/dash/governance.ts) — reads groups and all displayed `ChangeControlRules` rows from a fetched contract, derives the rule matrix (`RULE_DEFINITIONS`), and appends new groups (`appendTokenOpsGroup` via `sdk.contracts.update`).
  - [groupActions.ts](src/dash/groupActions.ts) — lists ACTIVE pending group actions and per-action signer progress; parses token-event params out of a `GroupAction`.
  - [groupDisplay.ts](src/dash/groupDisplay.ts) — pure UI helper: rule key → capability category/accent, and a group's live domains/capabilities derived from its operator rules. No SDK calls.
  - [token.ts](src/dash/token.ts) — token constants + read helpers: ID, total supply, pause status, per-identity balances, frozen state, localized name/description, and supply config (capped/uncapped, perpetual/pre-programmed distribution).
  - [tokenOperations.ts](src/dash/tokenOperations.ts) — group-managed mutations and operator reassignment. Each helper's optional `actionId`: omitted → propose; present → co-sign.
  - [loginWithPrivateKey.ts](src/dash/loginWithPrivateKey.ts) — **WIF private-key sign-in**. `resolveIdentityFromWif` derives the pubkey hash (`PrivateKey.fromWIF`), finds the owning identity (`sdk.identities.byPublicKeyHash`, falling back to `byNonUniquePublicKeyHash`), matches the key entry against either full public-key bytes or the 20-byte public-key hash, and validates it: purpose must be AUTHENTICATION at HIGH/CRITICAL security level and not disabled. Throws the typed `UnknownIdentityError` / `AmbiguousIdentityError` / `WrongKeyPurposeError` / `KeyDisabledError` / `InvalidPrivateKeyError`. `loginWithPrivateKey` then builds an `IdentitySigner` (`addKeyFromWif`) and returns a `DashAuth & { identityId }` tuple. This file statically imports `@dashevo/evo-sdk` value symbols (`PrivateKey`, `IdentitySigner`, `Purpose`, `SecurityLevel`) — the same SDK chunk `client.ts`/`keyManager.ts` already pull in via the shared core, so it adds no new entry-graph anchor (see [Performance](#performance--load-anchor-rules)).
  - [resolveTokenRef.ts](src/dash/resolveTokenRef.ts) — resolves a pasted **contract ID _or_ token ID** to a contract ID (token-first via `contractInfo`, contract fallback).
  - [resolveDpnsName.ts](src/dash/resolveDpnsName.ts) — DPNS username lookup, `.dash` stripped.
  - [logger.ts](src/dash/logger.ts) — `Logger` type, `consoleLogger`, `errorMessage()` for wasm-bindgen errors.
  - [types.ts](src/dash/types.ts) — the app's SDK-surface type aliases (`DashSdk`, `DashKeyManager`, `DashContractLike`, `DashTokenGroupActionResult`, …).
- **[src/session/](src/session/)** — `SessionContext.tsx` provides `{ status, error, sdk, keyManager, identityId, contractId, setContractId, log, login, enterReadOnly, logout }`. `login(secret, { identityIndex? })` dispatches on secret shape (`detectSecretShape`): a **mnemonic** builds an `IdentityKeyManager`; a **WIF** goes through `loginWithPrivateKey` and then `keyManagerFromKey` (adapts the resolved `DashAuth` tuple into the minimal `DashKeyManager` shape — `{ identityId, getAuth: async () => auth }`; `identityIndex` is ignored for WIF, the identity is whichever holds the key). `enterReadOnly()` connects the SDK with no keys (`App.tsx` auto-enters it on `status === "idle"`). Network is hardcoded to **testnet**. The secret is never stored in state or localStorage — only `contractId` is persisted. Consumer hook: `useSession.ts`. `keyManagerFromKey.ts` is the WIF adapter; `../lib/detectSecretShape.ts` is the mnemonic-vs-WIF heuristic (mnemonics have whitespace, WIFs are a single token).
- **[src/hooks/useDpnsNames.ts](src/hooks/useDpnsNames.ts)** — resolves a set of identity IDs to DPNS names, keyed/deduped by a normalized sorted `idsKey`, backed by a **module-level cache** so names survive remounts. Transient failures are left uncached for retry.
- **[src/components/](src/components/)** — five views rendered by tab in [App.tsx](src/App.tsx) (remounted via `key={refreshKey}` on op completion): `OverviewView` (token header, supply meter, pending count, identity inspector), `OperationsView` (proposal forms + direct transfer, gated by live operator membership), `PendingActionsView` (ACTIVE actions, signer progress, co-sign), `GovernanceView` (Access-control + Groups tabs), `SettingsView` (signed-in status + balance _or_ read-only notice, contract/token-ID resolver, register-contract — **no longer holds the sign-in form**). Sign-in moved to `LoginModal`, a top-bar modal opened by `TopNav`'s "Sign in" button (`App.tsx` owns the `loginOpen` state); `TopNav` also renders "Sign out" when authenticated. Supporting: `ConfirmActionPanel`, `CopyableId`, `IdentityLabel` (renders `@dpnsname`), `AppNotices`.
- **[src/lib/](src/lib/)** — [capabilityIcon.tsx](src/lib/capabilityIcon.tsx) (per-capability SVG glyph), [explorer.ts](src/lib/explorer.ts) (testnet Platform Explorer URLs — base is hardcoded testnet), [format.ts](src/lib/format.ts) (`shortId`, `formatDate`, `severityLabel`).
- **[scripts/bootstrap-identities.mjs](scripts/bootstrap-identities.mjs)** — derives/registers four identities (indices 0–3) from one `PLATFORM_MNEMONIC`, tops each up to its role floor, and writes member IDs to `token-ops/.env`. See [Bootstrap](#bootstrap-script).
- **Config** — [vite.config.ts](vite.config.ts) doubles as the Vitest config (see [Performance](#performance--load-anchor-rules) for its SDK alias / preload role). [tsconfig.app.json](tsconfig.app.json) targets `src`; `tsconfig.node.json` targets the config files.

## Performance — load-anchor rules

The `@dashevo/evo-sdk` browser bundle is ~8 MB and must stay off the boot critical path. Two invariants keep it there:

- **Never add a top-level value import of `@dashevo/evo-sdk` to any file statically reachable from `App.tsx`** (type-only imports are fine — they're erased). A single static value import anchors the whole SDK chunk to the entry graph even when it's only used inside an async function. This is why [contractStorage.ts](src/dash/contractStorage.ts) is split from [contract.ts](src/dash/contract.ts): the session bootstrap imports the sync contract-ID helpers (`loadStoredContractId`, `saveContractId`, `clearStoredContractId`, `DEFAULT_CONTRACT_ID`) at render time, and those must not drag in the SDK. Keep them synchronous.
- **The `modulePreload.resolveDependencies` filter in [vite.config.ts](vite.config.ts) must keep stripping the `evo-sdk` chunk.** Vite auto-injects `<link rel="modulepreload">` for every dynamic-import dependency it finds at build time; without the filter the browser races to fetch the 8 MB SDK in parallel with the entry chunk, re-blocking first paint even though the import is syntactically dynamic. That same file aliases the `@dashevo/evo-sdk` bare specifier to this app's local `dist/evo-sdk.module.js`.

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
- **Pending actions**: `sdk.group.actions({ …, status: "ACTIVE" })` and `sdk.group.actionSigners({ …, status: "ACTIVE", actionId })`.
- **WIF sign-in** ([loginWithPrivateKey.ts](src/dash/loginWithPrivateKey.ts)): `PrivateKey.fromWIF` → `privateKey.getPublicKeyHash()` → `sdk.identities.byPublicKeyHash(hash)` first, then `byNonUniquePublicKeyHash(hash)` if the unique lookup misses. The resolver matches the WIF against the identity's `publicKeys[]` by decoding `entry.data` as hex-or-base64 and comparing either full public-key bytes or the 20-byte public-key hash, since SDK serialization varies. It then gates on `purpose === AUTHENTICATION` + `securityLevel ∈ {HIGH, CRITICAL}` + not disabled, and throws `AmbiguousIdentityError` instead of guessing if non-unique lookup returns multiple valid auth matches. `IdentitySigner.addKeyFromWif` builds the signer. `DashSdk.identities` includes `byPublicKeyHash(...)` and `byNonUniquePublicKeyHash(...)` members in [types.ts](src/dash/types.ts) for this.
- Direct purchase, distribution claims, and admin/control-group updates are displayed or documented but intentionally deferred from v1.

## Limitations

The authoritative, user-facing limitations list lives in [README.md](README.md#limitations) — keep the two in sync when you change scope. The one item worth restating here for contributors: **reassignment only touches the operator (`authorizedToMakeChange`), never the admin (`adminActionTakers`).** The reassign modal is titled "Reassign operator" and `configurationChangeItemForRule` only builds operator changes; the admin column in the Governance matrix is read-only.

## Bootstrap script

`npm run bootstrap:identities` ([scripts/bootstrap-identities.mjs](scripts/bootstrap-identities.mjs)) registers four identities from one mnemonic. Each `identityIndex` (0–3) is a distinct DIP-13 path, so one mnemonic yields four genuinely distinct, independently-registerable identities — it saves managing four seed phrases, **not** the on-chain cost (each still needs its own funded identity-create tx).

- Reads `PLATFORM_MNEMONIC` from the **repo-root** `.env` (loaded via `dotenv` before `setupDashClient.mjs`'s own `dotenv.config()`).
- Writes the three member IDs to **`token-ops/.env`** as `VITE_TOKEN_OPS_MEMBER_1_ID` / `_2_ID` / `_3_ID` (owner index 0 gets no env key). The Settings tab defaults its register-contract group members to these.
- Imports `Identity`/`Identifier` from the **repo-root** SDK copy (not the bare specifier) to avoid a dual-module `instanceof` break under Node 22.
- Idempotent on both axes: skips creating any identity that already resolves on-chain; only tops up balances below the role floor (`OWNER_MIN_CREDITS = 60_000_000_000n`, `MEMBER_MIN_CREDITS = 1_000_000_000n`).
- Carries the platform issue #3095 workaround (proof verification fails but the identity was created — the created ID is recovered from the error message).

## Testing

Vitest ([test/](test/), `test/**/*.test.{ts,tsx}`, default env `node`, jsdom via per-file `// @vitest-environment jsdom`) covers:

- rule preset operator-vs-admin separation and initial token config wiring ([contract.test.ts](test/contract.test.ts) — still asserts the literal 2/2/3 thresholds and "exactly 3 members" for the _initial_ groups; keep that product-invariant intent when editing the docs)
- governance rule derivation, authority classification, deferred rows, and `appendTokenOpsGroup` (Map + object shapes, larger-than-3 groups) ([governance.test.ts](test/governance.test.ts))
- proposer/co-signer `groupInfo` call shapes, publicNote policy, and config-item mapping ([tokenOperations.test.ts](test/tokenOperations.test.ts))
- pending-action param parsing and signer progress ([groupActions.test.ts](test/groupActions.test.ts))
- supply config parsing ([tokenSupplyConfig.test.ts](test/tokenSupplyConfig.test.ts)), token-ref/DPNS resolution, logger
- WIF sign-in: the mnemonic-vs-WIF heuristic ([detectSecretShape.test.ts](test/detectSecretShape.test.ts)), the key-validation branches of `resolveIdentityFromWif`/`loginWithPrivateKey` with `@dashevo/evo-sdk` mocked ([loginWithPrivateKey.test.ts](test/loginWithPrivateKey.test.ts)), and the auth-tuple adapter ([keyManagerFromKey.test.ts](test/keyManagerFromKey.test.ts))
- component tests for `LoginModal` / `TopNav` / `GovernanceView` / `OperationsView` / `PendingActionsView` (mock the dash modules + `useSession`; `LoginModal.test.tsx` also covers the mnemonic-only "advanced settings" toggle)

E2E ([test/e2e/](test/e2e/), Playwright, port 5184, real testnet, chromium only, serial): the committed [browse.spec.ts](test/e2e/browse.spec.ts) is a read-only smoke test with no writes (nav now expects a **Settings** tab, not Account). Auth/group-gated flows sign in through the top-bar login modal — the `loginAs` fixture ([fixtures.ts](test/e2e/fixtures.ts)) clicks "Sign in", fills "Mnemonic or private key", and expands "Show advanced settings" for the identity index. They key off `PLATFORM_MNEMONIC` (repo-root `.env`) and the three `VITE_TOKEN_OPS_MEMBER_*_ID` vars via the `HAS_MNEMONIC` / `HAS_GROUP_IDENTITIES` fixture flags and `test.skip` cleanly when unset. Any chain-mutating e2e must avoid the irreversible `destroyFrozen` path unless behind an explicit manual flag.

## Gotchas

- **Read `maxSupply` from the fetched contract**, not the static `TOKEN_MAX_SUPPLY` constant — the app browses arbitrary contracts, and the constant only describes ones it registers.
- Group members carry **unit power** in the initial contract, so `requiredPower` reads as an N-of-M threshold — but the code handles weighted power generally (`signedPower` sums the map values). Don't assume 1-per-member when reading signer progress.
- `explorer.ts` and the whole app are **testnet-only** — the explorer base and `createClient("testnet")` are hardcoded.
- The `@dashevo/evo-sdk` WASM bundle is ~8MB; this is expected and not a build error. See [Performance](#performance--load-anchor-rules) for the load-anchor rules that keep it off the boot critical path.
- `allowJs: true` in [tsconfig.app.json](tsconfig.app.json) so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root.
