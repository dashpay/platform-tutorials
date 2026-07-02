// One-time setup: register 4 identities from a single PLATFORM_MNEMONIC —
// identity index 0 is the researcher, indices 1-3 are the Triage Panel.
// Different identityIndex values are separate DIP-13 derivation paths
// (m/9'/{coin}'/5'/0'/0'/{identityIndex}'/{keyIndex}'), so each index
// produces a genuinely distinct, independently-registerable identity from
// one mnemonic — this only saves managing 4 separate seed phrases, it does
// NOT make registration free: each index still needs its own funded
// on-chain identity-create transaction (adapted from
// 1-Identities-and-Names/identity-register.mjs, looped over 4 indices).
//
// Usage: npm run bootstrap:identities
// Requires PLATFORM_MNEMONIC set in the repo-root .env, funded with enough
// testnet credits for 4 identity registrations (5,000,000 credits each,
// drawn from the SAME wallet platform address regardless of identityIndex).
//
// Idempotent: re-running skips any index that already resolves to an
// on-chain identity and just reports its existing ID.
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Identity, Identifier } from "@dashevo/evo-sdk";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../.env");

// `npm run bootstrap:identities` runs with cwd = example-apps/dashbounty/,
// but PLATFORM_MNEMONIC lives in the repo-root .env. Load it explicitly
// before setupDashClient.mjs's own dotenv.config() call runs — dotenv
// doesn't override already-set process.env values, so this wins.
loadEnv({ path: resolve(here, "../../../.env") });

const { setupDashClient, IdentityKeyManager } =
  await import("../../../setupDashClient.mjs");

const ROLES = ["researcher", "panelist-1", "panelist-2", "panelist-3"];
const ENV_KEYS = [
  null,
  "VITE_PANELIST_1_ID",
  "VITE_PANELIST_2_ID",
  "VITE_PANELIST_3_ID",
];

async function resolveExistingIdentityId({ sdk, mnemonic, identityIndex }) {
  try {
    const manager = await IdentityKeyManager.create({
      sdk,
      mnemonic,
      network: "testnet",
      identityIndex,
    });
    return manager.identityId ?? null;
  } catch {
    return null;
  }
}

async function registerIdentityAtIndex({ identityIndex }) {
  const { sdk, keyManager, addressKeyManager } = await setupDashClient({
    requireIdentity: false,
    identityIndex,
  });

  const existingId = await resolveExistingIdentityId({
    sdk,
    mnemonic: process.env.PLATFORM_MNEMONIC,
    identityIndex,
  });
  if (existingId) return { identityId: existingId, alreadyRegistered: true };

  const identity = new Identity(new Identifier(randomBytes(32)));
  keyManager.getKeysInCreation().forEach((key) => {
    identity.addPublicKey(key.toIdentityPublicKey());
  });

  try {
    const result = await sdk.addresses.createIdentity({
      identity,
      inputs: [
        {
          address: addressKeyManager.primaryAddress.bech32m,
          amount: 5000000n,
        },
      ],
      identitySigner: keyManager.getFullSigner(),
      addressSigner: addressKeyManager.getSigner(),
    });
    return {
      identityId: result.identity.id.toString(),
      alreadyRegistered: false,
    };
  } catch (e) {
    // Known SDK bug: proof verification fails but the identity was created.
    // Issue: https://github.com/dashpay/platform/issues/3095
    const match = e.message?.match(/proof returned identity (\w+) but/);
    if (match) return { identityId: match[1], alreadyRegistered: false };
    throw e;
  }
}

function upsertEnvVar(key, value) {
  const line = `${key}=${value}\n`;
  if (!existsSync(envPath)) {
    writeFileSync(envPath, line);
    return;
  }
  const contents = readFileSync(envPath, "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) {
    writeFileSync(envPath, contents.replace(pattern, line.trimEnd()));
  } else {
    appendFileSync(envPath, contents.endsWith("\n") ? line : `\n${line}`);
  }
}

for (let identityIndex = 0; identityIndex < 4; identityIndex += 1) {
  const { identityId, alreadyRegistered } = await registerIdentityAtIndex({
    identityIndex,
  });
  const role = ROLES[identityIndex];
  console.log(
    `[${role}] identityIndex=${identityIndex} → ${identityId}${
      alreadyRegistered ? " (already registered)" : " (newly registered)"
    }`,
  );
  const envKey = ENV_KEYS[identityIndex];
  if (envKey) upsertEnvVar(envKey, identityId);
}

console.log(`\nWrote panelist IDs to ${envPath}`);
console.log(
  "Sign in to DashBounty with identityIndex 0 to file reports, or 1/2/3 to act as a panelist.",
);
