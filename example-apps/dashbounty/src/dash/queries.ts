/**
 * Read queries over the bounty data contract's `report` document type.
 *
 * normalizeReports() hides the three possible shapes the SDK may return
 * (Array, Map, or plain object) so UI code always sees a plain array of
 * typed Report objects.
 *
 * SDK method: sdk.documents.query({ dataContractId, documentTypeName, where?, orderBy?, limit })
 */
import type { Logger } from "./logger.js";
import type {
  DashReportQueryDocument,
  DashReportQueryResults,
  DashSdk,
} from "./types";
import type { ReportSeverity } from "./submitReport";

// Platform caps document queries at 100 results per request.
const MAX_QUERY_LIMIT = 100;

export interface Report {
  id: string;
  ownerId: string;
  revision: bigint | number | string;
  title: string;
  severity: ReportSeverity;
  component: string;
  description: string;
  pocHash?: string;
  createdAt?: bigint | number | string;
}

function toReport(id: string | null, raw: DashReportQueryDocument): Report {
  const j: Record<string, unknown> =
    typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
  return {
    id: (id ?? (j.$id as string) ?? (j.id as string)) as string,
    ownerId: j.$ownerId as string,
    revision: (j.$revision as bigint | number | string) ?? 1n,
    title: j.title as string,
    severity: j.severity as ReportSeverity,
    component: j.component as string,
    description: j.description as string,
    pocHash: j.pocHash as string | undefined,
    createdAt: j.$createdAt as bigint | number | string | undefined,
  };
}

export function normalizeReports(results: DashReportQueryResults): Report[] {
  if (Array.isArray(results)) return results.map((d) => toReport(null, d));
  const entries =
    results instanceof Map ? Object.fromEntries(results) : results;
  return Object.entries(entries).map(([id, d]) => toReport(id, d));
}

interface BaseParams {
  sdk: DashSdk;
  contractId: string;
  limit?: number;
  log?: Logger;
}

export async function listReportsByOwner({
  sdk,
  contractId,
  ownerId,
  limit = MAX_QUERY_LIMIT,
  log,
}: BaseParams & { ownerId: string }): Promise<Report[]> {
  log?.("Loading your reports…");
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "report",
    where: [["$ownerId", "==", ownerId]],
    orderBy: [
      ["$ownerId", "asc"],
      ["$createdAt", "desc"],
    ],
    limit,
  });
  const reports = normalizeReports(results);
  log?.(`Found ${reports.length} report(s).`);
  return reports;
}

export async function listReportsBySeverity({
  sdk,
  contractId,
  severity,
  limit = MAX_QUERY_LIMIT,
  log,
}: BaseParams & { severity: ReportSeverity }): Promise<Report[]> {
  log?.(`Loading ${severity} reports…`);
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "report",
    where: [["severity", "==", severity]],
    orderBy: [
      ["severity", "asc"],
      ["$createdAt", "desc"],
    ],
    limit,
  });
  const reports = normalizeReports(results);
  log?.(`Found ${reports.length} ${severity} report(s).`);
  return reports;
}

export async function listReportsByComponent({
  sdk,
  contractId,
  component,
  limit = MAX_QUERY_LIMIT,
  log,
}: BaseParams & { component: string }): Promise<Report[]> {
  log?.(`Loading reports for "${component}"…`);
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "report",
    where: [["component", "==", component]],
    orderBy: [
      ["component", "asc"],
      ["$createdAt", "desc"],
    ],
    limit,
  });
  const reports = normalizeReports(results);
  log?.(`Found ${reports.length} report(s) for "${component}".`);
  return reports;
}

export async function listAllReports({
  sdk,
  contractId,
  limit = MAX_QUERY_LIMIT,
  log,
}: BaseParams): Promise<Report[]> {
  log?.("Loading all reports…");
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "report",
    limit,
  });
  const reports = normalizeReports(results);
  log?.(`Found ${reports.length} report(s) total.`);
  return reports;
}

export async function findReportById({
  sdk,
  contractId,
  reportId,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  reportId: string;
  log?: Logger;
}): Promise<Report | undefined> {
  const doc = await sdk.documents.get(contractId, "report", reportId);
  if (!doc) {
    log?.(`Report ${reportId} not found.`);
    return undefined;
  }
  return toReport(reportId, doc as DashReportQueryDocument);
}
