import { createContext } from "react";
import type { SessionValue } from "./types";

/**
 * Lives in its own module so SessionContext.tsx exports only components —
 * otherwise Vite's fast refresh can't hot-update the provider.
 */
export const SessionContext = createContext<SessionValue | null>(null);
