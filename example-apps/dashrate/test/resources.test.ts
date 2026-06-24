import { describe, expect, it } from "vitest";
import {
  RESOURCES,
  findResource,
  type RatedResource,
} from "../src/catalog/resources";

const CATEGORIES: RatedResource["category"][] = [
  "Tutorial",
  "Example App",
  "Reference",
];

describe("resource catalog integrity", () => {
  it("has unique ids", () => {
    // Each id is persisted into a review's resourceId and used as a lookup
    // key, so a duplicate or shadowed id would be a real app bug.
    const ids = RESOURCES.map((resource) => resource.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids fit the contract's resourceId field (1–63 chars)", () => {
    // contract.ts caps resourceId at maxLength 63; an over-long catalog id
    // would fail every review write for that resource.
    for (const { id } of RESOURCES) {
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(id.length).toBeLessThanOrEqual(63);
    }
  });

  it("every entry has non-empty display fields and a valid category", () => {
    for (const resource of RESOURCES) {
      expect(resource.title.trim()).not.toBe("");
      expect(resource.summary.trim()).not.toBe("");
      expect(resource.href.trim()).not.toBe("");
      expect(CATEGORIES).toContain(resource.category);
    }
  });
});

describe("findResource", () => {
  // The lookup App.tsx uses to resolve the selected resource and review titles.
  it("returns the entry matching an id", () => {
    const first = RESOURCES[0];
    expect(findResource(first.id)).toBe(first);
  });

  it("returns undefined for an unknown id", () => {
    expect(findResource("not-a-real-resource")).toBeUndefined();
  });
});
