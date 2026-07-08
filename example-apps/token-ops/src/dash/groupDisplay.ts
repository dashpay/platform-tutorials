import type { RuleInfo } from "./governance";

export interface Category {
  label: string;
  accent: string;
}

/**
 * Capability categories describe domains, not group names. A group receives a
 * domain only because its current operator rules include that capability.
 */
export const CATEGORY_BY_RULE_KEY: Record<string, Category> = {
  manualMinting: { label: "Treasury", accent: "green" },
  manualBurning: { label: "Treasury", accent: "green" },
  freeze: { label: "Access", accent: "orange" },
  unfreeze: { label: "Access", accent: "orange" },
  destroyFrozenFunds: { label: "Access", accent: "orange" },
  emergencyAction: { label: "Emergency", accent: "purple" },
};

const CONFIG_CATEGORY: Category = { label: "Config", accent: "blue" };
const EMPTY_GROUP_ACCENT = CONFIG_CATEGORY.accent;

export function ruleCategory(ruleKey: string): Category {
  return CATEGORY_BY_RULE_KEY[ruleKey] ?? CONFIG_CATEGORY;
}

export function deriveGroupDomain(
  groupPosition: number,
  rules: RuleInfo[],
): Category | null {
  let firstCategory: Category | null = null;

  // Group identity is a single summary domain. Emergency wins because it is the
  // highest-impact capability when a reassigned group spans multiple domains.
  for (const rule of rules) {
    if (
      rule.operator.type !== "Group" ||
      rule.operator.groupPosition !== groupPosition
    ) {
      continue;
    }

    const category = ruleCategory(rule.key);
    if (category.label === "Emergency") return category;
    firstCategory ??= category;
  }

  return firstCategory;
}

export function groupDisplay(
  groupPosition: number,
  rules: RuleInfo[],
): { position: number; domain: string | null; accent: string } {
  const category = deriveGroupDomain(groupPosition, rules);
  return {
    position: groupPosition,
    domain: category?.label ?? null,
    accent: category?.accent ?? EMPTY_GROUP_ACCENT,
  };
}

export function formatGroupIdentity(
  groupPosition: number,
  rules: RuleInfo[],
): string {
  const display = groupDisplay(groupPosition, rules);
  return `Group ${display.position} · ${display.domain ?? "no capabilities"}`;
}
