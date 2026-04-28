export interface OperationResult {
  kind: "success" | "error";
  message: string;
}

export interface OperationResultNoticeProps {
  result: OperationResult;
}

export function OperationResultNotice({ result }: OperationResultNoticeProps) {
  const isError = result.kind === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={
        isError
          ? "rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] text-danger"
          : "rounded-md border border-line-2 bg-bg px-3 py-2 text-[12px] text-accent"
      }
    >
      {result.message}
    </div>
  );
}
