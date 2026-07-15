import type { ReassignableRuleKind, TokenActionKind } from "../dash/contract";

type CapabilityIconKind = ReassignableRuleKind | TokenActionKind | string;

function normalizeKind(kind: CapabilityIconKind): string {
  if (kind === "manualMinting" || kind === "mint") return "mint";
  if (kind === "manualBurning" || kind === "burn") return "burn";
  if (kind === "freeze") return "freeze";
  if (kind === "unfreeze") return "unfreeze";
  if (kind === "destroyFrozenFunds" || kind === "destroyFrozen") {
    return "destroyFrozen";
  }
  if (kind === "emergencyAction" || kind === "emergency") return "emergency";
  return "config";
}

function iconPath(kind: string) {
  switch (kind) {
    case "mint":
      return (
        <>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </>
      );
    case "burn":
      return (
        <>
          <path d="M8.8 14.4c0-2.4 2.1-3.5 2.1-6.4 2 1.4 4.3 3.7 4.3 6.4a3.2 3.2 0 0 1-6.4 0Z" />
          <path d="M12 20a6 6 0 0 0 6-6c0-3.4-2.1-6.1-5.9-9.7.2 3.4-2.8 4.8-4.1 7.2A6 6 0 0 0 12 20Z" />
        </>
      );
    case "freeze":
      return (
        <>
          <path d="M12 3v18" />
          <path d="m5 7 14 10" />
          <path d="m19 7-14 10" />
          <path d="m9 5 3 3 3-3" />
          <path d="m9 19 3-3 3 3" />
        </>
      );
    case "unfreeze":
      return (
        <>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.5v2" />
          <path d="M12 19.5v2" />
          <path d="m4.9 4.9 1.4 1.4" />
          <path d="m17.7 17.7 1.4 1.4" />
          <path d="M2.5 12h2" />
          <path d="M19.5 12h2" />
          <path d="m4.9 19.1 1.4-1.4" />
          <path d="m17.7 6.3 1.4-1.4" />
        </>
      );
    case "destroyFrozen":
      return (
        <>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </>
      );
    case "emergency":
      return (
        <>
          <path d="M12 3 5 6v5c0 4.3 2.9 8.2 7 10 4.1-1.8 7-5.7 7-10V6l-7-3Z" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </>
      );
    default:
      return (
        <>
          <path d="M12 3v18" />
          <path d="M3 12h18" />
        </>
      );
  }
}

export function CapabilityIcon({
  kind,
  accent,
  className = "capability-icon",
}: {
  kind: CapabilityIconKind;
  accent?: string;
  className?: string;
}) {
  const normalized = normalizeKind(kind);
  const classes = [className, accent].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        {iconPath(normalized)}
      </svg>
    </span>
  );
}
