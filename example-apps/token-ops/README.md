# TokenOps — Group-Governed Dash Platform Tokens

A React + TypeScript + Vite app that makes Dash Platform token governance visible. It registers a token whose every capability — mint, burn, freeze, unfreeze, destroy-frozen, emergency pause/resume — is controlled by a multi-signer group through `ChangeControlRules`, then lets you propose actions, co-sign them, watch signing progress, and reassign or add authorities.

The app is built around the idea that a token action has two authorities: an **operator** (`authorizedToMakeChange`, who performs the action) and an **admin** (`adminActionTakers`, who can later reassign that operator). The Governance view keeps those separate.

## Prerequisites

- Node 22.22+ (`engines.node` pins `>=22.22.0 <22.23.0`)
- **Browse-only mode needs nothing** — a default contract is baked in, so a fresh install can read the token, groups, and rule matrix without any identity.
- Writing needs a funded Dash Platform testnet identity (BIP-39 mnemonic + identity index).
- Exercising the **group signing flow** end-to-end needs three additional funded identities (the group members). `npm run bootstrap:identities` derives and funds all four from one mnemonic — see [Group members](#group-members). That bootstrap path also requires a **repository-root `npm install`** (in addition to this app's local install) so `setupDashClient.mjs` and the shared root `@dashevo/evo-sdk` copy resolve — see [Group members](#group-members).

## Quick start

```bash
# From this directory (example-apps/token-ops):
npm install
npm run dev
```

Production build: `npm run build && npm run preview`

Other scripts:

```bash
npm run test          # Vitest unit + component suite
npm run test:coverage # Vitest under v8 coverage (text + HTML in coverage/)
npm run test:e2e      # Playwright suite on port 5184 (real testnet)
npm run test:e2e:ui   # Playwright interactive runner
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
```

## Signing in

Click **Sign in** in the top bar to open the login modal. Paste either a BIP-39 **mnemonic** or a single **WIF private key** — the app picks the path automatically (mnemonics contain whitespace; a WIF is one token). "Sign out" also lives in the top bar. The secret is passed straight to the in-memory key manager and is never written to React state or localStorage.

- **Mnemonic** — an "Advanced settings" disclosure exposes an identity index. Index `0` is the contract owner (the identity that can register a contract and reassign authorities); indices `1`–`3` are the group members that propose and co-sign token actions.
- **WIF private key** — the app looks up the owning identity via its public-key hash (`sdk.identities.byPublicKeyHash`, then `byNonUniquePublicKeyHash` when needed) and verifies the matching key is an AUTHENTICATION key at HIGH or CRITICAL security level and not disabled. SDK key data may be encoded as either full public-key bytes or the 20-byte public-key hash; the login path accepts both. Wrong-purpose, disabled-key, unknown-identity, ambiguous-identity, and malformed-WIF cases each surface a specific error. No identity index applies — the identity is whichever one holds that key.

The **Settings** tab shows signed-in status and token balance (or a read-only notice), plus the contract/token-ID resolver and the register-contract flow.

The **Dashboard** leads with governance: proposals needing the current identity's signature, all active proposals, group membership, and a "Who controls what" summary. That summary groups capabilities by their live operator authority, treating ContractOwner, Identity, MainGroup, and NoOne authorities like groups for display. Compact token details and a lazy, collapsible identity balance/freeze-status inspector remain available lower in the same view.

The network is hardcoded to **testnet** — this is a demo app, not a mainnet tool.

## Contract

The contract has one token at position `0` and a minimal placeholder `note` document schema. The app is about token operations, not documents.

Token config (in [`src/dash/contract.ts`](src/dash/contract.ts)): base supply `100`, max supply `10,000`, full history-keeping on, not paused, not tradeable. The five named rule presets and their operator / admin authorities:

| Preset           | operator (`authorizedToMakeChange`) | admin (`adminActionTakers`) |
| ---------------- | ----------------------------------- | --------------------------- |
| `lockedRules`    | NoOne                               | NoOne                       |
| `ownerRules`     | ContractOwner                       | ContractOwner               |
| `treasuryRules`  | Group(Treasury)                     | ContractOwner               |
| `accessRules`    | Group(Access)                       | ContractOwner               |
| `emergencyRules` | Group(Emergency)                    | ContractOwner               |

### Initial groups

The contract registers three groups. Every member has power `1`, so the required power is the signature threshold:

- **Treasury Group** — position `0`, 2-of-3, holds `manualMintingRules` and `manualBurningRules`
- **Access Group** — position `1`, 2-of-3, holds `freezeRules` and `unfreezeRules`
- **Emergency Group** — position `2`, 3-of-3, holds `destroyFrozenFundsRules` and `emergencyActionRules`

These thresholds describe the **initial** contract. Platform groups are immutable once registered, so the app never edits a group in place — the Governance → Groups tab **appends** a new group (any Platform-valid size, 2–256 members) and remaps token functions to it.

`DEFAULT_CONTRACT_ID` in [`src/dash/contractStorage.ts`](src/dash/contractStorage.ts) is a published testnet contract (`KMMJJdJo9LTjjevsuJ4jkbNZEY8xCq8n44cDmba7o2A`) so browse-only mode works immediately. The active ID is stored under `localStorage['token-ops.contractId']`; clearing it falls back to the default. Register your own from the Settings tab, or paste an existing contract **or** token ID — the app resolves either.

## Group members

The group-signing flow needs three additional funded identities. The bootstrap script derives four identities (owner + three members) from a single `PLATFORM_MNEMONIC` — each identity index is a distinct DIP-13 path, so one mnemonic yields four independently-registerable, independently-funded identities.

**Root install is required for bootstrap.** `scripts/bootstrap-identities.mjs` imports the repo-root `setupDashClient.mjs` helper and the root `@dashevo/evo-sdk` package (not this app's local copy) so Node 22 keeps a single module instance for `instanceof` checks inside the SDK. An app-local `npm install` alone is not enough — without root `node_modules`, bootstrap fails with `ERR_MODULE_NOT_FOUND` for the root SDK path.

```bash
# From the repository root (once per clone):
npm install

# Then from this directory:
npm install          # if you have not already for the Vite app
npm run bootstrap:identities
```

`PLATFORM_MNEMONIC` is read from the **repo-root** `.env`, funded with enough testnet credits to register and top up four identities. The script is idempotent (re-runs skip already-registered identities and only top up balances below the role floor) and writes the three member IDs to `token-ops/.env` as `VITE_TOKEN_OPS_MEMBER_1_ID`, `VITE_TOKEN_OPS_MEMBER_2_ID`, and `VITE_TOKEN_OPS_MEMBER_3_ID`. The Settings tab's "Register a new contract" flow defaults its group members to those three.

## Platform operations at a glance

Every SDK call lives under [`src/dash/`](src/dash/), one file per concern, each with a JSDoc header naming the method it wraps.

| Concern                         | File                                                        | SDK method(s)                                                                                                          |
| ------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Connect to testnet              | [`SessionContext.tsx`](src/session/SessionContext.tsx)      | `EvoSDK.testnetTrusted()` + `sdk.connect()` (via shared core, lazy-loaded)                                             |
| Derive identity keys (mnemonic) | [`SessionContext.tsx`](src/session/SessionContext.tsx)      | `IdentityKeyManager` / `wallet.deriveKeyFromSeedWithPath` (via shared core, lazy-loaded)                               |
| Sign in with a WIF private key  | [`loginWithPrivateKey.ts`](src/dash/loginWithPrivateKey.ts) | `sdk.identities.byPublicKeyHash` / `byNonUniquePublicKeyHash`, `PrivateKey.fromWIF`, `IdentitySigner.addKeyFromWif`    |
| Register contract               | [`contract.ts`](src/dash/contract.ts)                       | `sdk.identities.nonce`, `sdk.contracts.publish`                                                                        |
| Persist / look up contract      | [`contractStorage.ts`](src/dash/contractStorage.ts)         | `sdk.contracts.fetch`                                                                                                  |
| Read groups + rules             | [`governance.ts`](src/dash/governance.ts)                   | `sdk.contracts.fetch`, `sdk.group.info`, `sdk.contracts.update` (append group)                                         |
| List pending actions + signers  | [`groupActions.ts`](src/dash/groupActions.ts)               | `sdk.group.actions`, `sdk.group.actionSigners`                                                                         |
| Read token state                | [`token.ts`](src/dash/token.ts)                             | `sdk.tokens.calculateId` / `totalSupply` / `statuses` / `identityBalances` / `identityTokenInfos` / `contractInfo`     |
| Token mutations                 | [`tokenOperations.ts`](src/dash/tokenOperations.ts)         | `sdk.tokens.mint` / `burn` / `transfer` / `freeze` / `unfreeze` / `destroyFrozen` / `emergencyAction` / `configUpdate` |
| Resolve contract-or-token ID    | [`resolveTokenRef.ts`](src/dash/resolveTokenRef.ts)         | `sdk.tokens.contractInfo`, `sdk.tokens.calculateId`                                                                    |
| Resolve DPNS name               | [`resolveDpnsName.ts`](src/dash/resolveDpnsName.ts)         | `sdk.dpns.username`                                                                                                    |

`createClient` and `IdentityKeyManager` come from the repo-root `setupDashClient-core.mjs` — the same browser-safe core the Node tutorials use — loaded lazily via `SessionContext`'s cached dynamic import so the ~8 MB `@dashevo/evo-sdk` bundle stays off the boot critical path (the build splits it into its own chunk; the entry chunk is ~315 kB). The `@dashevo/evo-sdk` bare specifier is aliased to the app's local copy in [`vite.config.ts`](vite.config.ts).

Supporting files:

- [`groupDisplay.ts`](src/dash/groupDisplay.ts) — pure UI helper mapping rule keys to capability categories/accents and deriving a group's domains from its live operator rules.
- [`logger.ts`](src/dash/logger.ts) — shared `Logger` type, `consoleLogger`, and `errorMessage()` for wasm-bindgen errors.
- [`types.ts`](src/dash/types.ts) — the app's SDK-surface type aliases (`DashSdk`, `DashKeyManager`, etc.).

## Group action lifecycle

Group-managed operations (everything except direct transfer) follow propose → co-sign → execute:

1. A group member **proposes** an action — `sdk.tokens.mint({ …, groupInfo: GroupStateTransitionInfoStatus.proposer(groupPosition) })`. This creates an ACTIVE group action.
2. Other members **co-sign** the same action — the same call with `GroupStateTransitionInfoStatus.otherSigner(groupPosition, actionId)`.
3. When accumulated signing power reaches the group's required power, Platform **executes** it automatically.

The Actions tab surfaces ACTIVE actions (`sdk.group.actions`) below the proposal form, shows "N of M" signing progress (`sdk.group.actionSigners`), and splits them into "needs your signature" vs "waiting on others". Each group is loaded with a single query capped at 100 ACTIVE actions (`PENDING_ACTIONS_QUERY_LIMIT` in [`groupActions.ts`](src/dash/groupActions.ts)); later proposals beyond that cap are not listed.

## Limitations

TokenOps is a **group-governance demo**. It uses a token only as the vehicle for showing `ChangeControlRules` group governance — it is not a complete token toolkit. Its token surface is deliberately minimal: a single token at position `0`, testnet only, in-memory keys, and several token config controls (max supply, conventions, distribution, marketplace, direct purchase) are shown read-only rather than made editable. The point is the groups.

Within group governance itself, a few things are intentionally not exercised in v1:

- **The `MainGroup` (main control group) is never used as an authority.** The contract registers one (`mainControlGroup: Treasury`, `mainControlGroupCanBeModified: NoOne`) and the Governance matrix will render "Main group" if it sees it ([`governance.ts`](src/dash/governance.ts)), but no capability is assigned to it and there is no UI to modify it.
- **Appended groups always use unit voting power.** The Governance → Groups "Append group" form takes a member list and a single required-power threshold, so every group it creates gives each member power `1`. The read/display side handles weighted power generally (see `usesOnePowerPerSignature` in [`PendingActionsView.tsx`](src/components/PendingActionsView.tsx)), but there's no form field to assign disparate per-member power.
- **Capabilities can only be reassigned to a `Group`.** The reassign control lists existing groups only, and `configurationChangeItemForRule` ([`tokenOperations.ts`](src/dash/tokenOperations.ts)) always builds `AuthorizedActionTakers.Group(...)`. The matrix reads and displays ContractOwner, Identity, MainGroup, and NoOne authorities, but the app can't assign to (or away from) them.
- **Only the operator authority is reassignable, not the admin.** Reassignment changes `authorizedToMakeChange` (who performs the action); it never changes `adminActionTakers` (who can later reassign the operator), which is displayed but not editable.
- **Group-admin reassignment is not supported yet.** Direct `configUpdate` only works when the rule admin is `ContractOwner` or a specific `Identity`. If `adminActionTakers` is a Group, the reassign modal stays inspect-only until TokenOps implements the multi-signer propose/co-sign lifecycle for configuration updates.
- **Pending actions are limited to 100 ACTIVE proposals per group.** The queue issues one `sdk.group.actions` call with `limit: 100` and does not paginate further pages, so older/later proposals beyond that window are not shown.

## Reading this codebase

1. **[`src/dash/`](src/dash/)** — start here. [`contract.ts`](src/dash/contract.ts) defines the token config, rule presets, and initial groups; [`tokenOperations.ts`](src/dash/tokenOperations.ts) shows the propose/co-sign pattern; [`governance.ts`](src/dash/governance.ts) reads and appends authorities.
2. **[`src/session/SessionContext.tsx`](src/session/SessionContext.tsx)** — SDK connection, identity, contract ID, read-only vs authenticated status, and the toast logger. `login(secret, { identityIndex })` dispatches on secret shape ([`detectSecretShape.ts`](src/lib/detectSecretShape.ts)): a mnemonic builds an `IdentityKeyManager`; a WIF goes through [`loginWithPrivateKey.ts`](src/dash/loginWithPrivateKey.ts), then [`keyManagerFromKey.ts`](src/session/keyManagerFromKey.ts) adapts the resolved auth tuple to the `DashKeyManager` shape. The secret lives only inside the key manager closure. Consumer hook: [`useSession.ts`](src/session/useSession.ts).
3. **[`src/components/`](src/components/)** — the four tab views (Dashboard, Actions, Governance, Settings). [`ActionsView`](src/components/ActionsView.tsx) loads one governance snapshot shared by [`ProposeActionPanel`](src/components/ProposeActionPanel.tsx) and [`PendingActionsView`](src/components/PendingActionsView.tsx). Supporting components include the top-bar [`LoginModal`](src/components/LoginModal.tsx) (mnemonic/WIF sign-in), [`ConfirmActionPanel`](src/components/ConfirmActionPanel.tsx), [`IdentityLabel`](src/components/IdentityLabel.tsx), [`CopyableId`](src/components/CopyableId.tsx), [`AppNotices`](src/components/AppNotices.tsx), and [`TopNav`](src/components/TopNav.tsx) (Sign in / Sign out).
4. **[`src/hooks/useDpnsNames.ts`](src/hooks/useDpnsNames.ts)** — resolves identity IDs to DPNS usernames, cached at module level so lists don't re-query.
5. **[`src/lib/`](src/lib/)** — [`capabilityIcon.tsx`](src/lib/capabilityIcon.tsx) (per-capability SVG glyph), [`explorer.ts`](src/lib/explorer.ts) (testnet Platform Explorer URLs), [`format.ts`](src/lib/format.ts) (ID truncation, dates).

## Tests

[`test/`](test/) is a Vitest + Testing Library suite: unit tests over `src/dash/`/`src/lib/` that stub the `DashSdk` shape (including WIF login — `detectSecretShape`, `loginWithPrivateKey`'s key-validation branches, and `keyManagerFromKey`), and component tests (`LoginModal`, `TopNav`, `OverviewView`, `GovernanceView`, `ActionsView`, `ProposeActionPanel`, `PendingActionsView`) that mock the dash modules and `useSession`. Default env is `node`; component tests opt into jsdom with a `// @vitest-environment jsdom` pragma. Run with `npm run test`.

[`test/e2e/`](test/e2e/) is a Playwright suite that runs against real Dash Platform testnet — no mocks — auto-booting Vite on port 5184. It is **read-only** (no chain writes): the specs broaden per-view browsing coverage and run without credentials, except one authenticated read-only spec that signs in to observe the signed-in state (and that the mnemonic and WIF sign-in paths reach the same identity), which skips cleanly when `PLATFORM_MNEMONIC` (repo-root `.env`) is unset. Run with `npm run test:e2e`.

## Deploying to GitHub Pages

The repo ships a fork-friendly deploy workflow. Builds honor `VITE_BASE_PATH` so links resolve under `/<repo>/`. For a local preview of that build:

```bash
VITE_BASE_PATH=/token-ops/ npm run build && npm run preview
```

## Tech stack

- React 19
- TypeScript
- Vite 8 / Vitest 4
- Playwright
- `@dashevo/evo-sdk` 4.0.0
- sonner (toasts)
