import { useEffect, useRef, useState } from "react";

export function ContractCopyButton({
  contractId,
  className,
}: {
  contractId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (resetTimer.current !== undefined)
        window.clearTimeout(resetTimer.current);
    },
    [],
  );
  async function copy() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(contractId);
      setCopied(true);
      if (resetTimer.current !== undefined)
        window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      className={className}
      title={contractId}
      aria-label={copied ? "Contract ID copied" : "Copy contract ID"}
      aria-live="polite"
      onClick={() => void copy()}
    >
      {copied
        ? "Copied ✓"
        : `${contractId.slice(0, 6)}…${contractId.slice(-4)} · Copy`}
    </button>
  );
}
