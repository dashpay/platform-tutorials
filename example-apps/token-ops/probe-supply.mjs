import { createClient } from "../../setupDashClient-core.mjs";

const CONTRACT =
  process.argv[2] || "5hK6SMfN4m2vU1t9qhvngUUQjsXeMNwr8MZdFeGBH8Aa";

const network = process.argv[3] || "testnet";
const sdk = await createClient(network);
console.log("connected to", network, "; resolving", CONTRACT);

// The pasted value may be a token ID. contractInfo(tokenId) returns the
// contract ID; it returns undefined for a real contract ID.
let contractId = CONTRACT;
const asToken = await sdk.tokens.contractInfo(CONTRACT);
if (asToken) {
  const info =
    typeof asToken?.toJSON === "function" ? asToken.toJSON() : asToken;
  contractId = String(asToken.contractId ?? info.contractId);
  console.log("input was a TOKEN ID; resolved contractId =", contractId);
  console.log("  tokenContractPosition =", asToken.tokenContractPosition);
} else {
  console.log("input treated as a CONTRACT ID");
}

const contract = await sdk.contracts.fetch(contractId);
const json =
  typeof contract?.toJSON === "function" ? contract.toJSON() : contract;

const replacer = (_k, v) => (typeof v === "bigint" ? `${v}n` : v);
console.log("=== FULL tokens config ===");
console.log(JSON.stringify(json.tokens, replacer, 2));

try {
  const tokenId = await sdk.tokens.calculateId(CONTRACT, 0);
  console.log("\n=== tokenId ===", tokenId);
  const info = await sdk.tokens.contractInfo(tokenId);
  const infoJson = typeof info?.toJSON === "function" ? info.toJSON() : info;
  console.log("=== contractInfo ===");
  console.log(JSON.stringify(infoJson, replacer, 2));

  const supply = await sdk.tokens.totalSupply(tokenId);
  const supplyJson =
    typeof supply?.toJSON === "function" ? supply.toJSON() : supply;
  console.log("=== totalSupply ===");
  console.log(JSON.stringify(supplyJson, replacer, 2));
} catch (e) {
  console.log("token query error:", e.message);
}

process.exit(0);
