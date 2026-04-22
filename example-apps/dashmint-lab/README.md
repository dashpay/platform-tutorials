# DashMint Lab — NFT Collectibles (Modern React)

A React + TypeScript + Vite app demonstrating every Dash Platform NFT operation: mint, transfer, price, purchase, burn, and query.

## Prerequisites

- Node >= 20 (developed on v20.19.5, npm 10.8.2)
- A funded Dash Platform testnet identity (BIP-39 mnemonic + identity index)
- (Optional) A second funded identity for testing cross-profile transfer and purchase
- Browse-only mode works without any identity — visitors can explore the marketplace

## Quick start

```bash
npm install
npm run dev
```

Production build: `npm run build && npm run preview`

## Platform operations at a glance

Every SDK call lives in its own file under [`src/dash/`](src/dash/). Open the file to see the full implementation with a JSDoc header explaining what it does and why.

| Operation | File | SDK method |
| --- | --- | --- |
| Connect to testnet | [`src/dash/client.ts`](src/dash/client.ts) | `EvoSDK.testnetTrusted()` + `sdk.connect()` |
| Derive identity keys | [`src/dash/keyManager.ts`](src/dash/keyManager.ts) | `wallet.deriveKeyFromSeedWithPath` |
| Deploy card contract | [`src/dash/contract.ts`](src/dash/contract.ts) | `sdk.contracts.publish` |
| Mint a card | [`src/dash/mintCard.ts`](src/dash/mintCard.ts) | `sdk.documents.create` |
| Transfer a card | [`src/dash/transferCard.ts`](src/dash/transferCard.ts) | `sdk.documents.transfer` |
| Set / remove price | [`src/dash/setPrice.ts`](src/dash/setPrice.ts) | `sdk.documents.setPrice` |
| Purchase a card | [`src/dash/purchaseCard.ts`](src/dash/purchaseCard.ts) | `sdk.documents.purchase` |
| Burn (delete) a card | [`src/dash/burnCard.ts`](src/dash/burnCard.ts) | `sdk.documents.delete` |
| Query cards | [`src/dash/queries.ts`](src/dash/queries.ts) | `sdk.documents.query` |

Two supporting files:

- **[`src/dash/withAuthedCard.ts`](src/dash/withAuthedCard.ts)** — shared mutation prelude used by transfer, setPrice, purchase, and burn. Fetches the document, bumps its revision, and resolves the authentication signer.
- **[`src/dash/logger.ts`](src/dash/logger.ts)** — shared `Logger` type so every operation can stream progress messages to the UI activity log or console.

## Reading this codebase

Recommended order for understanding how the app works:

1. **[`src/dash/`](src/dash/)** — start here. One file per Platform operation, each with a JSDoc block explaining what / why / which SDK method. Read [`mintCard.ts`](src/dash/mintCard.ts) first (simplest create flow), then [`withAuthedCard.ts`](src/dash/withAuthedCard.ts) (shared pattern for mutations that need the current document).

2. **[`src/session/SessionContext.tsx`](src/session/SessionContext.tsx)** — manages the SDK connection, identity, contract ID, and activity log. The mnemonic never enters React state; it lives only inside the `keyManager` closure and is garbage-collected on logout.

3. **[`src/components/`](src/components/)** — standard React UI. [`CardTile.tsx`](src/components/CardTile.tsx) renders a single card with rarity gradient and action buttons. Modals wire directly to the `src/dash/` functions.

4. **[`src/lib/`](src/lib/)** — pure utilities. [`rarity.ts`](src/lib/rarity.ts) maps attack + defense to a rarity tier (common / rare / legendary). [`format.ts`](src/lib/format.ts) truncates IDs and formats credits.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- `@dashevo/evo-sdk`
