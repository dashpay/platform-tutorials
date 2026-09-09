// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ContractRegistry,
  RegistryExplorer,
} from "../src/components/RegistryViews";
import { useSession } from "../src/session/useSession";
import {
  allProposals,
  exactRegistryEntry,
  myEntries,
  recentEntries,
} from "../src/dash/registryReads";
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
    connection: {
      sdk: {},
      names: { resolve: vi.fn(async () => null) },
    },
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

  await screen.findByRole("button", { name: "Edit your submission" });
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

it("does not render an empty switcher for one signed-out listing", async () => {
  const entry = {
    id: id(4),
    ownerId: id(1),
    contractId: id(2),
    name: "Only app",
    tagline: "The only listing",
    category: "other" as const,
    tags: [],
    revision: 1n,
  };
  vi.mocked(allProposals).mockResolvedValue([entry]);
  vi.mocked(exactRegistryEntry).mockResolvedValue(entry);
  vi.mocked(useSession).mockReturnValue({
    connection: {
      sdk: {},
      names: { resolve: vi.fn(async () => null) },
    },
    registryId: id(3),
    identityId: null,
    keyManager: null,
  } as never);
  const onPreferredEntry = vi.fn();

  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={vi.fn()}
      onPreferredEntry={onPreferredEntry}
    />,
  );

  await vi.waitFor(() => expect(onPreferredEntry).toHaveBeenCalledWith(entry));
  expect(screen.queryByLabelText("App listings")).toBeNull();
  expect(screen.queryByRole("button", { name: /Switch listing/ })).toBeNull();
});

it("defaults to the owner listing and lets the user select a community listing", async () => {
  const canonical = {
    id: id(4),
    ownerId: id(1),
    contractId: id(2),
    name: "Owner app",
    tagline: "Canonical metadata",
    category: "other" as const,
    tags: [],
    appUrl: "https://owner.example/app",
    revision: 1n,
  };
  const community = {
    ...canonical,
    id: id(5),
    ownerId: id(6),
    name: "Community proposal",
    tagline: "Suggested metadata",
    appUrl: "https://community.example/app",
  };
  vi.mocked(allProposals).mockResolvedValue([canonical, community]);
  vi.mocked(exactRegistryEntry).mockResolvedValue(canonical);
  vi.mocked(useSession).mockReturnValue({
    connection: {
      sdk: {},
      names: { resolve: vi.fn(async () => null) },
    },
    registryId: id(3),
    identityId: null,
    keyManager: null,
  } as never);

  const onPreferredEntry = vi.fn();
  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={vi.fn()}
      onPreferredEntry={onPreferredEntry}
    />,
  );

  fireEvent.click(
    await screen.findByRole("button", { name: /Switch listing/ }),
  );
  expect(screen.getByText(/Showing the/).textContent).toContain(
    "contract owner's",
  );
  expect(onPreferredEntry).toHaveBeenCalledWith(canonical);
  fireEvent.click(screen.getByRole("radio", { name: /Community member/ }));
  expect(onPreferredEntry).toHaveBeenLastCalledWith(community);
  expect(screen.getByText(/Showing the/).textContent).toContain("community");
});

it("edits the signed-in user's proposal from a canonical Discover card", async () => {
  const canonical = {
    id: id(4),
    ownerId: id(1),
    contractId: id(2),
    name: "Owner app",
    tagline: "Canonical metadata",
    category: "other" as const,
    tags: [],
    revision: 1n,
  };
  const ownProposal = {
    ...canonical,
    id: id(5),
    ownerId: id(6),
    name: "My proposed name",
    tagline: "My proposed metadata",
  };
  vi.mocked(recentEntries).mockResolvedValue({
    entries: [canonical, ownProposal],
    cursor: undefined,
  });
  vi.mocked(myEntries).mockResolvedValue([ownProposal]);
  vi.mocked(useSession).mockReturnValue({
    connection: {
      sdk: {},
      names: { resolve: vi.fn(async () => null) },
      resolver: {
        summaryMany: vi.fn(() => new Map()),
        resolve: vi.fn(
          async () => new Map([[id(2), { status: "found", ownerId: id(1) }]]),
        ),
      },
    },
    registryId: id(3),
    identityId: id(6),
    keyManager: {},
  } as never);
  const open = vi.fn();

  render(<RegistryExplorer open={open} showNavigation={false} />);

  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  expect(open).not.toHaveBeenCalled();
  expect(
    screen.getByRole("dialog", { name: "Edit your submission" }),
  ).toBeTruthy();
  expect(screen.getByDisplayValue("My proposed name")).toBeTruthy();
});
