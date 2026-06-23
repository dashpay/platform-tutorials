# DashRate

DashRate is a React + TypeScript + Vite example app for rating Platform tutorial resources on Dash
Platform testnet.

It is intentionally small and centered on Platform v4 document features:

- `sdk.documents.query` for resource reviews, identity reviews, and existing review lookup
- `sdk.documents.count` for review count
- `sdk.documents.sum` for total rating points
- `sdk.documents.average` for average rating
- `sdk.documents.history` for review edit history

Users sign in with a mnemonic only. After signing in, they can register a local testnet contract,
paste an existing DashRate contract ID, create one review per resource, edit that review, and
inspect its document history.

## Quick start

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build
npm run test
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
- aggregate count/sum/average queries use the standalone `resourceId` index with `countable:
  "countable"` and `summable: "rating"`

`DEFAULT_CONTRACT_ID` is set to a published testnet DashRate contract
(`BxkwU2skmYz8a6ixj1FwBCf6v8t5WsNxB4LN4EYcDuET`), so fresh installs can read aggregates and reviews
immediately. The active ID is stored under `localStorage['dashrate.contractId']`; clearing it falls
back to this default. Register your own contract from the Settings tab to override it.
