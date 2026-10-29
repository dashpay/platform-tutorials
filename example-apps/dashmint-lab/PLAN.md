# Modernize the NFT Collectibles Tutorial App — Design & Plan

Historical design record for the `tutorial/nft-modern/` project. The day-to-day task checklist lives in [IMPLEMENTATION.md](./IMPLEMENTATION.md).

## Context

The existing [../nft/nft-collectibles.html](../nft/nft-collectibles.html) is a 1,069-line single-file app with inline ES modules. It works, but it has outgrown the "plain HTML, one file" convention the rest of the tutorial series (`01-connect.html` → `03-todo-app.html`) follows — it has 4 modals, sub-tabs, a rarity system, a `withAuthedCard` mutation helper, and browse-only mode. The more complex the app gets, the more a learner reading the source has to untangle app-logic from Platform-SDK-logic.

We want a version that looks and feels like a modern webapp to the **average web dev** who isn't crypto-aware, while keeping the Dash Platform SDK calls — not the framework — front and center. The framework's job is to disappear into the background so the Platform story reads clearly.

Goals:

- Show a real-framework reference that complements (not replaces) the from-scratch HTML next to it
- Reuse the shared `setupDashClient.mjs` verbatim where possible (currently Node-only due to `dotenv`/`process.env`)
- Keep the mnemonic in-browser, in-memory only — preserves the self-custody story the Platform exists to enable
- Make every Platform operation findable via a "treasure-map" README: _"Want to see how minting works? Open `src/dash/mintCard.ts`"_

## Recommendation (confirmed)

**Vite + React 18 + TypeScript + Tailwind CSS v4**, SPA only (no SSR). Lives at `tutorial/nft-modern/` alongside the existing HTML. `setupDashClient.mjs` gets split into a browser-safe core + Node wrapper so both the Node tutorials and the modern app import the same `IdentityKeyManager` with no copy-paste drift.

## Architecture

### Directory layout

```text
tutorial/nft-modern/
  index.html                    # Vite entry
  package.json
  vite.config.ts
  tsconfig.json
  README.md                     # treasure-map: op → file → SDK method
  PLAN.md                       # this file
  IMPLEMENTATION.md             # progress tracker
  src/
    main.tsx                    # ReactDOM.createRoot + <App/>
    App.tsx                     # tabs, modal mounts, <SessionProvider>
    dash/                       # <-- ALL Platform SDK calls live here
      client.ts                 # createClient(network) — re-exports from shared core
      keyManager.ts             # re-exports IdentityKeyManager
      contract.ts               # CARD_SCHEMAS + ensureContract()
      withAuthedCard.ts         # fetch-bump-revision wrapper (verbatim from HTML)
      mintCard.ts               # documents.create
      transferCard.ts           # documents.transfer
      setPrice.ts               # documents.setPrice
      purchaseCard.ts           # documents.purchase
      burnCard.ts               # documents.delete
      queries.ts                # listMyCards / listAllCards / listMarketplaceCards
    session/
      SessionContext.tsx        # { sdk, keyManager, identityId, contractId, status }
      useSession.ts
    components/
      LoginModal.tsx
      TransferModal.tsx
      SetPriceModal.tsx
      PurchaseModal.tsx
      MintForm.tsx
      CardGrid.tsx
      CardTile.tsx
      Tabs.tsx
      ActivityLog.tsx
    lib/
      rarity.ts                 # pure: attack+defense -> tier
      format.ts                 # id truncation, credits formatting
    styles/
      globals.css               # Tailwind + rarity gradient classes
```

### Where SDK calls live

**One file per Platform operation under `src/dash/`.** Each exports a single async function (`mintCard`, `transferCard`, etc.) that takes `{ sdk, keyManager, contractId, ... }` and returns the result. Components import and call these directly — no wrapping hooks, no service classes. A learner opens `src/dash/mintCard.ts` and sees the exact SDK call, unwrapped, with a block comment explaining what it does and linking to docs.

### State / auth flow

