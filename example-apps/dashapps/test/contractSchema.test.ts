import { expect, it } from "vitest";
import {
  APP_METADATA_SCHEMAS,
  DOCUMENT_TYPE,
  RATING_DOCUMENT_TYPE,
} from "../src/dash/contract";

type Index = {
  name: string;
  unique?: boolean;
  properties: readonly Record<string, string>[];
  countable?: string;
  summable?: string;
  rangeCountable?: boolean;
};
type Schema = {
  properties: Record<string, { position: number }>;
  required: readonly string[];
  indices: readonly Index[];
};
const rating = APP_METADATA_SCHEMAS[RATING_DOCUMENT_TYPE] as unknown as Schema;

it("declares both registry document types with sequential positions", () => {
  expect(Object.keys(APP_METADATA_SCHEMAS)).toEqual([
    DOCUMENT_TYPE,
    RATING_DOCUMENT_TYPE,
  ]);
  for (const schema of Object.values(APP_METADATA_SCHEMAS) as Schema[]) {
    const positions = Object.values(schema.properties)
      .map((property) => property.position)
      .sort((left, right) => left - right);
    expect(positions).toEqual(positions.map((_, index) => index));
  }
});

it("requires stars and the rated contract, and bounds stars to 1–5", () => {
  expect(rating.required).toEqual([
    "$createdAt",
    "$updatedAt",
    "contractId",
    "stars",
  ]);
  expect(rating.properties.stars).toMatchObject({
    type: "integer",
    minimum: 1,
    maximum: 5,
  });
  expect(rating.properties.contractId).toMatchObject({
    byteArray: true,
    minItems: 32,
    maxItems: 32,
    contentMediaType: "application/x.dash.dpp.identifier",
  });
});

it("indexes one rating per identity, a range-countable stars index and recency", () => {
  const byName = new Map(rating.indices.map((index) => [index.name, index]));
  expect(byName.get("ownerContract")).toMatchObject({
    unique: true,
    properties: [{ $ownerId: "asc" }, { contractId: "asc" }],
  });
  // Range/grouped counts need rangeCountable with the range field LAST.
  expect(byName.get("byContractStars")).toMatchObject({
    properties: [{ contractId: "asc" }, { stars: "asc" }],
    countable: "countable",
    rangeCountable: true,
  });
  expect(byName.get("byContractCreated")).toMatchObject({
    properties: [{ contractId: "asc" }, { $createdAt: "asc" }],
  });
});

it("never combines summable with a deeper count-only index on a shared prefix (#3960)", () => {
  for (const schema of Object.values(APP_METADATA_SCHEMAS) as Schema[]) {
    const indices = schema.indices.map((index) => ({
      ...index,
      path: index.properties.map((property) => Object.keys(property)[0]),
    }));
    for (const index of indices) expect(index.summable).toBeUndefined();
    for (const parent of indices) {
      if (!parent.countable && !parent.summable) continue;
      for (const child of indices) {
        if (child === parent || child.path.length <= parent.path.length)
          continue;
        const shared = parent.path.every(
          (segment, position) => child.path[position] === segment,
        );
        if (!shared) continue;
        // A shared-prefix aggregate parent must not be count+sum while the
        // continuation is count-only.
        expect(Boolean(parent.summable)).toBe(Boolean(child.summable));
      }
    }
  }
});
