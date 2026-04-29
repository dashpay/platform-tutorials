// Use the default Node test environment (not jsdom): jsdom's File polyfill
// returns the bytes of the string "[object File]" from File.arrayBuffer(),
// which would make this regression test useless. Node 20+ provides a working
// global File backed by Undici's Blob implementation.

import { describe, expect, it } from "vitest";

import { bytesToHex, hashFile } from "../src/lib/hash";

describe("hashFile", () => {
  it("hashes binary (non-UTF-8) bytes correctly", async () => {
    // 0xFF 0xFE is invalid UTF-8 — a TextEncoder-based fallback would
    // corrupt these bytes into the U+FFFD replacement character before
    // hashing. SHA-256 of [0xFF, 0xFE] is precomputed below.
    const bytes = Uint8Array.from([0xff, 0xfe]);
    const file = new File([bytes], "binary.bin", {
      type: "application/octet-stream",
    });

    const digest = await hashFile(file);
    expect(bytesToHex(digest)).toBe(
      "b3d510ef04275ca8e698e5b3cbb0ece3949ef9252f0cdc839e9ee347409a2209",
    );
  });

  it("hashes empty files to the SHA-256 empty digest", async () => {
    const file = new File([], "empty.bin");
    const digest = await hashFile(file);
    expect(bytesToHex(digest)).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
