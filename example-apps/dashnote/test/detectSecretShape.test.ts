import { describe, expect, it } from "vitest";

import { detectSecretShape, looksLikeWif } from "../src/lib/detectSecretShape";

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

describe("looksLikeWif", () => {
  // Real-shape testnet WIFs: 52-char compressed and 51-char uncompressed.
  const compressed = "cVHcfvcWNc7DvqaPCwM6Z3DqZQqZqZqZqZqZqZqZqZqZqZqZqZqZ";
  const uncompressed = "9JbT9rkLcXzVqUsMNvFvHJtKdwYZHGfRbScVTpQrLnBxAyEoMmL";

  it("accepts 52-char base58 input (compressed WIF length)", () => {
    expect(compressed).toHaveLength(52);
    expect(looksLikeWif(compressed)).toBe(true);
  });

  it("accepts 51-char base58 input (uncompressed WIF length)", () => {
    expect(uncompressed).toHaveLength(51);
    expect(looksLikeWif(uncompressed)).toBe(true);
  });

  it("rejects input shorter than 51 chars (still typing)", () => {
    expect(looksLikeWif("cVHcfvcWNc7Dvqa")).toBe(false);
    expect(looksLikeWif("")).toBe(false);
  });

  it("rejects input longer than 52 chars", () => {
    expect(looksLikeWif(`${compressed}X`)).toBe(false);
  });

  it("rejects input containing characters outside the base58 alphabet", () => {
    // 0, O, I, l are excluded from base58.
    const withZero = `0${compressed.slice(1)}`;
    const withCapitalO = `O${compressed.slice(1)}`;
    const withCapitalI = `I${compressed.slice(1)}`;
    const withLowercaseL = `l${compressed.slice(1)}`;
    expect(looksLikeWif(withZero)).toBe(false);
    expect(looksLikeWif(withCapitalO)).toBe(false);
    expect(looksLikeWif(withCapitalI)).toBe(false);
    expect(looksLikeWif(withLowercaseL)).toBe(false);
  });

  it("rejects hex containing '0' (excluded from base58)", () => {
    const hexWithZero = "0".repeat(52);
    expect(looksLikeWif(hexWithZero)).toBe(false);
  });

  it("ACCEPTS 52-char hex without '0' — gate is structural, not semantic", () => {
    // Documents intentional behavior: hex 1-9 + a-f is a subset of base58, so
    // a 52-char hex string of those characters passes the structural gate.
    // The downstream PrivateKey.fromWIF parser is responsible for catching
    // it (bad checksum / version byte). The eager-preview UI must not error
    // on this — it falls into the silent "idle" branch via UnknownIdentity
    // or a generic parse rejection.
    // 52 chars of hex digits, all of which are also valid base58 (1-9 a-f).
    const hexNoZero = "abcdef123456789".repeat(4).slice(0, 52);
    expect(hexNoZero).toHaveLength(52);
    expect(looksLikeWif(hexNoZero)).toBe(true);
  });

  it("trims whitespace before measuring length", () => {
    expect(looksLikeWif(`  ${compressed}  `)).toBe(true);
  });

  it("rejects mnemonic-shaped input (whitespace breaks length+charset)", () => {
    expect(
      looksLikeWif(
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      ),
    ).toBe(false);
  });
});
