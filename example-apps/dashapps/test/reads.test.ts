import { expect, it, vi } from "vitest";
import { contractFacts } from "../src/dash/contractFacts";
import {
  searchKeywords,
  shortDescription,
  KEYWORD_CONTRACT_ID,
} from "../src/dash/keywordSearch";
import { normalizeUrl, UrlValidationError } from "../src/lib/urls";
import { idToBytes } from "../src/dash/ids";
import { contract, id, sdk } from "./helpers";
it("reads contract facts without unsafe token JSON serialization", () => {
  const handle = {
    ...contract(),
    toJSON: () => {
      throw new Error("u64 exceeds safe integer");
    },
  };
  expect(contractFacts(handle, 13)).toEqual({
    ownerId: id(1),
    version: 1,
    description: "Example contract",
    keywords: ["notes"],
    documentTypes: ["note"],
  });
  expect(() =>
    contractFacts({ ...handle, toObject: () => ({ keywords: "bad" }) }, 13),
  ).toThrow();
});
it("lowercases keywords and uses the last document ID for continuation, deduplicating targets", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValue(
    Array.from({ length: 100 }, (_, i) => ({
      id: id(i + 200),
      properties: { contractId: idToBytes(id(i % 2)) },
    })),
  );
  const result = await searchKeywords(client, " APPS ", id(50));
  expect(result).toEqual({ ids: [id(0), id(1)], cursor: id(299) });
  expect(client.documents.query).toHaveBeenCalledWith({
    dataContractId: KEYWORD_CONTRACT_ID,
    documentTypeName: "contractKeywords",
    where: [["keyword", "==", "apps"]],
    limit: 100,
    startAfter: id(50),
  });
});
it("queries short description with JSON-safe base58 identifiers and preserves failures", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValue([
    { properties: { description: "An app" } },
  ]);
  expect(await shortDescription(client, id(2))).toBe("An app");
  expect(client.documents.query).toHaveBeenCalledWith(
    expect.objectContaining({
      where: [["contractId", "==", id(2)]],
      limit: 1,
    }),
  );
  vi.mocked(client.documents.query).mockRejectedValue(new Error("offline"));
  await expect(shortDescription(client, id(2))).rejects.toThrow("offline");
});
it("normalizes optional URLs and blocks unsafe protocols and oversize values", () => {
  expect(normalizeUrl("  ")).toBeUndefined();
  expect(normalizeUrl(" HTTPS://EXAMPLE.COM ")).toBe("https://example.com/");
  expect(normalizeUrl("http://localhost")).toBe("http://localhost/");
  for (const input of [
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///tmp/x",
    "relative/path",
    "https://example.com/" + "a".repeat(256),
  ])
    expect(() => normalizeUrl(input)).toThrow(UrlValidationError);
});
