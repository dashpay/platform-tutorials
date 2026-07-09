import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { TOKEN_POSITION, registerContract } from "../dash/contract";
import { errorMessage } from "../dash/logger";
import {
  resolveTokenRef,
  type ResolvedTokenRef,
} from "../dash/resolveTokenRef";
import { fetchTokenBalance } from "../dash/token";
import { useSession } from "../session/useSession";

/**
 * The 3 initial group member identity IDs, read from env vars rather than
 * hardcoded. TokenOps registers treasury, access, and emergency groups with
 * these same members but different required power.
 */
const DEFAULT_GROUP_MEMBER_IDS = [
  import.meta.env.VITE_TOKEN_OPS_MEMBER_1_ID,
  import.meta.env.VITE_TOKEN_OPS_MEMBER_2_ID,
  import.meta.env.VITE_TOKEN_OPS_MEMBER_3_ID,
].filter((id): id is string => Boolean(id));

export function AccountView() {
  const session = useSession();
  const [mnemonic, setMnemonic] = useState("");
  const [identityIndex, setIdentityIndex] = useState("0");
  const [contractInput, setContractInput] = useState(session.contractId ?? "");
  const [groupMembers, setGroupMembers] = useState(
    DEFAULT_GROUP_MEMBER_IDS.join("\n"),
  );
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedTokenRef | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { sdk, contractId, identityId } = session;
      if (!sdk || !contractId || !identityId) {
        if (!cancelled) setBalance(null);
        return;
      }
      try {
        const value = await fetchTokenBalance({
          sdk,
          contractId,
          identityId,
        });
        if (!cancelled) setBalance(value);
      } catch {
        if (!cancelled) setBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);
    setBusy(true);
    try {
      await session.login(mnemonic, Number(identityIndex) || 0);
      setMnemonic("");
    } catch (err) {
      setLocalError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleContractSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk) return;
    setLocalError(null);
    setResolved(null);
    const input = contractInput.trim();
    if (!input) return;

    setResolving(true);
    try {
      const ref = await resolveTokenRef(session.sdk, input);
      if (ref.tokenPosition !== TOKEN_POSITION) {
        // The app drives the token at TOKEN_POSITION; a token elsewhere on a
        // multi-token contract isn't something TokenOps can operate.
        setLocalError(
          `That token is at position ${ref.tokenPosition} on its contract. TokenOps operates the token at position ${TOKEN_POSITION}.`,
        );
        return;
      }
      session.setContractId(ref.contractId);
      setContractInput(ref.contractId);
      setResolved(ref);
    } catch (err) {
      setLocalError(errorMessage(err));
    } finally {
      setResolving(false);
    }
  }

  async function handleRegisterContract() {
    if (!session.sdk || !session.keyManager) {
      setLocalError("Sign in before registering a contract.");
      return;
    }
    const groupMemberIds = groupMembers
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    if (groupMemberIds.length !== 3) {
      setLocalError(
        "Enter exactly three TokenOps group member identity IDs before registering a contract.",
      );
      return;
    }
    if (new Set(groupMemberIds).size !== groupMemberIds.length) {
      setLocalError("Group member identity IDs must be distinct.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const id = await registerContract({
        sdk: session.sdk,
        keyManager: session.keyManager,
        groupMemberIds,
        log: session.log,
      });
      session.setContractId(id);
      setContractInput(id);
      setRegistering(false);
    } catch (err) {
      setLocalError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {localError && <div className="notice error">{localError}</div>}
      {session.status === "authenticated" ? (
        <div className="card">
          <h3>Signed in</h3>
          <p className="row">
            Identity: <CopyableId id={session.identityId} />
          </p>
          {balance != null && (
            <p>
              Token balance: <strong>{balance.toString()}</strong>
            </p>
          )}
          <button type="button" className="secondary" onClick={session.logout}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="card">
          <h3>Sign in</h3>
          <form onSubmit={handleSignIn}>
            <div className="field">
              <label htmlFor="mnemonic">Mnemonic</label>
              <textarea
                id="mnemonic"
                rows={2}
                value={mnemonic}
                onChange={(event) => setMnemonic(event.target.value)}
                placeholder="twelve word mnemonic phrase…"
              />
            </div>
            <div className="field">
              <label htmlFor="identity-index">
                Identity index (0 = owner, 1-3 = group members)
              </label>
              <input
                id="identity-index"
                type="number"
                min={0}
                value={identityIndex}
                onChange={(event) => setIdentityIndex(event.target.value)}
              />
            </div>
            <button type="submit" disabled={busy || !mnemonic.trim()}>
              Sign in
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Contract</h3>
        <form onSubmit={handleContractSubmit} className="row">
          <input
            value={contractInput}
            onChange={(event) => setContractInput(event.target.value)}
            placeholder="Contract or token ID"
          />
          <button type="submit" disabled={resolving}>
            {resolving ? "Resolving…" : "Use"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Paste either a data contract ID or a token ID — a token ID is resolved
          back to its contract.
        </p>
        {resolved &&
          (resolved.resolvedFrom === "token" ? (
            <p className="notice info" style={{ marginTop: "0.5rem" }}>
              Resolved token{" "}
              <CopyableId id={resolved.tokenId} explorer="token" /> to contract{" "}
              <CopyableId id={resolved.contractId} explorer="dataContract" />.
            </p>
          ) : (
            <p className="notice info" style={{ marginTop: "0.5rem" }}>
              Using contract{" "}
              <CopyableId id={resolved.contractId} explorer="dataContract" />.
            </p>
          ))}
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              session.setContractId(null);
              setContractInput("");
              setResolved(null);
            }}
          >
            Clear override
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Register a new contract</h3>
        {!registering ? (
          <>
            <p className="muted">
              Deploy a fresh TokenOps contract with one token and three initial
              groups.
            </p>
            <button
              type="button"
              className="secondary"
              style={{ marginTop: "0.75rem" }}
              onClick={() => {
                setLocalError(null);
                setRegistering(true);
              }}
              disabled={busy || !session.keyManager}
            >
              Register new TokenOps contract…
            </button>
            {!session.keyManager && (
              <p className="notice info" style={{ marginTop: "0.75rem" }}>
                Sign in before registering a new contract.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="group-members">
                Initial group member identity IDs
              </label>
              <textarea
                id="group-members"
                rows={3}
                value={groupMembers}
                onChange={(event) => setGroupMembers(event.target.value)}
                placeholder="three identity IDs, one per line"
              />
            </div>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              Registering creates one TokenOps token and three initial groups
              from these identity IDs. Treasury handles mint/burn, access
              handles freeze/unfreeze, and emergency handles pause/resume and
              destroy-frozen actions. The signing identity receives the initial
              token supply.
            </p>
            <div className="row" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                onClick={handleRegisterContract}
                disabled={busy || !session.keyManager}
              >
                {busy ? "Registering…" : "Register contract"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setRegistering(false);
                  setLocalError(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
