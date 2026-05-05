import { describe, expect, it } from "vitest";

import { detectSecretShape } from "../src/lib/detectSecretShape";

describe("detectSecretShape", () => {
  it("returns mnemonic for a 12-word phrase", () => {
    expect(
      detectSecretShape(
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      ),
    ).toBe("mnemonic");
  });

  it("returns mnemonic for a 24-word phrase", () => {
    const phrase = Array(24).fill("word").join(" ");
    expect(detectSecretShape(phrase)).toBe("mnemonic");
  });

  it("returns wif for a base58 string with no whitespace", () => {
    expect(
      detectSecretShape("cVHcfvcWNc7DvqaPCwM6Z3DqZqZqZqZqZqZqZqZqZqZqZqZqZqZq"),
    ).toBe("wif");
  });

  it("returns wif for hex (no whitespace) — parser will reject downstream", () => {
    expect(
      detectSecretShape(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ),
    ).toBe("wif");
  });

  it("returns wif for empty input — parser will reject downstream", () => {
    expect(detectSecretShape("")).toBe("wif");
  });

  it("returns wif for a single word — parser will reject downstream", () => {
    expect(detectSecretShape("abandon")).toBe("wif");
  });

  it("treats leading/trailing whitespace around a WIF as wif (after trim)", () => {
    expect(detectSecretShape("   cVHcfvcWNc7DvqaPCwM6Z3DqZ   ")).toBe("wif");
  });

  it("returns mnemonic when interior whitespace is present even with stray text", () => {
    expect(detectSecretShape("note: abandon abandon")).toBe("mnemonic");
  });
});
