import { formatAverage } from "../lib/format";

export function StarMeter({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  const fillPercent = value === null ? 0 : Math.max(0, Math.min(5, value)) * 20;
  const label =
    value === null ? "No rating yet" : `${formatAverage(value)} out of 5`;
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
