import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useWifPreview } from "../hooks/useWifPreview";
import { detectSecretShape } from "../lib/detectSecretShape";
import { errorMessage } from "../lib/logger";
import { useSession } from "../session/useSession";
import { Modal } from "./Modal";
import { OperationResultNotice } from "./OperationResultNotice";

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const session = useSession();
  const [secret, setSecret] = useState("");
  const [identityIndex, setIdentityIndex] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [useDifferentIdentity, setUseDifferentIdentity] = useState(false);
  const showRememberedPanel = Boolean(
    session.rememberedIdentityId && !useDifferentIdentity,
  );
  // Detect what the user pasted so we can hide the identity-index field for
  // single-key WIF input (where DIP-13 derivation doesn't apply).
  const secretShape = useMemo(
    () => (secret.trim() ? detectSecretShape(secret) : null),
    [secret],
  );
  const isWifInput = secretShape === "wif";
  const wifPreview = useWifPreview(session.sdk, secret, isWifInput);
  const previewBlocksLogin =
    wifPreview.status === "wrong-purpose" ||
    wifPreview.status === "key-disabled";

  useEffect(() => {
    if (open) {
      setRememberMe(true);
      setUseDifferentIdentity(false);
      setError(null);
      setSecret("");
    }
  }, [open]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const index = Number.parseInt(identityIndex, 10);
      await session.login(secret, {
        identityIndex: Number.isNaN(index) ? 0 : index,
        rememberMe,
      });
      setSecret("");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-bg">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="7.5" cy="15.5" r="3.5" />
              <path d="M21 2 9.6 13.4M14.5 8.5l4 4M19 5l3 3" />
            </svg>
          </span>
          <div>
            <div className="text-[15px] font-bold tracking-[-0.01em] text-ink">
              Sign in to Dashnote
            </div>
            <div className="text-[11px] text-ink-4">
              Connects to <span className="font-mono text-accent">testnet</span>
            </div>
          </div>
        </div>
      }
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-4 py-2">
        {showRememberedPanel && session.rememberedIdentityId && (
          <label
            data-testid="remembered-identity-panel"
            className="flex flex-col gap-1"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Identity
            </span>
            <input
              type="text"
              readOnly
              value={session.rememberedIdentityId}
              aria-label="Remembered identity"
              className="break-all rounded-md border border-line bg-bg/40 px-3 py-2 font-mono text-[12px] text-accent outline-none"
            />
            {session.dpnsName && (
              <span className="text-[10px] text-ink-4">
                ✓ {session.dpnsName}.dash
              </span>
            )}
          </label>
        )}

        {useDifferentIdentity && session.rememberedIdentityId && (
          <p
            data-testid="different-identity-notice"
            className="rounded-md border border-line bg-bg/40 px-3 py-2 text-[11px] text-ink-3"
          >
            Signing in with a different identity. The remembered identity stays
            remembered until you sign in again or forget it.
          </p>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            {showRememberedPanel
              ? "Mnemonic or Private Key"
              : "Identity Mnemonic or Private Key"}
          </span>
          <input
            type="password"
            autoComplete="off"
            required
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="Mnemonic phrase or WIF private key (high/critical)"
            className="rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
          {isWifInput && wifPreview.status !== "idle" && (
            <div
              data-testid="wif-preview"
              aria-live="polite"
              className="mt-1 min-h-[1.5em] text-[11px]"
            >
              {wifPreview.status === "checking" && (
                <span className="text-ink-4">Checking…</span>
              )}
              {wifPreview.status === "resolved" && (
                <span className="text-ink-3">
                  ✓ Identity{" "}
                  <span className="font-mono text-accent">
                    {wifPreview.dpnsName
                      ? `${wifPreview.dpnsName}.dash`
                      : `${wifPreview.identityId.slice(0, 8)}…${wifPreview.identityId.slice(-4)}`}
                  </span>
                </span>
              )}
              {wifPreview.status === "wrong-purpose" && (
                <span className="text-[color:var(--color-danger)]">
                  Found identity{" "}
                  <span className="font-mono">
                    {wifPreview.dpnsName
                      ? `${wifPreview.dpnsName}.dash`
                      : `${wifPreview.identityId.slice(0, 8)}…${wifPreview.identityId.slice(-4)}`}
                  </span>
                  , but this is a{" "}
                  {wifPreview.purposeName === "AUTHENTICATION"
                    ? `${wifPreview.securityLevelName} authentication`
                    : wifPreview.purposeName}{" "}
                  key — paste a HIGH or CRITICAL authentication key instead.
                </span>
              )}
              {wifPreview.status === "key-disabled" && (
                <span className="text-[color:var(--color-danger)]">
                  The matching key on identity{" "}
                  <span className="font-mono">
                    {wifPreview.dpnsName
                      ? `${wifPreview.dpnsName}.dash`
                      : `${wifPreview.identityId.slice(0, 8)}…${wifPreview.identityId.slice(-4)}`}
                  </span>{" "}
                  has been disabled.
                </span>
              )}
            </div>
          )}
        </label>

        <div className="flex items-center gap-1.5 text-[11px] text-ink-4">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Stored in memory only — never sent over the network.
        </div>

        {session.rememberedIdentityId && !useDifferentIdentity && (
          <div
            data-testid="remembered-identity-actions"
            className="flex flex-wrap gap-3 text-[11px]"
          >
            <button
              type="button"
              onClick={() => setUseDifferentIdentity(true)}
              className="font-medium text-accent-dim underline-offset-2 hover:text-accent hover:underline"
            >
              Use a different identity
            </button>
          </div>
        )}

        <label className="flex items-start gap-2 text-[12px] text-ink-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[color:var(--color-accent)]"
          />
          <span>Remember this identity on this device</span>
        </label>

        {!isWifInput && (
          <>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 self-start text-[11px] font-medium text-ink-3 transition hover:text-ink"
            >
              <span
                className={`inline-block transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-4 rounded-md border border-line bg-bg/40 p-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                    Identity index
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={identityIndex}
                    onChange={(event) => setIdentityIndex(event.target.value)}
                    className="w-24 rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
                  />
                </label>
              </div>
            )}
          </>
        )}

        {error && (
          <OperationResultNotice tone="error" title="Error">
            {error}
          </OperationResultNotice>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting || !secret.trim() || previewBlocksLogin}
            className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
          >
            {submitting ? "Connecting…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-3 transition hover:border-line-2 hover:text-ink-2"
          >
            Cancel
          </button>
        </div>

        {!showRememberedPanel && (
          <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-line-2 px-3.5 py-3 text-[12px] text-ink-3">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="mt-px text-accent"
              aria-hidden="true"
            >
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" />
            </svg>
            <div>
              Don&apos;t have a testnet identity?{" "}
              <a
                href="https://bridge.thepasta.org/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent underline-offset-2 hover:underline"
              >
                Create one on Dash Bridge →
              </a>
              <br />
              <span className="text-ink-4">
                Funded automatically. ~30 seconds.
              </span>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
