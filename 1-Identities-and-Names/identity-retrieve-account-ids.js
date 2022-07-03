// See https://dashplatform.readme.io/docs/tutorial-retrieve-an-accounts-identities
const Dash = require("dash");
const dotenv = require("dotenv");
dotenv.config();

const client = new Dash.Client({
  network: "testnet",
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 675000, // only sync from early-2022
    },
  },
});

const retrieveIdentityIds = async () => {
  const account = await client.getWalletAccount();
  return account.identities.getIdentityIds();
};

retrieveIdentityIds()
  .then((d) => console.log("Mnemonic identities:\n", d))
  .catch((e) => console.error("Something went wrong:\n", e))
  .finally(() => client.disconnect());
