# Example Apps

Stand-alone applications built on top of the same `@dashevo/evo-sdk` used by the Node tutorials in the parent repo. Each example is an independent npm project — `cd` into its directory and run `npm install` there.

## Apps

- [dashmint-lab/](./dashmint-lab/) — React + TypeScript + Vite SPA for minting, viewing, transferring, and trading NFT-style collectible cards on Dash Platform testnet. Shares the browser-safe SDK core (`setupDashClient-core.mjs`) with the Node tutorials at the repo root.
- [dashproof-lab/](./dashproof-lab/) — React + TypeScript + Vite proof-of-existence tutorial app that hashes files locally in the browser, anchors SHA-256 proofs on Dash Platform testnet, verifies files by hash, and reviews proof history by owner or chain ID. Also uses the shared browser-safe SDK core from the parent repo.
- [dashnote/](./dashnote/) — React + TypeScript + Vite notes app for Dash Platform testnet. Create, edit, and delete notes against a small `note` data contract; supports a "Remember Me" read-only browse mode, optimistic localStorage cache, and ships a single-file zero-build read-only companion at `dashnote-lite.html`. Also uses the shared browser-safe SDK core from the parent repo.
