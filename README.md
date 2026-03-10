# platform-readme-tutorials

[![SDK
Version](https://img.shields.io/github/package-json/dependency-version/dashpay/platform-readme-tutorials/%40dashevo%2Fevo-sdk)](https://github.com/dashpay/platform-readme-tutorials/blob/main/package.json)

Code for the tutorials found on the [Platform documentation site](https://docs.dash.org/platform).

## Install

Note: [NodeJS](https://nodejs.org/en/download/) (v20+) must be installed to run the tutorial code.

### Clone this repository

```shell
git clone https://github.com/dashpay/platform-readme-tutorials.git
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

## Contributing

PRs accepted.

## License

[MIT](LICENSE.md)
