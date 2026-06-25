import type { FormEvent } from "react";
import type { Session } from "../session/types";
import { shortId } from "../lib/format";

export function SettingsView({
  session,
  dpnsNames,
  busy,
  mnemonic,
  identityIndex,
  showAdvanced,
  contractId,
  contractInput,
  onMnemonicChange,
  onIdentityIndexChange,
  onShowAdvancedChange,
  onContractInputChange,
  onSignIn,
  onSignOut,
  onContractSubmit,
  onClearContract,
  onRegisterContract,
}: {
  session: Session | null;
  dpnsNames: Record<string, string | null>;
  busy: boolean;
  mnemonic: string;
  identityIndex: string;
  showAdvanced: boolean;
  contractId: string;
  contractInput: string;
  onMnemonicChange: (mnemonic: string) => void;
  onIdentityIndexChange: (identityIndex: string) => void;
  onShowAdvancedChange: (showAdvanced: boolean) => void;
  onContractInputChange: (contractId: string) => void;
  onSignIn: (event: FormEvent) => void;
  onSignOut: () => void;
  onContractSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClearContract: () => void;
  onRegisterContract: () => void;
}) {
  return (
    <section className="panel settings">
      <h2>Settings</h2>
      <form onSubmit={onSignIn}>
        <h3>Login</h3>
        {session ? (
          <div>
            <p>
              Identity:{" "}
              {dpnsNames[session.identityId] ? (
                <>
                  <strong>{dpnsNames[session.identityId]}</strong>{" "}
                  <code>{shortId(session.identityId)}</code>
                </>
              ) : (
                <code>{shortId(session.identityId)}</code>
              )}
            </p>
            <button type="button" onClick={onSignOut} disabled={busy}>
              Sign out
            </button>
          </div>
        ) : (
          <>
            <p className="field-note">
              Need an identity? Create one for testing with the{" "}
              <a
                href="https://bridge.thepasta.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dash bridge
              </a>
              .
            </p>
            <label>
              Identity Mnemonic
              <textarea
                value={mnemonic}
                onChange={(event) => onMnemonicChange(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !busy &&
                    mnemonic.trim()
                  ) {
                    event.preventDefault();
                    onSignIn(event);
                  }
                }}
                rows={3}
                disabled={busy}
              />
            </label>
            <button type="submit" disabled={busy || !mnemonic.trim()}>
              Sign in
            </button>
          </>
        )}
      </form>

      <button
        type="button"
        className="advanced-toggle"
        aria-expanded={showAdvanced}
        onClick={() => onShowAdvancedChange(!showAdvanced)}
      >
        <span aria-hidden="true">{showAdvanced ? "▾" : "▸"}</span> Advanced
        settings
      </button>

      {showAdvanced && (
        <div className="advanced-section">
          {!session && (
            <label className="advanced-index">
              Identity index
              <input
                type="number"
                min={0}
                value={identityIndex}
                onChange={(event) => onIdentityIndexChange(event.target.value)}
                inputMode="numeric"
                disabled={busy}
              />
              <span className="field-note">
                Usually 0. Only change this if you have multiple identities
                derived from the same mnemonic.
              </span>
            </label>
          )}

          <form onSubmit={onContractSubmit}>
            <h3>Contract</h3>
            <p>
              Current: <code>{contractId || "none"}</code>
            </p>
            <label>
              Contract ID (optional)
              <input
                name="contractId"
                value={contractInput}
                onChange={(event) => onContractInputChange(event.target.value)}
              />
            </label>
            <div className="row">
              <button type="submit">Use contract</button>
              <button type="button" onClick={onClearContract}>
                Clear
              </button>
              <button
                type="button"
                onClick={onRegisterContract}
                disabled={busy || !session}
              >
                Register new
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
