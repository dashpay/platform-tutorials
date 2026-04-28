/**
 * Login form — collects a BIP39 mnemonic + identity index.
 * The mnemonic is passed to session.login() and goes out of scope
 * as soon as the async call returns. Never stored.
 */
import { useEffect, useState, type FormEvent } from "react";
import { registerContract } from "../dash/contract";
import { errorMessage } from "../dash/logger";
import { useSession } from "../session/useSession";
import { Modal } from "./Modal";

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const session = useSession();
  const [mnemonic, setMnemonic] = useState("");
  const [identityIndex, setIdentityIndex] = useState("0");
  const [contractInput, setContractInput] = useState(session.contractId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loggedIn = session.status === "authenticated";
  const [registering, setRegistering] = useState(false);

  // Keep the input in sync when session.contractId changes (e.g. after
  // Register-contract) so the modal always shows the current value.
  useEffect(() => {
    setContractInput(session.contractId ?? "");
  }, [session.contractId]);

  function handleApplyContract() {
    const trimmed = contractInput.trim();
    if (!trimmed) {
      session.setContractId(null);
      return;
    }
    session.setContractId(trimmed);
  }

  async function handleRegisterContract() {
    if (!session.sdk || !session.keyManager) return;
    setRegistering(true);
    try {
      const id = await registerContract({
        sdk: session.sdk,
        keyManager: session.keyManager,
        log: session.log,
      });
      session.setContractId(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRegistering(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const idx = parseInt(identityIndex, 10);
      await session.login(mnemonic, Number.isNaN(idx) ? 0 : idx);
      setMnemonic("");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    session.logout();
    onClose();
  }

  return (
    <Modal
      open={open}
      title={loggedIn ? "Settings" : "Login"}
      onClose={onClose}
    >
      {loggedIn ? (
        <div className="flex flex-col gap-4 py-2">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Identity
            </div>
            <div className="break-all rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] text-accent">
              {session.identityId ?? "—"}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Contract ID
            </span>
            <input
              type="text"
              value={contractInput}
              onChange={(e) => setContractInput(e.target.value)}
              placeholder="Paste a contract ID or register a new one"
              className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] text-ink outline-none transition focus:border-accent-dim"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApplyContract}
                disabled={contractInput.trim() === (session.contractId ?? "")}
                className="rounded-md border border-line-2 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
              >
                Use this ID
              </button>
              <button
                type="button"
                onClick={handleRegisterContract}
                disabled={registering}
                className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
              >
                {registering ? "Registering…" : "Register new"}
              </button>
            </div>
            <p className="text-[11px] text-ink-4">
              Register deploys a fresh NFT card contract to testnet (one-time).
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] text-danger">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleLogout}
              className="flex-1 rounded-md border border-line-2 bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink"
            >
              Logout
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-3 transition hover:border-line-2 hover:text-ink-2"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Identity Mnemonic
            </span>
            <p className="text-[11px] text-ink-3">
              Need an identity? Use the{" "}
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
            <input
              type="password"
              autoComplete="off"
              required
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="mnemonic phrase"
              className="rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
            />
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
            <div className="flex flex-col gap-4 rounded-md border border-line bg-bg/30 p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                  Identity index
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={identityIndex}
                    onChange={(e) => setIdentityIndex(e.target.value)}
                    className="w-24 rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
                  />
                  <span className="group relative cursor-help">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="size-5 text-ink-4 transition group-hover:text-ink-2"
                    >
                      <path
                        fillRule="evenodd"
                        d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-6 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.293 5.293a1 1 0 1 1 .324 1.647.5.5 0 0 0-.617.489v.671a.75.75 0 0 0 1.5 0v-.105a2.5 2.5 0 1 0-3.056-3.282.75.75 0 0 0 1.414.498 1 1 0 0 1 .435-.918Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-48 -translate-x-1/2 rounded-md bg-surface-2 px-2.5 py-1.5 text-[10px] font-normal normal-case tracking-normal text-ink-2 opacity-0 shadow-[0_12px_28px_-8px_rgba(0,0,0,0.6)] transition group-hover:opacity-100">
                      Usually 0. Only change this if you have multiple
                      identities derived from the same mnemonic.
                    </span>
                  </span>
                </div>
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                  Contract ID (optional)
                </span>
                <input
                  type="text"
                  value={contractInput}
                  onChange={(e) => setContractInput(e.target.value)}
                  placeholder="Default testnet contract used if blank"
                  className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-[12px] text-ink outline-none transition focus:border-accent-dim"
                />
                <button
                  type="button"
                  onClick={handleApplyContract}
                  disabled={contractInput.trim() === (session.contractId ?? "")}
                  className="self-start rounded-md border border-line-2 bg-transparent px-3 py-1 text-[12px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
                >
                  Use this ID
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] text-danger">
              {error}
            </div>
          )}

          <p className="text-[11px] text-ink-4">
            Your mnemonic stays in browser memory and is never sent anywhere.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || !mnemonic.trim()}
              className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
            >
              {submitting ? "Connecting…" : "Login"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-3 transition hover:border-line-2 hover:text-ink-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
