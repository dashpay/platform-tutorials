# DashProof Lab — Design Notes

Historical design record for the proof-of-existence example app.

## Intent

Build a modern React tutorial app that keeps the Dash Platform code readable and direct:

- hash files locally in the browser
- store immutable proof documents on Dash Platform
- verify by querying the same SHA-256 hash
- inspect proof history by owner or `chainId`

## Architecture

- React + TypeScript + Vite SPA
- One Platform operation per file under `src/dash/`
- Single `SessionContext` for SDK connection, login state, and active contract ID
- File bytes never leave the browser; only the digest and metadata are submitted

## Primary screens

- `Anchor` — select file, hash locally, submit proof
- `Verify` — select file, hash locally, query by hash
- `History` — query by owner or `chainId`

## Contract decisions

- Immutable `anchor` documents
- `entryHash` and `previousId` stored as 32-byte `byteArray` fields
- `byHash` unique index prevents duplicate anchors for the same hash
- `byChain` and `byOwner` support the history views

## Tutorial constraints

- Keep the SDK calls in plain sight
- Avoid unnecessary data libraries or app abstractions
- Reuse the shared browser-safe `setupDashClient-core.mjs`
- Keep mnemonics in memory only
