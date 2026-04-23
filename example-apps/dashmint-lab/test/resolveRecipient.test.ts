import { describe, expect, it, vi } from "vitest";

import {
  normalizeDpnsName,
  resolveDpnsName,
} from "../src/dash/resolveRecipient";
import type { DashSdk } from "../src/dash/types";

function sdkWith(resolve: (name: string) => Promise<string | null>): DashSdk {
  return {
    dpns: {
      resolveName: vi.fn(resolve),
      username: vi.fn(),
    },
  } as unknown as DashSdk;
}

describe("normalizeDpnsName", () => {
  it("lowercases and appends .dash if missing", () => {
    expect(normalizeDpnsName("Alice")).toBe("alice.dash");
    expect(normalizeDpnsName("ALICE.DASH")).toBe("alice.dash");
    expect(normalizeDpnsName("  alice.dash  ")).toBe("alice.dash");
    expect(normalizeDpnsName("alice.dash")).toBe("alice.dash");
  });
});

describe("resolveDpnsName", () => {
  it("passes the normalized full name to the SDK", async () => {
    const resolveName = vi
      .fn<(name: string) => Promise<string>>()
      .mockResolvedValue("identity-id-abc");
    const sdk = {
      dpns: { resolveName, username: vi.fn() },
    } as unknown as DashSdk;

    const id = await resolveDpnsName(sdk, "Alice");
    expect(resolveName).toHaveBeenCalledWith("alice.dash");
    expect(id).toBe("identity-id-abc");
  });

  it("also works when the caller already included .dash", async () => {
    const resolveName = vi
      .fn<(name: string) => Promise<string>>()
      .mockResolvedValue("identity-id-abc");
    const sdk = {
      dpns: { resolveName, username: vi.fn() },
    } as unknown as DashSdk;

    await resolveDpnsName(sdk, "Alice.DASH");
    expect(resolveName).toHaveBeenCalledWith("alice.dash");
  });

  it("throws a user-friendly error when the name does not resolve", async () => {
    const sdk = sdkWith(async () => null);
    await expect(resolveDpnsName(sdk, "nobody")).rejects.toThrow(
      'No identity found for "nobody.dash"',
    );
  });

  it("throws when the SDK returns a non-string (e.g. undefined)", async () => {
    const sdk = sdkWith(async () => null);
    await expect(resolveDpnsName(sdk, "nobody")).rejects.toThrow(
      /No identity found/,
    );
  });
});
