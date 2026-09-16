# Dashapps — Dash Platform App Registry

A React + TypeScript + Vite app for discovering Dash Platform applications and inspecting their contract-declared metadata, backed by a community registry contract with per-app star ratings.

## Prerequisites

- Node 22.22+ (the repository's tested toolchain — run `nvm use` at the repo root)
- A funded Dash Platform testnet identity, to submit metadata or leave a rating
- Browsing works without an identity: discovery, search, contract facts, and rating histograms are all read-only

## Quick start

```bash
npm install
npm run dev
```

The dev server runs on port 5187. Other scripts:

```bash
npm run build         # tsc -b, then a production bundle
npm run test          # Vitest suite
npm run test:coverage # Vitest under v8 coverage
npm run test:e2e      # Playwright suite
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm run preview       # serve the production build
```

## Current app behavior

Anyone may publish metadata describing any contract, so the app distinguishes two kinds of entry. An entry whose owner matches the target contract's own owner is shown as **canonical**; entries from anyone else are **community proposals**, one per identity per contract. Registry entries are cross-referenced against the contract's declared metadata (the description and keywords baked into the contract itself) and the system Keyword Search contract.

Discovery covers recent entries, name-prefix search, category browsing, keyword search, every proposal for a given contract, and a signed-in user's own submissions. Signed-in testnet users can submit, edit, and withdraw their metadata.

Each app also carries community ratings: one 1–5 star rating per identity per contract, with an optional title and review body. An app's page shows the average, a per-star histogram built from a single grouped provable `count`, and sortable, filterable reviews. Signed-in testnet users can add, edit, or remove their own rating.

Registry entries carry a category, tags, tagline, app launch URL, and icon URL. External icon URLs are not rendered — displaying arbitrary remote images needs a same-origin sanitizing proxy that this app does not ship.

## Signing in

Sign-in accepts an existing testnet identity's recovery phrase (with an optional identity index) or a HIGH/CRITICAL authentication WIF private key. Secrets are passed straight to the key manager and are never written to browser storage, logs, or React state. Mainnet is read-only and has no sign-in.

## Contract

The registry schema lives in [`src/dash/contract.ts`](src/dash/contract.ts) and defines two mutable document types.

`appMetadata` describes one app: a target `contractId`, a required `name`, `tagline`, and `category` (a 16-value enum), plus an optional description, up to five kebab-case tags, and website, repository, docs, app, and icon URLs. Its indices back the read paths directly — a unique `$ownerId + contractId` index enforces one entry per identity per app, with separate indices for a contract's entries, name-prefix search, the recent feed, and category browsing.

`appRating` holds one rating: the target `contractId`, a required integer `stars` (1–5), and an optional title and body. A unique `$ownerId + contractId` index enforces one rating per identity per app. The `contractId + stars` index is `countable` plus `rangeCountable`, which backs the histogram, the total, the `stars == N` filter, and star ordering; a `contractId + $createdAt` index backs recency.

Neither rating index is `summable` — the average is derived in JS from the grouped distribution count rather than from a separate `sum`/`average` query.

Settings accepts a registry contract ID separately for each network, stored under `localStorage['dashapps.contractId.<network>']`. Testnet defaults to a published registry (`BXcWyLZDtcPrEmd8tmPt6A7h4YuqgPGVJU1PBvs1dYiS`) so a fresh install can browse immediately; mainnet has no default.

## Platform operations at a glance

Every SDK call lives in its own file under [`src/dash/`](src/dash/). Open the file to see the full implementation.

| Operation                    | File                                                                                                                                     | SDK method                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Connect                      | [`src/session/SessionContext.tsx`](src/session/SessionContext.tsx), [`src/dash/sdkCore.ts`](src/dash/sdkCore.ts)                         | shared `createClient`                                    |
| Sign in                      | [`src/session/SessionContext.tsx`](src/session/SessionContext.tsx), [`src/dash/loginWithPrivateKey.ts`](src/dash/loginWithPrivateKey.ts) | `IdentityKeyManager.create` or WIF identity lookup       |
| Balance                      | [`src/session/SessionContext.tsx`](src/session/SessionContext.tsx)                                                                       | `identities.balance`                                     |
| Resolve contract owner       | [`src/dash/ownerResolver.ts`](src/dash/ownerResolver.ts)                                                                                 | `contracts.getMany`                                      |
| Contract facts               | [`src/dash/contractFacts.ts`](src/dash/contractFacts.ts)                                                                                 | getters, `toObject`                                      |
| Keywords / short description | [`src/dash/keywordSearch.ts`](src/dash/keywordSearch.ts)                                                                                 | `documents.query`                                        |
| DPNS attribution             | [`src/dash/resolveDpnsName.ts`](src/dash/resolveDpnsName.ts)                                                                             | `dpns.username`                                          |
| Registry selection           | [`src/dash/contractStore.ts`](src/dash/contractStore.ts)                                                                                 | browser storage only                                     |
| Register the registry        | [`src/dash/contract.ts`](src/dash/contract.ts)                                                                                           | `contracts.publish`                                      |
| Registry reads               | [`src/dash/registryReads.ts`](src/dash/registryReads.ts)                                                                                 | `documents.query`                                        |
| Submit metadata              | [`src/dash/registryWrites.ts`](src/dash/registryWrites.ts)                                                                               | `documents.create`                                       |
| Edit metadata                | [`src/dash/registryWrites.ts`](src/dash/registryWrites.ts)                                                                               | `documents.get`, `documents.replace`                     |
| Withdraw metadata            | [`src/dash/registryWrites.ts`](src/dash/registryWrites.ts)                                                                               | `documents.get`, `documents.delete`                      |
| Rating summary / histogram   | [`src/dash/ratingReads.ts`](src/dash/ratingReads.ts)                                                                                     | `documents.count` (grouped by `stars`)                   |
| List / filter ratings        | [`src/dash/ratingReads.ts`](src/dash/ratingReads.ts)                                                                                     | `documents.query`                                        |
| Rate or edit a rating        | [`src/dash/ratingWrites.ts`](src/dash/ratingWrites.ts)                                                                                   | `documents.create`, `documents.get`, `documents.replace` |
| Remove a rating              | [`src/dash/ratingWrites.ts`](src/dash/ratingWrites.ts)                                                                                   | `documents.get`, `documents.delete`                      |

## Reading the codebase

- [`src/dash/`](src/dash/) — one file per SDK concern: reads, writes, the shared write path, identifier handling, and the two cached dynamic SDK imports
- [`src/session/`](src/session/) — network, connection, identity, and balance state behind generation guards
- [`src/components/`](src/components/) — presentational components; the view shells live in [`RegistryViews.tsx`](src/components/RegistryViews.tsx)
- [`src/lib/`](src/lib/) — pure utilities with no SDK references: formatting, logging, URL validation, document normalization

The `@dashevo/evo-sdk` browser bundle is roughly 8 MB, so it is never imported at the top level of anything reachable from `App.tsx` — it loads through a cached dynamic import instead, keeping it off the boot critical path.

## Tests

[`test/`](test/) uses Vitest + Testing Library, flat and named by subject. The default Vitest environment is Node; component tests opt into jsdom per file with `// @vitest-environment jsdom`. Unit and component tests use mocked SDK responses, covering errors and stale requests as well as success. Run with `npm run test`.

[`test/e2e/`](test/e2e/) holds a Playwright suite that runs against real testnet with no mocks, auto-starting Vite on port 5187. The specs are read-only shell smoke tests — they assert rendering, not live registry data. Run with `npm run test:e2e`, or `npm run test:e2e:ui` for the interactive runner.

## Deploying to GitHub Pages

The repo-root deploy workflow discovers each app under `example-apps/` and builds it with `VITE_BASE_PATH` set so links resolve under `/<repo>/dashapps/`. To preview that build locally:

```bash
VITE_BASE_PATH=/platform-tutorials/dashapps/ npm run build && npm run preview
```

## Tech stack

- React 19
- TypeScript
- Vite 8
- Vitest 4 + Testing Library
- Playwright
- `@dashevo/evo-sdk`
