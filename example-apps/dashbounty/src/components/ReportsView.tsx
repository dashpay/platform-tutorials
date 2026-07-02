import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { errorMessage } from "../dash/logger";
import {
  listAllReports,
  listReportsByComponent,
  listReportsBySeverity,
  type Report,
} from "../dash/queries";
import { fetchFrozenStatus } from "../dash/frozenStatus";
import { formatDate, severityLabel } from "../lib/format";
import { useSession } from "../session/useSession";
import type { ReportSeverity } from "../dash/submitReport";

export function ReportsView() {
  const session = useSession();
  const [severityFilter, setSeverityFilter] = useState<ReportSeverity | "">("");
  const [componentFilter, setComponentFilter] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [frozenOwners, setFrozenOwners] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { sdk, contractId } = session;
      if (!sdk || !contractId) {
        if (!cancelled) setReports([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const trimmedComponent = componentFilter.trim();
        const results = trimmedComponent
          ? await listReportsByComponent({
              sdk,
              contractId,
              component: trimmedComponent,
            })
          : severityFilter
            ? await listReportsBySeverity({
                sdk,
                contractId,
                severity: severityFilter,
              })
            : await listAllReports({ sdk, contractId });
        if (cancelled) return;
        setReports(results);

        const owners = [...new Set(results.map((r) => r.ownerId))];
        const frozen = new Set<string>();
        await Promise.all(
          owners.map(async (ownerId) => {
            try {
              const isFrozen = await fetchFrozenStatus({
                sdk,
                contractId,
                identityId: ownerId,
              });
              if (isFrozen) frozen.add(ownerId);
            } catch {
              // best-effort; leave unmarked on failure
            }
          }),
        );
        if (!cancelled) setFrozenOwners(frozen);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, severityFilter, componentFilter]);

  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="filter-severity">Filter by severity</label>
            <select
              id="filter-severity"
              value={severityFilter}
              onChange={(event) => {
                setSeverityFilter(event.target.value as ReportSeverity | "");
                setComponentFilter("");
              }}
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="filter-component">Filter by component</label>
            <input
              id="filter-component"
              value={componentFilter}
              onChange={(event) => {
                setComponentFilter(event.target.value);
                setSeverityFilter("");
              }}
              placeholder="e.g. Auth"
            />
          </div>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      <div className="list">
        {reports.map((report) => (
          <div key={report.id} className="card">
            <div className="row between">
              <strong>{report.title}</strong>
              <span className={`badge ${report.severity}`}>
                {severityLabel(report.severity)}
              </span>
            </div>
            <p className="muted">{report.component}</p>
            <p>{report.description}</p>
            <div className="row between">
              <span className="muted row">
                <CopyableId id={report.ownerId} len={6} /> ·{" "}
                {formatDate(report.createdAt)}
              </span>
              {frozenOwners.has(report.ownerId) && (
                <span className="badge frozen">Reporter frozen</span>
              )}
            </div>
          </div>
        ))}
        {!loading && reports.length === 0 && (
          <p className="muted">No reports found.</p>
        )}
      </div>
    </div>
  );
}
