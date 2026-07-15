import { useState } from "react";

import { CopyableId } from "./CopyableId";

export function IdentityLabel({
  id,
  dpnsNames,
  len = 8,
}: {
  id: string | null | undefined;
  dpnsNames: Record<string, string | null>;
  len?: number;
}) {
  const [copied, setCopied] = useState(false);
  if (!id) return <CopyableId id={id} len={len} />;

  const name = dpnsNames[id];
  if (!name) return <CopyableId id={id} len={len} />;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(id as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable. The full id remains available in title.
    }
  }

  return (
    <button
      type="button"
      className="copyable-id identity-label"
      title={`${id} - copy full identity ID`}
      onClick={handleCopy}
    >
      <code>@{name}</code>
      {copied && <span className="copyable-id-status"> copied</span>}
    </button>
  );
}
