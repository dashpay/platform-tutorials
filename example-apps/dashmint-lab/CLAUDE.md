# DashMint Lab — NFT Collectibles (Modern React)

React + TypeScript + Vite app for minting, viewing, transferring, and trading NFT-style collectible cards on Dash Platform testnet.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run preview` — serve production build locally

## Architecture

- **`src/dash/`** — one file per Platform SDK operation. Each exports a single async function with a leading JSDoc block. No hooks, no wrappers — the SDK call is the function.
- **`src/dash/vendor/`** — browser-safe `setupDashClient-core.mjs` shared with the Node tutorials. Do not edit here without backporting to `~/code/platform-tutorials/`.
- **`src/session/SessionContext.tsx`** — single React context: SDK instance, keyManager, identityId, contractId, auth status, activity log. Mnemonic lives only in the keyManager closure — never in state, never in localStorage.
- **`src/components/`** — standard React. Modals call `src/dash/` functions directly.
- **`src/lib/`** — pure utilities (rarity tiers, ID formatting).
- **`src/styles/globals.css`** — Tailwind v4 import + rarity gradient CSS.

## SDK Patterns

- **Minting**: `sdk.documents.create({ document, identityKey, signer })`
- **Transfer**: `sdk.documents.transfer({ document, recipientId, identityKey, signer })`
- **Set price**: `sdk.documents.setPrice({ document, price: BigInt, identityKey, signer })`
- **Purchase**: `sdk.documents.purchase({ document, buyerId, price: BigInt, identityKey, signer })`
- **Burn**: `sdk.documents.delete({ document: { id, ownerId, dataContractId, documentTypeName }, identityKey, signer })`
- **Query**: `sdk.documents.query({ dataContractId, documentTypeName, where?, limit })`

All mutations except mint flow through `withAuthedCard.ts` which fetches the document, bumps its revision, and resolves the auth signer.

## Gotchas

- All document mutations (transfer, setPrice, purchase) require fetching the document first and incrementing `document.revision = BigInt(document.revision) + 1n`
- Transfer/trade operations use AUTHENTICATION keys, not TRANSFER purpose keys — the SDK rejects TRANSFER purpose for these state transitions
- Attack/defense are randomly generated (1–10) on mint; rarity is derived client-side from their sum (common <11, rare 11–14, legendary >=15) and is not persisted
- Browse-only mode sets `keyManager` to null — `withAuthedCard` guards this; check session status before any write operation
- Contract ID stored in `localStorage` key `nft-modern.contractId` (public, safe to persist)
- The mint tab is gated to the contract owner — non-owners see an informative overlay
- The Evo SDK WASM bundle is ~8MB; this is expected and not a build error
- `allowJs: true` in tsconfig so TypeScript can import the JSDoc-typed `.mjs` vendor files
