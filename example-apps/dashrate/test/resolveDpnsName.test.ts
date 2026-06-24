import { describe, expect, it, vi } from "vitest";
import { resolveDpnsName } from "../src/dash/resolveDpnsName";
import type { DashSdk } from "../src/dash/types";

function sdkWith(username: () => Promise<string | null | undefined>): DashSdk {
  return { dpns: { username: vi.fn(username) } } as unknown as DashSdk;
}

describe("resolveDpnsName", () => {
  it("strips the .dash TLD from a registered name", async () => {
    const sdk = sdkWith(async () => "alice.dash");
    expect(await resolveDpnsName(sdk, "id-1")).toBe("alice");
  });

  it("returns a name without a .dash suffix unchanged", async () => {
    const sdk = sdkWith(async () => "bob");
    expect(await resolveDpnsName(sdk, "id-1")).toBe("bob");
  });

  it("returns null for an empty or non-string result", async () => {
    expect(
      await resolveDpnsName(
        sdkWith(async () => ""),
        "id-1",
      ),
    ).toBeNull();
    expect(
      await resolveDpnsName(
        sdkWith(async () => null),
        "id-1",
      ),
    ).toBeNull();
    expect(
      await resolveDpnsName(
        sdkWith(async () => undefined),
        "id-1",
      ),
    ).toBeNull();
    expect(
      await resolveDpnsName(
        sdkWith(async () => 42 as unknown as string),
        "id-1",
      ),
    ).toBeNull();
  });

  it("returns null when the lookup throws", async () => {
    const sdk = sdkWith(async () => {
      throw new Error("not found");
    });
    expect(await resolveDpnsName(sdk, "id-1")).toBeNull();
  });
});
