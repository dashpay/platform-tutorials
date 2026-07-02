import { useEffect, useState } from "react";

import { errorMessage } from "../dash/logger";
import { fetchCreditBalance } from "../dash/researcherCredit";
import { submitReport, type ReportSeverity } from "../dash/submitReport";
import { bytesToBase64, hashFile } from "../lib/hash";
import { useSession } from "../session/useSession";

const SEVERITIES: ReportSeverity[] = ["low", "medium", "high", "critical"];

export function SubmitReportForm({
  onSubmitted,
}: {
  onSubmitted?: () => void;
}) {
  const session = useSession();
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<ReportSeverity>("medium");
  const [component, setComponent] = useState("");
  const [description, setDescription] = useState("");
  const [pocFile, setPocFile] = useState<File | null>(null);
  const [pocHash, setPocHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { sdk, contractId, identityId } = session;
      if (!sdk || !contractId || !identityId) {
        if (!cancelled) setBalance(null);
        return;
      }
      try {
        const value = await fetchCreditBalance({ sdk, contractId, identityId });
        if (!cancelled) setBalance(value);
      } catch {
        if (!cancelled) setBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, status]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPocFile(file);
    setPocHash(null);
    if (!file) return;
    try {
      const bytes = await hashFile(file);
      setPocHash(bytesToBase64(bytes));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk || !session.keyManager) {
      setError("Sign in before submitting a report.");
      return;
    }
    if (!session.contractId) {
      setError("Register or select a bounty contract first (Account tab).");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await submitReport({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        report: {
          title,
          severity,
          component,
          description,
          pocHash: pocHash ?? undefined,
        },
        log: session.log,
      });
      setStatus("Report filed.");
      setTitle("");
      setComponent("");
      setDescription("");
      setPocFile(null);
      setPocHash(null);
      onSubmitted?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const noCredits = balance != null && balance <= 0n;

  return (
    <div className="card">
      <h3>Submit a bug report</h3>
      {balance != null && (
        <p className="muted">
          Researcher Credit balance: <strong>{balance.toString()}</strong> —
          filing costs 1 credit.
        </p>
      )}
      {error && <div className="notice error">{error}</div>}
      {status && <div className="notice info">{status}</div>}
      {noCredits && (
        <div className="notice error">
          No Researcher Credits remaining — ask the program operator to transfer
          some to your identity before filing.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={128}
            />
          </div>
          <div className="field">
            <label htmlFor="severity">Severity</label>
            <select
              id="severity"
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as ReportSeverity)
              }
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="component">Affected component</label>
          <input
            id="component"
            value={component}
            onChange={(event) => setComponent(event.target.value)}
            required
            maxLength={63}
          />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={2000}
          />
        </div>
        <div className="field">
          <label htmlFor="poc">
            Proof-of-concept file (optional, hashed locally)
          </label>
          <input id="poc" type="file" onChange={handleFileChange} />
          {pocFile && pocHash && (
            <p className="muted">
              SHA-256 (base64): <code>{pocHash}</code>
            </p>
          )}
        </div>
        <button type="submit" disabled={busy || noCredits}>
          {busy ? "Filing…" : "File report (1 credit)"}
        </button>
      </form>
    </div>
  );
}
