# DashMint Lab — Dash Platform NFTs (Modern React)

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

Other scripts:

```bash
npm run test          # Vitest suite
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
```

## Known constraints

- The app is built for Dash Platform testnet, not mainnet.
- Write operations require a funded Platform identity; browse-only mode works without login.
- Trading flows are easiest to test with a second funded identity.
- The active contract ID can be swapped or a new one can be registered from Settings.
- Minting is restricted to the contract owner by the schema (`creationRestrictionMode: 1`); non-owners see an overlay on the Mint tab.
- The browser bundle is intentionally heavy because it includes the full `@dashevo/evo-sdk` (~8MB WASM).

## Platform operations at a glance

Every SDK call lives in its own file under [`src/dash/`](src/dash/). Open the file to see the full implementation with a JSDoc header explaining what it does and why.

| Operation            | File                                                           | SDK method                                  |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------- |
| Connect to testnet   | [`src/dash/client.ts`](src/dash/client.ts)                     | `EvoSDK.testnetTrusted()` + `sdk.connect()` |
| Derive identity keys | [`src/dash/keyManager.ts`](src/dash/keyManager.ts)             | `wallet.deriveKeyFromSeedWithPath`          |
| Deploy card contract | [`src/dash/contract.ts`](src/dash/contract.ts)                 | `sdk.contracts.publish`                     |
| Mint a card          | [`src/dash/mintCard.ts`](src/dash/mintCard.ts)                 | `sdk.documents.create`                      |
| Transfer a card      | [`src/dash/transferCard.ts`](src/dash/transferCard.ts)         | `sdk.documents.transfer`                    |
| Set / remove price   | [`src/dash/setPrice.ts`](src/dash/setPrice.ts)                 | `sdk.documents.setPrice`                    |
| Purchase a card      | [`src/dash/purchaseCard.ts`](src/dash/purchaseCard.ts)         | `sdk.documents.purchase`                    |
| Burn (delete) a card | [`src/dash/burnCard.ts`](src/dash/burnCard.ts)                 | `sdk.documents.delete`                      |
| Query cards          | [`src/dash/queries.ts`](src/dash/queries.ts)                   | `sdk.documents.query`                       |
| Resolve DPNS name    | [`src/dash/resolveRecipient.ts`](src/dash/resolveRecipient.ts) | `sdk.dpns.resolveName`                      |

Balance is fetched inline from `SessionContext` via `sdk.identities.balance(identityId)` — it's a one-liner, so there's no dedicated `src/dash/` file for it.

Supporting files:

- **[`src/dash/withAuthedCard.ts`](src/dash/withAuthedCard.ts)** — shared mutation prelude used by transfer, setPrice, purchase, and burn. Fetches the document, bumps its revision, and resolves the authentication signer.
- **[`src/dash/classifyRecipientInput.ts`](src/dash/classifyRecipientInput.ts)** — decides whether a recipient string looks like a DPNS name or an identity ID by character set.
- **[`src/dash/logger.ts`](src/dash/logger.ts)** — shared `Logger` type so every operation can stream progress messages to the UI.

## Reading this codebase

Recommended order for understanding how the app works:

1. **[`src/dash/`](src/dash/)** — start here. One file per Platform operation, each with a JSDoc block explaining what / why / which SDK method. Read [`mintCard.ts`](src/dash/mintCard.ts) first (simplest create flow), then [`withAuthedCard.ts`](src/dash/withAuthedCard.ts) (shared pattern for mutations that need the current document).

2. **[`src/session/SessionContext.tsx`](src/session/SessionContext.tsx)** — manages the SDK connection, identity, contract ID, contract-owner ID, credit balance, and activity log. The mnemonic never enters React state; it lives only inside the `keyManager` closure and is garbage-collected on logout. The consumer hook lives in [`useSession.ts`](src/session/useSession.ts).

3. **[`src/components/`](src/components/)** — standard React UI. [`CardTile.tsx`](src/components/CardTile.tsx) renders a single card with rarity rail, owner chip, and action buttons. Modals wire directly to the `src/dash/` functions. [`HowItWorks.tsx`](src/components/HowItWorks.tsx) is the in-app education tab.

4. **[`src/hooks/`](src/hooks/)** — [`useDpnsName`](src/hooks/useDpnsName.ts) resolves an identity ID to a DPNS username for display; [`useResolvedRecipient`](src/hooks/useResolvedRecipient.ts) does the reverse for the transfer modal. Both cache across component mounts so lists of cards don't re-query.

5. **[`src/data/starterPack.ts`](src/data/starterPack.ts)** — the shared card pool and `drawStarterPack()` helper behind the "Mint Starter Pack" button.

6. **[`src/lib/`](src/lib/)** — pure utilities. [`rarity.ts`](src/lib/rarity.ts) maps attack + defense to a rarity tier (common / rare / legendary). [`format.ts`](src/lib/format.ts) truncates IDs and formats credits. [`explorer.ts`](src/lib/explorer.ts) builds Platform Explorer URLs. [`cardArt.ts`](src/lib/cardArt.ts) derives a deterministic theme, palette, and composition from each card's name/description/stats — it's presentation-only and has nothing to do with the on-chain schema.

## Tests

[`test/`](test/) uses Vitest + Testing Library, co-located by subject. The default Vitest environment is Node; component tests opt into jsdom per-file with `// @vitest-environment jsdom`. Run with `npm run test`.

## Deploying to GitHub Pages

The project ships with a fork-friendly deploy workflow at the repo root. Pushing the deploy branch triggers a Vite build with `VITE_BASE_PATH` set to the repo name so links resolve under `/<repo>/`. For local previews of that build, run:

```bash
VITE_BASE_PATH=/dashmint-lab/ npm run build && npm run preview
```

## Tech stack

- React 19
- TypeScript
- Vite 8
- Tailwind CSS v4
- Vitest 4 + Testing Library
- `@dashevo/evo-sdk`
- sonner (toasts)
