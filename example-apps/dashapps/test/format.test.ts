import { expect, it } from "vitest";
import { formatAverage, pluralize, timeAgo } from "../src/lib/format";

it("formats averages to one decimal and dashes missing values", () => {
  expect(formatAverage(4.333)).toBe("4.3");
  expect(formatAverage(5)).toBe("5.0");
  expect(formatAverage(null)).toBe("–");
  expect(formatAverage(Number.NaN)).toBe("–");
});

it("pluralizes bigint and number counts", () => {
  expect(pluralize(1n, "rating")).toBe("1 rating");
  expect(pluralize(27n, "rating")).toBe("27 ratings");
  expect(pluralize(0, "rating")).toBe("0 ratings");
});

it("labels relative time by the largest whole unit", () => {
  const now = 1_700_000_000_000;
  expect(timeAgo(undefined, now)).toBe("Date not provided");
  expect(timeAgo(now - 5_000, now)).toBe("just now");
  expect(timeAgo(BigInt(now - 3 * 86_400_000), now)).toMatch(/3 days ago/);
  expect(timeAgo(now - 8 * 86_400_000, now)).toMatch(/1 week ago/);
  expect(timeAgo(now - 90 * 60_000, now)).toMatch(/1 hour ago/);
});
