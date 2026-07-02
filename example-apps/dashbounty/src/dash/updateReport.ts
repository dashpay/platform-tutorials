/**
 * Edit a researcher's own report while it's still open.
 *
 * Every document mutation on Platform requires fetching the current
 * on-chain Document first and bumping its `revision` by exactly 1 — Platform
 * rejects mutations that don't strictly increase the revision number.
 *
 * `report` has `documentsMutable: true`, so this is allowed by the schema
 * at any time. App-level policy (not Platform) should stop calling this
 * once the researcher's identity is frozen or the report is known to be
 * slashed — check frozenStatus.ts before offering an edit UI.
 *
 * SDK methods: sdk.documents.get(...), sdk.documents.replace(...)
 */
import { Document } from "@dashevo/evo-sdk";

import { errorMessage, type Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";

export interface UpdateReportInput {
  title?: string;
  severity?: "low" | "medium" | "high" | "critical";
  component?: string;
  description?: string;
}

export async function updateReport({
  sdk,
  keyManager,
  contractId,
  reportId,
  updates,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  reportId: string;
  updates: UpdateReportInput;
  log?: Logger;
}): Promise<void> {
  try {
    const { identityKey, signer } = await keyManager.getAuth();

    const existing = await sdk.documents.get(contractId, "report", reportId);
    if (!existing) throw new Error(`Report ${reportId} not found.`);

    const properties: Record<string, unknown> = {
      title: updates.title?.trim() ?? existing.title,
      severity: updates.severity ?? existing.severity,
      component: updates.component?.trim() ?? existing.component,
      description: updates.description?.trim() ?? existing.description,
    };
    if (existing.pocHash) properties.pocHash = existing.pocHash;

    const revision = BigInt(existing.revision ?? 0) + 1n;
    const doc = new Document({
      properties,
      documentTypeName: "report",
      dataContractId: contractId,
      ownerId: existing.$ownerId as string,
      id: reportId,
      revision,
    });

    await sdk.documents.replace({ document: doc, identityKey, signer });
    log?.(`Report ${reportId} updated.`, "success");
  } catch (e) {
    log?.(`Update error: ${errorMessage(e)}`, "error");
    throw e;
  }
}
