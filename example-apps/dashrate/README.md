# DashRate

DashRate is a React + TypeScript + Vite example app for rating Platform tutorial resources on Dash
Platform testnet.

It is intentionally small and centered on Platform v4's relational document queries:

- `sdk.documents.query` for resource reviews, identity reviews, and existing-review lookup
- `sdk.documents.count` for the total review count per resource (a plain countable index)
- `sdk.documents.count` with `groupBy: ["rating"]` for the per-star rating distribution — the
  count/sum/average shown per resource is derived in JS from this one grouped count, not a separate
  `sum`/`average` query
- a `where rating == N` clause for filtering reviews by star rating
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

- resource detail and recent reviews query by `resourceId`
- My reviews queries by `$ownerId` and sorts by `$updatedAt`
- edit detection queries by `$ownerId + resourceId`
- the total review count uses the standalone `resourceId` index (`countable: "countable"`)
- the rating distribution and the `rating == N` filter use the compound `resourceId + rating` index
  (`countable: "countable"` plus `rangeCountable: true`)

Neither aggregate index uses `summable`: the count/sum/average shown per resource is computed in JS
from the grouped distribution count, so a single grouped `count` query backs both the histogram and
the average.

`DEFAULT_CONTRACT_ID` is set to a published testnet DashRate contract
(`BdgTqaTAPYMyhp1WdeWdcvYSgoD7AuJ7tVCaCSXyQgyP`), so fresh installs can read aggregates and reviews
immediately. The active ID is stored under `localStorage['dashrate.contractId']`; clearing it falls
back to this default. Register your own contract from the Settings tab to override it.
