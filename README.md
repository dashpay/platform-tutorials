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

## Usage

1. Check connection: `node connect.mjs`
1. Create a wallet: `node create-wallet.mjs`
1. Fund the platform address using the bridge URL printed in the previous step
1. Create a `.env` file (see [`.env.example`](./.env.example)) and set `PLATFORM_MNEMONIC` to the
   mnemonic from step 2. Set `NETWORK` if needed (defaults to `testnet`).

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

## Contributing

PRs accepted.

## License

[MIT](LICENSE.md)
