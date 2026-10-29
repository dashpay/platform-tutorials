import assert from "node:assert/strict";
import {
  DataContract,
  Document,
} from "../../../../node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js";
import { DECLARED_METADATA, DOCUMENT_TYPE } from "./candidate.mjs";
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
  snapshot,
} from "./probe-lib.mjs";

const report = {
  probe: "declared-metadata",
  startedAt: new Date().toISOString(),
  sdkVersion: "4.1.1",
  checks: {},
};
try {
  const { sdk, actors } = await connectActors();
  const version = sdk.version();
  report.network = await networkContext(sdk);
  const resumeId = process.env.DASHAPPS_PROBE_REGISTRY_ID?.trim();
  let id = resumeId;
  if (id) {
    report.resumedExistingContract = true;
  } else {
    const original = await newCandidate(sdk, actors[0]);
    const before = snapshot(original, version);
    const object = { ...before, ...DECLARED_METADATA, $formatVersion: "1" };
    const reconstructed = DataContract.fromObject(object, true, version);
    const after = snapshot(reconstructed, version);
    assert.deepEqual(after.schemas, before.schemas);
    assert.deepEqual(after.config, before.config);
    assert.equal(String(reconstructed.id), String(original.id));
    assert.equal(String(reconstructed.ownerId), String(original.ownerId));
    report.checks.reconstruction = "passed";
    ({ id } = await publish(sdk, actors[0], reconstructed));
  }
  report.registryContractId = id;
  const fetchedMap = await sdk.contracts.getMany([id]);
  const fetched = fetchedMap.get(id);
  assert(fetched, "Published contract could not be fetched");
  assertCandidate(fetched);
  const declared = snapshot(fetched, version);
  assert.equal(declared.description, DECLARED_METADATA.description);
  assert.deepEqual(declared.keywords, DECLARED_METADATA.keywords);
  report.checks.fetchedMetadata = {
    description: declared.description,
    keywords: declared.keywords,
  };

  // Re-run the critical write/index checks against the reconstructed contract.
  const targetId = (
    process.env.DASHAPPS_PROBE_TARGET_IDS ||
    "BsjE6tQxG47wffZCRQCovFx5rYrAYYC3rTVRWKro27LA"
  )
    .split(",")[0]
    .trim();
  const ownerDoc = await ensureEntry(
    sdk,
    actors[0],
    id,
    targetId,
    "Declared registry owner",
  );
  await ensureEntry(
    sdk,
    actors[1],
    id,
    targetId,
    "Declared registry community",
  );
  try {
    await createEntry(sdk, actors[0], id, targetId, "Duplicate");
    assert.fail(
      "Reconstructed contract accepted a duplicate owner/contract pair",
    );
  } catch (error) {
    if (error?.code === "ERR_ASSERTION") throw error;
    report.checks.duplicateRejected = errorDetails(error);
  }
  const ownerId = documentId(ownerDoc, version);
  const fetchedOwner = await sdk.documents.get(id, DOCUMENT_TYPE, ownerId);
  const replacementDraft = new Document({
    properties: {
      ...fetchedOwner.properties,
      contractId: bytesId(fetchedOwner.properties.contractId),
      name: "Declared registry revised",
    },
    documentTypeName: DOCUMENT_TYPE,
    dataContractId: id,
    ownerId: actors[0].auth.identity.id,
    revision: BigInt(fetchedOwner.revision ?? 0) + 1n,
    id: ownerId,
  });
  replacementDraft.createdAt = fetchedOwner.createdAt;
  replacementDraft.updatedAt = BigInt(Date.now());
  const replacement = await prepareDocument(sdk, replacementDraft, id);
  await sdk.documents.replace({
    document: replacement,
    identityKey: actors[0].auth.identityKey,
    signer: actors[0].auth.signer,
  });
  assert.equal(
    (await sdk.documents.get(id, DOCUMENT_TYPE, ownerId)).properties.name,
    "Declared registry revised",
  );
  await sdk.documents.delete({
    document: {
      id: ownerId,
      ownerId: actors[0].auth.identity.id,
      dataContractId: id,
      documentTypeName: DOCUMENT_TYPE,
    },
    identityKey: actors[0].auth.identityKey,
    signer: actors[0].auth.signer,
  });
  assert.equal(await sdk.documents.get(id, DOCUMENT_TYPE, ownerId), undefined);
  await ensureEntry(
    sdk,
    actors[0],
    id,
    targetId,
    "Declared registry recreated",
  );
  const paged = await queryAll(sdk, {
    dataContractId: id,
    documentTypeName: DOCUMENT_TYPE,
    where: [["contractId", "==", targetId]],
    orderBy: [
      ["contractId", "asc"],
      ["$createdAt", "asc"],
    ],
  });
  assert.equal(paged.length, 2);
  report.checks.mutationAndPagination = paged.map((doc) =>
    documentId(doc, version),
  );
  const category = await queryAll(sdk, {
    dataContractId: id,
    documentTypeName: DOCUMENT_TYPE,
    where: [["category", "==", "developer-tools"]],
    orderBy: [
      ["category", "asc"],
      ["$createdAt", "asc"],
    ],
  });
  assert.equal(category.length, 2);
  report.checks.categoryPagination = category.map((doc) =>
    documentId(doc, version),
  );
  const recent = await queryAll(sdk, {
    dataContractId: id,
    documentTypeName: DOCUMENT_TYPE,
    where: [],
    orderBy: [["$createdAt", "desc"]],
  });
  const times = recent.map((doc) =>
    BigInt(doc.createdAt ?? snapshot(doc, version).$createdAt),
  );
  assert(
    times.every((time, index) => index === 0 || times[index - 1] >= time),
    "Recent index did not honor descending order",
  );
  report.checks.recentDescending = recent.map((doc) =>
    documentId(doc, version),
  );

  const keywordContractId = "BsjE6tQxG47wffZCRQCovFx5rYrAYYC3rTVRWKro27LA";
  for (const keyword of DECLARED_METADATA.keywords) {
    const values = await queryAll(
      sdk,
      {
        dataContractId: keywordContractId,
        documentTypeName: "contractKeywords",
        where: [["keyword", "==", keyword]],
      },
      100,
    );
    assert(
      values.some((doc) => bytesId(doc.properties?.contractId) === id),
      `Keyword Search did not expose ${keyword}`,
    );
  }
  report.checks.keywordSearch = "passed";
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = errorDetails(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  printReport(report);
}
