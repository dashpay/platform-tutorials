import assert from "node:assert/strict";
import { Document } from "../../../../node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js";
import { DOCUMENT_TYPE } from "./candidate.mjs";
import {
  assertCandidate,
  bytesId,
  connectActors,
  createEntry,
  documentId,
  ensureEntry,
  errorDetails,
  networkContext,
  newCandidate,
  prepareDocument,
  printReport,
  publish,
  queryAll,
  rows,
  snapshot,
} from "./probe-lib.mjs";

const TARGETS = (
  process.env.DASHAPPS_PROBE_TARGET_IDS ||
  "BsjE6tQxG47wffZCRQCovFx5rYrAYYC3rTVRWKro27LA,8d6heK6CoskLBi6Rs7cChRG9RuckcZqZst28BdviBe8y"
)
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
assert(TARGETS.length >= 2, "Provide at least two DASHAPPS_PROBE_TARGET_IDS");
const report = {
  probe: "index-mutation-pagination",
  startedAt: new Date().toISOString(),
  sdkVersion: "4.1.1",
  inputs: { targetIds: TARGETS },
  checks: {},
};

try {
  const { sdk, actors } = await connectActors();
  report.network = await networkContext(sdk);
  report.identities = actors.map((a) => ({
    identityIndex: a.identityIndex,
    id: a.identityId,
    startingBalance: a.balance,
  }));
  const resumeId = process.env.DASHAPPS_PROBE_REGISTRY_ID?.trim();
  let contractId = resumeId;
  if (contractId) {
    const existingContract = (await sdk.contracts.getMany([contractId])).get(
      contractId,
    );
    assert(
      existingContract,
      `Resume registry contract ${contractId} was not found`,
    );
    assertCandidate(existingContract);
    report.resumedExistingContract = true;
  } else {
    const candidate = await newCandidate(sdk, actors[0]);
    ({ id: contractId } = await publish(sdk, actors[0], candidate));
  }
  report.registryContractId = contractId;
  assertCandidate((await sdk.contracts.getMany([contractId])).get(contractId));

  const created = [];
  created.push(
    await ensureEntry(
      sdk,
      actors[0],
      contractId,
      TARGETS[0],
      "Owner candidate",
    ),
  );
  created.push(
    await ensureEntry(
      sdk,
      actors[1],
      contractId,
      TARGETS[0],
      "Community candidate",
    ),
  );
  for (let i = 1; i < TARGETS.length; i += 1)
    created.push(
      await ensureEntry(
        sdk,
        actors[i % 2],
        contractId,
        TARGETS[i],
        `Target ${i}`,
      ),
    );
  report.createdDocumentIds = created.map((doc) =>
    documentId(doc, sdk.version()),
  );

  const exact = rows(
    await sdk.documents.query({
      dataContractId: contractId,
      documentTypeName: DOCUMENT_TYPE,
      where: [
        ["$ownerId", "==", actors[0].identityId],
        ["contractId", "==", TARGETS[0]],
      ],
      orderBy: [
        ["$ownerId", "asc"],
        ["contractId", "asc"],
      ],
      limit: 1,
    }),
  );
  assert.equal(exact.length, 1);
  report.checks.exactOwnerContractLookup = "passed";

  try {
    await createEntry(sdk, actors[0], contractId, TARGETS[0], "Duplicate");
    assert.fail("Duplicate owner/contract pair was accepted");
  } catch (error) {
    if (error?.code === "ERR_ASSERTION") throw error;
    report.checks.duplicateRejected = errorDetails(error);
  }

  const existing = exact[0];
  const existingId = documentId(existing, sdk.version());
  const replacementDraft = new Document({
    properties: {
      ...existing.properties,
      contractId: bytesId(existing.properties.contractId),
      name: "Owner candidate revised",
      tagline: "Revised registry probe listing",
    },
    documentTypeName: DOCUMENT_TYPE,
    dataContractId: contractId,
    ownerId: actors[0].auth.identity.id,
    revision: BigInt(existing.revision ?? 0) + 1n,
    id: existingId,
  });
  replacementDraft.createdAt = existing.createdAt;
  replacementDraft.updatedAt = BigInt(Date.now());
  const replacement = await prepareDocument(sdk, replacementDraft, contractId);
  await sdk.documents.replace({
    document: replacement,
    identityKey: actors[0].auth.identityKey,
    signer: actors[0].auth.signer,
  });
  const replaced = await sdk.documents.get(
    contractId,
    DOCUMENT_TYPE,
    existingId,
  );
  assert.equal(replaced.properties.name, "Owner candidate revised");
  assert.equal(BigInt(replaced.revision), BigInt(existing.revision ?? 0) + 1n);
  report.checks.replace = snapshot(replaced, sdk.version());

  await sdk.documents.delete({
    document: {
      id: existingId,
      ownerId: actors[0].auth.identity.id,
      dataContractId: contractId,
      documentTypeName: DOCUMENT_TYPE,
    },
    identityKey: actors[0].auth.identityKey,
    signer: actors[0].auth.signer,
  });
  assert.equal(
    await sdk.documents.get(contractId, DOCUMENT_TYPE, existingId),
    undefined,
  );
  report.checks.delete = "passed";
  const recreated = await ensureEntry(
    sdk,
    actors[0],
    contractId,
    TARGETS[0],
    "Owner candidate recreated",
  );
  report.checks.recreateFreedPair = documentId(recreated, sdk.version());

  const proposals = await queryAll(sdk, {
    dataContractId: contractId,
    documentTypeName: DOCUMENT_TYPE,
    where: [["contractId", "==", TARGETS[0]]],
    orderBy: [
      ["contractId", "asc"],
      ["$createdAt", "asc"],
    ],
  });
  assert.equal(proposals.length, 2);
  report.checks.compoundPagination = proposals.map((d) =>
    documentId(d, sdk.version()),
  );
  const category = await queryAll(sdk, {
    dataContractId: contractId,
    documentTypeName: DOCUMENT_TYPE,
    where: [["category", "==", "developer-tools"]],
    orderBy: [
      ["category", "asc"],
      ["$createdAt", "asc"],
    ],
  });
  assert.equal(category.length, created.length);
  report.checks.categoryPagination = category.map((d) =>
    documentId(d, sdk.version()),
  );
  const recent = await queryAll(sdk, {
    dataContractId: contractId,
    documentTypeName: DOCUMENT_TYPE,
    where: [],
    orderBy: [["$createdAt", "desc"]],
  });
  const times = recent.map((d) =>
    BigInt(
      d.createdAt ?? d.$createdAt ?? snapshot(d, sdk.version()).$createdAt,
    ),
  );
  assert(
    times.every((time, index) => index === 0 || times[index - 1] >= time),
    "Recent index did not honor descending order",
  );
  report.checks.recentDescending = recent.map((d) => ({
    id: documentId(d, sdk.version()),
    createdAt: String(d.createdAt ?? snapshot(d, sdk.version()).$createdAt),
  }));
  report.checks.sharedTimestampBoundaryObserved = times.some(
    (time, index) => index > 0 && index % 2 === 0 && time === times[index - 1],
  );
  if (!report.checks.sharedTimestampBoundaryObserved) {
    report.checks.sharedTimestampBoundaryNote =
      "No equal timestamp occurred at a two-item page boundary during this live sample; cursor correctness remains covered by duplicate/cycle detection and query-shape tests.";
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = errorDetails(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  printReport(report);
}
