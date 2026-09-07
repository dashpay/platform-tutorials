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

```sh
npm install
npm run dev
```

Run from this directory with the repository's Node 22.22.x toolchain. The app uses
port 5187 and shares the repository-root browser-safe SDK core. Settings accepts
an optional registry ID separately for each network. Testnet defaults to
`EtxiWUmuva8vsg2yezX2n7peompzN32VJABQuK7FLCXJ`; mainnet remains unset. Sign-in
uses an existing testnet identity's recovery phrase and optional
identity index. The phrase is never saved to browser storage. Mainnet has no sign-in.

| Operation | File | SDK method |
| --- | --- | --- |
| Connect | `src/session/SessionContext.tsx`, `src/dash/sdkCore.ts` | shared `createClient` |
| Sign in | `src/session/SessionContext.tsx` | shared `IdentityKeyManager.create` |
| Balance | `src/session/SessionContext.tsx` | `identities.balance` |
| Resolve contract owner | `src/dash/ownerResolver.ts` | `contracts.getMany` |
| Contract facts | `src/dash/contractFacts.ts` | getters, `toObject` |
| Keywords / short description | `src/dash/keywordSearch.ts` | `documents.query` |
| DPNS attribution | `src/dash/resolveDpnsName.ts` | `dpns.username` |
| Registry selection | `src/dash/contractStore.ts` | browser storage only |
| Registry reads | `src/dash/registryReads.ts` | `documents.query` |
| Submit metadata | `src/dash/registryWrites.ts` | `documents.create` |
| Edit metadata | `src/dash/registryWrites.ts` | `documents.get`, `documents.replace` |
| Withdraw metadata | `src/dash/registryWrites.ts` | `documents.get`, `documents.delete` |

```sh
npm run build
npm run lint
npm test
npm run test:e2e
node scripts/check-discovery.mjs
```

The discovery script makes read-only testnet requests without credentials. Unit and
component tests use mocked SDK responses, including errors and stale requests.
See [PLAN.md](PLAN.md) for the revised deployment gate and
[IMPLEMENTATION.md](IMPLEMENTATION.md) for completed and pending work.

## Registry deployment probes

The opt-in probes publish temporary testnet contracts and documents, so they spend
credits. They require one mnemonic with two existing, funded identities at distinct
identity indices. Neither script reads `.env`; pass secrets in the process environment.

```sh
export DASHAPPS_PROBE_MNEMONIC="your testnet recovery phrase"
export DASHAPPS_PROBE_IDENTITY_INDICES="0,1"
export DASHAPPS_PROBE_SPEND=yes
npm run probe:indexes
npm run probe:metadata
```

If public-key-hash discovery does not resolve identities that are known to exist,
set `DASHAPPS_PROBE_IDENTITY_IDS` to the corresponding comma-separated identity
IDs. The probe then fetches those identities directly and verifies that each
identity has the expected authentication-key slot before making any write. The
IDs and indices must correspond; Platform will reject a mismatched signer.

`DASHAPPS_PROBE_TARGET_IDS` may be set to a comma-separated list of two or more
existing testnet contract IDs. The index probe intentionally uses two-document
pages and records whether equal creation timestamps occur across a page boundary,
without manufacturing extra paid writes solely to force that case. Its JSON
report records identities, balances, contract/document IDs,
protocol status, block height, failures, and each gate result. Preserve passing
reports in `CLAUDE.md` before adopting a contract as the testnet default.
Set `DASHAPPS_PROBE_REGISTRY_ID` to resume against a compatible contract from a
failed attempt without publishing another contract.
