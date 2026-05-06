import type { ReactNode } from "react";

interface OperationResultNoticeProps {
  tone?: "info" | "success" | "error";
  title: string;
  children: ReactNode;
}

const toneClass: Record<
  NonNullable<OperationResultNoticeProps["tone"]>,
  string
> = {
  info: "border-line bg-surface text-ink-2",
  success:
    "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-fg)]",
  error:
    "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-fg)]",
};

export function OperationResultNotice({
  tone = "info",
  title,
  children,
}: OperationResultNoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-lg border px-4 py-3 ${toneClass[tone]}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-6">{children}</div>
    </div>
  );
}
