import { formatAverage } from "../lib/format";

/** Partial-fill star renderer: a 4.3 average fills 86% of five stars. */
export function StarMeter({
  value,
  className,
  label,
}: {
  value: number | null;
  className?: string;
  label?: string;
}) {
  const clamped = value === null ? null : Math.max(0, Math.min(5, value));
  const fill = clamped === null ? 0 : clamped * 20;
  return (
    <span
      className={className ? `star-meter ${className}` : "star-meter"}
      role="img"
      aria-label={
        label ??
        (clamped === null
          ? "No rating yet"
          : `${formatAverage(clamped)} out of 5 stars`)
      }
    >
      <span className="star-meter-track" aria-hidden="true">
        ★★★★★
      </span>
      <span
        className="star-meter-fill"
        aria-hidden="true"
        style={{ width: `${fill}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}
