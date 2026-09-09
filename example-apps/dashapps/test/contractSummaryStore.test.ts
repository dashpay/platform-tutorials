// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import {
  ContractSummaryStore,
  type ContractSummary,
} from "../src/dash/contractSummaryStore";
import { id } from "./helpers";

function summary(n = 2, owner = 1): ContractSummary {
  return {
    contractId: id(n),
    ownerId: id(owner),
    version: 3,
    description: `Contract ${n}`,
    keywords: ["app"],
    documentTypes: ["note"],
    fetchedAt: 123,
  };
}

beforeEach(() => localStorage.clear());

it("persists summaries and hydrates a later store", () => {
  new ContractSummaryStore("testnet").set(summary());
  expect(new ContractSummaryStore("testnet").get(id(2))).toEqual(summary());
});

it("isolates summaries by network", () => {
  new ContractSummaryStore("testnet").set(summary());
  expect(new ContractSummaryStore("mainnet").get(id(2))).toBeUndefined();
});

it("ignores malformed envelopes and entries while retaining valid entries", () => {
  localStorage.setItem(
    "dashapps.contractSummaries.v1.testnet",
    JSON.stringify({
      entries: [null, { ...summary(3), ownerId: "bad" }, summary()],
    }),
  );
  const store = new ContractSummaryStore("testnet");
  expect(store.get(id(2))).toEqual(summary());
  expect(store.get(id(3))).toBeUndefined();

  localStorage.setItem("dashapps.contractSummaries.v1.mainnet", "not json");
  expect(new ContractSummaryStore("mainnet").get(id(2))).toBeUndefined();
});

it("continues to work when storage writes fail", () => {
  const setItem = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
  const store = new ContractSummaryStore("testnet");
  store.set(summary());
  expect(store.get(id(2))).toEqual(summary());
  setItem.mockRestore();
});

it("starts empty when storage reads are unavailable", () => {
  const getItem = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
  expect(new ContractSummaryStore("testnet").get(id(2))).toBeUndefined();
  getItem.mockRestore();
});

it("keeps at most the 1000 most recently inserted summaries", () => {
  const store = new ContractSummaryStore("testnet");
  for (let n = 1; n <= 1_001; n++) store.set(summary(n, n + 2_000));
  expect(store.get(id(1))).toBeUndefined();
  expect(store.get(id(2))).toEqual(summary(2, 2_002));
  expect(store.get(id(1_001))).toEqual(summary(1_001, 3_001));
});
