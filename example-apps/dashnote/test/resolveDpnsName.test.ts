import { describe, expect, it, vi } from "vitest";

import { resolveDpnsName } from "../src/dash/resolveDpnsName";
import type { DashSdk } from "../src/dash/types";

function makeSdk(username: ReturnType<typeof vi.fn>): DashSdk {
  return { dpns: { username } } as unknown as DashSdk;
}

describe("resolveDpnsName", () => {
  it("strips the .dash TLD suffix", async () => {
    const sdk = makeSdk(vi.fn().mockResolvedValue("alice.dash"));
    expect(await resolveDpnsName(sdk, "id-1")).toBe("alice");
  });

  it("returns the value unchanged when there is no .dash suffix", async () => {
    const sdk = makeSdk(vi.fn().mockResolvedValue("alice"));
    expect(await resolveDpnsName(sdk, "id-1")).toBe("alice");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 0],
    ["an object", {}],
  ])("returns null when the SDK resolves to %s", async (_label, value) => {
    const sdk = makeSdk(vi.fn().mockResolvedValue(value));
    expect(await resolveDpnsName(sdk, "id-1")).toBeNull();
  });

  it("returns null when the SDK resolves to an empty string", async () => {
    const sdk = makeSdk(vi.fn().mockResolvedValue(""));
    expect(await resolveDpnsName(sdk, "id-1")).toBeNull();
  });

  it("returns null when the SDK call throws", async () => {
    const sdk = makeSdk(vi.fn().mockRejectedValue(new Error("network")));
    expect(await resolveDpnsName(sdk, "id-1")).toBeNull();
  });
});
