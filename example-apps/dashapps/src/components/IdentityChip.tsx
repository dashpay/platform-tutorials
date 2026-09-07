import { useState } from "react";
import { useSession } from "../session/useSession";
import { errorMessage } from "../lib/logger";
export function IdentityChip() {
  const session = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!session.identityId) return null;
  return (
    <section className="identity" aria-label="Signed-in identity">
      <p>
        {session.identityName && (
          <strong>{session.identityName}.dash · </strong>
        )}
        <code>{session.identityId}</code>
      </p>
      <p>
        Balance:{" "}
        {session.balance === null
          ? "Unavailable"
          : `${session.balance.toLocaleString()} credits`}
      </p>
      <div className="actions">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await session.refreshBalance();
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Refresh balance
        </button>
        <button onClick={session.logout}>Sign out</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
