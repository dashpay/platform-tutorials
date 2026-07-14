import { useCallback, useEffect, useRef, useState } from "react";

import { PendingActionsView } from "./PendingActionsView";
import { ProposeActionPanel } from "./ProposeActionPanel";
import {
  fetchTokenOpsGovernance,
  type TokenOpsGovernance,
} from "../dash/governance";
import { errorMessage } from "../dash/logger";
import { useSession } from "../session/useSession";

export function ActionsView({ onComplete }: { onComplete?: () => void }) {
  const session = useSession();
  const [governance, setGovernance] = useState<TokenOpsGovernance | null>(null);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refreshGovernance = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!session.sdk || !session.contractId) {
      setGovernance(null);
      setGovernanceError(null);
      return null;
    }
    setGovernanceError(null);
    try {
      const nextGovernance = await fetchTokenOpsGovernance({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      if (currentRequestId === requestId.current) {
        setGovernance(nextGovernance);
      }
      return nextGovernance;
    } catch (err) {
      if (currentRequestId === requestId.current) {
        setGovernance(null);
        setGovernanceError(errorMessage(err));
      }
      return null;
    }
  }, [session.contractId, session.sdk]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshGovernance(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshGovernance]);

  return (
    <div className="actions-screen">
      {governanceError && <div className="notice error">{governanceError}</div>}
      <ProposeActionPanel governance={governance} onComplete={onComplete} />
      <PendingActionsView
        governance={governance}
        refreshGovernance={refreshGovernance}
      />
    </div>
  );
}
