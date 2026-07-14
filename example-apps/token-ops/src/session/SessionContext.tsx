import { toast } from "sonner";
import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearStoredContractId,
  loadStoredContractId,
  saveContractId,
} from "../dash/contract";
import { errorMessage, type Logger } from "../dash/logger";
import type { DashKeyManager, DashSdk } from "../dash/types";
import { detectSecretShape } from "../lib/detectSecretShape";
import { keyManagerFromKey } from "./keyManagerFromKey";

// createClient + IdentityKeyManager pull in @dashevo/evo-sdk (and its ~8MB
// WASM bundle), so load the shared core lazily on first use to keep the app
// shell off the boot critical path. Cached after first call; cleared on
// failure so a transient chunk fetch can retry. This is a distinct loader
// from dash/sdkModule.ts (the @dashevo/evo-sdk value-import loader) on
// purpose — see the load-anchor rules in CLAUDE.md.
type SdkCore = typeof import("../../../../setupDashClient-core.mjs");
let sdkCorePromise: Promise<SdkCore> | null = null;
function loadSdkCore(): Promise<SdkCore> {
  if (!sdkCorePromise) {
    sdkCorePromise = import("../../../../setupDashClient-core.mjs").catch(
      (err) => {
        sdkCorePromise = null;
        throw err;
      },
    );
  }
  return sdkCorePromise;
}

export type SessionStatus =
  "idle" | "connecting" | "readonly" | "authenticated" | "error";

export interface LoginOptions {
  identityIndex?: number;
}

export interface SessionValue {
  status: SessionStatus;
  error: string | null;
  sdk: DashSdk | null;
  keyManager: DashKeyManager | null;
  identityId: string | null;
  contractId: string | null;
  setContractId: (id: string | null) => void;
  log: Logger;
  login: (secret: string, options?: LoginOptions) => Promise<void>;
  enterReadOnly: () => Promise<void>;
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
    const { createClient } = await loadSdkCore();
    const connected = await createClient("testnet");
    setSdk(connected as unknown as DashSdk);
    log("Connected to Dash Platform testnet.");
    return connected;
  }, [log]);

  const login = useCallback(
    async (secret: string, options: LoginOptions = {}) => {
      const { identityIndex = 0 } = options;
      const trimmed = secret.trim();
      if (!trimmed) throw new Error("Mnemonic or private key is required.");
      setError(null);
      try {
        const connected = sdk ?? (await connect());
        const shape = detectSecretShape(trimmed);
        let manager: DashKeyManager;

        if (shape === "mnemonic") {
          const { IdentityKeyManager } = await loadSdkCore();
          manager = (await IdentityKeyManager.create({
            sdk: connected as never,
            mnemonic: trimmed,
            network: "testnet",
            identityIndex,
          })) as unknown as DashKeyManager;
        } else {
          // Dynamic import keeps loginWithPrivateKey (and its transitive
          // @dashevo/evo-sdk value dependency) out of the app shell. The
          // mnemonic branch already pays the SDK fetch via loadSdkCore();
          // the WIF path fetches this module on first use here.
          const { loginWithPrivateKey } =
            await import("../dash/loginWithPrivateKey");
          const auth = await loginWithPrivateKey(
            connected as unknown as DashSdk,
            trimmed,
          );
          manager = keyManagerFromKey(auth.identityId, auth);
        }

        setKeyManager(manager);
        setIdentityId(manager.identityId ?? null);
        setStatus("authenticated");
        log(
          `Identity resolved: ${manager.identityId ?? "(unknown)"}`,
          "success",
        );
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

  const logout = useCallback(() => {
    setKeyManager(null);
    setIdentityId(null);
    setError(null);
    setStatus(sdk ? "readonly" : "idle");
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
      enterReadOnly,
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
      enterReadOnly,
      logout,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
