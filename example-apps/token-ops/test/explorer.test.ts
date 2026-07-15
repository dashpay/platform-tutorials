import { describe, expect, it } from "vitest";
import { explorerUrl, type ExplorerKind } from "../src/lib/explorer";

describe("explorerUrl", () => {
  it("builds a testnet Platform Explorer URL from kind + id", () => {
    expect(explorerUrl("identity", "abc123")).toBe(
      "https://testnet.platform-explorer.com/identity/abc123",
    );
  });

  it("maps each ExplorerKind to its path segment verbatim", () => {
    const cases: Array<[ExplorerKind, string]> = [
      ["identity", "identity"],
      ["dataContract", "dataContract"],
      ["token", "token"],
      ["document", "document"],
    ];
    for (const [kind, segment] of cases) {
      expect(explorerUrl(kind, "ID")).toBe(
        `https://testnet.platform-explorer.com/${segment}/ID`,
      );
    }
  });
});
