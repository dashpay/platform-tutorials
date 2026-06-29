import { describe, expect, it, vi } from "vitest";
import { lookupDpnsName, resolveDpnsName } from "../src/dash/resolveDpnsName";
import type { DashSdk } from "../src/dash/types";

function sdkWith(username: () => Promise<string | null | undefined>): DashSdk {
  return { dpns: { username: vi.fn(username) } } as unknown as DashSdk;
}

describe("resolveDpnsName", () => {
  it("safely returns null when the lookup throws", async () => {
    const sdk = sdkWith(async () => {
      throw new Error("not found");
    });
    expect(await resolveDpnsName(sdk, "id-1")).toBeNull();
  });
});

describe("lookupDpnsName", () => {
  it("strips the .dash TLD from a registered name", async () => {
    const sdk = sdkWith(async () => "alice.dash");
    expect(await lookupDpnsName(sdk, "id-1")).toBe("alice");
  });

  it("returns a name without a .dash suffix unchanged", async () => {
    const sdk = sdkWith(async () => "bob");
    expect(await lookupDpnsName(sdk, "id-1")).toBe("bob");
  });

  it("returns null for an empty or non-string result", async () => {
    expect(
      await lookupDpnsName(
        sdkWith(async () => ""),
        "id-1",
      ),
    ).toBeNull();
    expect(
      await lookupDpnsName(
        sdkWith(async () => null),
        "id-1",
      ),
    ).toBeNull();
    expect(
      await lookupDpnsName(
        sdkWith(async () => undefined),
        "id-1",
      ),
    ).toBeNull();
    expect(
      await lookupDpnsName(
        sdkWith(async () => 42 as unknown as string),
        "id-1",
      ),
    ).toBeNull();
  });

  it("propagates lookup errors", async () => {
    const sdk = sdkWith(async () => {
      throw new Error("not found");
    });
    await expect(lookupDpnsName(sdk, "id-1")).rejects.toThrow("not found");
  });
});
