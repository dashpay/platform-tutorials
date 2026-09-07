import { expect, it, vi } from "vitest";
import { OwnerResolver, StaleRequestError } from "../src/dash/ownerResolver";
import type { ContractHandle } from "../src/dash/types";
import { contract, deferred, id, sdk } from "./helpers";
it("deduplicates and runs batches of at most 100 sequentially", async () => {
  const client = sdk();
  const first = deferred<Map<string, ContractHandle | undefined>>();
  const get = vi
    .mocked(client.contracts.getMany)
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue(new Map());
  const resolver = new OwnerResolver(client, "testnet");
  const ids = Array.from({ length: 205 }, (_, i) => id(i));
  const reading = resolver.resolve([...ids, ids[0]]);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0][0]).toHaveLength(100);
  first.resolve(new Map());
  const results = await reading;
  expect(get.mock.calls.map((call) => call[0].length)).toEqual([100, 100, 5]);
  expect(results.size).toBe(205);
});
it("caches found for 60 seconds and missing for 5; force bypasses", async () => {
  let time = 0;
  const client = sdk();
  const get = vi
    .mocked(client.contracts.getMany)
    .mockResolvedValue(new Map([[id(2), contract()]]));
  const resolver = new OwnerResolver(client, "testnet", () => time);
  await resolver.resolve([id(2), id(3)]);
  time = 4999;
  await resolver.resolve([id(2), id(3)]);
  expect(get).toHaveBeenCalledTimes(1);
  time = 5000;
  await resolver.resolve([id(2), id(3)]);
  expect(get.mock.lastCall?.[0]).toEqual([id(3)]);
  time = 60000;
  await resolver.resolve([id(2)]);
  expect(get).toHaveBeenCalledTimes(3);
  await resolver.resolve([id(2)], true);
  expect(get).toHaveBeenCalledTimes(4);
});
it("never treats failed reads or malformed owners as missing or caches errors", async () => {
  const client = sdk();
  const get = vi
    .mocked(client.contracts.getMany)
    .mockRejectedValueOnce(new Error("proof failed"))
    .mockResolvedValueOnce(new Map([[id(2), contract("broken")]]))
    .mockResolvedValue(new Map());
  const resolver = new OwnerResolver(client, "testnet");
  expect((await resolver.resolve([id(2)])).get(id(2))?.status).toBe("error");
  expect((await resolver.resolve([id(2)])).get(id(2))?.status).toBe("error");
  expect((await resolver.resolve([id(2)])).get(id(2))?.status).toBe("missing");
  expect(get).toHaveBeenCalledTimes(3);
});
it("invalidates in-flight results and keeps network caches isolated", async () => {
  const client = sdk();
  const pending = deferred<Map<string, ContractHandle | undefined>>();
  vi.mocked(client.contracts.getMany)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(new Map());
  const resolver = new OwnerResolver(client, "testnet");
  const reading = resolver.resolve([id(2)]);
  const rejected = expect(reading).rejects.toBeInstanceOf(StaleRequestError);
  resolver.clear();
  pending.resolve(new Map([[id(2), contract()]]));
  await rejected;
  expect((await resolver.resolve([id(2)])).get(id(2))?.status).toBe("missing");
  await new OwnerResolver(client, "mainnet").resolve([id(2)]);
  expect(client.contracts.getMany).toHaveBeenCalledTimes(3);
});
