import { useState } from "react";
import { useSession } from "../session/useSession";
import { errorMessage } from "../lib/logger";
export function SettingsView() {
  const session = useSession();
  const [value, setValue] = useState(session.registryId);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <section className="panel">
      <h1>Settings</h1>
      <p>
        Registry selection for <strong>{session.network}</strong>. Each network
        has its own saved selection.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          try {
            const persisted = session.setRegistryId(value);
            setNotice(
              persisted
                ? "Registry selection saved."
                : "Registry selection applied for this session. Browser storage is unavailable.",
            );
          } catch (error) {
            setError(errorMessage(error));
          }
        }}
      >
        <label htmlFor="registry-id">Registry contract ID</label>
        <div className="input-row">
          <input
            id="registry-id"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
              setNotice("");
            }}
            placeholder="Base58 registry contract ID"
            spellCheck={false}
          />
          <button>Save registry</button>
        </div>
        <p>
          Leave blank to clear the override and use this network&apos;s default,
          when available.
        </p>
        <p>
          This selects the registry used for metadata entries. It does not
          change the contracts you browse through Keyword Search.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
      </form>
      <p>Testnet includes a validated default registry. Mainnet remains read-only.</p>
    </section>
  );
}
