import { useEffect, useMemo, useState, type FormEvent } from "react";

import { registerContract } from "../dash/contract";
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
  const [contractInput, setContractInput] = useState(session.contractId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [useDifferentIdentity, setUseDifferentIdentity] = useState(false);
  const loggedIn = session.status === "authenticated";
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

  useEffect(() => {
    setContractInput(session.contractId ?? "");
  }, [session.contractId]);

  useEffect(() => {
    if (open) {
      setRememberMe(true);
      setUseDifferentIdentity(false);
      setError(null);
      setSecret("");
    }
  }, [open]);

  function applyContractId() {
    session.setContractId(contractInput.trim() || null);
  }

  async function handleRegisterContract() {
    if (!session.sdk || !session.keyManager) return;
    setError(null);
    setRegistering(true);
    try {
      const contractId = await registerContract({
        sdk: session.sdk,
        keyManager: session.keyManager,
        log: session.log,
      });
      session.setContractId(contractId);
      setContractInput(contractId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRegistering(false);
    }
  }

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
      title={loggedIn ? "Settings" : "Login"}
    >
      {loggedIn ? (
        <div className="flex flex-col gap-4 py-2">
          <div data-testid="settings-identity-block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Identity
            </div>
            <div className="break-all rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] text-accent">
              {session.identityId ?? "—"}
            </div>
            {session.dpnsName && (
              <div className="mt-1 text-[10px] text-ink-4">
                ✓ {session.dpnsName}.dash
              </div>
            )}
            <div
              data-testid="settings-identity-actions"
              className="mt-2 flex flex-wrap gap-3 text-[11px]"
            >
              <button
                type="button"
                onClick={() => {
                  session.logout();
                }}
                className="font-medium text-accent-dim underline-offset-2 hover:text-accent hover:underline"
              >
                Use a different identity
              </button>
              {session.rememberedIdentityId && (
                <button
                  type="button"
                  onClick={() => session.forgetIdentity()}
                  className="font-medium text-ink-3 underline-offset-2 hover:text-[color:var(--color-danger)] hover:underline"
                >
                  Forget this device
                </button>
              )}
            </div>
          </div>

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
            <div className="flex flex-col gap-2 rounded-md border border-line bg-bg/40 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Contract ID
              </span>
              <input
                type="text"
                value={contractInput}
                onChange={(event) => setContractInput(event.target.value)}
                placeholder="Paste a note contract ID or register a new one"
                className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] text-ink outline-none transition focus:border-accent-dim"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyContractId}
                  disabled={contractInput.trim() === (session.contractId ?? "")}
                  className="rounded-md border border-line-2 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
                >
                  Use this ID
                </button>
                <button
                  type="button"
                  onClick={handleRegisterContract}
                  disabled={registering || !session.sdk || !session.keyManager}
                  className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
                >
                  {registering ? "Registering…" : "Register new"}
                </button>
              </div>
              <p className="text-[11px] text-ink-4">
                Register deploys a fresh note contract to testnet and switches
                Dashnote to it immediately.
              </p>
            </div>
          )}

          {error && (
            <OperationResultNotice tone="error" title="Error">
              {error}
            </OperationResultNotice>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                session.logout();
                onClose();
              }}
              className="flex-1 rounded-md border border-line-2 bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink"
            >
              Logout
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-3 transition hover:border-line-2 hover:text-ink-2"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
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
              Signing in with a different identity. The remembered identity
              stays remembered until you sign in again or forget it.
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {showRememberedPanel ? "Secret" : "Identity Secret"}
            </span>
            {!showRememberedPanel && (
              <p className="text-[11px] text-ink-3">
                Paste a recovery phrase or a WIF private key. Need an identity?
                Use the{" "}
                <a
                  href="https://bridge.thepasta.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent-dim underline underline-offset-2 hover:text-accent"
                >
                  Dash bridge
                </a>{" "}
                to create one for testing.
              </p>
            )}
            <input
              type="password"
              autoComplete="off"
              required
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder={
                showRememberedPanel
                  ? "Enter the mnemonic phrase or private key for this identity"
                  : "mnemonic phrase or private key (WIF)"
              }
              className="rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
            />
          </label>

          {session.rememberedIdentityId && (
            <div
              data-testid="remembered-identity-actions"
              className="flex flex-wrap gap-3 text-[11px]"
            >
              {!useDifferentIdentity && (
                <button
                  type="button"
                  onClick={() => setUseDifferentIdentity(true)}
                  className="font-medium text-accent-dim underline-offset-2 hover:text-accent hover:underline"
                >
                  Use a different identity
                </button>
              )}
              <button
                type="button"
                onClick={() => session.forgetIdentity()}
                className="font-medium text-ink-3 underline-offset-2 hover:text-[color:var(--color-danger)] hover:underline"
              >
                Forget this device
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
              {!isWifInput && (
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
              )}

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                  Contract ID (optional)
                </span>
                <input
                  type="text"
                  value={contractInput}
                  onChange={(event) => setContractInput(event.target.value)}
                  placeholder="Paste a Dashnote note contract ID to reuse"
                  className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] text-ink outline-none transition focus:border-accent-dim"
                />
                <button
                  type="button"
                  onClick={applyContractId}
                  disabled={contractInput.trim() === (session.contractId ?? "")}
                  className="self-start rounded-md border border-line-2 bg-transparent px-3 py-1 text-[12px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
                >
                  Use this ID
                </button>
              </div>
            </div>
          )}

          {error && (
            <OperationResultNotice tone="error" title="Error">
              {error}
            </OperationResultNotice>
          )}

          <p className="text-[11px] text-ink-4">
            Your secret stays in browser memory and is never sent or saved. Only
            the public identity ID is persisted, and only when “Remember me” is
            checked.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || !secret.trim()}
              className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
            >
              {submitting ? "Connecting…" : "Login"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-3 transition hover:border-line-2 hover:text-ink-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
