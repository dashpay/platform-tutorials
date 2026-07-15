import { describe, expect, it } from "vitest";

import { detectSecretShape } from "../src/lib/detectSecretShape";

describe("detectSecretShape", () => {
  it("detects whitespace-separated mnemonics", () => {
    expect(detectSecretShape("abandon abandon abandon")).toBe("mnemonic");
    expect(detectSecretShape("word\nword")).toBe("mnemonic");
  });

  it("treats single-token input as WIF-shaped", () => {
    expect(detectSecretShape("cVHcfvcWNc7DvqaPCwM6Z3DqZ")).toBe("wif");
    expect(detectSecretShape("   cVHcfvcWNc7DvqaPCwM6Z3DqZ   ")).toBe("wif");
    expect(detectSecretShape("")).toBe("wif");
  });
});