- Single `SessionContext` holds `{ status, sdk, keyManager, identityId, contractId }`.
- `LoginModal` collects mnemonic + identity index → calls `createClient()` + `IdentityKeyManager.create()` → dispatches into context.
- Mnemonic lives **only** inside the `keyManager` closure in React state. Never localStorage, never window, never a ref.
- `contractId` IS persisted to localStorage — it's public.
- No Redux/Zustand/TanStack Query. Plain `useState` + `useEffect` + a refresh nonce for re-fetch after mutations.

### How the framework stays in the background

- No `react-router` — tabs are `useState<'collection'|'mint'>` with conditional render. `App.tsx` fits on one screen.
- **Mint tab is always visible**, even in browse-only mode. When not authenticated, a translucent login-overlay ("Login to access this feature" + Login button) covers the Mint panel content. This matches the original HTML tutorial's UX and lets visitors see what minting looks like before committing to login.
- No RSCs, no server actions, no loaders. The SDK works in the browser; keep it there.
- No shadcn/ui, no Radix, no component library — plain Tailwind classes.
- No custom `useQuery`/`useMutation` abstractions. `useEffect(() => { listMyCards(...).then(setCards) }, [deps])` is fine and legible.
- Every `src/dash/*.ts` file is readable with zero React knowledge. The React code is layout-only.

## setupDashClient strategy

Split `~/code/platform-tutorials/setupDashClient.mjs` into two files:

1. **`setupDashClient-core.mjs`** — browser-safe. Exports `IdentityKeyManager`, `AddressKeyManager`, `createClient`, `dip13KeyPath`, `KEY_SPECS`. Zero references to `process.env`, `dotenv`, or `clientConfig`. Replace the one `Buffer.from(hex, 'hex')` call inside `getKeysInCreation()` with a local `hexToBytes()` helper so no Buffer polyfill is needed in Vite.
2. **`setupDashClient.mjs`** — rewritten as a thin re-exporter + the `setupDashClient()` convenience wrapper that keeps dotenv loading + the `clientConfig` object for Node tutorials. All existing import paths in Node tutorials continue to work byte-compatibly.

The modern app imports from the core via a local path/alias (simplest: a file-copy or a symlink under `tutorial/nft-modern/src/dash/vendor/`). The goal is that the inline `IdentityKeyManager` class in the existing HTML (lines 196–289) becomes a single `import { IdentityKeyManager } from './vendor/setupDashClient-core.mjs'` in the modern app.

## Critical files to reference

- [../nft/nft-collectibles.html](../nft/nft-collectibles.html) — source of truth for schema, withAuthedCard, rarity thresholds, all operation logic
- [../nft/nft-collectibles.css](../nft/nft-collectibles.css) — dark theme palette + rarity gradients (port to `globals.css`)
- [../nft/CLAUDE.md](../nft/CLAUDE.md) — documented gotchas (transfer uses auth key not transfer key; must bump revision; etc.)
- [../README.md](../README.md) — establishes the tutorial narrative arc the new app should fit into
- `~/code/platform-tutorials/setupDashClient.mjs` — source to split
- `~/code/platform-tutorials/CLAUDE.md` — documents DIP-13 paths and Node tutorial conventions

## Implementation sequence (high-level)

Day-to-day task list with checkboxes is in [IMPLEMENTATION.md](./IMPLEMENTATION.md). Summary:

