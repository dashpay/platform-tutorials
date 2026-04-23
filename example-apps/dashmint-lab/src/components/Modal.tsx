/**
 * Minimal modal primitive. No library — plain conditional render,
 * backdrop click dismiss, ESC dismiss. Shared by Login, Transfer,
 * SetPrice, and Purchase modals.
 */
import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-4 transition hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 pb-4">{children}</div>
        {footer && <div className="flex gap-2 px-5 pb-5 pt-2">{footer}</div>}
      </div>
    </div>
  );
}
