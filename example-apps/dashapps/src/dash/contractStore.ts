import { isBase58Id } from "./ids";
import type { Network } from "./types";
export const DEFAULT_CONTRACT_IDS: Record<Network, string> = {
  testnet: "EtxiWUmuva8vsg2yezX2n7peompzN32VJABQuK7FLCXJ",
  mainnet: "",
};
export function loadContractId(network: Network): string {
  try {
    const value = localStorage.getItem(`dashapps.contractId.${network}`);
    if (isBase58Id(value)) return value;
  } catch {
    /* Storage can be unavailable in embedded previews. */
  }
  return DEFAULT_CONTRACT_IDS[network];
}
export function saveContractId(network: Network, value: string): boolean {
  if (value && !isBase58Id(value))
    throw new Error("Invalid registry contract ID.");
  try {
    if (value) localStorage.setItem(`dashapps.contractId.${network}`, value);
    else localStorage.removeItem(`dashapps.contractId.${network}`);
    return true;
  } catch {
    return false;
  }
}

export function loadNetwork(): Network {
  try {
    return localStorage.getItem("dashapps.network") === "mainnet"
      ? "mainnet"
      : "testnet";
  } catch {
    return "testnet";
  }
}
export function saveNetwork(network: Network) {
  try {
    localStorage.setItem("dashapps.network", network);
  } catch {
    /* In-memory selection remains usable. */
  }
}
