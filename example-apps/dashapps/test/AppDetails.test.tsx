// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ContractCopyButton } from "../src/components/ContractCopyButton";
import { resourceLabel, summarizeSchemas } from "../src/lib/appDetails";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("formats GitHub resources as owner/repository", () => {
  expect(
    resourceLabel("https://github.com/dashpay/platform-tutorials/tree/main"),
  ).toBe("dashpay/platform-tutorials");
  expect(resourceLabel("https://example.com/docs/start")).toBe("example.com");
});

it("shows copy confirmation only after the contract ID is copied", async () => {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<ContractCopyButton contractId="abcdef1234567890" />);

  fireEvent.click(screen.getByRole("button", { name: "Copy contract ID" }));

  await screen.findByRole("button", { name: "Contract ID copied" });
  expect(writeText).toHaveBeenCalledWith("abcdef1234567890");
  expect(screen.getByText("Copied ✓")).toBeTruthy();
});

it("extracts property and index details from document schemas", () => {
  expect(
    summarizeSchemas({
      card: {
        properties: { seriesId: {}, owner: {}, rarity: {} },
        indices: [{ name: "byOwner" }, { name: "bySeries" }],
      },
    }),
  ).toEqual([
    {
      name: "card",
      properties: ["seriesId", "owner", "rarity"],
      indexCount: 2,
    },
  ]);
});
