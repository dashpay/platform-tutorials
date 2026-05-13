import { useCallback, useState } from "react";

import { registerContract } from "../dash/contract";
import { errorMessage } from "../lib/logger";
import { useSession } from "../session/useSession";

export interface UseContractRegistrationResult {
  register: () => Promise<string | null>;
  registering: boolean;
  error: string | null;
  clearError: () => void;
}

export function useContractRegistration(): UseContractRegistrationResult {
  const session = useSession();
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async () => {
    if (!session.sdk || !session.keyManager) return null;
    setError(null);
    setRegistering(true);
    try {
      const contractId = await registerContract({
        sdk: session.sdk,
        keyManager: session.keyManager,
        log: session.log,
      });
      session.setContractId(contractId);
      return contractId;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setRegistering(false);
    }
  }, [session]);

  const clearError = useCallback(() => setError(null), []);

  return { register, registering, error, clearError };
}
