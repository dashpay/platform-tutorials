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
import { clearCachedNotes } from "../dash/notesCache";
import {
  clearRememberedIdentityId,
  loadRememberedIdentityId,
  saveRememberedIdentityId,
} from "../dash/rememberedIdentity";
import type { DashKeyManager, DashSdk } from "../dash/types";

export type SessionStatus =
  | "idle"
  | "connecting"
  | "readonly"
  | "browsing"
  | "authenticated"
  | "error";

export interface LoginOptions {
  identityIndex?: number;
  rememberMe?: boolean;
}

export interface SessionValue {
  status: SessionStatus;
  error: string | null;
  sdk: DashSdk | null;
  keyManager: DashKeyManager | null;
  identityId: string | null;
  contractId: string | null;
  rememberedIdentityId: string | null;
  setContractId: (id: string | null) => void;
  log: Logger;
  login: (mnemonic: string, options?: LoginOptions) => Promise<void>;
  enterReadOnly: () => Promise<void>;
  viewAsRemembered: () => Promise<void>;
  forgetIdentity: () => void;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);
export { SessionContext };

export function SessionProvider({ children }: { children: ReactNode }) {
  const initialRemembered = loadRememberedIdentityId();
  const [status, setStatus] = useState<SessionStatus>(
    initialRemembered ? "browsing" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [sdk, setSdk] = useState<DashSdk | null>(null);
  const [keyManager, setKeyManager] = useState<DashKeyManager | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(
    initialRemembered,
  );
  const [contractId, setContractIdState] = useState<string | null>(() =>
    loadStoredContractId(),
  );
  const [rememberedIdentityId, setRememberedIdentityId] = useState<
    string | null
  >(initialRemembered);

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
    const connected = (await createClient("testnet")) as unknown as DashSdk;
    setSdk(connected);
    log("Connected to Dash Platform testnet.");
    return connected;
  }, [log]);

  const login = useCallback(
    async (mnemonic: string, options: LoginOptions = {}) => {
      const { identityIndex = 0, rememberMe = false } = options;
      const trimmed = mnemonic.trim();
      if (!trimmed) throw new Error("Mnemonic is required.");
      setError(null);
      try {
        const connected = sdk ?? (await connect());
        const manager = await IdentityKeyManager.create({
          sdk: connected as never,
          mnemonic: trimmed,
          network: "testnet",
          identityIndex,
        });
        setKeyManager(manager);
        const resolvedId = manager.identityId ?? null;
        setIdentityId(resolvedId);
        setStatus("authenticated");
        if (rememberMe && resolvedId) {
          saveRememberedIdentityId(resolvedId);
          setRememberedIdentityId(resolvedId);
        }
        log(`Identity resolved: ${resolvedId ?? "(unknown)"}`, "success");
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

  const enterReadOnly = useCallback(async () => {
    setError(null);
    try {
      if (!sdk) await connect();
      setKeyManager(null);
      setIdentityId(null);
      setStatus("readonly");
      log("Read-only mode enabled.");
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      setStatus("error");
      log(`Connection failed: ${message}`, "error");
    }
  }, [sdk, connect, log]);

  const viewAsRemembered = useCallback(async () => {
    const rememberedId = loadRememberedIdentityId();
    if (!rememberedId) {
      await enterReadOnly();
      return;
    }
    setError(null);
    setKeyManager(null);
    setIdentityId(rememberedId);
    setRememberedIdentityId(rememberedId);
    setStatus("browsing");
    try {
      if (!sdk) {
        log("Connecting to Dash Platform testnet…");
        const connected = (await createClient("testnet")) as unknown as DashSdk;
        setSdk(connected);
        log("Connected to Dash Platform testnet.");
      }
      log(`Browsing notes for ${rememberedId} (read-only).`);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      setStatus("error");
      log(`Connection failed: ${message}`, "error");
    }
  }, [sdk, enterReadOnly, log]);

  const forgetIdentity = useCallback(() => {
    if (rememberedIdentityId) clearCachedNotes(rememberedIdentityId);
    clearRememberedIdentityId();
    setRememberedIdentityId(null);
    if (status === "browsing") {
      setKeyManager(null);
      setIdentityId(null);
      setStatus(sdk ? "readonly" : "idle");
    }
    log("Forgot remembered identity on this device.");
  }, [status, sdk, rememberedIdentityId, log]);

  const logout = useCallback(() => {
    setKeyManager(null);
    setError(null);
    if (rememberedIdentityId) {
      setIdentityId(rememberedIdentityId);
      setStatus(sdk ? "browsing" : "idle");
      log("Logged out. Browsing remembered identity (read-only).");
      return;
    }
    setIdentityId(null);
    setStatus(sdk ? "readonly" : "idle");
    log("Logged out.");
  }, [sdk, rememberedIdentityId, log]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      error,
      sdk,
      keyManager,
      identityId,
      contractId,
      rememberedIdentityId,
      setContractId,
      log,
      login,
      enterReadOnly,
      viewAsRemembered,
      forgetIdentity,
      logout,
    }),
    [
      status,
      error,
      sdk,
      keyManager,
      identityId,
      contractId,
      rememberedIdentityId,
      setContractId,
      log,
      login,
      enterReadOnly,
      viewAsRemembered,
      forgetIdentity,
      logout,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
