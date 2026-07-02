/**
 * Submit a bug report (create a document against the bounty data contract).
 *
 * The `report` document type has `tokenCost.create` configured to transfer
 * 1 Researcher Credit to the contract owner. Passing `tokenPaymentInfo`
 * below is the caller's agreement to spend that credit, so each successful
 * submission costs the researcher 1 credit — the anti-spam friction that
 * deters low-effort mass/AI-slop submissions.
 *
 * SDK method: sdk.documents.create({ document, identityKey, signer, tokenPaymentInfo })
 */
import { Document } from "@dashevo/evo-sdk";

import type { Logger } from "./logger";
import { RESEARCHER_CREDIT_PAYMENT_INFO } from "./researcherCredit";
import type { DashKeyManager, DashSdk } from "./types";

export type ReportSeverity = "low" | "medium" | "high" | "critical";

export interface SubmitReportInput {
  title: string;
  severity: ReportSeverity;
  component: string;
  description: string;
  /** Optional base64 SHA-256 of a locally-hashed proof-of-concept file. */
  pocHash?: string;
}

export interface SubmitReportParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  report: SubmitReportInput;
  log?: Logger;
}

export async function submitReport({
  sdk,
  keyManager,
  contractId,
  report,
  log,
}: SubmitReportParams): Promise<void> {
  const title = report.title.trim();
  const component = report.component.trim();
  const description = report.description.trim();
  if (!title) throw new Error("Report title is required.");
  if (!component) throw new Error("Affected component is required.");
  if (!description) throw new Error("Report description is required.");

  log?.(`Spending 1 Researcher Credit to file "${title}"…`);

  const { identity, identityKey, signer } = await keyManager.getAuth();

  const properties: Record<string, unknown> = {
    title,
    severity: report.severity,
    component,
    description,
  };
  if (report.pocHash) properties.pocHash = report.pocHash;

  const doc = new Document({
    properties,
    documentTypeName: "report",
    dataContractId: contractId,
    ownerId: identity.id,
  });

  await sdk.documents.create({
    document: doc,
    identityKey,
    signer,
    tokenPaymentInfo: RESEARCHER_CREDIT_PAYMENT_INFO,
  });
  log?.(`Report "${title}" filed.`, "success");
}
