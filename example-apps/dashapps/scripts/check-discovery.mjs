/** Read-only testnet check. No .env, credentials, registrations, or writes. */
import assert from "node:assert/strict";
import { requireId } from "../src/dash/ids.ts";
import { createClient } from "../../../setupDashClient-core.mjs";
const timeout = setTimeout(() => {
  console.error("Testnet discovery timed out after 60 seconds.");
  process.exit(1);
}, 60_000);
try {
  const sdk = await createClient("testnet");
  const id = "BsjE6tQxG47wffZCRQCovFx5rYrAYYC3rTVRWKro27LA";
  const contracts = await sdk.contracts.getMany([id]);
  assert(contracts instanceof Map);
  const contract = contracts.get(id);
  assert(contract, "Keyword Search system contract must exist");
  const facts = contract.toObject(sdk.version());
  assert.equal(String(contract.id), id);
  assert(contract.schemas.contractKeywords);
  assert(contract.schemas.shortDescription);
  const documents = await sdk.documents.query({
    dataContractId: id,
    documentTypeName: "contractKeywords",
    where: [["keyword", "==", "dash"]],
    limit: 100,
  });
  const rows =
    documents instanceof Map
      ? [...documents.values()].filter(Boolean)
      : Array.isArray(documents)
        ? documents
        : Object.values(documents).filter(Boolean);
  // Exercise the follow-up read too: typed byte arrays are not JSON-safe filters.
  for (const row of rows) {
    const targetId = requireId(row.properties.contractId);
    const descriptions = await sdk.documents.query({
      dataContractId: id,
      documentTypeName: "shortDescription",
      where: [["contractId", "==", targetId]],
      limit: 1,
    });
    assert(descriptions instanceof Map);
    console.log(
      JSON.stringify({
        targetId,
        shortDescriptions: [...descriptions.values()]
          .filter(Boolean)
          .map((doc) => doc.properties.description),
      }),
    );
  }
  console.log(
    JSON.stringify(
      {
        network: "testnet",
        protocolVersion: sdk.version(),
        contractId: id,
        ownerId: String(contract.ownerId),
        version: contract.version,
        documentTypes: Object.keys(contract.schemas),
        description: facts.description,
        keyword: "dash",
        results: rows.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
