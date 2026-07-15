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
const POSITION_ACCENTS = [
  "green",
  "orange",
  "purple",
  "blue",
  "teal",
  "red",
] as const;

export function ruleCategory(ruleKey: string): Category {
  return CATEGORY_BY_RULE_KEY[ruleKey] ?? CONFIG_CATEGORY;
}

export function groupCapabilities(
  groupPosition: number,
  rules: RuleInfo[],
): RuleInfo[] {
  return rules.filter(
    (rule) =>
      rule.operator.type === "Group" &&
      rule.operator.groupPosition === groupPosition,
  );
}

export function deriveGroupDomains(
  groupPosition: number,
  rules: RuleInfo[],
): Category[] {
  const seen = new Set<string>();
  const domains: Category[] = [];

  for (const rule of groupCapabilities(groupPosition, rules)) {
    const category = ruleCategory(rule.key);
    if (seen.has(category.label)) continue;
    seen.add(category.label);
    domains.push(category);
  }

  return domains;
}

function positionAccent(groupPosition: number): string {
  return POSITION_ACCENTS[groupPosition % POSITION_ACCENTS.length];
}

export function groupDisplay(
  groupPosition: number,
  rules: RuleInfo[],
): {
  position: number;
  domains: Category[];
  capabilities: RuleInfo[];
  accent: string;
} {
  const capabilities = groupCapabilities(groupPosition, rules);
  return {
    position: groupPosition,
    domains: deriveGroupDomains(groupPosition, rules),
    capabilities,
    accent: positionAccent(groupPosition),
  };
}

export function formatGroupIdentity(
  groupPosition: number,
  rules: RuleInfo[],
): string {
  const display = groupDisplay(groupPosition, rules);
  const domainHint =
    display.domains.length > 0
      ? display.domains.map((domain) => domain.label).join(" + ")
      : "no capabilities";
  return `Group ${display.position} · ${domainHint}`;
}
