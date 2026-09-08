// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ContractRegistry } from "../src/components/RegistryViews";
import { useSession } from "../src/session/useSession";
import { allProposals, exactRegistryEntry } from "../src/dash/registryReads";
import { id } from "./helpers";

vi.mock("../src/session/useSession", () => ({ useSession: vi.fn() }));
vi.mock("../src/dash/registryReads", () => ({
  APP_CATEGORIES: ["other"],
  allProposals: vi.fn(),
  exactRegistryEntry: vi.fn(),
  myEntries: vi.fn(),
  recentEntries: vi.fn(),
  searchEntriesByName: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("shows metadata before opening the owner's editor", async () => {
  const entry = {
    id: id(4),
    ownerId: id(1),
    contractId: id(2),
    name: "Example app",
    tagline: "Useful metadata",
    category: "other" as const,
    tags: [],
    revision: 1n,
  };
  vi.mocked(allProposals).mockResolvedValue([entry]);
  vi.mocked(exactRegistryEntry).mockResolvedValue(entry);
  vi.mocked(useSession).mockReturnValue({
    connection: { sdk: {} },
    registryId: id(3),
    identityId: id(1),
    keyManager: {},
  } as never);

  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={vi.fn()}
    />,
  );

  await screen.findByText("Useful metadata");
  expect(
    screen.queryByRole("heading", { name: "Edit your submission" }),
  ).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Edit your submission" }));

  expect(
    screen.getByRole("heading", { name: "Edit your submission" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.queryByRole("heading", { name: "Edit your submission" }),
  ).toBeNull();
});
