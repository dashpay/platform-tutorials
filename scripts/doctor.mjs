#!/usr/bin/env node
import fs from 'node:fs/promises';

process.env.DOTENV_CONFIG_QUIET ??= 'true';

const PINNED_NODE_RANGE = '>=22.22.0 <22.23.0';
const SUPPORTED_NETWORKS = new Set(['testnet', 'mainnet', 'local']);
const OPTIONAL_READINESS = [
  {
    label: 'Contract/document standalone IDs',
    vars: ['DATA_CONTRACT_ID', 'DOCUMENT_ID'],
    missingStatus: 'PASS',
    missingDetail:
      'Read/retrieve and submit tutorials have defaults. Set DATA_CONTRACT_ID and DOCUMENT_ID only for standalone update/delete runs.',
    setDetail:
      'Custom contract/document IDs are configured for standalone document tutorials.',
  },
  {
    label: 'Token lifecycle tutorials',
    vars: ['TOKEN_CONTRACT_ID'],
    missingStatus: 'WARN',
    missingDetail:
      'Run 3-Tokens/token-register.mjs first, then set TOKEN_CONTRACT_ID before standalone token info/mint/transfer/burn tutorials.',
    setDetail: 'TOKEN_CONTRACT_ID is configured.',
  },
  {
    label: 'NFT document tutorials',
    vars: ['NFT_CONTRACT_ID'],
    missingStatus: 'WARN',
    missingDetail:
      'Set NFT_CONTRACT_ID after running contract-register-nft.mjs before standalone NFT document tutorials.',
    setDetail: 'NFT_CONTRACT_ID is configured.',
  },
  {
    label: 'Custom recipient tutorials',
    vars: ['RECIPIENT_ID', 'RECIPIENT_PLATFORM_ADDRESS', 'WITHDRAWAL_ADDRESS'],
    missingStatus: 'PASS',
    missingDetail:
      'Transfer/withdrawal scripts have testnet defaults. Set these only when you want custom recipients.',
    setDetail: 'Custom transfer/withdrawal recipients are configured.',
  },
];

const checks = [];

function section(title) {
  console.log(`\n${title}`);
}

function add(status, label, detail = '') {
  checks.push({ status, label, detail });
  const padded = status.padEnd(4);
  console.log(`${padded} ${label}${detail ? ` - ${detail}` : ''}`);
}

function pass(label, detail) {
  add('PASS', label, detail);
}

function warn(label, detail) {
  add('WARN', label, detail);
}

function fail(label, detail) {
  add('FAIL', label, detail);
}

function parseNodeVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function checkNodeVersion() {
  const version = process.versions.node;
  const { major, minor } = parseNodeVersion(version);

  if (major < 22) {
    fail(
      'Node version',
      `${version} is below Node 22. Install Node 22.22.x for the documented setup.`,
    );
    return;
  }

  if (major === 22 && minor === 22) {
    pass('Node version', `${version} satisfies ${PINNED_NODE_RANGE}.`);
    return;
  }

  warn(
    'Node version',
    `${version} may work, but CI and docs are pinned to ${PINNED_NODE_RANGE}. Use npm ci for the reproducible setup; use npm install only when intentionally resolving dependencies locally.`,
  );
}

async function pathExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function importPackage(name) {
  try {
    return { module: await import(name), ok: true };
  } catch (error) {
    fail(`Import ${name}`, error.message);
    return { module: null, ok: false };
  }
}

function cleanEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderMnemonic(value) {
  const cleaned = cleanEnvValue(value).toLowerCase();
  return (
    cleaned === '' ||
    cleaned.includes('your mnemonic phrase goes here') ||
    cleaned.includes('your twelve word mnemonic phrase goes here')
  );
}

function formatCredits(credits) {
  if (credits === null || credits === undefined) return 'unknown';
  const raw = typeof credits === 'bigint' ? credits : BigInt(credits);
  const dash = Number(raw) / 1e11;
  return `${raw.toString()} credits (${dash.toFixed(8)} DASH)`;
}

function reportTutorialReadiness({
  sdkReady,
  mnemonicConfigured,
  mnemonicReady,
  identityReady,
}) {
  if (sdkReady) {
    pass(
      'Read-only tutorial scripts',
      'Ready to run connection, lookup, and retrieve tutorials.',
    );
  } else {
    warn(
      'Read-only tutorial scripts',
      'Skipped readiness because SDK connection did not complete.',
    );
  }

  if (mnemonicReady) {
    pass(
      'Wallet/address tutorial scripts',
      'Ready to derive the platform address and sign address operations.',
    );
  } else if (mnemonicConfigured && !sdkReady) {
    warn(
      'Wallet/address tutorial scripts',
      'Skipped readiness because SDK connection did not complete.',
    );
  } else {
    warn(
      'Wallet/address tutorial scripts',
      'Set PLATFORM_MNEMONIC before wallet, funding, or signing tutorials.',
    );
  }

  if (identityReady) {
    pass(
      'Identity write tutorial scripts',
      'Ready for identity, name, contract, document, and token write tutorials.',
    );
  } else if (mnemonicConfigured && !sdkReady) {
    warn(
      'Identity write tutorial scripts',
      'Skipped readiness because SDK connection did not complete.',
    );
  } else {
    warn(
      'Identity write tutorial scripts',
      'Register or import a funded identity before write tutorials.',
    );
  }
}

