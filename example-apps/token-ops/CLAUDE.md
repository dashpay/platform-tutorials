# TokenOps

React + TypeScript + Vite app for demonstrating Dash Platform token
operations controlled by groups and `ChangeControlRules`.

## Commands

- `npm run dev` - start Vite dev server
- `npm run build` - typecheck (`tsc -b`) then bundle
- `npm run test` - Vitest suite in [test/](test/)
- `npm run test:e2e` - Playwright suite in [test/e2e/](test/e2e/) on port 5184
- `npm run bootstrap:identities` - registers identity index 0 plus three group-member identities

## Architecture

- [src/dash/](src/dash/) - one file per Platform SDK operation.
  - `contract.ts` defines the placeholder schema, token configuration, named rule presets, and initial groups.
  - `governance.ts` reads groups and all displayed `ChangeControlRules` rows.
  - `token.ts` reads token ID, supply, pause status, identity balances, and frozen state.
  - `tokenOperations.ts` wraps group-managed token actions and supported config reassignment.
  - `groupActions.ts` lists pending group actions and signer progress.
- [src/components/](src/components/) - Overview, Operations, Pending Actions, Governance, and Account views.
- [scripts/bootstrap-identities.mjs](scripts/bootstrap-identities.mjs) - derives/registers four identities from one mnemonic and writes group-member env vars.

## Contract

The contract has one token at position `0` and a minimal placeholder `note`
document schema. The app is about token operations, not documents.

Initial groups:

- Treasury Group: group `0`, 2-of-3, `manualMintingRules` and `manualBurningRules`
- Access Group: group `1`, 2-of-3, `freezeRules` and `unfreezeRules`
- Emergency Group: group `2`, 3-of-3, `destroyFrozenFundsRules` and `emergencyActionRules`

Rule presets in `contract.ts` are intentionally named:

- `lockedRules`: `NoOne / NoOne`
- `ownerRules`: `ContractOwner / ContractOwner`
- `treasuryRules`: `Group(Treasury) / ContractOwner`
- `accessRules`: `Group(Access) / ContractOwner`
- `emergencyRules`: `Group(Emergency) / ContractOwner`

Remember that a `ChangeControlRules` object has two authorities:

- `authorizedToMakeChange`: who can perform the action or change the config value
- `adminActionTakers`: who can later change that authority

The Governance view must keep those separate in the rule matrix.

## SDK Patterns

- Group actions use `GroupStateTransitionInfoStatus.proposer(groupPosition)` for the first signer and `.otherSigner(groupPosition, actionId)` for later signatures.
- Config reassignment currently supports only high-signal operator changes:
  `ManualMintingItem`, `ManualBurningItem`, `FreezeItem`, `UnfreezeItem`,
  `DestroyFrozenFundsItem`, and `EmergencyActionItem`.
- Admin/control-group updates, direct purchase, and distribution claims are displayed or documented but intentionally deferred from v1.
- Existing Platform groups are immutable after contract registration. Append a new group and remap token functions instead of editing a group in place.

## Testing

Vitest covers:

- rule preset separation of operator vs admin authority
- initial token configuration and group thresholds
- governance rule derivation
- config reassignment item mapping
- proposer/co-signer groupInfo call shapes

E2E should avoid irreversible `destroyFrozen` unless protected by an explicit manual flag.
