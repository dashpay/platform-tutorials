import { useContext } from "react";
import { SessionContext } from "./context";
import type { SessionValue } from "./types";

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return value;
}
