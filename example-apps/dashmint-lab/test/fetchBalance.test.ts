import { describe, expect, it, vi } from "vitest";

import { fetchBalance } from "../src/dash/fetchBalance";
import type { DashSdk } from "../src/dash/types";

describe("fetchBalance", () => {
  it("returns the bigint from sdk.identities.balance", async () => {
    const balance = vi
      .fn<(id: string) => Promise<bigint>>()
      .mockResolvedValue(12_345n);
    const sdk = {
      identities: { balance, nonce: vi.fn() },
    } as unknown as DashSdk;

    expect(await fetchBalance(sdk, "id-1")).toBe(12_345n);
    expect(balance).toHaveBeenCalledWith("id-1");
  });

  it("propagates errors from the SDK", async () => {
    const sdk = {
      identities: {
        balance: vi.fn().mockRejectedValue(new Error("network")),
        nonce: vi.fn(),
      },
    } as unknown as DashSdk;

    await expect(fetchBalance(sdk, "id-1")).rejects.toThrow("network");
  });
});
