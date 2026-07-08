import { useState } from "react";

import { shortId } from "../lib/format";

/**
 * Renders a truncated identity ID as plain monospace text that copies the
 * FULL id to the clipboard on click. Every group action (propose/co-sign
 * suspend/restore/revoke) needs the full 44-char base58 id typed into a
 * form — a purely truncated {shortId(id)} display gives the user nothing to
 * actually act on. Hover tints the text to signal it is clickable; a brief
 * "copied" label confirms the copy without a persistent icon.
 */
export function CopyableId({
  id,
  len = 6,
}: {
  id: string | null | undefined;
  len?: number;
}) {
  const [copied, setCopied] = useState(false);
  const displayLen = Math.min(len, 6);

  if (!id) return <span className="copyable-id empty">—</span>;

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
      className="copyable-id"
      title={id}
      onClick={handleClick}
    >
      <code>{shortId(id, displayLen)}</code>
      {copied && <span className="copyable-id-status"> copied</span>}
    </button>
  );
}
