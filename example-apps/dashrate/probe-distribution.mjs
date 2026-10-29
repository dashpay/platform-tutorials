// Read-only probe to diagnose why the grouped rating-distribution count
// returns 0 while the document exists. Runs several count() variants against
// the live testnet contract. No signing, no writes.
//
//   node example-apps/dashrate/probe-distribution.mjs
//
// Contract: BdgTqaTAPYMyhp1WdeWdcvYSgoD7AuJ7tVCaCSXyQgyP (has 1 dashnote 5★ review)
import { EvoSDK } from "@dashevo/evo-sdk";

const CONTRACT = "BdgTqaTAPYMyhp1WdeWdcvYSgoD7AuJ7tVCaCSXyQgyP";
const RESOURCE = "dashnote";
const TYPE = "review";

const sdk = EvoSDK.testnetTrusted();
await sdk.connect();

function show(label, map) {
  const entries = [...map.entries()].map(([k, v]) => `${k || "∅"}=${v}`);
  console.log(`  ${label}: {${entries.join(", ")}}`);
}

async function tryCount(label, query) {
  try {
    const map = await sdk.documents.count(query);
    show(label, map);
  } catch (e) {
    console.log(`  ${label}: ERROR ${e.message}`);
  }
}

console.log(`\nContract ${CONTRACT}, resource "${RESOURCE}"\n`);

// Confirm the on-chain contract is what we registered: indices + flags.
try {
  const fetched = await sdk.contracts.fetch(CONTRACT);
  const json =
    typeof fetched?.toJSON === "function" ? fetched.toJSON() : fetched;
  const review =
    json?.documentSchemas?.review ?? json?.documents?.review ?? json?.review;
  const indices = review?.indices ?? review?.indexes;
  console.log("Contract indices on-chain:");
  console.log(JSON.stringify(indices, null, 2));
} catch (e) {
  console.log(`Contract fetch: ERROR ${e.message}`);
}

// 0. plain query — does the document come back?
try {
  const docs = await sdk.documents.query({
    dataContractId: CONTRACT,
    documentTypeName: TYPE,
    where: [["resourceId", "==", RESOURCE]],
    orderBy: [["resourceId", "asc"]],
    limit: 10,
  });
  const arr = docs instanceof Map ? [...docs.values()] : docs;
  console.log(`0. query resourceId==: ${arr.length} docs`);
  for (const d of arr) {
    const j = typeof d?.toJSON === "function" ? d.toJSON() : d;
    console.log(
      `   rating=${j.rating} owner=${String(j.$ownerId).slice(0, 8)}`,
    );
  }
} catch (e) {
  console.log(`0. query: ERROR ${e.message}`);
}

console.log("\nCounts:");

// 1. plain total count (resourceId == only) — known to return 1
await tryCount("1. count resourceId== (no orderBy)", {
  dataContractId: CONTRACT,
  documentTypeName: TYPE,
  where: [["resourceId", "==", RESOURCE]],
});

// 2. the app's distribution query verbatim
await tryCount("2. groupBy rating, between [1,5], orderBy rating asc", {
  dataContractId: CONTRACT,
  documentTypeName: TYPE,
  where: [
    ["resourceId", "==", RESOURCE],
    ["rating", "between", [1, 5]],
  ],
  orderBy: [["rating", "asc"]],
  groupBy: ["rating"],
});

// 3. same but orderBy includes the prefix field too
await tryCount("3. groupBy rating, orderBy [resourceId,rating]", {
  dataContractId: CONTRACT,
  documentTypeName: TYPE,
  where: [
    ["resourceId", "==", RESOURCE],
    ["rating", "between", [1, 5]],
  ],
  orderBy: [
    ["resourceId", "asc"],
    ["rating", "asc"],
  ],
  groupBy: ["rating"],
});

// 4. no groupBy — does the range alone (resourceId== + rating between) count?
await tryCount("4. range only, NO groupBy", {
  dataContractId: CONTRACT,
  documentTypeName: TYPE,
  where: [
    ["resourceId", "==", RESOURCE],
    ["rating", "between", [1, 5]],
  ],
  orderBy: [["rating", "asc"]],
});

// 5. point lookup: resourceId== AND rating==5 (Equal, the filter path)
await tryCount("5. count resourceId== AND rating==5 (filter path)", {
  dataContractId: CONTRACT,
  documentTypeName: TYPE,
  where: [
    ["resourceId", "==", RESOURCE],
    ["rating", "==", 5],
  ],
});

// 6. groupBy with no orderBy
await tryCount("6. groupBy rating, between, NO orderBy", {
  dataContractId: CONTRACT,
  documentTypeName: TYPE,
  where: [
    ["resourceId", "==", RESOURCE],
    ["rating", "between", [1, 5]],
  ],
  groupBy: ["rating"],
});

console.log();
