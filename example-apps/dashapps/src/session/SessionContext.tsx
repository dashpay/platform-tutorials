/** Adapted from dashnames: cached SDK loading and generation-guarded identity sessions.
 * Recovery phrases are parameters only; never held in state, refs, storage, or logs.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadSdkCore } from "../dash/sdkCore";
import {
  DEFAULT_CONTRACT_IDS,
  loadContractId,
  saveContractId,
  saveNetwork,
} from "../dash/contractStore";
import { requireId } from "../dash/ids";
import { OwnerResolver } from "../dash/ownerResolver";
import { NameResolver } from "../dash/resolveDpnsName";
import { errorMessage } from "../lib/logger";
import type { Network } from "../dash/types";
import type { SessionState, SessionValue } from "./types";
import { SessionContext } from "./context";
const signedOut = {
  keyManager: null,
  identityId: null,
  identityName: null,
  balance: null,
};
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() => ({
    network: "testnet",
    status: "connecting",
    connection: null,
    error: null,
    ...signedOut,
  }));
  const [attempt, setAttempt] = useState(0);
  const [registries, setRegistries] = useState(() => ({
    testnet: loadContractId("testnet"),
    mainnet: loadContractId("mainnet"),
  }));
  const [registryGeneration, setRegistryGeneration] = useState(0);
  const [connectionGeneration, setConnectionGeneration] = useState(0);
  const generations = useRef({ connection: 0, auth: 0, balance: 0 });
  const network = state.network;
  useEffect(() => {
    const guard = generations.current;
    const generation = ++guard.connection;
    let connection: SessionState["connection"] = null;
    void (async () => {
      try {
        const core = await loadSdkCore();
        if (generation !== guard.connection) return;
        const sdk = await core.createClient(network);
        if (generation !== guard.connection) return;
        connection = {
          sdk,
          resolver: new OwnerResolver(sdk, network),
          names: new NameResolver(sdk, network),
        };
        setState((previous) => ({
          ...previous,
          connection,
          status: "readonly",
          error: null,
        }));
      } catch (error) {
        if (generation === guard.connection)
          setState((previous) => ({
            ...previous,
            status: "error",
            error: errorMessage(error),
          }));
      }
    })();
    return () => {
      guard.connection++;
      guard.auth++;
      guard.balance++;
      connection?.resolver.clear();
      connection?.names.clear();
    };
  }, [network, attempt]);
  function invalidateConnection() {
    generations.current.connection++;
    generations.current.auth++;
    generations.current.balance++;
    state.connection?.resolver.clear();
    state.connection?.names.clear();
    setConnectionGeneration((value) => value + 1);
  }
  function setNetwork(next: Network) {
    if (next !== "testnet" && next !== "mainnet")
      throw new Error("Unknown network.");
    if (next === state.network) return;
    invalidateConnection();
    saveNetwork(next);
    setState({
      network: next,
      status: "connecting",
      connection: null,
      error: null,
      ...signedOut,
    });
  }
  function reconnect() {
    invalidateConnection();
    setState((previous) => ({
      ...previous,
      status: "connecting",
      connection: null,
      error: null,
      ...signedOut,
    }));
    setAttempt((value) => value + 1);
  }
  async function login(mnemonic: string, identityIndex = 0) {
    const connection = state.connection;
    if (state.network !== "testnet")
      throw new Error(
        "Sign-in is disabled on mainnet. Switch to testnet to use an identity.",
      );
    if (!connection) throw new Error("Not connected yet.");
    if (!mnemonic.trim()) throw new Error("Recovery phrase is required.");
    if (
      !Number.isInteger(identityIndex) ||
      identityIndex < 0 ||
      identityIndex > 2147483647
    )
      throw new Error(
        "Identity index must be an integer from 0 to 2147483647.",
      );
    const generation = ++generations.current.auth;
    const connectionId = generations.current.connection;
    const assertCurrent = () => {
      if (
        generation !== generations.current.auth ||
        connectionId !== generations.current.connection
      )
        throw new Error("Sign-in was cancelled because the session changed.");
    };
    const core = await loadSdkCore();
    assertCurrent();
    const keyManager = await core.IdentityKeyManager.create({
      sdk: connection.sdk,
      mnemonic: mnemonic.trim(),
      network: "testnet",
      identityIndex,
    });
    assertCurrent();
    const identityId = requireId(keyManager.identityId);
    const [balance, identityName] = await Promise.all([
      connection.sdk.identities.balance(identityId).catch(() => null),
      connection.names.resolve(identityId).catch(() => null),
    ]);
    assertCurrent();
    setState((previous) => ({
      ...previous,
      status: "authenticated",
      keyManager,
      identityId,
      identityName,
      balance,
    }));
  }
  function logout() {
    generations.current.auth++;
    generations.current.balance++;
    setState((previous) => ({
      ...previous,
      ...signedOut,
      status: previous.connection ? "readonly" : previous.status,
    }));
  }
  async function refreshBalance() {
    const { connection, identityId } = state;
    if (!connection || !identityId) return;
    const auth = generations.current.auth;
    const generation = ++generations.current.balance;
    const balance = await connection.sdk.identities.balance(identityId);
    if (
      generation !== generations.current.balance ||
      auth !== generations.current.auth
    )
      return;
    setState((previous) => ({ ...previous, balance }));
  }
  function setRegistryId(input: string) {
    const id = input.trim();
    if (id) requireId(id);
    const persisted = saveContractId(network, id);
    const selected = id || DEFAULT_CONTRACT_IDS[network];
    if (selected !== registries[network]) {
      generations.current.auth++;
      setRegistries((previous) => ({ ...previous, [network]: selected }));
      setRegistryGeneration((value) => value + 1);
    }
    return persisted;
  }
  const value: SessionValue = {
    ...state,
    registryId: registries[network],
    registryGeneration,
    connectionGeneration,
    setRegistryId,
    setNetwork,
    reconnect,
    login,
    logout,
    refreshBalance,
  };
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
