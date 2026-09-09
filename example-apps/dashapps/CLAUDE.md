# Dashapps implementation notes

## Identifier query encoding — verified on testnet

The evo-sdk 4.1.1 document-query filter passes through JSON deserialization.
A `Uint8Array` in `where` fails with:

> Invalid documents query: fromObject: serde deserialization error: invalid type: byte array, expected any valid JSON value

Use validated base58 strings for identifier equality filters. Live write verification
later established that identifier-media `Document` properties also require
base58; byte values do not survive the evo-sdk bridge as `Value::Identifier`.

Verified the Keyword Search `shortDescription` query for both results of the
`dash` keyword on testnet: base58 filters returned the Sansnote description.
The app's mocked tests assert the JSON-safe filter shape.

SDK errors can be WASM objects with a `message()` method. Use
`src/lib/logger.ts` rather than `String(error)`, including before wrapping errors.
Short-description errors are independent of successfully loaded contract facts;
show the actual error next to that field and let Refresh retry it. A successful
empty response is distinct from a failed read.

First live attempt at protocol 13, heights 568315–568316, published temporary
contracts `7ZiLHmRbe1KCDAjcKmGJ7MFYpDuA1WeFP3HMN61w7Mc3` and
`EtxiWUmuva8vsg2yezX2n7peompzN32VJABQuK7FLCXJ`. Metadata reconstruction,
publication and fetched declared metadata passed. The first document write on
each failed with Drive's `structure error: not an array of bytes`: the write attempt
gave `Document` a `Uint8Array` identifier property. A second attempt at height
568318 used a plain number array and received the same error. The evo-sdk 4.1
contract-aware serializer requires identifier-media properties in canonical
base58 form, then a fetched-contract `toBytes`/`fromBytes` round trip to produce
the typed identifier before facade validation. Its own document round-trip tests
use that path. Creates and replacements now use this preparation. These
attempts do not satisfy the deployment gate.

The first contract-aware attempt at height 568319 then stopped locally with
`missing required key: created at field is not present`. Because this preparation
serializes before the facade can populate timestamps, the write path seeds create
timestamps and preserves `$createdAt` while advancing `$updatedAt` on replacement.
At height 568320, typed property preparation passed but `fromBytes` dropped the
wrapper-only creation entropy; the facade stopped before broadcast with
`Document must have entropy set for creation`. Preparation now restores the
draft's entropy after the round trip.

At height 568323, Platform reported a duplicate unique owner/contract pair during
seed creation, establishing that at least one write had committed across the
failed/retried attempts. Seed setup now resumes per unique pair: it reads first,
and after a create error only treats the operation as committed when the exact
pair is confirmed on-chain. The deliberate duplicate-rejection check still uses
a raw create and cannot be satisfied by reconciliation.

The height-568324 run passed exact lookup, duplicate rejection (40105), replace
to revision 2, delete, recreation, two-item compound pagination, and descending
recent ordering. Its three live timestamps were distinct, so no equal-timestamp
page boundary occurred. This is informational: the gate retains duplicate/cycle
detection and does not spend credits solely to manufacture a timestamp tie.

The declared-metadata contract
`EtxiWUmuva8vsg2yezX2n7peompzN32VJABQuK7FLCXJ` passed the remaining gate at
height 568332 with evo-sdk 4.1.1 / protocol 13. Its fetched description was
"Community metadata registry for Dash Platform applications" and its keywords
were `registry`, `apps`, and `dapps`; Keyword Search exposed them. Duplicate
owner/contract submission was rejected with code 40105. Replace, delete,
recreate, and two-document compound pagination passed, returning documents
`2LT1UATC6krJSH9bvao3LjJCu31aszQwNx8Chk7CRfug` and
`6LY9iXbJy65iaFLQjTdgjNr53J1h6j9bEggL3QdcssnF`. This contract is the frozen
testnet default. Mainnet has no default.

The production write layer uses the same live-verified contract-aware
`toBytes`/`fromBytes` preparation. Before create, edit, or withdraw it evicts the
target contract from the SDK cache and refetches it. It independently checks an
existing owner/contract pair before create, fetches the current revision before
replace, fetches the current document before delete, classifies 40105 as an edit
prompt, and invalidates detail/discovery reads after success. Final local checks:
build, lint, 46 Vitest tests in 11 files, and the Chromium Playwright smoke test.

## Accepted scope and session boundaries

PLAN.md now removes the leaderboard and all proposal/target-document counts.
Keep one metadata entry per identity per target, allowing multiple community
proposals. Use the four non-aggregate candidate indices.

SessionContext.tsx adapts the dashnames generation-guard pattern for mnemonic
and WIF private-key sign-in. Network changes invalidate connection/auth/balance requests and caches.
Registry changes have a separate generation that resets dependent views/forms and
cancels pending sign-in; an already authenticated identity remains signed in.
Registry selection survives network switches in memory even if browser storage
fails. Mainnet sign-in is rejected in the session API as well as hidden in the UI.
Recovery phrases and WIFs are form values passed to login and immediately cleared
from the form; do not add them to React state, refs, storage, or logs.

Shared auth parity: `src/dash/loginWithPrivateKey.ts`,
`src/lib/detectSecretShape.ts`, `src/session/keyManagerFromKey.ts`, and
`test/loginWithPrivateKey.test.ts` remain byte-identical to Dashnote, TokenOps,
and DashNames. Keep app-specific session and form behavior outside those files;
`scripts/check-shared-auth-parity.sh` enforces this.