1. **Scaffold** — Vite React-TS template, add Tailwind v4, `@dashevo/evo-sdk`.
2. **Split `setupDashClient.mjs`** — core + wrapper. Regress Node tutorials before touching the new app.
3. **Wire core into modern app** — copy/symlink into `src/dash/vendor/`. Smoke test.
4. **Port `CARD_SCHEMAS` + `ensureContract`** — verbatim from the HTML. Persist to localStorage.
5. **Port `withAuthedCard`** — verbatim from [../nft/nft-collectibles.html:767](../nft/nft-collectibles.html#L767). Keep named + commented.
6. **Port the six operation files + queries** — each with leading JSDoc.
7. **Session context + LoginModal** — in-memory mnemonic only, testnet-only banner.
8. **CardGrid + CardTile** — presentational; rarity gradient from `lib/rarity.ts`.
9. **Mint form + Starter Pack + 3 operation modals** — MintForm (single-card mint), StarterPack (Fire Dragon / Stone Golem / Shadow Fox, sequential 3-card mint matching the original HTML), Transfer, SetPrice, Purchase.
10. **Tabs + sub-tabs** — plain `useState`.
11. **Activity log** — preserved for educational streaming.
12. **Theme port** — dark colors + rarity gradients into `globals.css`.
13. **README (the treasure map)** — operation → file → SDK method table.
14. **E2E verification** — run full matrix in IMPLEMENTATION.md.

## Educational affordances

- **One op per file in `src/dash/`.** No service objects, no hook-soup. The SDK call is visible, unwrapped, at the top of each file.
- **Treasure-map README** — the single most important deliverable. `Mint | src/dash/mintCard.ts | sdk.documents.create`.
- **Every `src/dash/*.ts` leads with a JSDoc block** explaining what / why / which SDK method.
- **Plain React only.** No custom hooks that hide SDK calls. A learner who knows React but not Dash Platform shouldn't have to chase abstractions.
- **Activity log preserved.** Seeing "Minting…" → "Card minted!" messages stream in teaches the mental model of async Platform ops.
- **Browse-only mode preserved** — a learner without testnet Dash can explore the marketplace and read code. Write-capable tabs (Mint) are always visible but covered by a translucent login-overlay prompting login, matching the original HTML tutorial's pattern.
- **`withAuthedCard` kept as a named, commented helper.** Don't inline it, don't abstract it further. It's the one non-obvious pattern and deserves its own teachable file.

## Tradeoffs (why not X)

- **Next.js / SvelteKit / Remix**: push SDK toward server; mnemonic leaves browser or splits awkwardly; destroys self-custody story.
- **Plain Vite + vanilla JS**: tempting for minimalism, but the modal/tab/state complexity starts demanding hand-rolled reactivity, which is more distracting than `useState`.
- **shadcn/ui + Radix**: adds CLI ritual and a large dep tree that muddies the "here's the Dash code" story.
- **TanStack Query**: cleans up refetch logic but teaches the learner nothing about Dash Platform; `useEffect` + refresh nonce is ~10 lines.
- **Zustand / Redux**: overkill for three fields of session state.
- **Encrypted localStorage for "stay logged in"**: more realistic UX but introduces crypto-UX code that competes with the Platform story. Testnet-only in-memory matches the existing convention.

## Verification plan

Manual E2E on testnet with **two browser profiles** (to test cross-identity transfer + purchase):

1. `npm run dev` → Profile A logs in with funded testnet mnemonic → identity resolves.
2. First run creates data contract via `ensureContract`; verify `contractId` persists in localStorage and reload resolves instantly.
3. Mint a card; rarity tier matches `lib/rarity.ts` output for its stats.
4. Switch My / All / Marketplace sub-tabs; priced vs. unpriced filtering correct.
5. Open SetPrice modal → set 10000 credits → card appears in Marketplace.
6. Profile B logs in with a different funded mnemonic + same `contractId`; purchases the card from Marketplace. Verify ownership flipped in both profiles' My tabs.
7. Profile B transfers a card to Profile A's identity ID; Profile A sees it after refresh.
8. Profile A burns a card; disappears from My + All.
9. Logout → "Browse only" → All + Marketplace render; Mint tab visible with login overlay covering its content; action buttons hidden on cards.
10. Error paths: invalid identity index → LoginModal surfaces error; transfer to invalid ID → SDK error surfaces in activity log.
11. Revision-bump regression: mint → setPrice → setPrice again. Both succeed without "revision out of date" errors (tests `withAuthedCard`'s fetch-before-mutate).
12. Rarity visual QA: mint low (common), mid (rare), high-stat (legendary) cards; confirm three distinct gradients.
13. **Framework-in-background check**: open `src/dash/mintCard.ts` cold. Can a web dev with zero Dash Platform knowledge understand it in one minute? If not, revise comments.
14. Run existing Node tutorials (`~/code/platform-tutorials/*.mjs`) after the setupDashClient split to confirm no Node regression.
