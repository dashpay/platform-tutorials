import type { ReactNode } from "react";

export function ConfirmActionPanel({
  title,
  summary,
  consequence,
  confirmLabel,
  tone,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  summary: ReactNode;
  consequence: ReactNode;
  confirmLabel: string;
  tone: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className={`reassign-preview confirm-action-panel ${tone}`}>
      <div>
        <strong>{title}</strong>
        <div className="confirm-action-summary">{summary}</div>
      </div>
      <p className="reassign-warning">{consequence}</p>
      <div className="reassign-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={tone === "danger" ? "danger" : undefined}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Submitting..." : confirmLabel}
        </button>
      </div>
    </div>
  );
}
