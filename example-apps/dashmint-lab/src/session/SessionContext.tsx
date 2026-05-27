/**
 * Session state for the app.
 *
 * Holds the connected SDK, the IdentityKeyManager (when logged in), the
 * current contract ID, and an in-memory activity log. Components read this
 * via useSession() to get what they need for Platform operations.
 *
 * Security note: the BIP39 mnemonic is never stored on the session object
 * or in localStorage. It lives only inside IdentityKeyManager's closure
 * during login() and goes out of scope as soon as login() returns. logout()
 * drops the keyManager reference so the keys are garbage-collected.
 *
 * What IS persisted: the contract ID, under localStorage['dashmint-lab.contractId'].
 * Contract IDs are public (anyone querying the network sees them), so storing
 * them is a UX win with no security cost.
 */
import { toast } from "sonner";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearStoredContractId,
  fetchContractOwnerId,
  loadStoredContractId,
  saveContractId,
} from "../dash/contractStorage";
import { errorMessage, type Logger } from "../dash/logger";
import { fetchDashMintTokenBalance } from "../dash/dashMintToken";
import type { DashKeyManager, DashSdk } from "../dash/types";

// The SDK + IdentityKeyManager pull in @dashevo/evo-sdk (and its ~8MB WASM
// bundle), so we load them lazily on first use to keep the app shell off
// the critical path. Cached after first call.
let sdkModulePromise: Promise<{
  createClient: (network: string) => Promise<DashSdk>;
  IdentityKeyManager: typeof import("../../../../setupDashClient-core.mjs").IdentityKeyManager;
}> | null = null;
function loadSdkModule() {
  if (!sdkModulePromise) {
    sdkModulePromise = import("../../../../setupDashClient-core.mjs").catch(
      (err) => {
        // Clear the cache on failure so a subsequent connect/login retry
        // can re-attempt the import (e.g., after a transient chunk fetch
        // failure). Without this, every retry would await the same
        // rejected promise and fail immediately.
        sdkModulePromise = null;
        throw err;
      },
    );
  }
  return sdkModulePromise;
}

export type SessionStatus =
  | "idle"
  | "connecting"
  | "browsing"
  | "authenticated"
  | "error";

export interface SessionValue {
  status: SessionStatus;
  error: string | null;

  /** Connected EvoSDK instance (undefined before connect). */
  sdk: DashSdk | null;

  /** Identity key manager. Null in browse-only mode or logged out. */
  keyManager: DashKeyManager | null;

  /** The signed-in identity ID, or null in browse-only mode. */
  identityId: string | null;

  /** Active contract ID. Loaded from localStorage on mount. */
  contractId: string | null;

  /** Owner identity ID of the active contract (fetched from Platform). */
  contractOwnerId: string | null;

  /** Signed-in identity's credit balance. Null while loading or logged out. */
  balance: bigint | null;

  /** Signed-in identity's DashMint token balance. Null if unavailable. */
  dashMintTokenBalance: bigint | null;

  /** Refetch the balance. Called by App's `refresh` after mutations. */
  refreshBalance: () => void;

  /** Replaces the active contract ID and persists it. */
  setContractId: (id: string | null) => void;

  /** Logger callback threaded through every src/dash/* op. */
  log: Logger;

  /** Log in with a BIP39 mnemonic. */
  login: (mnemonic: string, identityIndex?: number) => Promise<void>;

  /** Connect in browse-only mode (no mnemonic). */
  browseOnly: () => Promise<void>;

