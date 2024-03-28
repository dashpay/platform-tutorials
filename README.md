# platform-readme-tutorials

[![SDK Version](https://img.shields.io/github/package-json/dependency-version/dashpay/platform-readme-tutorials/dash)](https://github.com/dashpay/platform-readme-tutorials/blob/main/package.json)

Code for the tutorials found on the
[Platform documentation site](https://docs.dash.org/platform).

## Install

Note: [NodeJS](https://nodejs.org/en/download/) (v20+) must be installed to run
the tutorial code.

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

1. Create an `.env` file (See [`.env.example`](./.env.example) for an example
   `.env` file). Set `NETWORK` to the desired network type (normally 'testnet').
1. Check connection: `node connect.js`
1. Create wallet: `node create-wallet.js`
1. Go to the [Testnet faucet](https://testnet-faucet.dash.org/) and add funds to
   the address reported in the previous step
1. Open the `.env` file (See [`.env.example`](./.env.example) for an example
   `.env` file) and set `MNEMONIC` to the wallet mnemonic from step 3.
1. (Optional) To minimize wallet sync time, open your `.env` file and set
   `SYNC_START_HEIGHT` to a Core chain block height just below the height of
   your wallet's first transaction. Otherwise you can skip this step and use the
   default value from [`.env.example`](./.env.example).

Proceed with the tutorials
[Identities and Names tutorials](./1-Identities-and-Names/) first and the
[Contracts And Documents tutorials](./2-Contracts-and-Documents/) next. They
align with the tutorials section found on the
[documentation site](https://dashplatform.readme.io/docs/tutorials-introduction).

After [creating an identity](./1-Identities-and-Names/identity-register.js), set
the `IDENTITY_ID` value in your `.env` file to your new identity ID. After
[registering a data contract](./2-Contracts-and-Documents/contract-register-minimal.js),
set the `CONTRACT_ID` value in your `.env` file to your new contract ID. To do
credit transfers between identities, create a second identity and set the
`RECIPIENT_ID` value in your `.env` file to its ID.

## Contributing

PRs accepted.

## License

[MIT](LICENSE.md)
