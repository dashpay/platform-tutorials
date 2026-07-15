import { describe, expect, it } from "vitest";

import { keyManagerFromKey } from "../src/session/keyManagerFromKey";

describe("keyManagerFromKey", () => {
  it("adapts a resolved auth tuple to the DashKeyManager shape", async () => {
    const auth = {
      identity: { id: "identity-1" },
      identityKey: { id: 2 },
      signer: { addKeyFromWif: () => undefined },
    };

    const manager = keyManagerFromKey("identity-1", auth as never);

    expect(manager.identityId).toBe("identity-1");
    await expect(manager.getAuth()).resolves.toBe(auth);
  });
});
