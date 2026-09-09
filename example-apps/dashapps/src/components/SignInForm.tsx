import { useEffect, useRef, useState } from "react";
import { useSession } from "../session/useSession";
import { errorMessage } from "../lib/logger";
import { detectSecretShape } from "../lib/detectSecretShape";
export function SignInForm({ onClose }: { onClose(): void }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isWif, setIsWif] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [needsIdentityId, setNeedsIdentityId] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function close() {
    if (busy) return;
    setIsWif(false);
    setShowAdvanced(false);
    setNeedsIdentityId(false);
    onClose();
  }
  return (
    <section
      className="panel login-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-title"
    >
      <header className="login-panel__header">
        <span className="login-key-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="7.5" cy="15.5" r="3.5" />
            <path d="M21 2 9.6 13.4M14.5 8.5l4 4M19 5l3 3" />
          </svg>
        </span>
        <div>
          <h2 id="sign-in-title">Sign in to dashapps</h2>
          <p>Use a testnet mnemonic or HIGH/CRITICAL authentication WIF.</p>
        </div>
        <button
          type="button"
          className="login-panel__close"
          aria-label="Close sign in"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </header>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = new FormData(form);
          const secret = String(values.get("secret") ?? "");
          const identityIndex = Number(values.get("identityIndex"));
          const expectedIdentityId = String(
            values.get("expectedIdentityId") ?? "",
          ).trim();
          setBusy(true);
          setError("");
          try {
            await session.login(secret, {
              identityIndex,
              ...(expectedIdentityId ? { expectedIdentityId } : {}),
            });
            form.reset();
            if (active.current) {
              setIsWif(false);
              setShowAdvanced(false);
              setNeedsIdentityId(false);
              onClose();
            }
          } catch (error) {
            if (active.current) {
              setError(errorMessage(error));
              if (
                error instanceof Error &&
                error.name === "AmbiguousIdentityError"
              )
                setNeedsIdentityId(true);
            }
          } finally {
            if (active.current) setBusy(false);
          }
        }}
      >
        <label htmlFor="login-secret">Mnemonic or private key</label>
        <input
          id="login-secret"
          name="secret"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={busy}
          autoFocus
          placeholder="Mnemonic phrase or WIF private key"
          onChange={(event) => {
            const shape = event.currentTarget.value.trim()
              ? detectSecretShape(event.currentTarget.value)
              : null;
            setIsWif(shape === "wif");
            setNeedsIdentityId(false);
            setError("");
          }}
        />
        <p className="input-help">
          Stored in memory only. The secret is used locally to sign state
          transitions.
        </p>
        {isWif && needsIdentityId && (
          <div className="field login-advanced-field">
            <label htmlFor="expected-identity-id">Identity ID</label>
            <input
              id="expected-identity-id"
              name="expectedIdentityId"
              autoComplete="off"
              spellCheck={false}
              placeholder="Full Dash Platform identity ID"
              required
              disabled={busy}
              onChange={() => setError("")}
            />
            <p className="input-help">
              This key belongs to multiple identities. Enter the exact identity
              you want to use.
            </p>
          </div>
        )}
        {!isWif && (
          <>
            <button
              type="button"
              className="secondary login-advanced-toggle"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? "Hide" : "Show"} advanced settings
            </button>
            {showAdvanced && (
              <div className="field login-advanced-field">
                <label htmlFor="identity-index">Identity index</label>
                <input
                  id="identity-index"
                  name="identityIndex"
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  defaultValue="0"
                  required
                  disabled={busy}
                />
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="login-bridge-callout">
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
        <div className="actions">
          <button
            disabled={
              busy || !session.connection || session.network !== "testnet"
            }
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
