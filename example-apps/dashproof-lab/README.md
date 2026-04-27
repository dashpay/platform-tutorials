# DashProof Lab — Dash Platform Proof of Existence

`DashProof Lab` is a React + TypeScript + Vite example app that hashes files in the browser, anchors the resulting SHA-256 digest on Dash Platform, and later verifies the same file by querying that stored hash.

The app is structured as a tutorial example, not a production product. Platform operations live under [`src/dash/`](./src/dash/), UI flows live under [`src/components/`](./src/components/), and session state lives in [`src/session/`](./src/session/).

## Quick start

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build
npm run test
npm run lint
```

## Current app behavior

- Files never leave the browser.
- SHA-256 is computed locally before any Platform call.
- The app stores only the digest plus small metadata like `chainId`, filename, MIME type, size, and an optional note.
- The app auto-connects in browse-only mode on load.
- `Create proof` requires login to submit, but still lets you hash a file locally first.
- `Verify proof` works in browse-only mode as long as you have a contract ID configured.
- `Review proof history` supports both `My anchors` for the authenticated identity and `By chain` lookups for any `chainId`.
- `chainId` is explained in the UI and auto-suggested from known fixtures or the selected filename, but remains fully editable.
- Verification runs automatically after file selection when the app has both a contract ID and a connected SDK.
- A successful verify result can jump directly into the `By chain` history view with the matching `chainId` prefilled.

## Screens

### Create proof

- Drag in a file or click to select one.
- Compute its SHA-256 locally and review the full grouped hash before submission.
- Use the suggested `Group / Chain ID` or replace it with your own grouping label.
- Add an optional note.
- Submit an immutable proof document after login.

### Verify proof

- Drag in a file or click to select one.
- The browser computes the SHA-256 hash locally, then automatically checks Dash Platform for a matching proof.
- If a match exists, the app displays owner, `chainId`, timestamp, and stored metadata.
- The matched `chainId` links into History so you can open that chain timeline directly.

### Review proof history

- `My anchors` loads documents for the authenticated identity.
- `By chain` loads all proofs grouped under a specific `chainId`.

## Contract and Settings flow

- The app does not currently ship with a bundled deployed contract ID.
- On a fresh machine, browse-only reads need a contract ID pasted into Settings or a new contract registered after login.
- The login modal becomes a Settings modal after authentication.
- Settings can:
  - paste and reuse an existing contract ID
  - register a fresh proof contract on testnet
  - switch the app to that newly registered contract immediately

## Starter files

The repo includes three example files under [`public/example-files/`](./public/example-files/). The app exposes them through the `Starter files` button in the page header, which opens a modal with:

- downloadable fixture files
- known SHA-256 hashes
- suggested `chainId` values
- short notes for demo bootstrapping

These fixtures are also used in tests so the hash examples stay grounded in real repo files.

## Contract schema notes

- The contract schema in [`src/dash/contract.ts`](./src/dash/contract.ts) includes `"$createdAt"` in `required`, so newly anchored documents can display a Platform-created timestamp.
- The app stores `entryHash` as a base64-encoded SHA-256 digest string in the document, then normalizes it back to bytes and hex for queries and UI display.
- `byHash` is unique, so duplicate proofs for the same hash are rejected by design within a single deployed contract.

## Platform operations at a glance

Every SDK call lives in its own file under [`src/dash/`](./src/dash/).

| Operation | File | SDK method |
| --- | --- | --- |
| Connect to testnet | [`src/dash/client.ts`](./src/dash/client.ts) | `EvoSDK.testnetTrusted()` + `sdk.connect()` |
| Derive identity keys | [`src/dash/keyManager.ts`](./src/dash/keyManager.ts) | wallet/key derivation helpers |
| Register proof contract | [`src/dash/contract.ts`](./src/dash/contract.ts) | `sdk.contracts.publish` |
| Submit anchor | [`src/dash/createAnchor.ts`](./src/dash/createAnchor.ts) | `sdk.documents.create` |
| Query by hash | [`src/dash/queries.ts`](./src/dash/queries.ts) | `sdk.documents.query` |
| Query by owner | [`src/dash/queries.ts`](./src/dash/queries.ts) | `sdk.documents.query` |
| Query by chain | [`src/dash/queries.ts`](./src/dash/queries.ts) | `sdk.documents.query` |

## Reading the codebase

1. Start with [`src/dash/`](./src/dash/) for the raw Platform calls and contract schema.
2. Then read [`src/session/SessionContext.tsx`](./src/session/SessionContext.tsx) for browse-only and authenticated session state.
3. Then move to [`src/components/AnchorForm.tsx`](./src/components/AnchorForm.tsx), [`src/components/VerifyPanel.tsx`](./src/components/VerifyPanel.tsx), and [`src/components/HistoryPanel.tsx`](./src/components/HistoryPanel.tsx).
4. Hashing and chain-ID helpers live under [`src/lib/`](./src/lib/).

## Tech stack

- React 19
- TypeScript
- Vite 8
- Tailwind CSS v4
- Vitest + Testing Library
- `@dashevo/evo-sdk`
- sonner
