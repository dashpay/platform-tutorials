import { useState } from "react";

import { shortId } from "../lib/format";

/**
 * Renders a truncated identity ID that copies the FULL id to the clipboard
 * on click. Every group action (propose/co-sign a freeze/unfreeze/destroy,
 * rotate the panel roster) needs the full 44-char base58 id typed into a
 * form — a purely truncated <code>{shortId(id)}</code> display gives the
 * user nothing to actually act on.
 */
export function CopyableId({
  id,
  len = 10,
}: {
  id: string | null | undefined;
  len?: number;
}) {
  const [copied, setCopied] = useState(false);

  if (!id) return <code>—</code>;

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(id as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — no-op.
      // The full id is still in the title attribute for manual selection.
    }
  }

  return (
    <button
      type="button"
      className="secondary copyable-id"
      title={id}
      onClick={handleClick}
    >
      <code>{shortId(id, len)}</code>
      <span className="muted"> {copied ? "✓ copied" : "⧉"}</span>
    </button>
  );
}
