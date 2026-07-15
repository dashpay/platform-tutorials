// One-time setup: register 4 identities from a single PLATFORM_MNEMONIC —
// identity index 0 is the contract owner, indices 1-3 are group members.
// Different identityIndex values are separate DIP-13 derivation paths
// (m/9'/{coin}'/5'/0'/0'/{identityIndex}'/{keyIndex}'), so each index
// produces a genuinely distinct, independently-registerable identity from
// one mnemonic — this only saves managing 4 separate seed phrases, it does
// NOT make registration free: each index still needs its own funded
// on-chain identity-create transaction (adapted from
// 1-Identities-and-Names/identity-register.mjs, looped over 4 indices).
//
// Usage (from example-apps/token-ops/): npm run bootstrap:identities
// Prerequisites:
//   - repository-root `npm install` (this script imports setupDashClient.mjs
//     and the root @dashevo/evo-sdk copy — app-local node_modules alone is
//     not enough; see README.md#group-members)
//   - PLATFORM_MNEMONIC set in the repo-root .env, funded with enough
//     testnet credits to register 4 identities and top each up to its role's
//     demo minimum (see ROLE_MIN_CREDITS below).
//
// Idempotent on both axes: a re-run skips creating any identity that
// already resolves on-chain and only tops up existing balances that dipped
// below the role minimum since the last run.
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
// Import Identity/Identifier from the REPO-ROOT @dashevo/evo-sdk copy — the
// same one setupDashClient.mjs (also at the repo root) loads — rather than
// the bare specifier. A bare `import ... from "@dashevo/evo-sdk"` in a
// script under example-apps/token-ops/ resolves to this app's LOCAL
// node_modules copy, a different module instance from the root one the
// helper uses; the two produce distinct class constructors under Node 22,
// which breaks `instanceof` inside the SDK mid-create. Sharing the root
// copy is what lets this script use these primitives exactly like the root
// tutorials (e.g. 1-Identities-and-Names/identity-register.mjs) do.
import {
  Identity,
  Identifier,
} from "../../../node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../.env");

// `npm run bootstrap:identities` runs with cwd = example-apps/token-ops/,
// but PLATFORM_MNEMONIC lives in the repo-root .env. Load it explicitly
// before setupDashClient.mjs's own dotenv.config() call runs — dotenv
// doesn't override already-set process.env values, so this wins.
loadEnv({ path: resolve(here, "../../../.env") });

const { setupDashClient, IdentityKeyManager } =
  await import("../../../setupDashClient.mjs");

const ROLES = ["owner", "member-1", "member-2", "member-3"];
const ENV_KEYS = [
  null,
  "VITE_TOKEN_OPS_MEMBER_1_ID",
  "VITE_TOKEN_OPS_MEMBER_2_ID",
  "VITE_TOKEN_OPS_MEMBER_3_ID",
];

// Credits deposited into each identity at creation. Enough for the initial
// on-chain registration; the role-specific top-up step raises this to the
// demo minimum below.
const CREATION_DEPOSIT_CREDITS = 5_000_000n;

// Per-role balance floors for the TokenOps demo. Owner (index 0) has to
// afford contract publish. Group members need credits for group proposals and
// co-signatures.
const OWNER_MIN_CREDITS = 60_000_000_000n;
const MEMBER_MIN_CREDITS = 1_000_000_000n;
const ROLE_MIN_CREDITS = [
  OWNER_MIN_CREDITS,
  MEMBER_MIN_CREDITS,
  MEMBER_MIN_CREDITS,
  MEMBER_MIN_CREDITS,
];

function formatCredits(n) {
  return typeof n === "bigint" ? n.toString() : String(n);
}

async function resolveExistingIdentityId({ sdk, mnemonic, identityIndex }) {
  try {
    const manager = await IdentityKeyManager.create({
      sdk,
      mnemonic,
      network: "testnet",
      identityIndex,
    });
    return manager.identityId ?? null;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "No identity found for the given mnemonic (key 0 public key hash)"
    ) {
      return null;
    }
    throw error;
  }
}

async function fetchIdentityBalance(sdk, identityId) {
  const identity = await sdk.identities.fetch(identityId);
  if (!identity) {
    throw new Error(`Identity ${identityId} not found on-chain`);
  }
  const raw = identity.balance;
  return typeof raw === "bigint" ? raw : BigInt(raw ?? 0);
}

async function fetchWalletBalance(addressKeyManager) {
  const info = await addressKeyManager.getInfo();
  if (!info) return 0n;
  const raw = info.balance;
  return typeof raw === "bigint" ? raw : BigInt(raw ?? 0);
}

