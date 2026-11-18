import { useEffect, useRef, useState } from "react";

/** Escape closes the dialog; focus returns to its opener once it is gone. */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const [opener] = useState(() => document.activeElement);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      // Deferred so the click that closed the dialog cannot take focus back.
      setTimeout(() => {
        if (!dialog?.isConnected && opener instanceof HTMLElement)
          opener.focus();
      });
    };
  }, [opener]);
  return ref;
}
