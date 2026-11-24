import { useCallback, useState } from "react";

/**
 * An inline sign-in form that replaces its card's "Sign in" button; closing
 * the form focuses the button again, since the dialog's opener is gone.
 */
export function useInlineSignIn() {
  const [state, setState] = useState<"idle" | "open" | "closed">("idle");
  const button = useCallback(
    (node: HTMLButtonElement | null) => {
      if (state === "closed") node?.focus();
    },
    [state],
  );
  return {
    signingIn: state === "open",
    button,
    open: () => setState("open"),
    close: () => setState("closed"),
  };
}
