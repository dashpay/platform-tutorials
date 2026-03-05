import { wallet, PlatformAddressSigner, PrivateKey } from '@dashevo/evo-sdk';

const network = 'testnet';

try {
  const mnemonic = await wallet.generateMnemonic();
  const pathInfo =
    network === 'testnet'
      ? await wallet.derivationPathBip44Testnet(0, 0, 0)
      : await wallet.derivationPathBip44Mainnet(0, 0, 0);

  // Derive the first BIP44 key to get a platform address
  const keyInfo = await wallet.deriveKeyFromSeedWithPath({
    mnemonic,
    path: pathInfo.path,
    network,
  });

  // Get the platform address (bech32m) from the private key
  const privateKey = PrivateKey.fromWIF(keyInfo.toObject().privateKeyWif);
  const signer = new PlatformAddressSigner();
  const address = signer.addKey(privateKey).toBech32m(network);

  // ⚠️ Never log mnemonics in real applications
  console.log('Mnemonic:', mnemonic);
  console.log('Platform address:', address);
  console.log(
    'Fund address using:',
    `https://bridge.thepasta.org/?address=${address}`,
  );
} catch (e) {
  console.error('Something went wrong:', e.message);
}
