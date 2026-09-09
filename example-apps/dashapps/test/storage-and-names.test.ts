// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  DEFAULT_CONTRACT_IDS,
  loadContractId,
  saveContractId,
} from "../src/dash/contractStore";
import { NameResolver } from "../src/dash/resolveDpnsName";
import { deferred, id, sdk } from "./helpers";
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it("isolates registry overrides by network and rejects corrupt storage", () => {
  saveContractId("testnet", id(2));
  expect(loadContractId("testnet")).toBe(id(2));
  expect(loadContractId("mainnet")).toBe("");
  localStorage.setItem("dashapps.contractId.mainnet", "invalid");
  expect(loadContractId("mainnet")).toBe("");
  expect(() => saveContractId("testnet", "bad")).toThrow();
  saveContractId("testnet", "");
  expect(loadContractId("testnet")).toBe(DEFAULT_CONTRACT_IDS.testnet);
});
it("works when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  expect(loadContractId("testnet")).toBe(DEFAULT_CONTRACT_IDS.testnet);
  expect(() => saveContractId("testnet", id(2))).not.toThrow();
});
it("does not cache name lookup failures and expires successful names", async () => {
  const client = sdk();
  let time = 0;
  const lookup = vi
    .mocked(client.dpns.username)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue("alice.dash");
  const names = new NameResolver(client, "testnet", () => time);
  expect(await names.resolve(id(1))).toBeNull();
  expect(await names.resolve(id(1))).toBe("alice");
  await names.resolve(id(1));
  expect(lookup).toHaveBeenCalledTimes(2);
  time = 60000;
  await names.resolve(id(1));
  expect(lookup).toHaveBeenCalledTimes(3);
});
it("normalizes trailing dots before displaying the DPNS suffix", async () => {
  const client = sdk();
  vi.mocked(client.dpns.username).mockResolvedValue("alice..dash");
  const names = new NameResolver(client, "testnet");
  expect(await names.resolve(id(1))).toBe("alice");
});
it("discarded name lookups cannot repopulate the cache", async () => {
  const client = sdk();
  const pending = deferred<string | undefined>();
  vi.mocked(client.dpns.username)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue("bob.dash");
  const names = new NameResolver(client, "testnet");
  const reading = names.resolve(id(1));
  const rejected = expect(reading).rejects.toThrow();
  names.clear();
  pending.resolve("alice.dash");
  await rejected;
  expect(await names.resolve(id(1))).toBe("bob");
});
