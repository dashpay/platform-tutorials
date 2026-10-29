/**
 * Credit-spending testnet probe for app ratings. Publishes the production
 * registry contract (both document types, declared metadata, curated system
 * entries) unless DASHAPPS_PROBE_REGISTRY_ID resumes an existing one, then
 * verifies rating create, uniqueness (40105), grouped count keys, replace,
 * sort/filter query shapes and delete through the app's own read module.
 *
 * Run from example-apps/dashapps:
 *   DASHAPPS_PROBE_SPEND=yes node --import ./scripts/probes/ts-resolve-hook.mjs \
 *     --env-file=../../.env scripts/probes/ratings.mjs
 * Uses DASHAPPS_PROBE_MNEMONIC, falling back to the tutorial PLATFORM_MNEMONIC.
 */
import assert from "node:assert/strict";
import {
  DataContract,
  Document,
} from "../../../../node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js";
import {
  createClient,
  IdentityKeyManager,
} from "../../../../setupDashClient-core.mjs";
import {
  APP_METADATA_SCHEMAS,
  CONTRACT_CONFIG,
  DECLARED_METADATA,
  DOCUMENT_TYPE,
  RATING_DOCUMENT_TYPE,
} from "./candidate.mjs";
import {
  assertCandidate,
  errorDetails,
  networkContext,
  prepareDocument,
  printReport,
  rows,
} from "./probe-lib.mjs";
import {
  listRatings,
  ownRating,
  ratingSummary,
  starsKeyHex,
} from "../../src/dash/ratingReads.ts";
import { metadataProperties } from "../../src/dash/registryWrites.ts";
import { SYSTEM_CONTRACT_METADATA } from "../../src/dash/systemContractMetadata.ts";

const TARGET =
  process.env.DASHAPPS_PROBE_TARGET_ID?.trim() ||
  "BsjE6tQxG47wffZCRQCovFx5rYrAYYC3rTVRWKro27LA";
const report = {
  probe: "ratings",
  startedAt: new Date().toISOString(),
  sdkVersion: "4.1.1",
  inputs: { targetId: TARGET },
  checks: {},
};

function optIn() {
  assert.equal(
    process.env.DASHAPPS_PROBE_SPEND,
    "yes",
    "Set DASHAPPS_PROBE_SPEND=yes to acknowledge testnet credit spending",
  );
  const mnemonic = (
    process.env.DASHAPPS_PROBE_MNEMONIC ||
    process.env.PLATFORM_MNEMONIC ||
    ""
  ).trim();
  assert(mnemonic, "Set DASHAPPS_PROBE_MNEMONIC or PLATFORM_MNEMONIC");
  const identityIndex = Number(process.env.DASHAPPS_PROBE_IDENTITY_INDEX || 0);
  assert(Number.isSafeInteger(identityIndex) && identityIndex >= 0);
  return { mnemonic, identityIndex };
}

async function connectActor() {
  const { mnemonic, identityIndex } = optIn();
  const sdk = await createClient("testnet");
  const manager = await IdentityKeyManager.create({
    sdk,
    mnemonic,
    network: "testnet",
    identityIndex,
  });
  const auth = await manager.getAuth();
  const identityId = auth.identity.id.toString();
  assert(auth.identityKey, `No authentication key on identity ${identityId}`);
  const balance = BigInt(await sdk.identities.balance(identityId));
  assert(balance > 0n, `Identity ${identityId} has no credits`);
  return { sdk, actor: { manager, auth, identityId, balance } };
}

/** Mirrors registerContract in src/dash/contract.ts with the root SDK module. */
async function publishProductionRegistry(sdk, actor) {
  const nonce = await sdk.identities.nonce(actor.identityId);
  const candidate = new DataContract({
    ownerId: actor.auth.identity.id,
    identityNonce: BigInt(nonce ?? 0) + 1n,
    schemas: APP_METADATA_SCHEMAS,
    fullValidation: true,
  });
  candidate.setConfig(CONTRACT_CONFIG);
  const dataContract = DataContract.fromObject(
    {
      ...candidate.toObject(sdk.version()),
      ...DECLARED_METADATA,
      $formatVersion: "1",
    },
    true,
    sdk.version(),
  );
  const published = await sdk.contracts.publish({
    dataContract,
    identityKey: actor.auth.identityKey,
    signer: actor.auth.signer,
  });
  const id = published.id?.toString() || published.toJSON?.(sdk.version())?.id;
  assert(id, "Contract publication returned no ID");
  return id;
}

