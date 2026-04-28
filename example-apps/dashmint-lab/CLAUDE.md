# DashMint Lab — Dash Platform NFTs (Modern React)

React + TypeScript + Vite app for minting, viewing, transferring, and trading NFT-style collectible cards on Dash Platform testnet. Ships with browse-only mode, DPNS-aware recipient input, a themed SVG card-art layer, and a deterministic starter pack.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck (`tsc -b`) then bundle
- `npm run lint` — ESLint
- `npm run test` — Vitest suite in [test/](test/)
- `npm run format` / `format:check` — Prettier
- `npm run preview` — serve production build locally

## Architecture

- **[src/dash/](src/dash/)** — one file per Platform SDK operation. Each exports an async function with a leading JSDoc block. No hooks, no wrappers — the SDK call is the function. Includes the `classifyRecipientInput` / `resolveRecipient` DPNS helpers.
- **Shared SDK core** — [src/dash/client.ts](src/dash/client.ts) and [src/dash/keyManager.ts](src/dash/keyManager.ts) re-export directly from `../../../../setupDashClient-core.mjs` (the canonical browser-safe core at the host repo root). No vendoring, no backport step. The `@dashevo/evo-sdk` bare specifier is aliased to the app's local copy via [vite.config.ts](vite.config.ts).
- **[src/session/](src/session/)** — `SessionContext.tsx` provides the context (SDK, keyManager, identityId, contractId, contractOwnerId, balance, activity log) and calls `sdk.identities.balance` inline; `useSession.ts` is the consumer hook. Mnemonic lives only in the keyManager closure — never in state, never in localStorage.
- **[src/components/](src/components/)** — standard React. Modals call `src/dash/` functions directly. Notable: [HowItWorks.tsx](src/components/HowItWorks.tsx) (static education tab), [CardArt.tsx](src/components/CardArt.tsx) (deterministic themed SVG), [OddsTable.tsx](src/components/OddsTable.tsx).
- **[src/hooks/](src/hooks/)** — `useDpnsName` (identityId → username) and `useResolvedRecipient` (name → identityId). Both use module-level caches so repeated renders don't re-query.
- **[src/data/starterPack.ts](src/data/starterPack.ts)** — shared card pool and `drawStarterPack()` Fisher-Yates shuffle. Injectable RNG for deterministic tests.
- **[src/lib/](src/lib/)** — pure utilities: [rarity.ts](src/lib/rarity.ts) (tier from atk+def), [format.ts](src/lib/format.ts), [explorer.ts](src/lib/explorer.ts) (Platform Explorer URLs), [cardArt.ts](src/lib/cardArt.ts) (theme/palette recipe — presentation only, not Platform-relevant).
- **[src/styles/globals.css](src/styles/globals.css)** — Tailwind v4 import + rarity tokens.
- **[test/](test/)** — Vitest + Testing Library. All test files live here per the `include` pattern in [vite.config.ts](vite.config.ts) and are named after the subject under test (e.g. `CardTile.test.tsx`, `SessionContext.test.tsx`). Default env is `node`; tests that need DOM opt in with `// @vitest-environment jsdom`.

## SDK Patterns

- **Minting**: `sdk.documents.create({ document, identityKey, signer })`
- **Transfer**: `sdk.documents.transfer({ document, recipientId, identityKey, signer })`
- **Set price**: `sdk.documents.setPrice({ document, price: BigInt, identityKey, signer })`
- **Purchase**: `sdk.documents.purchase({ document, buyerId, price: BigInt, identityKey, signer })`
- **Burn**: `sdk.documents.delete({ document: { id, ownerId, dataContractId, documentTypeName }, identityKey, signer })`
- **Query**: `sdk.documents.query({ dataContractId, documentTypeName, where?, limit })`
- **DPNS resolve**: `sdk.dpns.resolveName(fullName)` / `sdk.dpns.username(identityId)`
- **Balance**: `sdk.identities.balance(identityId)` → `bigint` (called directly from `SessionContext`)

All mutations except mint flow through [withAuthedCard.ts](src/dash/withAuthedCard.ts), which fetches the document, bumps its revision, and resolves the auth signer.

## Gotchas

- All document mutations (transfer, setPrice, purchase) require fetching the document first and incrementing `document.revision = BigInt(document.revision) + 1n`
- Transfer/trade operations use AUTHENTICATION keys, not TRANSFER purpose keys — the SDK rejects TRANSFER purpose for these state transitions
- Attack/defense are randomly generated (1–10) on mint; rarity is derived client-side in [rarity.ts](src/lib/rarity.ts) (common ≤10, rare 11–14, legendary ≥15) and is not persisted
- Browse-only mode sets `keyManager` to null — `withAuthedCard` guards this; check session status before any write operation
- `listMarketplaceCards` filters client-side for `$price` (no server-side trade-mode index available yet)
- DPNS names are normalized to lowercase + `.dash` suffix before resolving; `classifyRecipientInput` distinguishes identity IDs from names by character set, not length
- Contract ID stored in `localStorage['dashmint-lab.contractId']` (public, safe to persist); clearing falls back to `DEFAULT_CONTRACT_ID` in [contract.ts](src/dash/contract.ts) so browse-only mode always has something queryable
- The mint tab is gated to the contract owner — non-owners see an informative overlay
- The Evo SDK WASM bundle is ~8MB; this is expected and not a build error
- `allowJs: true` in tsconfig so TypeScript can import the JSDoc-typed `.mjs` core at the host repo root
- Deploys to GitHub Pages via `VITE_BASE_PATH`; the workflow lives at the repo root under `.github/workflows/`
- [src/lib/cardArt.ts](src/lib/cardArt.ts) and [src/components/CardArt.tsx](src/components/CardArt.tsx) are presentation-only — don't mistake them for contract or document logic
