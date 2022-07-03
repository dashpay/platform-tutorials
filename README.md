# platform-readme-tutorials

[![SDK Version](https://img.shields.io/github/package-json/dependency-version/dashevo/platform-readme-tutorials/dash)](https://github.com/dashevo/platform-readme-tutorials/blob/main/package.json)

Code for the tutorials found on the
[Platform documentation site](https://dashplatform.readme.io/).

## Install

Note: [NodeJS](https://nodejs.org/en/download/) (v12+) must be installed to run
the tutorial code.

### Clone this repository

```shell
git clone https://github.com/dashevo/platform-readme-tutorials.git
```

### Install project dependencies

Do a clean install of project dependencies:

```shell
npm ci
```

## Usage

1. Check connection: `node connect.js`
1. Create wallet: `node create-wallet.js`
1. Go to the [Testnet faucet](https://testnet-faucet.dash.org/) and add funds to
   the address reported in the previous step
1. Create an `.env` file (See [`.env.example`](./.env.example) for an example
   `.env` file). Set `MNEMONIC` to the wallet mnemonic from step 2.

Proceed with the tutorials
[Identities and Names tutorials](./1-Identities-and-Names/) first and the
[Contracts And Documents tutorials](./2-Contracts-and-Documents/) next. They
align with the tutorials section found on the
[documentation site](https://dashplatform.readme.io/docs/tutorials-introduction).

## Contributing

PRs accepted.

## License

[MIT](LICENSE.md)
