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

Anyone may publish metadata describing any contract, one entry per identity per contract. A contract's owner can **endorse** one publisher's entry — their own or a delegate's — and that entry is shown as **official**; every other entry is a **community proposal**. "Official" only means "named by whoever registered the contract". Registry entries are cross-referenced against the contract's declared metadata (the description and keywords baked into the contract itself) and the system Keyword Search contract.

Discovery covers recent entries, name-prefix search, category browsing, keyword search, every entry for a given contract, and a signed-in user's own submissions, each paged by the network. Signed-in testnet users can submit, edit, and withdraw their metadata.

Each app also carries community reviews: one 1–5 star rating per identity per contract, with an optional title and body; a contract's owner can't review it. An app's page shows the proven average, a per-star histogram from one grouped `count`, and reviews the network serves already ordered — newest first, highest or lowest rated, or one star value — a page at a time. Signed-in testnet users can add, edit, or remove their own review.

Discover lists the latest entries with an Official or Community badge and each app's average and review count, with an "Official only" switch (newest endorsements first) and a 4★+ filter (up to 100 contracts from one `having` query). A leaderboard ranks apps by average and by number of reviews; equal scores share a rank. A contract's owner sees which listing is official on its page and can mark any listed entry official, re-point, or withdraw the endorsement; after listing their own contract, the app offers the endorsement as a second step. My submissions also lists the contracts you've endorsed.

Registry entries carry a category, tags, tagline, app launch URL, and icon URL. External icon URLs are not rendered — displaying arbitrary remote images needs a same-origin sanitizing proxy that this app does not ship.

## Signing in

Sign-in accepts an existing testnet identity's recovery phrase (with an optional identity index) or a HIGH/CRITICAL authentication WIF private key. Secrets are passed straight to the key manager and are never written to browser storage, logs, or React state. Mainnet is read-only and has no sign-in.

## Contract

The registry schema lives in [`src/dash/contract.ts`](src/dash/contract.ts) and defines three mutable, deletable document types. Every `contractId` uses `refersTo`, so the network rejects a document pointing at a contract that doesn't exist, and is immutable, so a document can never be moved to another contract.

`appMetadata` describes one app: a target `contractId`, a required `name`, `tagline`, and `category` (a 16-value enum), plus an optional description, up to five kebab-case tags, and website, repository, docs, app, and icon URLs. A unique `$ownerId + contractId` index enforces one entry per identity per app, with separate indices for a contract's entries (plus a countable total), name-prefix search, the recent feed, category browsing, and each identity's entries.

`appEndorsement` is a contract owner's pointer to the official publisher. Its `contractId` reference requires the signer to own that contract, and its `publisherId` reference requires that publisher to have an `appMetadata` entry for the same contract. A unique `contractId` index allows one endorsement per contract; re-pointing replaces `publisherId`, and deleting it withdraws the endorsement. If the publisher later deletes their entry, the endorsement stays but points at nothing until the owner re-points or deletes it.

`appReview` holds one review: the target `contractId` (whose reference requires the reviewer _not_ to own it), a required integer `stars` (1–5), and an optional title and body. A unique `$ownerId + contractId` index enforces one review per identity per app. The averageable `contractId` index backs the proven average, batched averages for a page of apps, and the `ranked` and `having` queries; a countable `contractId + stars` index backs the histogram; `$updatedAt`-ordered indices back the review lists and each user's reviews.

Aggregate results need care: grouped `count` and `average` leave out groups with no documents (the app fills in zeros), and key each group by its raw index bytes in hex — a star value is a single byte, a contract ID its 32 bytes. The histogram must keep its `stars between [1,5]` range; grouping without one is refused.

Settings accepts a registry contract ID separately for each network, stored under `localStorage['dashapps.contractId.<network>']`. Testnet defaults to a published registry (`DkpxWsi5D9cP3RvNiF2uMDEhFF3cFCmsVhHXY5HNawkN`) so a fresh install can browse immediately; mainnet has no default. If the saved registry was published for an older version of the app and lacks one of the three document types, the app says so and offers to switch back to the default; if the check itself fails, it offers to try again.

## Platform operations at a glance

Every SDK call lives in its own file under [`src/dash/`](src/dash/). Open the file to see the full implementation.

