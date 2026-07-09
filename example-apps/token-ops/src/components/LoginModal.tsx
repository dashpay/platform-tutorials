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

  const secretShape = useMemo(
    () => (secret.trim() ? detectSecretShape(secret) : null),
    [secret],
  );
  const isWifInput = secretShape === "wif";

  const resetForm = useCallback(() => {
    setSecret("");
    setError(null);
    setSubmitting(false);
    setShowAdvanced(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const index = Number.parseInt(identityIndex, 10);
      await session.login(secret, {
        identityIndex: Number.isNaN(index) ? 0 : index,
      });
      handleClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
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
            onClick={handleClose}
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
              autoComplete="off"
              spellCheck={false}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Mnemonic phrase or WIF private key"
            />
            <p className="muted login-modal-hint">
              Stored in memory only. The secret is used locally to sign state
              transitions.
            </p>
          </div>

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
                  <label htmlFor="login-identity-index">
                    Identity index (0 = owner, 1-3 = group members)
                  </label>
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

          <div className="modal-actions">
            <button type="submit" disabled={submitting || !secret.trim()}>
              {submitting ? "Connecting..." : "Sign in"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={submitting}
              onClick={handleClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
