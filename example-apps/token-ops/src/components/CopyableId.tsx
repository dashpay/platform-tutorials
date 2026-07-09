import { useState } from "react";

import { explorerUrl, type ExplorerKind } from "../lib/explorer";
import { shortId } from "../lib/format";

/**
 * Renders a truncated identity ID. Two modes:
 *
 * - Default (no `explorer`): the whole truncated id is a click-to-copy button.
 *   Every group action needs the full 44-char base58 id typed into a form, so a
 *   purely truncated display gives the user nothing to act on — clicking copies
 *   the full id. Used in tables and compact rows.
 * - With `explorer`: the id text becomes a link to Platform Explorer and a
 *   separate copy button sits beside it. Used where the id identifies a
 *   top-level resource (contract, token) worth inspecting on-chain.
 *
 * A brief "copied" label confirms the copy without a persistent icon.
 */
export function CopyableId({
  id,
  len = 6,
  explorer,
}: {
  id: string | null | undefined;
  len?: number;
  explorer?: ExplorerKind;
}) {
  const [copied, setCopied] = useState(false);
  const displayLen = Math.min(len, 6);

  if (!id) return <span className="copyable-id empty">—</span>;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(id as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — no-op.
      // The full id is still in the title attribute for manual selection.
    }
  }

  if (explorer) {
    return (
      <span className="copyable-id-link-group">
        <a
          className="copyable-id-link"
          href={explorerUrl(explorer, id)}
          target="_blank"
          rel="noreferrer"
          title={`${id} — view on Platform Explorer`}
        >
          <code>{shortId(id, displayLen)}</code>
        </a>
        <button
          type="button"
          className="copyable-id-copy"
          title="Copy full ID"
          aria-label="Copy full ID"
          onClick={handleCopy}
        >
          {copied ? "✓" : "Copy"}
        </button>
      </span>
    );
  }

  return (
    <button type="button" className="copyable-id" title={id} onClick={handleCopy}>
      <code>{shortId(id, displayLen)}</code>
      {copied && <span className="copyable-id-status"> copied</span>}
    </button>
  );
}
