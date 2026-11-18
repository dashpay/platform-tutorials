import { useEffect, useState } from "react";
import { DEFAULT_CONTRACT_IDS } from "../dash/contractStore";
import { missingDocumentTypes } from "../dash/registryCheck";
import type { Network, ReadSdk } from "../dash/types";

export type RegistryCheck = "checking" | "current" | "outdated";

/**
 * Whether a saved registry has the document types this app reads. The
 * default registry is known to; a failed check lets the views report errors.
 */
export function useRegistryCheck(
  sdk: ReadSdk | undefined,
  registryId: string,
  network: Network,
): RegistryCheck {
  const known = !registryId || registryId === DEFAULT_CONTRACT_IDS[network];
  const [result, setResult] = useState<{ id: string; outdated: boolean }>();

  useEffect(() => {
    if (!sdk || known) return;
    let active = true;
    missingDocumentTypes(sdk, registryId).then(
      (missing) => {
        if (active) setResult({ id: registryId, outdated: missing.length > 0 });
      },
      () => {
        if (active) setResult({ id: registryId, outdated: false });
      },
    );
    return () => {
      active = false;
    };
  }, [sdk, registryId, known]);

  if (known) return "current";
  if (result?.id !== registryId) return "checking";
  return result.outdated ? "outdated" : "current";
}
