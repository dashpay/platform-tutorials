import { useEffect, useState } from "react";
import { lookupDpnsName } from "../dash/resolveDpnsName";
import type { DashSdk } from "../dash/types";
import type { ReviewRecord } from "../dash/queries";
import type { Session } from "../session/types";

interface UseDpnsNamesArgs {
  reviews: ReviewRecord[];
  myReviews: ReviewRecord[];
  session: Session | null;
  connectReadOnly: () => Promise<DashSdk>;
}

export function useDpnsNames({
  reviews,
  myReviews,
  session,
  connectReadOnly,
}: UseDpnsNamesArgs): Record<string, string | null> {
  const [dpnsNames, setDpnsNames] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const candidates = new Set<string>();
    for (const review of reviews) candidates.add(review.ownerId);
    for (const review of myReviews) candidates.add(review.ownerId);
    if (session) candidates.add(session.identityId);
    const pending = [...candidates].filter((id) => id && !(id in dpnsNames));
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      let activeSdk: DashSdk;
      try {
        activeSdk = session?.sdk ?? (await connectReadOnly());
      } catch {
        // Couldn't get an SDK; leave every id pending so a later run retries.
        return;
      }
      // Cache confirmed hits/misses, but leave transient failures pending so a
      // later render can retry instead of permanently falling back to short IDs.
      const resolved = await Promise.all(
        pending.map(async (id) => {
          try {
            return [id, await lookupDpnsName(activeSdk, id)] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const entries = resolved.filter(
        (entry): entry is readonly [string, string | null] => entry !== null,
      );
      if (entries.length === 0) return;
      setDpnsNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [connectReadOnly, dpnsNames, myReviews, reviews, session]);

  return dpnsNames;
}
