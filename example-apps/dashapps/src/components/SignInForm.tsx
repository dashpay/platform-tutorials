import { useEffect, useRef, useState } from "react";
import { useSession } from "../session/useSession";
import { errorMessage } from "../lib/logger";
export function SignInForm({ onClose }: { onClose(): void }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <section className="panel" aria-labelledby="sign-in-title">
      <h2 id="sign-in-title">Sign in to dashapps</h2>
      <p>
        Use an existing testnet identity. Your recovery phrase or authentication
        private key stays in memory and is never saved in browser storage.
      </p>
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
          form.reset();
          setBusy(true);
          setError("");
          try {
            await session.login(secret, {
              identityIndex,
              ...(expectedIdentityId ? { expectedIdentityId } : {}),
            });
            if (active.current) onClose();
          } catch (error) {
            if (active.current) setError(errorMessage(error));
          } finally {
            if (active.current) setBusy(false);
          }
        }}
      >
        <label htmlFor="login-secret">
          Testnet recovery phrase or private key
        </label>
        <input
          id="login-secret"
          name="secret"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={busy}
        />
        <p className="input-help">
          A single-token WIF is detected automatically. If a key belongs to more
          than one identity, enter the intended identity ID below.
        </p>
        <label htmlFor="expected-identity-id">
          Identity ID (only for an ambiguous key)
        </label>
        <input
          id="expected-identity-id"
          name="expectedIdentityId"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
        />
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
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
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
            onClick={() => {
              session.logout();
              onClose();
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
