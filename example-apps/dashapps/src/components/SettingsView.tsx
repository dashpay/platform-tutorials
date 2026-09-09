import { useState } from "react";
import { useSession } from "../session/useSession";
import { errorMessage } from "../lib/logger";
import { registerContract } from "../dash/contract";

export function SettingsView() {
  const session = useSession();
  const [value, setValue] = useState(session.registryId);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [registering, setRegistering] = useState(false);

  function save() {
    setError("");
    try {
      const persisted = session.setRegistryId(value);
      setNotice(
        persisted
          ? "Registry selection saved."
          : "Registry selection applied for this session. Browser storage is unavailable.",
      );
      setEditing(false);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function register() {
    if (!session.connection || !session.keyManager || registering) return;
    setRegistering(true);
    setError("");
    setNotice("");
    try {
      const result = await registerContract({
        sdk: session.connection.sdk,
        keyManager: session.keyManager,
      });
      session.setRegistryId(result.id);
      setValue(result.id);
      setNotice(
        result.seedFailures.length
          ? `Registry registered and selected: ${result.id}. Added ${result.seeded} of 5 system contract entries.`
          : `Registry registered and selected with ${result.seeded} system contract entries: ${result.id}`,
      );
      if (result.seedFailures.length) {
        setError(
          `Could not add: ${result.seedFailures.map(({ name }) => name).join(", ")}.`,
        );
      }
      void session.refreshBalance().catch(() => undefined);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRegistering(false);
    }
  }

  return (
    <section className="settings-page">
      <p className="settings-label">Registry</p>
      <form
        className="settings-group"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="settings-row registry-setting">
          <strong>{session.network}</strong>
          <div className="registry-value">
            {editing ? (
              <label>
                <span className="sr-only">Registry contract ID</span>
                <input
                  id="registry-id"
                  aria-label="Registry contract ID"
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setError("");
                    setNotice("");
                  }}
                  placeholder="Base58 registry contract ID"
                  spellCheck={false}
                />
              </label>
            ) : (
              <>
                <code>{session.registryId || "Not set"}</code>
                <small>
                  {session.registryId ? "Connected" : "No registry configured"}
                </small>
              </>
            )}
          </div>
          {editing ? (
            <button type="submit">Save registry</button>
          ) : (
            <button type="button" onClick={() => setEditing(true)}>
              {session.registryId ? "Change" : "Set"}
            </button>
          )}
        </div>
      </form>
      <p className="settings-help">
        Point the app at a different registry contract for this network.
        Changing it reloads everything you’re viewing.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}

      <p className="settings-label">Advanced</p>
      <div className="settings-row">
        <div>
          <strong>Publish a new registry</strong>
          <small>
            Creates and selects a registry owned by your signed-in identity.
            Costs testnet credits.
          </small>
        </div>
        <button
          type="button"
          disabled={
            session.network !== "testnet" || !session.keyManager || registering
          }
          onClick={() => void register()}
        >
          {registering ? "Publishing…" : "Publish"}
        </button>
      </div>
    </section>
  );
}
