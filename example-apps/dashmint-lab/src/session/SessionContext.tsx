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
 * What IS persisted: the contract ID, under localStorage['nft-modern.contractId'].
 * Contract IDs are public (anyone querying the network sees them), so storing
 * them is a UX win with no security cost.
 */
import { toast } from 'sonner'
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { createClient } from '../dash/client';
import { IdentityKeyManager } from '../dash/keyManager';
import {
  clearStoredContractId,
  fetchContractOwnerId,
  loadStoredContractId,
  saveContractId,
} from '../dash/contract';
import { errorMessage, type Logger } from '../dash/logger';

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'browsing'
  | 'authenticated'
  | 'error';

export interface SessionValue {
  status: SessionStatus;
  error: string | null;

  /** Connected EvoSDK instance (undefined before connect). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any | null;

  /** Identity key manager. Null in browse-only mode or logged out. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keyManager: any | null;

  /** The signed-in identity ID, or null in browse-only mode. */
  identityId: string | null;

  /** Active contract ID. Loaded from localStorage on mount. */
  contractId: string | null;

  /** Owner identity ID of the active contract (fetched from Platform). */
  contractOwnerId: string | null;

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
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sdk, setSdk] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [keyManager, setKeyManager] = useState<any | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [contractId, setContractIdState] = useState<string | null>(() =>
    loadStoredContractId(),
  );
  const [contractOwnerId, setContractOwnerId] = useState<string | null>(null);
  const log = useCallback<Logger>((message, level = 'info') => {
    const method = level === 'error' ? 'error' : level === 'success' ? 'info' : 'log';
    console[method](`[${level}] ${message}`);
    if (level === 'success') toast.success(message);
    else if (level === 'error') toast.error(message);
  }, []);

  // Resolve the contract owner whenever sdk or contractId changes.
  useEffect(() => {
    if (!sdk || !contractId) return;
    let cancelled = false;
    fetchContractOwnerId({ sdk, contractId }).then((ownerId) => {
      if (!cancelled) setContractOwnerId(ownerId);
    }).catch(() => {
      if (!cancelled) setContractOwnerId(null);
    });
    return () => { cancelled = true; };
  }, [sdk, contractId]);

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
    setStatus('connecting');
    setError(null);
    log('Connecting to Dash Platform testnet…');
    const connected = await createClient('testnet');
    log('Connected to testnet.', 'info');
    setSdk(connected);
    return connected;
  }, [log]);

  const login = useCallback(
    async (mnemonic: string, identityIndex = 0) => {
      const trimmed = mnemonic.trim();
      if (!trimmed) throw new Error('Mnemonic is required.');

      try {
        const connected = sdk ?? (await connect());
        log('Deriving identity keys from mnemonic…');
        const km = await IdentityKeyManager.create({
          sdk: connected,
          mnemonic: trimmed,
          network: 'testnet',
          identityIndex,
        });
        const resolvedId = km.identityId ?? null;
        setKeyManager(km);
        setIdentityId(resolvedId);
        setStatus('authenticated');
        log(`Identity resolved: ${resolvedId ?? '(unknown)'}`);
      } catch (e) {
        const message = errorMessage(e);
        setError(message);
        setStatus('error');
        log(`Login failed: ${message}`, 'error');
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
      setStatus('browsing');
      log('Browse-only mode (not logged in).', 'info');
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      setStatus('error');
      log(`Connection failed: ${message}`, 'error');
    }
  }, [sdk, connect, log]);

  const logout = useCallback(() => {
    setKeyManager(null);
    setIdentityId(null);
    setStatus(sdk ? 'browsing' : 'idle');
    log('Logged out.', 'info');
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