async function main() {
  console.log('Dash Platform tutorial doctor');

  section('Local environment');
  checkNodeVersion();

  if (await pathExists('package-lock.json')) {
    pass('Lockfile', 'package-lock.json found.');
  } else {
    fail(
      'Lockfile',
      'package-lock.json is missing. Run npm install intentionally or restore the lockfile.',
    );
  }

  const dotenvImport = await importPackage('dotenv');
  if (dotenvImport.ok) pass('Import dotenv');

  const evoSdkImport = await importPackage('@dashevo/evo-sdk');
  if (evoSdkImport.ok) pass('Import @dashevo/evo-sdk');

  section('Configuration');
  const hasEnvFile = await pathExists('.env');
  if (hasEnvFile) {
    pass('Environment file', '.env found.');
    dotenvImport.module?.config();
  } else {
    fail('Environment file', '.env is missing. Run cp .env.example .env.');
  }

  const network = cleanEnvValue(process.env.NETWORK) || 'testnet';
  if (SUPPORTED_NETWORKS.has(network)) {
    pass('Network', `Using ${network}.`);
  } else {
    fail(
      'Network',
      `Unsupported NETWORK="${network}". Use testnet, mainnet, or local.`,
    );
  }

  let helpers;
  if (evoSdkImport.ok && SUPPORTED_NETWORKS.has(network)) {
    try {
      helpers = await import('../setupDashClient.mjs');
      pass('Tutorial helpers', 'setupDashClient helpers loaded.');
    } catch (error) {
      fail('Tutorial helpers', error.message);
    }
  }

  section('Platform connection');
  let sdk;
  let sdkReady = false;
  if (helpers && SUPPORTED_NETWORKS.has(network)) {
    try {
      sdk = await helpers.createClient(network);
      const status = await sdk.system.status();
      sdkReady = true;
      pass(
        'SDK connection',
        `Connected to ${network}; status returned ${status ? 'OK' : 'empty response'}.`,
      );
    } catch (error) {
      fail(
        'SDK connection',
        `Could not connect to ${network}: ${error.message}`,
      );
    }
  } else {
    warn(
      'SDK connection',
      'Skipped because earlier configuration checks did not complete.',
    );
  }

  section('Wallet and identity');
  const mnemonic = cleanEnvValue(process.env.PLATFORM_MNEMONIC);
  const mnemonicConfigured = !!mnemonic && !isPlaceholderMnemonic(mnemonic);
  let mnemonicReady = false;
  let identityReady = false;
  if (!mnemonic || isPlaceholderMnemonic(mnemonic)) {
    warn(
      'PLATFORM_MNEMONIC',
      'Missing or placeholder value. Read-only tutorials can run; wallet and identity tutorials need a generated mnemonic.',
    );
  } else if (helpers && sdk) {
    try {
      const valid = await evoSdkImport.module.wallet.validateMnemonic(mnemonic);
      if (!valid) {
        fail('PLATFORM_MNEMONIC', 'Value is not a valid BIP39 mnemonic.');
      } else {
        pass(
          'PLATFORM_MNEMONIC',
          'Mnemonic is valid. It is not printed by this command.',
        );
        mnemonicReady = true;

        const addressKeyManager = await helpers.AddressKeyManager.create({
          sdk,
          mnemonic,
          network,
        });
        const { bech32m, path } = addressKeyManager.primaryAddress;
        pass('Platform address', `${bech32m} (${path})`);
        if (network === 'testnet') {
          pass(
            'Testnet funding URL',
            `https://bridge.thepasta.org/?address=${bech32m}`,
          );
        }

        try {
          const keyManager = await helpers.IdentityKeyManager.create({
            sdk,
            mnemonic,
            network,
          });
          pass('Identity resolution', keyManager.identityId);
          identityReady = true;

          try {
            const identity = await sdk.identities.fetch(keyManager.identityId);
            pass('Identity balance', formatCredits(identity.balance));
          } catch (error) {
            fail('Identity fetch', error.message);
          }
        } catch (error) {
          if (
            error.message?.includes('No identity found for the given mnemonic')
          ) {
            warn(
              'Identity resolution',
              'No identity found for this mnemonic. Fund the platform address, then run node 1-Identities-and-Names/identity-register.mjs.',
            );
          } else {
            fail('Identity resolution', error.message);
          }
        }
      }
    } catch (error) {
      fail('PLATFORM_MNEMONIC', error.message);
    }
  } else if (mnemonic) {
    warn(
      'PLATFORM_MNEMONIC',
      'Skipped wallet checks because earlier required checks failed.',
    );
  }

  section('Tutorial readiness');
  reportTutorialReadiness({
    sdkReady,
    mnemonicConfigured,
    mnemonicReady,
    identityReady,
  });

  for (const group of OPTIONAL_READINESS) {
    const missing = group.vars.filter(
      (name) => !cleanEnvValue(process.env[name]),
    );
    if (missing.length === 0) {
      pass(group.label, group.setDetail);
    } else if (group.missingStatus === 'WARN') {
      warn(group.label, group.missingDetail);
    } else {
      pass(group.label, group.missingDetail);
    }
  }

  const counts = checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { PASS: 0, WARN: 0, FAIL: 0 },
  );

  console.log(
    `\nSummary: ${counts.PASS} passed, ${counts.WARN} warnings, ${counts.FAIL} failures.`,
  );

  if (counts.FAIL > 0) {
    console.log(
      'Next action: fix the FAIL rows above, then run npm run doctor again.',
    );
    process.exitCode = 1;
  } else if (counts.WARN > 0) {
    console.log(
      'Next action: warnings show tutorial flows that need prior setup or IDs from earlier scripts.',
    );
  } else {
    console.log(
      'Next action: setup is ready for the configured tutorial flow.',
    );
  }
}

await main();