| Operation                    | File                                                                                                                                     | SDK method                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Connect                      | [`src/session/SessionContext.tsx`](src/session/SessionContext.tsx), [`src/dash/sdkCore.ts`](src/dash/sdkCore.ts)                         | shared `createClient`                                       |
| Sign in                      | [`src/session/SessionContext.tsx`](src/session/SessionContext.tsx), [`src/dash/loginWithPrivateKey.ts`](src/dash/loginWithPrivateKey.ts) | `IdentityKeyManager.create` or WIF identity lookup          |
| Balance                      | [`src/session/SessionContext.tsx`](src/session/SessionContext.tsx)                                                                       | `identities.balance`                                        |
| Resolve contract owner       | [`src/dash/ownerResolver.ts`](src/dash/ownerResolver.ts)                                                                                 | `contracts.getMany`                                         |
| Contract facts               | [`src/dash/contractFacts.ts`](src/dash/contractFacts.ts)                                                                                 | getters, `toObject`                                         |
| Keywords / short description | [`src/dash/keywordSearch.ts`](src/dash/keywordSearch.ts)                                                                                 | `documents.query`                                           |
| DPNS attribution             | [`src/dash/resolveDpnsName.ts`](src/dash/resolveDpnsName.ts)                                                                             | `dpns.username`                                             |
| Registry selection           | [`src/dash/contractStore.ts`](src/dash/contractStore.ts)                                                                                 | browser storage only                                        |
| Register the registry        | [`src/dash/contract.ts`](src/dash/contract.ts)                                                                                           | `contracts.publish`                                         |
| Registry reads               | [`src/dash/registryReads.ts`](src/dash/registryReads.ts)                                                                                 | `documents.query`                                           |
| Official entries             | [`src/dash/endorsementReads.ts`](src/dash/endorsementReads.ts)                                                                           | `documents.query` (`in`)                                    |
| Endorse / withdraw           | [`src/dash/endorsementWrites.ts`](src/dash/endorsementWrites.ts)                                                                         | `documents.create`, `documents.replace`, `documents.delete` |
| Submit metadata              | [`src/dash/registryWrites.ts`](src/dash/registryWrites.ts)                                                                               | `documents.create`                                          |
| Edit metadata                | [`src/dash/registryWrites.ts`](src/dash/registryWrites.ts)                                                                               | `documents.get`, `documents.replace`                        |
| Withdraw metadata            | [`src/dash/registryWrites.ts`](src/dash/registryWrites.ts)                                                                               | `documents.get`, `documents.delete`                         |
| Rating summary / histogram   | [`src/dash/ratingReads.ts`](src/dash/ratingReads.ts)                                                                                     | `documents.average`, `documents.count` (grouped by `stars`) |
| Top rated / Most rated / 4★+ | [`src/dash/leaderboard.ts`](src/dash/leaderboard.ts)                                                                                     | `documents.ranked`, `documents.having`                      |
| List / filter ratings        | [`src/dash/ratingReads.ts`](src/dash/ratingReads.ts)                                                                                     | `documents.query`                                           |
| Rate or edit a rating        | [`src/dash/ratingWrites.ts`](src/dash/ratingWrites.ts)                                                                                   | `documents.create`, `documents.get`, `documents.replace`    |
| Remove a rating              | [`src/dash/ratingWrites.ts`](src/dash/ratingWrites.ts)                                                                                   | `documents.get`, `documents.delete`                         |

## Reading the codebase

- [`src/dash/`](src/dash/) — one file per SDK concern: reads, writes, the shared write path, identifier handling, and the two cached dynamic SDK imports
- [`src/session/`](src/session/) — network, connection, identity, and balance state behind generation guards
- [`src/components/`](src/components/) — presentational components; the view shells live in [`RegistryViews.tsx`](src/components/RegistryViews.tsx)
- [`src/lib/`](src/lib/) — pure utilities with no SDK references: formatting, logging, URL validation, document normalization

The `@dashevo/evo-sdk` browser bundle is roughly 8 MB, so it is never imported at the top level of anything reachable from `App.tsx` — it loads through a cached dynamic import instead, keeping it off the boot critical path.

## Tests

[`test/`](test/) uses Vitest + Testing Library, flat and named by subject. The default Vitest environment is Node; component tests opt into jsdom per file with `// @vitest-environment jsdom`. Unit and component tests use mocked SDK responses, covering errors and stale requests as well as success. Run with `npm run test`.

[`test/e2e/`](test/e2e/) holds a Playwright suite that runs against real testnet with no mocks, auto-starting Vite on port 5187, in a desktop and a mobile (Pixel 7) Chromium project. It is read-only: one spec per view clicks through its controls and fails on any console error, and a ratings spec checks invariants that hold for any live data (reviews newest first; the rating total equals the reviews listed; the star histogram sums to the review count; leaderboard counts match each app's own). The signed-in spec needs `PLATFORM_MNEMONIC`, from the environment or the repo-root `.env`, and only opens and cancels dialogs; without it, it is skipped. Tests skip while the registry lacks the data they need. Run with `npm run test:e2e`, or `npm run test:e2e:ui` for the interactive runner.

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
