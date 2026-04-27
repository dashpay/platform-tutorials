import { toast } from "sonner";
import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "../dash/client";
import {
  clearStoredContractId,
  loadStoredContractId,
  saveContractId,
} from "../dash/contract";
import { IdentityKeyManager } from "../dash/keyManager";
import { errorMessage, type Logger } from "../dash/logger";
import type { DashKeyManager, DashSdk } from "../dash/types";

export type SessionStatus =
  | "idle"
  | "connecting"
  | "browsing"
  | "authenticated"
  | "error";

export interface SessionValue {
  status: SessionStatus;
  error: string | null;
  sdk: DashSdk | null;
  keyManager: DashKeyManager | null;
  identityId: string | null;
  contractId: string | null;
  setContractId: (id: string | null) => void;
  log: Logger;
  login: (mnemonic: string, identityIndex?: number) => Promise<void>;
  browseOnly: () => Promise<void>;
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

  const log = useCallback<Logger>((message, level = "info") => {
    const method =
      level === "error" ? "error" : level === "success" ? "info" : "log";
    console[method](`[${level}] ${message}`);
    if (level === "success") toast.success(message);
    if (level === "error") toast.error(message);
  }, []);

  const setContractId = useCallback((id: string | null) => {
    const trimmed = id?.trim() ?? "";
    if (trimmed) {
      saveContractId(trimmed);
      setContractIdState(trimmed);
      return;
    }
    clearStoredContractId();
    setContractIdState(loadStoredContractId());
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    log("Connecting to Dash Platform testnet…");
    const connected = await createClient("testnet");
    setSdk(connected);
    log("Connected to Dash Platform testnet.");
    return connected;
  }, [log]);

  const login = useCallback(
    async (mnemonic: string, identityIndex = 0) => {
      const trimmed = mnemonic.trim();
      if (!trimmed) throw new Error("Mnemonic is required.");
      try {
        const connected = sdk ?? (await connect());
        const manager = await IdentityKeyManager.create({
          sdk: connected as never,
          mnemonic: trimmed,
          network: "testnet",
          identityIndex,
        });
        setKeyManager(manager);
        setIdentityId(manager.identityId ?? null);
        setStatus("authenticated");
        log(`Identity resolved: ${manager.identityId ?? "(unknown)"}`, "success");
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        setStatus("error");
        log(`Login failed: ${message}`, "error");
        throw err;
      }
    },
    [sdk, connect, log],
  );

  const browseOnly = useCallback(async () => {
    try {
      if (!sdk) await connect();
      setKeyManager(null);
      setIdentityId(null);
      setStatus("browsing");
      log("Browse-only mode enabled.");
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      setStatus("error");
      log(`Connection failed: ${message}`, "error");
    }
  }, [sdk, connect, log]);

  const logout = useCallback(() => {
    setKeyManager(null);
    setIdentityId(null);
    setStatus(sdk ? "browsing" : "idle");
    log("Logged out.");
  }, [sdk, log]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      error,
      sdk,
      keyManager,
      identityId,
      contractId,
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
