import { useEffect, useState } from "react";

import { errorMessage } from "../dash/logger";
import { listReportsByOwner, type Report } from "../dash/queries";
import { updateReport } from "../dash/updateReport";
import { formatDate, severityLabel } from "../lib/format";
import { useSession } from "../session/useSession";

export function MyReportsView() {
  const session = useSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!session.sdk || !session.contractId || !session.identityId) {
      setReports([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await listReportsByOwner({
        sdk: session.sdk,
        contractId: session.contractId,
        ownerId: session.identityId,
      });
      setReports(results);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId, session.identityId]);

  function startEdit(report: Report) {
    setEditingId(report.id);
    setEditDescription(report.description);
  }

  async function saveEdit(reportId: string) {
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    setBusy(true);
    setError(null);
    try {
      await updateReport({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        reportId,
        updates: { description: editDescription },
        log: session.log,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (session.status !== "authenticated") {
    return <div className="notice info">Sign in to see your reports.</div>;
  }

  return (
    <div>
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
            <p className="muted">
              {report.component} · filed {formatDate(report.createdAt)}
            </p>
            {editingId === report.id ? (
              <>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
                <div className="row" style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveEdit(report.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>{report.description}</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => startEdit(report)}
                >
                  Edit
                </button>
              </>
            )}
          </div>
        ))}
        {!loading && reports.length === 0 && (
          <p className="muted">You haven't filed any reports yet.</p>
        )}
      </div>
    </div>
  );
}
