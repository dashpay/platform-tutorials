import type { AppCategory } from "./registryReads";

export function categoryLabel(category: AppCategory) {
  const labels: Partial<Record<AppCategory, string>> = {
    "wallets-payments": "Wallets & payments",
    "developer-tools": "Developer tools",
    "data-analytics": "Data & analytics",
    "governance-community": "Governance & community",
  };
  return (
    labels[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
  );
}
