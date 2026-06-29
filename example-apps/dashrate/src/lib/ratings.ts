import type { RatingDistribution, RatingSummary } from "../dash/queries";
import { shortId } from "./format";

export const RATING_ROWS = [5, 4, 3, 2, 1] as const;

export const emptySummary = (resourceId: string): RatingSummary => ({
  resourceId,
  count: 0n,
  sum: 0n,
  average: null,
});

export const emptyDistribution = (): RatingDistribution => ({
  1: 0n,
  2: 0n,
  3: 0n,
  4: 0n,
  5: 0n,
});

export function ownerLabel(
  ownerId: string,
  dpnsNames: Record<string, string | null>,
): string {
  const name = dpnsNames[ownerId];
  return name ? name : shortId(ownerId);
}

export function reviewCountLine(summary: RatingSummary): string {
  if (summary.count === 0n || summary.average === null) return "No reviews yet";
  const noun = summary.count === 1n ? "review" : "reviews";
  return `${summary.count.toString()} ${noun}`;
}

export function stars(value: number | null): string {
  if (value === null) return "No rating";
  const rounded = Math.round(value);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}
