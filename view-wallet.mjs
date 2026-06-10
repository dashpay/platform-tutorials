import {
  createClient,
  clientConfig,
  AddressKeyManager,
  IdentityKeyManager,
} from './setupDashClient.mjs';

const { mnemonic, network } = clientConfig;

if (!mnemonic) {
  console.error('No mnemonic found. Set PLATFORM_MNEMONIC in your .env file.');
  process.exit(1);
}

try {
  const sdk = await createClient(network);
  const addressKeyManager = await AddressKeyManager.create({
    sdk,
    mnemonic,
    network,
  });
  const { bech32m, path } = addressKeyManager.primaryAddress;

  let identityId = 'No identity found for this mnemonic';
  let balance = null;
  try {
    const keyManager = await IdentityKeyManager.create({
      sdk,
      mnemonic,
      network,
    });
    identityId = keyManager.identityId;
    const identity = await sdk.identities.fetch(identityId);
    balance = identity.balance;
  } catch (e) {
    if (!e.message?.includes('No identity found for the given mnemonic'))
      throw e;
  }

  // ⚠️ Never log mnemonics in real applications
  console.log('Network:         ', network);
  console.log('Mnemonic:        ', mnemonic);
  console.log(`First address:    ${bech32m}  (${path})`);
  console.log(
    'Fund address:    ',
    `https://bridge.thepasta.org/?address=${bech32m}`,
  );
  console.log('Identity ID:     ', identityId);
  if (balance !== null) {
    // 1000 credits = 1 duff, 100_000_000 duffs = 1 Dash
    const dash = Number(balance) / 1e11;
    console.log(
      'Identity balance:',
      `${balance} credits (${dash.toFixed(8)} DASH)`,
    );
  }
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
