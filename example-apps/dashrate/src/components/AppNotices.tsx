export function AppNotices({
  status,
  hasContract,
}: {
  status: string;
  hasContract: boolean;
}) {
  return (
    <>
      {status && (
        <p className="status" aria-live="polite">
          {status}
        </p>
      )}
      {!hasContract && (
        <p className="notice">
          No active contract is set. Sign in and register a DashRate contract,
          or paste an existing contract ID in Settings.
        </p>
      )}
    </>
  );
}
