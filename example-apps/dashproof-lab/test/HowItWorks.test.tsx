// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HowItWorks } from "../src/components/HowItWorks";

afterEach(() => {
  cleanup();
});

describe("HowItWorks", () => {
  const expectedOperations = [
    ["Connect to testnet", "src/dash/client.ts", 'createClient("testnet")'],
    ["Derive identity keys", "src/dash/keyManager.ts", "IdentityKeyManager.create"],
    [
      "Use bundled/default contract ID",
      "src/dash/contract.ts",
      "loadStoredContractId / DEFAULT_CONTRACT_ID",
    ],
    ["Register proof contract", "src/dash/contract.ts", "sdk.contracts.publish"],
    ["Create proof", "src/dash/createAnchor.ts", "sdk.documents.create"],
    ["Verify by hash", "src/dash/queries.ts", "sdk.documents.query"],
    ["Query by owner", "src/dash/queries.ts", "sdk.documents.query"],
    ["Query by chain", "src/dash/queries.ts", "sdk.documents.query"],
  ];

  const expectedReadingOrder = [
    "src/dash/contract.ts",
    "src/dash/createAnchor.ts",
    "src/dash/queries.ts",
    "src/session/SessionContext.tsx",
    "src/components/AnchorForm.tsx",
    "src/components/VerifyPanel.tsx",
    "src/components/HistoryPanel.tsx",
  ];

  it("renders the documented sections", () => {
    render(<HowItWorks />);

    expect(screen.getByText(/What is DashProof Lab\?/i)).toBeTruthy();
    expect(screen.getByText(/Core proof model/i)).toBeTruthy();
    expect(screen.getByText(/Platform operations at a glance/i)).toBeTruthy();
    expect(screen.getByText(/How the app flows work/i)).toBeTruthy();
    expect(screen.getByText(/Reading order/i)).toBeTruthy();
  });

  it("lists the SDK methods invoked by each operation", () => {
    render(<HowItWorks />);

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(expectedOperations.length + 1);

    const bodyRows = rows.slice(1);
    for (const [index, [operation, file, method]] of expectedOperations.entries()) {
      const cells = within(bodyRows[index] as HTMLElement).getAllByRole("cell");
      expect(cells).toHaveLength(3);
      expect(cells.map((cell) => cell.textContent)).toEqual([operation, file, method]);
    }
  });

  it("renders the reading order with all expected paths", () => {
    render(<HowItWorks />);

    const readingOrderHeading = screen.getByRole("heading", { name: /reading order/i });
    const section = readingOrderHeading.closest("section");
    expect(section).toBeTruthy();

    const items = within(section as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(expectedReadingOrder.length);
    expect(items.map((item) => item.textContent?.trim())).toEqual(expectedReadingOrder);
  });
});
