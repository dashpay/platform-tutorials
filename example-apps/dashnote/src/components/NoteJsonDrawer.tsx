import { useEffect } from "react";

import type { NoteRecord } from "../dash/queries";

interface NoteJsonDrawerProps {
  open: boolean;
  note: NoteRecord | null;
  contractId: string | null;
  onClose: () => void;
}

export function NoteJsonDrawer({
  open,
  note,
  contractId,
  onClose,
}: NoteJsonDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !note) return null;

  const payload = {
    $id: note.id,
    $type: "note",
    $ownerId: note.ownerId,
    $dataContractId: contractId,
    $revision: note.revision,
    $createdAt: note.createdAt,
    $updatedAt: note.updatedAt,
    title: note.title,
    message: note.message,
  };

  return (
    <div
      role="dialog"
      aria-label="Document JSON"
      className="fixed inset-0 z-40 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[480px] flex-col border-l border-line bg-surface shadow-[0_30px_70px_-22px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Document
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-accent">
              rev {note.revision}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-4 hover:text-ink"
          >
            ×
          </button>
        </div>
        <pre className="flex-1 overflow-auto px-5 py-4 font-mono text-[12px] leading-[1.65] text-ink-2">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </aside>
    </div>
  );
}
