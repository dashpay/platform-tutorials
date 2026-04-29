/**
 * Minimal modal primitive. No library — plain conditional render,
 * backdrop click dismiss, ESC dismiss. Shared by Login, Transfer,
 * SetPrice, and Purchase modals.
 */
import { useEffect, useId, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  panelClassName,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] outline-none ${panelClassName ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <h2
            id={titleId}
            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4"
          >
            {title}
          </h2>
          <button
            type="button"
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
