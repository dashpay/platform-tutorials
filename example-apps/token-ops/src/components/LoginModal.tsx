import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { errorMessage } from "../dash/logger";
import { detectSecretShape } from "../lib/detectSecretShape";
import { useSession } from "../session/useSession";

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
  const [expectedIdentityId, setExpectedIdentityId] = useState("");
  const [ambiguousWif, setAmbiguousWif] = useState<string | null>(null);

  const secretShape = useMemo(
    () => (secret.trim() ? detectSecretShape(secret) : null),
    [secret],
  );
  const isWifInput = secretShape === "wif";
  const needsIdentityId = isWifInput && ambiguousWif === secret.trim();

  const resetForm = useCallback(() => {
    setSecret("");
    setIdentityIndex("0");
    setError(null);
    setSubmitting(false);
    setShowAdvanced(false);
    setExpectedIdentityId("");
    setAmbiguousWif(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const requestClose = useCallback(() => {
    if (submitting) return;
    handleClose();
  }, [submitting, handleClose]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, requestClose]);

  if (!open) return null;

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const index = Number.parseInt(identityIndex, 10);
      await session.login(secret, {
        identityIndex: Number.isNaN(index) ? 0 : index,
        ...(isWifInput && expectedIdentityId.trim()
          ? { expectedIdentityId: expectedIdentityId.trim() }
          : {}),
      });
      handleClose();
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof Error && err.name === "AmbiguousIdentityError") {
        setAmbiguousWif(secret.trim());
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        className="modal-panel login-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-capability-icon blue" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="7.5" cy="15.5" r="3.5" />
                <path d="M21 2 9.6 13.4M14.5 8.5l4 4M19 5l3 3" />
              </svg>
            </span>
            <div>
              <h4 id="login-modal-title">Sign in to TokenOps</h4>
              <p className="muted">
                Use a testnet mnemonic or HIGH/CRITICAL authentication WIF.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-button"
            aria-label="Close sign in"
            disabled={submitting}
            onClick={requestClose}
          >
            x
          </button>
        </div>

        <form className="login-modal-body" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="login-secret">Mnemonic or private key</label>
            <input
              id="login-secret"
              type="password"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={secret}
              onChange={(event) => {
                setSecret(event.target.value);
                setExpectedIdentityId("");
                setAmbiguousWif(null);
              }}
              placeholder="Mnemonic phrase or WIF private key"
            />
            <p className="muted login-modal-hint">
              Stored in memory only. The secret is used locally to sign state
              transitions.
            </p>
          </div>

          {needsIdentityId && (
            <div className="field login-advanced-field">
              <label htmlFor="login-identity-id">Identity ID</label>
              <input
                id="login-identity-id"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={expectedIdentityId}
                onChange={(event) => {
                  setExpectedIdentityId(event.target.value);
                  setError(null);
                }}
                placeholder="Full Dash Platform identity ID"
              />
              <p className="muted login-modal-hint">
                This key is associated with multiple identities. Token
                operations will be performed as this exact identity; TokenOps
                does not list identities associated with the key.
              </p>
            </div>
          )}

          {!isWifInput && (
            <>
              <button
                type="button"
                className="secondary login-advanced-toggle"
                onClick={() => setShowAdvanced((value) => !value)}
              >
                {showAdvanced ? "Hide" : "Show"} advanced settings
              </button>

              {showAdvanced && (
                <div className="field login-advanced-field">
                  <label htmlFor="login-identity-index">Identity index</label>
                  <input
                    id="login-identity-index"
                    type="number"
                    min={0}
                    value={identityIndex}
                    onChange={(event) => setIdentityIndex(event.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {error && <div className="notice error">{error}</div>}

          <p className="muted login-modal-bridge">
            Don&apos;t have a testnet identity?{" "}
            <a
              href="https://bridge.thepasta.org/"
              target="_blank"
              rel="noreferrer"
            >
              Create one on Dash Bridge
            </a>{" "}
            — funded automatically in about 30 seconds.
          </p>

          <div className="modal-actions">
            <button
              type="submit"
              disabled={
                submitting ||
                !secret.trim() ||
                (needsIdentityId && !expectedIdentityId.trim())
              }
            >
              {submitting ? "Connecting..." : "Sign in"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={submitting}
              onClick={requestClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
