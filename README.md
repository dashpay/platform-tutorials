# platform-readme-tutorials

[![SDK
Version](https://img.shields.io/github/package-json/dependency-version/dashpay/platform-readme-tutorials/%40dashevo%2Fevo-sdk)](https://github.com/dashpay/platform-readme-tutorials/blob/main/package.json)

Code for the tutorials found on the [Platform documentation
site](http://docs.dash.org/projects/platform/en/stable/docs/tutorials/introduction.html). This repo
uses `@dashevo/evo-sdk`. For the legacy `js-dash-sdk` tutorials, see
[v2.0.1](https://github.com/dashpay/platform-tutorials/releases/tag/v2.0.1).

## Quick Start with Dev Containers

[![Open in GitHub
Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/dashpay/platform-tutorials)

The included dev container provides a ready-to-use environment with Node.js, dependencies, and
editor tooling pre-configured. Open the repo in [GitHub
Codespaces](https://codespaces.new/dashpay/platform-tutorials) or locally with the [VS Code Dev
Containers
extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

On first launch the container installs dependencies and creates a starter `.env` file from
`.env.example`. Run `node create-wallet.mjs` to generate a mnemonic, then set `PLATFORM_MNEMONIC` in
your `.env` file to begin the tutorials.

## Install

Note: [NodeJS](https://nodejs.org/en/download/) (v20+) must be installed to run the tutorial code.

### Clone this repository

```shell
git clone https://github.com/dashpay/platform-tutorials.git
```

### Install project dependencies

Do a clean install of project dependencies:

```shell
npm ci
```

### Configure environment

Copy [`.env.example`](./.env.example) to `.env`. Set `NETWORK` if needed (defaults to `testnet`).
You will set `PLATFORM_MNEMONIC` when configuring a wallet in the Usage section.

```shell
cp .env.example .env
```

## Usage

### Standard setup (recommended)

Follow these steps to go through the full Platform flow (wallet → funding → identity):

1. Check connection: `node connect.mjs`
1. Create a wallet: `node create-wallet.mjs`
1. Fund the platform address using the bridge URL printed in the previous step
1. Set `PLATFORM_MNEMONIC` in `.env` to the mnemonic from step 2
1. To inspect the wallet after configuring `PLATFORM_MNEMONIC`, run `node view-wallet.mjs`
1. Proceed with [Next Steps](#next-steps)

### Fast setup (optional)

If you want to start interacting with Platform as quickly as possible, you can use [Dash
Bridge](https://bridge.thepasta.org/) to create a wallet and register an identity in one step.

Then, just set `PLATFORM_MNEMONIC` in `.env`, run `node view-wallet.mjs` to confirm the wallet
and identity are found, and proceed with [Next Steps](#next-steps).

> This is useful for quick experimentation, but the standard setup above is recommended to
> understand the full flow.

### Next steps

Proceed with the [Identities and Names tutorials](./1-Identities-and-Names/) first and the
[Contracts and Documents tutorials](./2-Contracts-and-Documents/) next. They align with the
tutorials section on the [documentation
site](https://docs.dash.org/projects/platform/en/stable/docs/tutorials/introduction.html).

The identity ID is automatically resolved from your mnemonic, so there is no need to set it
manually. After [registering a data
contract](./2-Contracts-and-Documents/contract-register-minimal.mjs), set `DATA_CONTRACT_ID` in your
`.env` file to the new contract ID for use in subsequent document tutorials.

Some client configuration options are included as comments in
[`setupDashClient.mjs`](./setupDashClient.mjs) if more advanced configuration is required.

## Testing

Tests run each tutorial as a subprocess and validate its output. No test framework dependencies are
required — tests use the Node.js built-in test runner.

Ensure your `.env` file is configured (see [`.env.example`](./.env.example)) before running tests.

```shell
# Read-only tests (default) — safe to run, no credits consumed
npm test

# Write tests — registers identities/contracts/documents (consumes testnet credits)
npm run test:read-write

# All tests
npm run test:all
```

### Importing an existing wallet

If you already have a Dash identity created with another tool (e.g. [Dash
Bridge](https://bridge.thepasta.org/)), you can use it directly by setting `PLATFORM_MNEMONIC` to
your existing mnemonic. Run `node view-wallet.mjs` to confirm the derived address and identity ID.

> **Note:** [Dash Bridge](https://bridge.thepasta.org/) can handle wallet creation and identity
> registration in one step.

For compatibility, the external tool must use the same derivation paths (no BIP39 passphrase):

| Key type | Testnet | Mainnet |
| - | - | - |
| Platform address (BIP44) | `m/44'/1'/0'/0/i` | `m/44'/5'/0'/0/i` |
| Identity keys (DIP-13) | `m/9'/1'/5'/0'/0'/0'/k'` | `m/9'/5'/5'/0'/0'/0'/k'` |

The first platform address (`i=0`) must be funded for top-up and send-funds operations.

## Contributing

PRs accepted.

## License

[MIT](LICENSE.md)
