# Implementation Tracker — `tutorial/nft-modern/`

Progress tracker for the modern NFT collectibles app. Design rationale and architecture live in [PLAN.md](./PLAN.md).

**At the start of every session:** read this file, find the first `[ ]` or `[~]`, continue from there. **As you finish steps:** flip `[ ]` → `[x]`. Use `[~]` for in-progress and `[!]` for blocked (add a note).

## Legend

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked — annotate with a note

---

## Phase 0 — Prep

- [x] 0.0 Create `tutorial/nft-modern/` directory and seed it with `PLAN.md` and `IMPLEMENTATION.md`
- [x] 0.1 Confirm funded testnet identity + mnemonic available for development
- [x] 0.2 Confirm a second funded testnet identity exists (needed for cross-profile transfer/purchase E2E)
- [x] 0.3 Record Node version + npm version used in `tutorial/nft-modern/README.md` once scaffolded (Node v20.19.5, npm 10.8.2 — note in README pending Phase 6.1)

## Phase 1 — Split `setupDashClient.mjs` (do this BEFORE touching the new app)

**Workflow change:** the canonical `setupDashClient.mjs` was copied into `src/dash/vendor/setupDashClient.mjs`. All edits happen here in this repo. The user will backport the resulting changes to `~/code/platform-tutorials/setupDashClient.mjs` (and the new `setupDashClient-core.mjs`) manually.

- [x] 1.0 Copy `setupDashClient.mjs` into `src/dash/vendor/` for in-place editing (backport to platform-tutorials by user)
- [x] 1.1 In `src/dash/vendor/`, split into `setupDashClient-core.mjs` (browser-safe: `IdentityKeyManager`, `AddressKeyManager`, `createClient`, `dip13KeyPath`, `KEY_SPECS`) and a thin Node wrapper `setupDashClient.mjs` that adds dotenv + clientConfig + the `setupDashClient()` convenience
- [x] 1.2 Replace `Buffer.from(hex, 'hex')` in `getKeysInCreation()` with a local `hexToBytes()` helper (browser-safe; no Buffer polyfill needed in Vite)
- [x] 1.3 (User) Backport `setupDashClient-core.mjs` + the rewritten wrapper to `~/code/platform-tutorials/`
- [x] 1.4 (User) Regression: run all existing Node tutorials under `platform-tutorials/` — confirm zero behavior change (all tests pass)
- [ ] 1.5 (User) Commit the split in `platform-tutorials/` as its own change so any rollback is clean

## Phase 2 — Scaffold the modern app

- [x] 2.1 `npm create vite@latest tutorial/nft-modern -- --template react-ts` (scaffolded into /tmp and rsync-merged to preserve existing PLAN.md, IMPLEMENTATION.md, src/dash/vendor/)
- [x] 2.2 Add deps: `@dashevo/evo-sdk`, `tailwindcss@4`, `@tailwindcss/vite` (installed)
- [x] 2.3 Wire Tailwind (vite.config.ts plugin + `src/styles/globals.css` `@import "tailwindcss"`)
- [x] 2.4 Verify `npm run dev` serves the Vite template (smoke-tested OK)
- [x] 2.5 Copy/symlink `setupDashClient-core.mjs` into `src/dash/vendor/` (already present from Phase 1)
- [x] 2.6 Smoke test: in `main.tsx`, `await createClient('testnet')` logs a connected SDK (build passes; visual confirm pending — open dev server, check console for `[smoke] EvoSDK connected to testnet`)

## Phase 3 — Port Platform code to `src/dash/`

