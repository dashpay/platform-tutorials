import { expect, it, vi } from "vitest";
import { missingDocumentTypes } from "../src/dash/registryCheck";
import { contract, id, sdk } from "./helpers";

function registry(...types: string[]) {
  return {
    ...contract(),
    schemas: Object.fromEntries(types.map((type) => [type, {}])),
  };
}

it("lists the document types an older registry lacks", async () => {
  const client = sdk();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([[id(7), registry("appMetadata", "appRating")]]),
  );
  expect(await missingDocumentTypes(client, id(7))).toEqual([
    "appEndorsement",
    "appReview",
  ]);
});

it("passes a current registry and a missing contract", async () => {
  const client = sdk();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([[id(7), registry("appMetadata", "appEndorsement", "appReview")]]),
  );
  expect(await missingDocumentTypes(client, id(7))).toEqual([]);
  expect(await missingDocumentTypes(client, id(8))).toEqual([]);
});

it("fetches each registry once per connection and retries a failure", async () => {
  const client = sdk();
  vi.mocked(client.contracts.getMany).mockRejectedValueOnce(
    new Error("timeout"),
  );
  await expect(missingDocumentTypes(client, id(7))).rejects.toThrow("timeout");
  await missingDocumentTypes(client, id(7));
  await missingDocumentTypes(client, id(7));
  expect(client.contracts.getMany).toHaveBeenCalledTimes(2);
});
