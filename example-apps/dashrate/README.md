# DashRate

DashRate is a React + TypeScript + Vite example app for rating Platform tutorial resources on Dash
Platform testnet.

It is intentionally small and centered on Platform's aggregate and relational document queries
(protocol version 14):

- `sdk.documents.average` for each resource's proven review count, rating sum and average
- `sdk.documents.count` with `groupBy: ["rating"]` for the per-star rating distribution
- `sdk.documents.ranked` for the "Top rated" (by average) and "Most reviewed" (by count) leaderboards
- `sdk.documents.having` for the "4★+ average" filter
- `sdk.documents.query` with `orderBy: [["$updatedAt", "desc"]]` + `startAfter` for newest-first,
  server-paged reviews, optionally filtered with `where rating == N`
- `sdk.documents.history` for review edit history

Users sign in with a mnemonic only. After signing in, they can register a local testnet contract,
paste an existing DashRate contract ID, create one review per resource, edit that review, and
inspect its document history. Read-only browsing (resources, aggregates, reviews) works without
signing in.

## Quick start

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build
npm run test
npm run test:coverage
npm run lint
npm run preview
```

## Contract

The app defines one mutable document type, `review`, in
[`src/dash/contract.ts`](./src/dash/contract.ts). Each identity can review a resource once, enforced
by the unique `$ownerId + resourceId` index. Saving a review creates the document on first use and
replaces the same document on later edits, with document history retained by `documentsKeepHistory`.

The read paths are intentionally index-shaped:

- `resourceRating` on `resourceId` is `averageable: "rating"` (a provable count and sum per resource)
  and carries two ranking axes (`rankedAverageable`, `rankedCountable`) that back `ranked` and
  `having` across resources
- `resourceRatingDistribution` on `resourceId + rating` (`countable` plus `rangeCountable`) backs the
  grouped rating distribution
- `resourceRecent` (`resourceId + $updatedAt`) and `resourceRatingRecent`
  (`resourceId + rating + $updatedAt`) page a resource's reviews newest first, with or without a star
  filter
- `ownerReviews` (`$ownerId + $updatedAt`) lists My reviews newest first
- `ownerAndResource` (unique) finds an identity's existing review, so saving again edits it

The ranked keywords require a protocol version 14 network, and an indexed `resourceId` on a ranked
index is capped at 59 characters.

`DEFAULT_CONTRACT_ID` is set to a published testnet DashRate contract
(`EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz`), so fresh installs can read aggregates and reviews
immediately. The active ID is stored under `localStorage['dashrate.contractId']`; clearing it falls
back to this default. Register your own contract from the Settings tab to override it.

A single-file, read-only companion lives at [`public/dashrate-lite.html`](./public/dashrate-lite.html):
the same average, distribution, newest-first reviews and a "Top rated" ranking, with no build step.
