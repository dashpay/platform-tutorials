# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tutorial code for [Dash Platform](https://docs.dash.org/platform) demonstrating how to interact with the Dash network using `@dashevo/evo-sdk`. Covers identities, DPNS names, data contracts, and documents.

### Getting started

Users need a funded identity before running write tutorials. Two paths:

1. **Standard** — `node create-wallet.mjs` (generates mnemonic + faucet URL) → fund via the printed URL → `node 1-Identities-and-Names/identity-register.mjs`
2. **Fast** — Use [Dash Bridge](https://bridge.thepasta.org/) to create a wallet and register an identity in one step, then set `PLATFORM_MNEMONIC` in `.env`

Run `node view-wallet.mjs` to confirm the identity is found before proceeding.

## Commands

```bash
nvm use                 # Use the repo's tested Node 22.22.x toolchain
npm test                # Read-only tests (~2min, safe to run anytime)
npm run test:read-write # Write tests (destructive, consumes testnet credits, ~5min)
npm run test:all        # Both suites sequentially
npm run test:setup      # Mocha tests for setupDashClient configuration

npm run lint            # TypeScript type-check all JS files (tsc)
npm run fmt             # Format with Prettier
```

## Node / npm Toolchain

Use the repo-root `.nvmrc` before installing dependencies or updating lockfiles:

```bash
nvm use
npm ci
```

The root package and each standalone example app declare `engines.node` for the tested Node minor version. The example apps have their own `package-lock.json` files, and npm's optional native/WASM dependency resolution can differ across Node/npm versions. For contributor work, prefer `npm ci` under `nvm use`; do not commit lockfile rewrites from another Node/npm version.

**Running a single tutorial directly:**

```bash
node connect.mjs
node 1-Identities-and-Names/identity-retrieve.mjs
```

**Running a single test file:**

```bash
node --test --test-timeout=120000 test/read-only.test.mjs
```

## Architecture

### Tutorial Structure

Each tutorial is a standalone `.mjs` ESM file with top-level `await`. The pattern is consistent:

```javascript
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();

try {
  // Tutorial logic — use sdk and keyManager
  console.log(result.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
```

### `setupDashClient.mjs`

The central helper (~500 lines) that all tutorials import. It handles:

- Loading `.env` via `dotenv`
- BIP39 wallet derivation from `PLATFORM_MNEMONIC`
- DIP-13 key path derivation
- SDK instantiation (`createClient(network)`)
- Key manager setup — returns `{ sdk, keyManager, addressKeyManager }`

`keyManager.identityId` resolves automatically from the mnemonic. `keyManager.getAuth()` returns the identity, key, and signer needed for signing transactions.

> **Note:** The in-memory key pattern in `setupDashClient` is for tutorials only — not suitable for production.
>
> **Transitional scaffolding:** `setupDashClient-core.mjs` is expected to be removed once the SDK provides key management directly. Its declarations (`setupDashClient-core.d.mts`) deliberately type the `sdk` factory params as `unknown` rather than `EvoSDK` so example apps can pass their own SDK shape without a lockstep type change. Don't tighten it — it breaks the dashnote / dashnote-starter builds.

### Test Framework

Tests use Node.js built-in test runner. Each test runs a tutorial as a **subprocess** via `test/run-tutorial.mjs` and validates:

- Exit code is 0
- `stdout`/`stderr` match expected regex patterns
- Process was not killed (no timeout)

`test/assertions.mjs` provides helpers like `extractId()` and `extractKeyId()` to capture values from output for use in subsequent dependent tests.

**Read-write tests** maintain a shared state object to pass IDs (contract IDs, document IDs, etc.) between sequential dependent tests.

### Derivation Paths

All key derivation uses standard Dash paths. External wallets/tools must use the same paths for compatibility.

| Key type | Testnet path | Mainnet path |
| - | - | - |
| Platform address (BIP44) | `m/44'/1'/0'/0/i` | `m/44'/5'/0'/0/i` |
| Identity master key (DIP-13) | `m/9'/1'/5'/0'/0'/0'/0'` | `m/9'/5'/5'/0'/0'/0'/0'` |
| Identity keys 0–4 (DIP-13) | `m/9'/1'/5'/0'/0'/0'/k'` | `m/9'/5'/5'/0'/0'/0'/k'` |

Where `i` = address index and `k` = key index (0=MASTER, 1=HIGH auth, 2=CRITICAL auth, 3=TRANSFER, 4=ENCRYPTION).

No BIP39 passphrase is used.

### Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
| - | - |
| `PLATFORM_MNEMONIC` | BIP39 mnemonic; required for all write operations |
| `NETWORK` | `testnet` (default) or `mainnet` |
| `DATA_CONTRACT_ID` | Output of `contract-register-minimal.mjs` |
| `DOCUMENT_ID` | Output of `document-submit.mjs` |
| `TOKEN_CONTRACT_ID` | Output of `token-register.mjs`; required by the other `3-Tokens/` tutorials |
| `RECIPIENT_ID` | Identity ID for credit transfers |
| `RECIPIENT_PLATFORM_ADDRESS` | `tdash1...` address for send-funds |

Read-only tests skip gracefully when `PLATFORM_MNEMONIC` is unset.

### Directory Layout

- **Root** — shared utilities (`setupDashClient.mjs`, `connect.mjs`, `create-wallet.mjs`, `view-wallet.mjs`, `send-funds.mjs`)
- **`1-Identities-and-Names/`** — identity registration, top-up, key management, DPNS name registration/lookup
- **`2-Contracts-and-Documents/`** — data contract variants (minimal, indexed, binary, timestamps, history, NFT), document CRUD, NFT operations
- **`3-Tokens/`** — token contract registration, info queries, minting, burning, and transfers
- **`test/`** — test runner, assertions, read-only and read-write test suites
- **`docs/`** — HTML/JS interactive tutorial runner (separate from Node tutorials)
- **`example-apps/`** — Standalone applications (Vite + React + TypeScript) that consume the tutorial SDK code. Each has its own `package.json`, tsconfig, and toolchain — the conventions in this file (Node16 modules, `airbnb-base`, etc.) describe the **root** tutorial code only and do not apply inside `example-apps/`. See each app's local `CLAUDE.md` for its conventions.

### Linting / Types

`npm run lint` runs `tsc` against the root `tsconfig.json`, which is scoped narrowly via `include: ["./setupDashClient.mjs"]` and transitively typechecks the tutorial `.mjs` files via `allowJs` + `checkJs`. Settings: `strict: true`, `noUnusedLocals: true`, Node16 module resolution. Apps under `example-apps/` are excluded from this typecheck — they have their own tsconfigs and run their own `tsc -b` via each app's `npm run build`. ESLint uses `airbnb-base`. Prettier uses single quotes, 2-space tabs, trailing commas.
