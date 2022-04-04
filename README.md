# platform-readme-tutorials

## Install

Clone this repository:

``` shell
git clone https://github.com/dashevo/platform-readme-tutorials.git
```

Do a clean install of project dependencies:

``` shell
npm ci
```

## Usage

1. Check connection: `node connect.js`
1. Create wallet: `node create-wallet.js`
1. Go to https://testnet-faucet.dash.org/ and add funds to the address reported in the previous step
1. Create an `.env` file (See [`.env.example`](./.env.example) for an example `.env` file). Set `MNEMONIC` to the wallet mnemonic from step 2.

Proceed with the tutorials [Identities and Names tutorials](./1-Identities-and-Names/) first and the [Contracts And Documents tutorials](./2-Contracts-and-Documents/) next. They align with the tutorials section found here: https://dashplatform.readme.io/docs/tutorials-introduction.