async function createDocument(sdk, actor, registryId, type, properties, extra) {
  const draft = new Document({
    properties,
    documentTypeName: type,
    dataContractId: registryId,
    ownerId: actor.auth.identity.id,
    ...extra,
  });
  if (extra?.createdAt != null) draft.createdAt = extra.createdAt;
  if (extra?.revision != null) draft.updatedAt = BigInt(Date.now());
  return prepareDocument(sdk, draft, registryId);
}

async function seedSystemMetadata(sdk, actor, registryId) {
  const seeded = [];
  const failures = [];
  for (const entry of SYSTEM_CONTRACT_METADATA) {
    try {
      const existing = rows(
        await sdk.documents.query({
          dataContractId: registryId,
          documentTypeName: DOCUMENT_TYPE,
          where: [
            ["$ownerId", "==", actor.identityId],
            ["contractId", "==", entry.contractId],
          ],
          orderBy: [
            ["$ownerId", "asc"],
            ["contractId", "asc"],
          ],
          limit: 1,
        }),
      );
      if (existing.length) {
        seeded.push({ name: entry.input.name, resumed: true });
        continue;
      }
      const document = await createDocument(
        sdk,
        actor,
        registryId,
        DOCUMENT_TYPE,
        metadataProperties(entry.contractId, entry.input),
      );
      await sdk.documents.create({
        document,
        identityKey: actor.auth.identityKey,
        signer: actor.auth.signer,
      });
      seeded.push({ name: entry.input.name, id: String(document.id) });
    } catch (error) {
      failures.push({ name: entry.input.name, error: errorDetails(error) });
    }
  }
  return { seeded, failures };
}

async function rawCounts(sdk, registryId) {
  const counts = await sdk.documents.count({
    dataContractId: registryId,
    documentTypeName: RATING_DOCUMENT_TYPE,
    where: [
      ["contractId", "==", TARGET],
      ["stars", "between", [1, 5]],
    ],
    orderBy: [["stars", "asc"]],
    groupBy: ["stars"],
  });
  return Object.fromEntries(
    [...counts.entries()].map(([key, value]) => [key, value.toString()]),
  );
}

function plain(summary) {
  return {
    count: summary.count.toString(),
    average: summary.average,
    distribution: Object.fromEntries(
      Object.entries(summary.distribution).map(([k, v]) => [k, v.toString()]),
    ),
  };
}

