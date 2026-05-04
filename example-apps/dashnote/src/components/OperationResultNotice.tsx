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
    "border-[oklch(38%_0.08_150)] bg-[oklch(24%_0.03_150)] text-ink max-md:bg-transparent max-md:rounded-none max-md:border-0 max-md:border-l-2 max-md:border-l-[oklch(38%_0.08_150)] max-md:px-3",
  error:
    "border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] text-[oklch(84%_0.08_25)] max-md:bg-transparent max-md:rounded-none max-md:border-0 max-md:border-l-2 max-md:border-l-[oklch(30%_0.08_25)] max-md:px-3",
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
      className={`rounded-lg border px-4 py-3 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-4 max-md:py-3 ${toneClass[tone]}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-6">{children}</div>
    </div>
  );
}