- [x] 3.1 `src/dash/client.ts` — typed re-export of `createClient`
- [x] 3.2 `src/dash/keyManager.ts` — typed re-export of `IdentityKeyManager`
- [x] 3.3 `src/dash/contract.ts` — `CARD_SCHEMAS` (verbatim) + `ensureContract()` with localStorage persistence
- [x] 3.4 `src/dash/withAuthedCard.ts` — verbatim from [../nft/nft-collectibles.html:767](../nft/nft-collectibles.html#L767), with leading JSDoc
- [x] 3.5 `src/dash/mintCard.ts`
- [x] 3.6 `src/dash/transferCard.ts`
- [x] 3.7 `src/dash/setPrice.ts`
- [x] 3.8 `src/dash/purchaseCard.ts`
- [x] 3.9 `src/dash/burnCard.ts`
- [x] 3.10 `src/dash/queries.ts` — `listMyCards`, `listAllCards`, `listMarketplaceCards`
- [x] 3.11 Each file begins with a JSDoc block: what / why / SDK method

## Phase 4 — Session + auth

- [x] 4.1 `src/session/SessionContext.tsx` — `{ status, sdk, keyManager, identityId, contractId, setContractId, logEntries, log, clearLog, login, browseOnly, logout, error }`
- [x] 4.2 `src/session/useSession.ts`
- [x] 4.3 Mnemonic lives only in `keyManager` closure — audit confirmed: `login()` uses trimmed local var only, never writes to state/localStorage/ref; logout drops keyManager so the closure can be GC'd
- [x] 4.4 `contractId` persisted via `loadStoredContractId` / `saveContractId` in `src/dash/contract.ts` (key: `nft-modern.contractId`)

## Phase 5 — UI components

- [x] 5.1 `src/lib/rarity.ts` (pure function) + `src/lib/format.ts`
- [x] 5.2 `src/styles/globals.css` — port dark theme + rarity gradients from `../nft/nft-collectibles.css` (rarity CSS + conn-dot animation ported; most other styles live as Tailwind utilities in JSX)
- [x] 5.3 `CardTile.tsx` — rarity gradient, owner/buyer/browse-only action buttons
- [x] 5.4 `CardGrid.tsx`
- [x] 5.5 `Tabs.tsx` — top-level Collection / Mint (always visible) + sub-tabs My / All / Marketplace (hide "My" in browse-only)
- [x] 5.6 `LoginModal.tsx` — mnemonic + identity index + testnet-only banner + post-login contract-register button (auto-connect in browse-only handled in App.tsx)
- [x] 5.7 `MintForm.tsx` + `StarterPack.tsx` (Fire Dragon / Stone Golem / Shadow Fox sequential mint, matching original HTML)
- [x] 5.8 `TransferModal.tsx`
- [x] 5.9 `SetPriceModal.tsx`
- [x] 5.10 `PurchaseModal.tsx`
- [x] 5.11 `ActivityLog.tsx` — streaming op messages (mirrors existing HTML log panel)
- [x] 5.12 `App.tsx` ties it all together (current ~200 LOC — target was ~80 but the shared modal/refresh plumbing needed to live somewhere; can slim further in Phase 6 if needed)
- [x] 5.13 **Login overlay for write tabs**: Mint tab always visible; when not authenticated, a translucent login-overlay ("Login to access this feature" + Login CTA) covers the Mint panel. Matches the original HTML's `loginOverlay` pattern.
- [x] 5.14 **StarterPack component**: "Mint Starter Pack (3 cards)" card in the Mint panel, sequential mint of Fire Dragon / Stone Golem / Shadow Fox with random stats. Matches original HTML's `mintStarterPack()`.
- Bonus: added `Modal.tsx` primitive so all four modals share one backdrop/escape/stopPropagation implementation.

## Phase 6 — Educational polish

- [x] 6.1 `tutorial/nft-modern/README.md` with treasure-map table (Operation → File → SDK method)
- [x] 6.2 "Reading this codebase" section pointing at `src/dash/` first
- [x] 6.3 Every `src/dash/*.ts` file has a leading JSDoc block
- [ ] 6.4 Link back to `../README.md` and the from-scratch `../nft/nft-collectibles.html` as the progression (skipped for now)

## Phase 7 — E2E verification (see Verification plan in PLAN.md)

- [ ] 7.1 Two-profile testnet run: login, mint, set price, purchase across profiles, transfer across profiles, burn
- [ ] 7.2 Browse-only mode: no mnemonic prompt ever fires; Mint tab visible with login overlay covering its content
- [ ] 7.3 Revision-bump regression: mint → setPrice → setPrice succeeds
- [ ] 7.4 Rarity visual QA: common / rare / legendary render distinctly
- [ ] 7.5 Error paths: bad identity index, bad recipient ID, buy-while-logged-out surface cleanly
- [ ] 7.6 Framework-in-background check: `src/dash/mintCard.ts` reads cleanly to a Dash-naive React dev in <1 min
- [ ] 7.7 Post-split Node regression: all `platform-tutorials/*.mjs` still pass

---

## Session log

Append newest entry at top. Format: `YYYY-MM-DD — what landed / what's next / any blockers`.

- 2026-04-20 — Phase 6 (6.1–6.3) complete. Replaced Vite boilerplate README with educational README: treasure-map table mapping each operation to its file and SDK method, "Reading this codebase" guide pointing at `src/dash/` first, tech stack summary. Task 6.3 was already done (all `src/dash/*.ts` have JSDoc). Task 6.4 (tutorial progression links) skipped for now. Next: Phase 7 (E2E verification).
- 2026-04-16 — Phase 5 complete. Added `lib/rarity.ts` + `lib/format.ts`. Ported dark theme + rarity gradients into `styles/globals.css` (the `::before` gradient stripe + inset glow were easier as plain CSS than fighting Tailwind v4's pseudo-element support). Built `CardTile`, `CardGrid`, `Tabs`+`SubTabs`, and a shared `Modal` primitive. Four modals: `LoginModal` (mnemonic + contract register), `TransferModal`, `SetPriceModal` (with Remove-from-sale button), `PurchaseModal`. `MintForm` wires into `src/dash/mintCard`. `ActivityLog` reads from session. `App.tsx` is the single source of tab + modal orchestration — uses a `refreshNonce` + `useEffect` to re-query cards after mutations. Build: 42 modules, clean. Next: Phase 6 (README treasure map + docs polish).
- 2026-04-16 — Phase 4 complete. Added `SessionProvider` + `useSession()` managing `{ status, sdk, keyManager, identityId, contractId, logEntries, log, clearLog, login, browseOnly, logout }`. Mnemonic never enters state — trimmed in `login()` local scope, passed straight into `IdentityKeyManager.create()`, out of scope on return. `contractId` reuses Phase 3's localStorage helpers. Activity log is session-owned (array of `LogEntry`) and every `src/dash/*` op gets `session.log` as its `Logger`, so progress messages stream into the UI. Temporary `App.tsx` renders session fields + activity log for a visual smoke test until Phase 5.12. `tsc -b` + `vite build` pass. Next: Phase 5 (UI components — lib/, styles port, tiles, modals, tabs).
- 2026-04-16 — Phase 3 complete. Ported all Platform code into `src/dash/`: typed re-exports (`client.ts`, `keyManager.ts`), contract schema + `ensureContract()` (`contract.ts`), shared mutation prelude (`withAuthedCard.ts`), six operation files (`mintCard`, `transferCard`, `setPrice`, `purchaseCard`, `burnCard`, plus `queries.ts`) and a shared `logger.ts` so each op can stream progress to either the UI activity log or the console. Every file leads with a JSDoc block naming the SDK method it calls. Evo SDK does ship TS types; removed the speculative `@ts-expect-error` directives. `main.tsx` now imports from `./dash/client` instead of reaching into `vendor/`. `tsc -b` + `vite build` both clean. Next: Phase 4 (session context + auth).
- 2026-04-16 — Phase 2 complete. Wired Tailwind v4 plugin in `vite.config.ts`; replaced scaffold `index.css`/`App.css` with `src/styles/globals.css` (Tailwind import + dark base). Renamed package `nft-modern-scaffold` → `nft-modern`. Set `allowJs: true` so TS imports the JSDoc-typed `.mjs` vendor files. Replaced placeholder `App.tsx` with a Tailwind-styled landing card. Added EvoSDK smoke test in `main.tsx` (logs `[smoke] EvoSDK connected to testnet`). Removed unused scaffold assets (hero.png, react/vite logos, icons.svg). Updated `index.html` title. `tsc -b` clean; `vite build` passes (8MB JS chunk is the SDK WASM — expected). Next: Phase 3 (port Platform code to `src/dash/`).
- 2026-04-16 — Phase 2 scaffold landed (commit `0564cd0`). Vite + React + TS template scaffolded via /tmp + rsync to preserve existing files. Installed `@dashevo/evo-sdk`, `tailwindcss@4`, `@tailwindcss/vite`. Dev server smoke-tested (2.4). Phase 1 backport confirmed by user (1.3, 1.4 pass; 1.5 commit done by user).
- 2026-04-16 — Phase 1.1 + 1.2 done. Split `setupDashClient.mjs` in `src/dash/vendor/` into `setupDashClient-core.mjs` (browser-safe) + thin `setupDashClient.mjs` Node wrapper. Replaced `Buffer.from(hex, 'hex')` with local `hexToBytes()`. All original exports preserved; `KEY_SPECS` newly exported.
- 2026-04-16 — Seeded `PLAN.md` and `IMPLEMENTATION.md`. Confirmed Phase 0 prerequisites (0.1, 0.2). Copied `setupDashClient.mjs` into `src/dash/vendor/` (1.0).
