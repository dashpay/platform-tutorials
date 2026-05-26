import { useEffect, useId, useRef, type ReactNode } from "react";

interface MobileActionSheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function MobileActionSheet({
  open,
  title,
  children,
  onClose,
}: MobileActionSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;

    function focusableElements() {
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
    }

    const firstFocusable = focusableElements()[0];
    (firstFocusable ?? dialog)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      onClick={onClose}
      data-testid="mobile-action-sheet-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full rounded-2xl border border-line bg-surface p-2 shadow-[0_22px_60px_-24px_rgba(0,0,0,0.65)] outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id={titleId}
          className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4"
        >
          {title}
        </h2>
        <div className="py-1">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-surface-2 px-4 py-3 text-[15px] font-semibold text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
