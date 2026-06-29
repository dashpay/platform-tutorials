import { formatAverage } from "../lib/format";

export function StarMeter({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  const clamped = value === null ? null : Math.max(0, Math.min(5, value));
  const fillPercent = clamped === null ? 0 : clamped * 20;
  const label =
    clamped === null ? "No rating yet" : `${formatAverage(clamped)} out of 5`;
  return (
    <span
      className={className ? `star-meter ${className}` : "star-meter"}
      role="img"
      aria-label={label}
    >
      <span className="star-meter-track" aria-hidden="true">
        ★★★★★
      </span>
      <span
        className="star-meter-fill"
        aria-hidden="true"
        style={{ width: `${fillPercent}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}