function assertWalletCanCover({
  walletBalance,
  need,
  role,
  identityIndex,
  step,
  walletAddress,
}) {
  if (walletBalance >= need) return;
  const message = [
    `Wallet platform address ${walletAddress} has ${formatCredits(walletBalance)} credits`,
    `but ${step} for ${role} (identityIndex=${identityIndex}) needs ${formatCredits(need)} credits.`,
    `Fund the wallet with at least ${formatCredits(need - walletBalance)} more credits and re-run.`,
  ].join(" ");
  throw new Error(message);
}

async function registerIdentity({
  sdk,
  keyManager,
  addressKeyManager,
  role,
  identityIndex,
  walletAddress,
  walletBalanceRef,
}) {
  assertWalletCanCover({
    walletBalance: walletBalanceRef.value,
    need: CREATION_DEPOSIT_CREDITS,
    role,
    identityIndex,
    step: "identity registration",
    walletAddress,
  });

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
          amount: CREATION_DEPOSIT_CREDITS,
        },
      ],
      identitySigner: keyManager.getFullSigner(),
      addressSigner: addressKeyManager.getSigner(),
    });
    return result.identity.id.toString();
  } catch (e) {
    // Known SDK bug: proof verification fails but the identity was created.
    // Issue: https://github.com/dashpay/platform/issues/3095
    const match = e.message?.match(/proof returned identity (\w+) but/);
    if (match) return match[1];
    throw e;
  }
}

async function ensureIdentityBalance({
  sdk,
  addressKeyManager,
  identityId,
  minCredits,
  role,
  identityIndex,
  walletAddress,
  walletBalanceRef,
}) {
  const currentBalance = await fetchIdentityBalance(sdk, identityId);
  if (currentBalance >= minCredits) {
    return { topUpAmount: 0n, finalBalance: currentBalance };
  }
  const topUpAmount = minCredits - currentBalance;

  assertWalletCanCover({
    walletBalance: walletBalanceRef.value,
    need: topUpAmount,
    role,
    identityIndex,
    step: "top-up",
    walletAddress,
  });

  const identity = await sdk.identities.fetch(identityId);
  const result = await sdk.addresses.topUpIdentity({
    identity,
    inputs: [
      {
        address: addressKeyManager.primaryAddress.bech32m,
        amount: topUpAmount,
      },
    ],
    signer: addressKeyManager.getSigner(),
  });
  const finalBalance =
    typeof result.newBalance === "bigint"
      ? result.newBalance
      : BigInt(result.newBalance ?? 0);
  walletBalanceRef.value = await fetchWalletBalance(addressKeyManager);
  return { topUpAmount, finalBalance };
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

try {
  for (let identityIndex = 0; identityIndex < 4; identityIndex += 1) {
    const role = ROLES[identityIndex];
    const minCredits = ROLE_MIN_CREDITS[identityIndex];

    const { sdk, keyManager, addressKeyManager } = await setupDashClient({
      requireIdentity: false,
      identityIndex,
    });
    const walletAddress = addressKeyManager.primaryAddress.bech32m;
    const walletBalanceRef = {
      value: await fetchWalletBalance(addressKeyManager),
    };

    const existingId = await resolveExistingIdentityId({
      sdk,
      mnemonic: process.env.PLATFORM_MNEMONIC,
      identityIndex,
    });

    let identityId = existingId;
    const alreadyRegistered = Boolean(existingId);
    if (!existingId) {
      identityId = await registerIdentity({
        sdk,
        keyManager,
        addressKeyManager,
        role,
        identityIndex,
        walletAddress,
        walletBalanceRef,
      });
      walletBalanceRef.value = await fetchWalletBalance(addressKeyManager);
    }

    const { topUpAmount, finalBalance } = await ensureIdentityBalance({
      sdk,
      addressKeyManager,
      identityId,
      minCredits,
      role,
      identityIndex,
      walletAddress,
      walletBalanceRef,
    });

    const registrationState = alreadyRegistered
      ? "already registered"
      : "newly registered";
    const topUpState =
      topUpAmount > 0n
        ? `topped up +${formatCredits(topUpAmount)} credits`
        : "at or above minimum";
    console.log(
      `[${role}] identityIndex=${identityIndex} → ${identityId} ` +
        `(${registrationState}, ${topUpState}, balance=${formatCredits(finalBalance)}, ` +
        `min=${formatCredits(minCredits)})`,
    );

    const envKey = ENV_KEYS[identityIndex];
    if (envKey) upsertEnvVar(envKey, identityId);
  }

  console.log(`\nWrote TokenOps group member IDs to ${envPath}`);
  console.log(
    "Sign in to TokenOps with identityIndex 0 as owner, or 1/2/3 as group members.",
  );
} catch (error) {
  console.error("Something went wrong:\n", error.message);
  process.exitCode = 1;
}
