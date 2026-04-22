import { useContext } from 'react';

import { SessionContext, type SessionValue } from './SessionContext';

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>.');
  }
  return ctx;
}