  /** Log out. Keeps the connected SDK so read queries still work. */
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);
export { SessionContext };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sdk, setSdk] = useState<DashSdk | null>(null);
  const [keyManager, setKeyManager] = useState<DashKeyManager | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [contractId, setContractIdState] = useState<string | null>(() =>
    loadStoredContractId(),
  );
  const [contractOwnerId, setContractOwnerId] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [dashMintTokenBalance, setDashMintTokenBalance] = useState<
    bigint | null
  >(null);
  const [balanceNonce, setBalanceNonce] = useState(0);
  const refreshBalance = useCallback(() => {
    setBalanceNonce((n) => n + 1);
  }, []);
  const log = useCallback<Logger>((message, level = "info") => {
    const method =
      level === "error" ? "error" : level === "success" ? "info" : "log";
    console[method](`[${level}] ${message}`);
    if (level === "success") toast.success(message);
    else if (level === "error") toast.error(message);
  }, []);

  // Resolve the contract owner whenever sdk or contractId changes.
  useEffect(() => {
    if (!sdk || !contractId) return;
    let cancelled = false;
    fetchContractOwnerId({ sdk, contractId })
      .then((ownerId) => {
        if (!cancelled) setContractOwnerId(ownerId);
      })
      .catch(() => {
        if (!cancelled) setContractOwnerId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, contractId]);

  // Fetch the signed-in identity's credit balance on login and whenever
  // `refreshBalance()` is called. Clears on logout.
  useEffect(() => {
    if (!sdk || !identityId) return;
    let cancelled = false;
    sdk.identities
      .balance(identityId)
      .then((credits) => {
        if (!cancelled) setBalance(credits);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setBalance(null);
          log(`Balance fetch failed: ${errorMessage(e)}`, "error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, identityId, balanceNonce, log]);

  // Fetch the signed-in identity's DashMint token balance. If the active
  // contract does not expose the token, unavailable is represented as null.
  useEffect(() => {
    if (!sdk || !identityId || !contractId) return;
    let cancelled = false;
    fetchDashMintTokenBalance({ sdk, contractId, identityId })
      .then((tokens) => {
        if (!cancelled) setDashMintTokenBalance(tokens);
      })
      .catch(() => {
        if (!cancelled) setDashMintTokenBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, identityId, contractId, balanceNonce]);

  const setContractId = useCallback((id: string | null) => {
    if (id) {
      saveContractId(id);
      setContractIdState(id);
    } else {
      // Clearing falls back to the default contract ID so browse-only mode
      // always has something queryable.
      clearStoredContractId();
      setContractIdState(loadStoredContractId());
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    log("Connecting to Dash Platform testnet…");
    const { createClient } = await loadSdkModule();
    const connected = await createClient("testnet");
    log("Connected to testnet.", "info");
    setSdk(connected);
    return connected;
  }, [log]);

  const login = useCallback(
    async (mnemonic: string, identityIndex = 0) => {
      const trimmed = mnemonic.trim();
      if (!trimmed) throw new Error("Mnemonic is required.");

      try {
        const connected = sdk ?? (await connect());
        log("Deriving identity keys from mnemonic…");
        const { IdentityKeyManager } = await loadSdkModule();
        const km = await IdentityKeyManager.create({
          sdk: connected,
          mnemonic: trimmed,
          network: "testnet",
          identityIndex,
        });
        const resolvedId = km.identityId ?? null;
        setKeyManager(km);
        setIdentityId(resolvedId);
        setStatus("authenticated");
        log(`Identity resolved: ${resolvedId ?? "(unknown)"}`);
      } catch (e) {
        const message = errorMessage(e);
        setError(message);
        setStatus("error");
        log(`Login failed: ${message}`, "error");
        throw e;
      }
    },
    [sdk, connect, log],
  );

  const browseOnly = useCallback(async () => {
    try {
      if (!sdk) await connect();
      setKeyManager(null);
      setIdentityId(null);
      setBalance(null);
      setDashMintTokenBalance(null);
      setStatus("browsing");
      log("Browse-only mode (not logged in).", "info");
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      setStatus("error");
      log(`Connection failed: ${message}`, "error");
    }
  }, [sdk, connect, log]);

  const logout = useCallback(() => {
    setKeyManager(null);
    setIdentityId(null);
    setBalance(null);
    setDashMintTokenBalance(null);
    setStatus(sdk ? "browsing" : "idle");
    log("Logged out.", "info");
  }, [sdk, log]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      error,
      sdk,
      keyManager,
      identityId,
      contractId,
      contractOwnerId,
      balance,
      dashMintTokenBalance,
      refreshBalance,
      setContractId,
      log,
      login,
      browseOnly,
      logout,
    }),
    [
      status,
      error,
      sdk,
      keyManager,
      identityId,
      contractId,
      contractOwnerId,
      balance,
      dashMintTokenBalance,
      refreshBalance,
      setContractId,
      log,
      login,
      browseOnly,
      logout,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
