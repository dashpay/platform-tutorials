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
  const addressKeyManager = await AddressKeyManager.create({ sdk, mnemonic, network });
  const { bech32m, path } = addressKeyManager.primaryAddress;

  let identityId = 'No identity found for this mnemonic';
  try {
    const keyManager = await IdentityKeyManager.create({ sdk, mnemonic, network });
    identityId = keyManager.identityId;
  } catch (e) {
    if (!e.message?.includes('No identity found for the given mnemonic')) throw e;
  }

  // ⚠️ Never log mnemonics in real applications
  console.log('Network:         ', network);
  console.log('Mnemonic:        ', mnemonic);
  console.log(`First address:    ${bech32m}  (${path})`);
  console.log('Fund address:    ', `https://bridge.thepasta.org/?address=${bech32m}`);
  console.log('Identity ID:     ', identityId);
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
