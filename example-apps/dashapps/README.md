# dashapps

Discover Dash Platform contracts and inspect their declared metadata. This example
is being extended into a community metadata registry: one proposal per identity
per contract, with the contract owner's entry shown as canonical.

Current features: keyword browsing, contract facts, testnet recovery-phrase sign-in,
identity/DPNS/balance display, mainnet read-only browsing, and per-network registry
selection. The validated testnet registry supports recent entries, name-prefix
search, complete contract proposals, canonical owner entries, and signed-in users'
submissions. Signed-in testnet users can submit, edit, and withdraw metadata.
There is no leaderboard or document counting in this version.

The deployed registry schema includes category, tags, tagline, app launch URL and
icon URL. External icon URLs remain display-disabled
until a same-origin sanitizing image proxy is available; see `ICON_SECURITY.md`.

```sh
npm install
npm run dev
```

Run from this directory with the repository's Node 22.22.x toolchain. The app uses
port 5187 and shares the repository-root browser-safe SDK core. Settings accepts
an optional registry ID separately for each network. Testnet defaults to
`EoMc3L6KsLBr9aTSbBwuZKcVFRnarMfxFMQFXCGY5ZGo`; mainnet remains unset. Sign-in
uses an existing testnet identity's recovery phrase and optional
identity index. The phrase is never saved to browser storage. Mainnet has no sign-in.

| Operation                    | File                                                    | SDK method                           |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------ |
| Connect                      | `src/session/SessionContext.tsx`, `src/dash/sdkCore.ts` | shared `createClient`                |
| Sign in                      | `src/session/SessionContext.tsx`                        | shared `IdentityKeyManager.create`   |
| Balance                      | `src/session/SessionContext.tsx`                        | `identities.balance`                 |
| Resolve contract owner       | `src/dash/ownerResolver.ts`                             | `contracts.getMany`                  |
| Contract facts               | `src/dash/contractFacts.ts`                             | getters, `toObject`                  |
| Keywords / short description | `src/dash/keywordSearch.ts`                             | `documents.query`                    |
| DPNS attribution             | `src/dash/resolveDpnsName.ts`                           | `dpns.username`                      |
| Registry selection           | `src/dash/contractStore.ts`                             | browser storage only                 |
| Registry reads               | `src/dash/registryReads.ts`                             | `documents.query`                    |
| Submit metadata              | `src/dash/registryWrites.ts`                            | `documents.create`                   |
| Edit metadata                | `src/dash/registryWrites.ts`                            | `documents.get`, `documents.replace` |
| Withdraw metadata            | `src/dash/registryWrites.ts`                            | `documents.get`, `documents.delete`  |

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

Unit and component tests use mocked SDK responses, including errors and stale requests.
See [PLAN.md](PLAN.md) for the revised deployment gate and
[IMPLEMENTATION.md](IMPLEMENTATION.md) for completed and pending work.
