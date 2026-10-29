// Throwaway read-only diagnostic. MN="..." node probe-seed.mjs ; then rm probe-seed.mjs
import { EvoSDK } from "@dashevo/evo-sdk";
import {
  IdentityKeyManager,
  PLATFORM_VERSION_OVERRIDE,
} from "../../setupDashClient-core.mjs";

const mnemonic = (process.env.MN || "").trim();
if (!mnemonic) {
  console.error('Set MN="..."');
  process.exit(1);
}

const sdk = EvoSDK.testnetTrusted({ version: PLATFORM_VERSION_OVERRIDE });
await sdk.connect();
const km = await IdentityKeyManager.create({
  sdk,
  mnemonic,
  network: "testnet",
  identityIndex: 0,
});
const id = String(km.identityId ?? "");
console.log("identityId:", id);

const identity = await sdk.identities.fetch(id); // same call getSigner uses
const json = identity?.toJSON?.() ?? {};
const keys = json.publicKeys ?? json.$publicKeys ?? json.public_keys ?? [];
console.log("on-chain public keys:");
for (const k of keys) {
  console.log(
    `  id=${k.id} purpose=${k.purpose} level=${k.securityLevel} type=${k.type} readOnly=${k.readOnly ?? ""} disabledAt=${k.disabledAt ?? ""}`,
  );
}

// What getSigner picks for each named key, and whether getPublicKeyById finds it
for (const name of ["master", "authHigh", "auth", "transfer", "encryption"]) {
  const keyId = km.keys?.[name]?.keyId;
  const found = identity?.getPublicKeyById?.(keyId);
  console.log(
    `  ${name} -> keyId ${keyId} : getPublicKeyById ${found ? "FOUND id=" + found.id?.() : "MISSING"}`,
  );
}
