export function AppNotices({
  status,
  hasContract,
}: {
  status: string;
  hasContract: boolean;
}) {
  return (
    <>
      {status && <p className="status">{status}</p>}
      {!hasContract && (
        <p className="notice">
          No default contract is bundled yet. Sign in and register a DashRate
          contract, or paste an existing contract ID in Settings.
        </p>
      )}
    </>
  );
}
