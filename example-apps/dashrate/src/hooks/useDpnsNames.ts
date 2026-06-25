import { useEffect, useState } from "react";
import { resolveDpnsName } from "../dash/resolveDpnsName";
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
      try {
        const activeSdk = session?.sdk ?? (await connectReadOnly());
        const resolved = await Promise.all(
          pending.map(
            async (id) => [id, await resolveDpnsName(activeSdk, id)] as const,
          ),
        );
        if (!cancelled) {
          setDpnsNames((prev) => ({
            ...prev,
            ...Object.fromEntries(resolved),
          }));
        }
      } catch {
        // Name resolution is best-effort; the UI falls back to short IDs.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectReadOnly, dpnsNames, myReviews, reviews, session]);

  return dpnsNames;
}
