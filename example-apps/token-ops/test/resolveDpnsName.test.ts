import { describe, expect, it, vi } from "vitest";

import { lookupDpnsName, resolveDpnsName } from "../src/dash/resolveDpnsName";
import type { DashSdk } from "../src/dash/types";

function sdkWith(username: ReturnType<typeof vi.fn>): DashSdk {
  return { dpns: { username } } as unknown as DashSdk;
}

describe("lookupDpnsName", () => {
  it("strips the .dash suffix for display", async () => {
    const username = vi.fn(async () => "alice.dash");

    await expect(lookupDpnsName(sdkWith(username), "id-1")).resolves.toBe(
      "alice",
    );
    expect(username).toHaveBeenCalledWith("id-1");
  });

  it("returns null when no DPNS name exists", async () => {
    const username = vi.fn(async () => null);

    await expect(lookupDpnsName(sdkWith(username), "id-1")).resolves.toBeNull();
  });
});

describe("resolveDpnsName", () => {
  it("returns null when lookup fails", async () => {
    const username = vi.fn(async () => {
      throw new Error("dpns unavailable");
    });

    await expect(
      resolveDpnsName(sdkWith(username), "id-1"),
    ).resolves.toBeNull();
  });
});