try {
  const { sdk, actor } = await connectActor();
  report.network = await networkContext(sdk);
  report.identity = { id: actor.identityId, startingBalance: actor.balance };
  let registryId = process.env.DASHAPPS_PROBE_REGISTRY_ID?.trim();
  if (registryId) report.resumedExistingContract = true;
  else {
    registryId = await publishProductionRegistry(sdk, actor);
    report.publishedAt = await networkContext(sdk);
  }
  report.registryContractId = registryId;
  const contract = (await sdk.contracts.getMany([registryId])).get(registryId);
  assertCandidate(contract);
  const facts = contract.toObject(sdk.version());
  report.checks.declaredMetadata = {
    description: facts.description,
    keywords: facts.keywords,
    documentTypes: Object.keys(contract.schemas),
  };
  assert.equal(facts.description, DECLARED_METADATA.description);
  report.checks.seed = await seedSystemMetadata(sdk, actor, registryId);

  const initial = await ratingSummary(sdk, registryId, TARGET);
  const existing = await ownRating(sdk, registryId, actor.identityId, TARGET);
  report.checks.initial = { summary: plain(initial), ownRating: existing?.id };
  if (existing) {
    // Resume: clear a rating left by an interrupted run so the checks below start clean.
    const current = await sdk.documents.get(
      registryId,
      RATING_DOCUMENT_TYPE,
      existing.id,
    );
    await sdk.documents.delete({
      document: current,
      identityKey: actor.auth.identityKey,
      signer: actor.auth.signer,
    });
    report.checks.initial.clearedLeftover = true;
  }

  const created = await createDocument(
    sdk,
    actor,
    registryId,
    RATING_DOCUMENT_TYPE,
    {
      contractId: TARGET,
      stars: 5,
      title: "Probe rating",
      body: "Created by scripts/probes/ratings.mjs",
    },
  );
  await sdk.documents.create({
    document: created,
    identityKey: actor.auth.identityKey,
    signer: actor.auth.signer,
  });
  const ratingId = String(created.id);
  const afterCreate = await ratingSummary(sdk, registryId, TARGET);
  report.checks.create = {
    ratingId,
    rawCountKeys: await rawCounts(sdk, registryId),
    summary: plain(afterCreate),
    height: (await networkContext(sdk)).blockHeight,
  };
  assert.equal(afterCreate.distribution[5], 1n, "5-star count after create");
  assert.equal(afterCreate.count, 1n);
  assert.equal(afterCreate.average, 5);
  assert.equal(
    report.checks.create.rawCountKeys[starsKeyHex(5)],
    "1",
    "grouped count key must be the sign-flipped hex byte",
  );

  try {
    const duplicate = await createDocument(
      sdk,
      actor,
      registryId,
      RATING_DOCUMENT_TYPE,
      {
        contractId: TARGET,
        stars: 1,
      },
    );
    await sdk.documents.create({
      document: duplicate,
      identityKey: actor.auth.identityKey,
      signer: actor.auth.signer,
    });
    report.checks.duplicate = { rejected: false };
    assert.fail("Duplicate owner/contract rating was accepted");
  } catch (error) {
    if (report.checks.duplicate) throw error;
    const details = errorDetails(error);
    report.checks.duplicate = { rejected: true, ...details };
    assert(
      details.code === 40105 ||
        /duplicate unique properties/i.test(
          details.decodedMessage || details.message,
        ),
      `Unexpected duplicate error: ${JSON.stringify(details)}`,
    );
  }

  const own = await ownRating(sdk, registryId, actor.identityId, TARGET);
  assert.equal(own?.id, ratingId, "ownRating must find the created rating");
  const current = await sdk.documents.get(
    registryId,
    RATING_DOCUMENT_TYPE,
    ratingId,
  );
  assert(current, "created rating must be fetchable");
  const replacement = await createDocument(
    sdk,
    actor,
    registryId,
    RATING_DOCUMENT_TYPE,
    { contractId: TARGET, stars: 3, title: "Probe rating (edited)" },
    {
      id: ratingId,
      revision: BigInt(current.revision ?? 0) + 1n,
      createdAt: current.createdAt,
    },
  );
  await sdk.documents.replace({
    document: replacement,
    identityKey: actor.auth.identityKey,
    signer: actor.auth.signer,
  });
  const afterReplace = await ratingSummary(sdk, registryId, TARGET);
  const replaced = await ownRating(sdk, registryId, actor.identityId, TARGET);
  report.checks.replace = {
    summary: plain(afterReplace),
    revision: replaced?.revision?.toString(),
    stars: replaced?.stars,
    title: replaced?.title,
    body: replaced?.body,
  };
  assert.equal(afterReplace.distribution[3], 1n);
  assert.equal(afterReplace.distribution[5], 0n);
  assert.equal(replaced?.stars, 3);
  assert.equal(replaced?.revision, 2n);
  assert.equal(replaced?.body, undefined, "blank body must be omitted");

  const lists = {};
  for (const [label, options] of Object.entries({
    recent: { sort: "recent" },
    highest: { sort: "highest" },
    lowest: { sort: "lowest" },
    filter3: { stars: 3 },
    filter5: { stars: 5 },
  })) {
    const page = await listRatings(sdk, registryId, TARGET, options);
    lists[label] = {
      count: page.ratings.length,
      stars: page.ratings.map((r) => r.stars),
      cursor: page.cursor,
    };
  }
  report.checks.lists = lists;
  for (const label of ["recent", "highest", "lowest", "filter3"])
    assert.deepEqual(lists[label].stars, [3], `${label} list`);
  assert.equal(lists.filter5.count, 0, "stars == 5 filter after replace");

  const toDelete = await sdk.documents.get(
    registryId,
    RATING_DOCUMENT_TYPE,
    ratingId,
  );
  await sdk.documents.delete({
    document: toDelete,
    identityKey: actor.auth.identityKey,
    signer: actor.auth.signer,
  });
  const afterDelete = await ratingSummary(sdk, registryId, TARGET);
  report.checks.delete = {
    summary: plain(afterDelete),
    ownRating: await ownRating(sdk, registryId, actor.identityId, TARGET),
  };
  assert.equal(afterDelete.count, 0n, "count after delete");
  assert.equal(report.checks.delete.ownRating, null);

  report.finishedAt = await networkContext(sdk);
  report.endingBalance = BigInt(await sdk.identities.balance(actor.identityId));
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.error = errorDetails(error);
  process.exitCode = 1;
} finally {
  printReport(report);
  process.exit(process.exitCode ?? 0);
}
