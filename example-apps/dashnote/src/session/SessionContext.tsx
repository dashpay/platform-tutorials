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
  refreshContractCache,
  saveContractId,
} from "../dash/contract";
import { loginWithPrivateKey } from "../dash/loginWithPrivateKey";
import { resolveDpnsName } from "../dash/resolveDpnsName";
import type { DashKeyManager, DashSdk } from "../dash/types";
import { detectSecretShape } from "../lib/detectSecretShape";
import { errorMessage, type Logger } from "../lib/logger";
import { clearCachedNotes } from "../lib/notesCache";
import {
  clearRememberedIdentity,
  loadRememberedIdentity,
  saveRememberedIdentity,
} from "../lib/rememberedIdentity";
import { keyManagerFromKey } from "./keyManagerFromKey";

// The SDK + IdentityKeyManager pull in @dashevo/evo-sdk (and its ~8MB WASM
// bundle), so we load them lazily on first use to keep the app shell off
// the critical path. Cached after first call.
type SdkModule = typeof import("../../../../setupDashClient-core.mjs");
let sdkModulePromise: Promise<SdkModule> | null = null;
function loadSdkModule(): Promise<SdkModule> {
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
  dpnsName: string | null;
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
  const initialRemembered = loadRememberedIdentity();
  const [status, setStatus] = useState<SessionStatus>(
    initialRemembered ? "browsing" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [sdk, setSdk] = useState<DashSdk | null>(null);
  const [keyManager, setKeyManager] = useState<DashKeyManager | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(
    initialRemembered?.id ?? null,
  );
  const [contractId, setContractIdState] = useState<string | null>(() =>
    loadStoredContractId(),
  );
  const [rememberedIdentityId, setRememberedIdentityId] = useState<
    string | null
  >(initialRemembered?.id ?? null);
  const [dpnsName, setDpnsName] = useState<string | null>(
    initialRemembered?.name ?? null,
  );

  const log = useCallback<Logger>((message, level = "info") => {
    const method =
      level === "error" ? "error" : level === "success" ? "info" : "log";
    console[method](`[${level}] ${message}`);
    if (level === "success") toast.success(message);
    if (level === "error") toast.error(message);
  }, []);

  const setContractId = useCallback(
    (id: string | null) => {
      const trimmed = id?.trim() ?? "";
      // Evict the SDK's cached schema for the contract we're leaving so the
      // next query refetches against the new ID. queries.ts trusts the cache
      // for normal note operations; this is the one place it can become
      // stale (user pastes a different ID or registers a fresh contract).
      const previousId = contractId;
      if (sdk && previousId && previousId !== trimmed) {
        void refreshContractCache({ sdk, contractId: previousId });
      }
      if (trimmed) {
        saveContractId(trimmed);
        setContractIdState(trimmed);
        return;
      }
      clearStoredContractId();
      setContractIdState(loadStoredContractId());
    },
    [sdk, contractId],
  );

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    log("Connecting to Dash Platform testnet…");
    const { createClient } = await loadSdkModule();
    const connected = (await createClient("testnet")) as unknown as DashSdk;
    setSdk(connected);
    log("Connected to Dash Platform testnet.");
    return connected;
  }, [log]);

  const login = useCallback(
    async (secret: string, options: LoginOptions = {}) => {
      const { identityIndex = 0, rememberMe = false } = options;
      const trimmed = secret.trim();
      if (!trimmed) throw new Error("Secret is required.");
      // Snapshot session state so a failed login can restore the user's
      // prior context instead of clobbering it. Without this, mistyping a
      // key while in browsing/authenticated mode silently logs the user out.
      const priorStatus = status;
      const priorKeyManager = keyManager;
      const priorIdentityId = identityId;
      const priorDpnsName = dpnsName;
      setError(null);
      try {
        const connected = sdk ?? (await connect());

        // Detect whether the user pasted a mnemonic or a WIF private key
        // and dispatch accordingly. identityIndex only applies to mnemonic
        // input (DIP-13 derivation); a single WIF identifies one key
        // directly so the index is irrelevant in that path.
        const shape = detectSecretShape(trimmed);

        let resolvedKeyManager: DashKeyManager;
        if (shape === "mnemonic") {
          const { IdentityKeyManager } = await loadSdkModule();
          resolvedKeyManager = (await IdentityKeyManager.create({
            sdk: connected as never,
            mnemonic: trimmed,
            network: "testnet",
            identityIndex,
          })) as unknown as DashKeyManager;
        } else {
          const auth = await loginWithPrivateKey(connected, trimmed);
          resolvedKeyManager = keyManagerFromKey(auth.identityId, auth);
        }

        setKeyManager(resolvedKeyManager);
        const resolvedId = resolvedKeyManager.identityId ?? null;
        setIdentityId(resolvedId ?? null);
        setStatus("authenticated");
        log(`Identity resolved: ${resolvedId ?? "(unknown)"}`, "success");

        // Resolve the DPNS name after auth so we can persist it alongside
        // the identity ID — DPNS bindings are permanent, so what we save
        // here is correct for every future load. A naming-service failure
        // shouldn't kill an otherwise-valid session: caption is optional.
        let resolvedName: string | null = null;
        if (resolvedId) {
          try {
            resolvedName = await resolveDpnsName(connected, resolvedId);
          } catch (dpnsErr) {
            log(`DPNS lookup failed: ${errorMessage(dpnsErr)}`, "info");
          }
          setDpnsName(resolvedName);
        }
        if (rememberMe && resolvedId) {
          saveRememberedIdentity({ id: resolvedId, name: resolvedName });
          setRememberedIdentityId(resolvedId);
        } else {
          clearRememberedIdentity();
          setRememberedIdentityId(null);
        }
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        // Restore prior session state. If a remembered identity exists,
        // prefer landing in browsing mode so a failed key-swap still shows
        // the remembered identity panel instead of the logged-out form.
        const remembered = loadRememberedIdentity();
        if (remembered) {
          setKeyManager(null);
          setIdentityId(remembered.id);
          setDpnsName(remembered.name ?? null);
          setStatus("browsing");
        } else {
          setKeyManager(priorKeyManager);
          setIdentityId(priorIdentityId);
          setDpnsName(priorDpnsName);
          setStatus(priorStatus);
        }
        log(`Login failed: ${message}`, "error");
        throw err;
      }
    },
    [sdk, status, keyManager, identityId, dpnsName, connect, log],
  );

  const enterReadOnly = useCallback(async () => {
    setError(null);
    try {
      if (!sdk) await connect();
      setKeyManager(null);
      setIdentityId(null);
      setDpnsName(null);
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
    const remembered = loadRememberedIdentity();
    if (!remembered) {
      await enterReadOnly();
      return;
    }
    setError(null);
    setKeyManager(null);
    setIdentityId(remembered.id);
    setRememberedIdentityId(remembered.id);
    setDpnsName(remembered.name ?? null);
    setStatus("browsing");
    try {
      let connected = sdk;
      if (!connected) {
        log("Connecting to Dash Platform testnet…");
        const { createClient } = await loadSdkModule();
        connected = (await createClient("testnet")) as unknown as DashSdk;
        setSdk(connected);
        log("Connected to Dash Platform testnet.");
      }
      log(`Browsing notes for ${remembered.id} (read-only).`);

      // DPNS (name, identityId) bindings are permanent, so a cached name
      // never needs revalidation. Only resolve when we don't have one yet
      // (e.g. the identity registered a name after we last saved, or this
      // record predates the dpnsName field).
      if (!remembered.name) {
        try {
          const fresh = await resolveDpnsName(connected, remembered.id);
          if (fresh) {
            setDpnsName(fresh);
            saveRememberedIdentity({ id: remembered.id, name: fresh });
          }
        } catch (dpnsErr) {
          log(`DPNS lookup failed: ${errorMessage(dpnsErr)}`, "info");
        }
      }
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      setStatus("error");
      log(`Connection failed: ${message}`, "error");
    }
  }, [sdk, enterReadOnly, log]);

  const forgetIdentity = useCallback(() => {
    if (rememberedIdentityId) clearCachedNotes(rememberedIdentityId);
    clearRememberedIdentity();
    setRememberedIdentityId(null);
    setDpnsName(null);
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
    setDpnsName(null);
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
      dpnsName,
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
      dpnsName,
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
