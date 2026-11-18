import { useEffect, useState } from "react";
import { DEFAULT_CONTRACT_IDS } from "../dash/contractStore";
import { missingDocumentTypes } from "../dash/registryCheck";
import type { Network, ReadSdk } from "../dash/types";

export type RegistryCheck = "checking" | "current" | "outdated" | "failed";

/**
 * Whether a saved registry has the document types this app reads. The
 * default registry is known to, so it is never checked.
 */
export function useRegistryCheck(
  sdk: ReadSdk | undefined,
  registryId: string,
  network: Network,
): { status: RegistryCheck; retry(): void } {
  const known = !registryId || registryId === DEFAULT_CONTRACT_IDS[network];
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    id: string;
    attempt: number;
    status: RegistryCheck;
  }>();

  useEffect(() => {
    if (!sdk || known) return;
    let active = true;
    missingDocumentTypes(sdk, registryId).then(
      (missing) => {
        if (active)
          setResult({
            id: registryId,
            attempt,
            status: missing.length ? "outdated" : "current",
          });
      },
      () => {
        if (active) setResult({ id: registryId, attempt, status: "failed" });
      },
    );
    return () => {
      active = false;
    };
  }, [sdk, registryId, known, attempt]);

  const retry = () => setAttempt((value) => value + 1);
  if (known) return { status: "current", retry };
  if (result?.id !== registryId || result.attempt !== attempt)
    return { status: "checking", retry };
  return { status: result.status, retry };
}
