// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  CategoryBrowser,
  ContractRegistry,
  RegistryExplorer,
} from "../src/components/RegistryViews";
import { useSession } from "../src/session/useSession";
import {
  contractEntries,
  contractEntryCount,
  entriesByCategory,
  publisherEntriesFor,
  publisherEntry,
  recentEntries,
} from "../src/dash/registryReads";
import {
  endorsementsFor,
  officialListing,
  type Endorsement,
} from "../src/dash/endorsementReads";
import { deferred, id } from "./helpers";

vi.mock("../src/session/useSession", () => ({ useSession: vi.fn() }));
vi.mock("../src/dash/registryReads", () => ({
  APP_CATEGORIES: ["other"],
  contractEntries: vi.fn(),
  contractEntryCount: vi.fn(),
  entriesByCategory: vi.fn(),
  myEntries: vi.fn(),
  publisherEntriesFor: vi.fn(),
  publisherEntry: vi.fn(),
  recentEntries: vi.fn(),
  searchEntriesByName: vi.fn(),
}));
vi.mock("../src/dash/endorsementReads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/dash/endorsementReads")>()),
  endorsementsFor: vi.fn(),
  officialListing: vi.fn(),
}));

function endorsement(contractId: string, publisherId: string): Endorsement {
  return {
    id: id(80),
    ownerId: publisherId,
    contractId,
    publisherId,
    revision: 1n,
  };
}

function mockContract(
  entries: Awaited<ReturnType<typeof contractEntries>>["entries"],
  official: (typeof entries)[number] | null,
  own: (typeof entries)[number] | null,
) {
  vi.mocked(contractEntries).mockResolvedValue({ entries, cursor: undefined });
  vi.mocked(contractEntryCount).mockResolvedValue(BigInt(entries.length));
  vi.mocked(officialListing).mockResolvedValue(
    official
      ? {
          endorsement: endorsement(official.contractId, official.ownerId),
          entry: official,
        }
      : null,
  );
  vi.mocked(publisherEntry).mockResolvedValue(own);
}

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
  mockContract([entry], entry, entry);
  vi.mocked(useSession).mockReturnValue({
    connection: {
      sdk: {},
      names: { resolve: vi.fn(async () => null) },
    },
    registryId: id(3),
    identityId: id(1),
    keyManager: {},
  } as never);

  render(<ContractRegistry contractId={id(2)} onMutation={vi.fn()} />);

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
  mockContract([entry], null, null);
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
      onMutation={vi.fn()}
      onPreferredEntry={onPreferredEntry}
    />,
  );

  await vi.waitFor(() => expect(onPreferredEntry).toHaveBeenCalledWith(entry));
  expect(screen.queryByLabelText("App listings")).toBeNull();
  expect(screen.queryByRole("button", { name: /Switch listing/ })).toBeNull();
});

it("defaults to the endorsed listing and lets the user select a community listing", async () => {
  const official = {
    id: id(4),
    ownerId: id(1),
    contractId: id(2),
    name: "Official app",
    tagline: "Official metadata",
    category: "other" as const,
    tags: [],
    appUrl: "https://owner.example/app",
    revision: 1n,
  };
  const community = {
    ...official,
    id: id(5),
    ownerId: id(6),
    name: "Community proposal",
    tagline: "Suggested metadata",
    appUrl: "https://community.example/app",
  };
  // The server lists the community entry first; the official one still leads.
  mockContract([community, official], official, null);
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
  const onOfficialPublisher = vi.fn();
  render(
    <ContractRegistry
      contractId={id(2)}
      onMutation={vi.fn()}
      onPreferredEntry={onPreferredEntry}
      onOfficialPublisher={onOfficialPublisher}
    />,
  );

  fireEvent.click(
    await screen.findByRole("button", { name: /Switch listing/ }),
  );
  expect(screen.getByText(/Showing the/).textContent).toContain(
    "official listing · 1 community proposal",
  );
  expect(onPreferredEntry).toHaveBeenCalledWith(official);
  expect(onOfficialPublisher).toHaveBeenCalledWith(id(1));
  expect(
    screen
      .getAllByRole("radio")
      .map((radio) => radio.closest("label")?.textContent),
  ).toEqual([
    expect.stringContaining("Official publisher"),
    expect.stringContaining("Community member"),
  ]);
  fireEvent.click(screen.getByRole("radio", { name: /Community member/ }));
  expect(onPreferredEntry).toHaveBeenLastCalledWith(community);
  expect(screen.getByText(/Showing the/).textContent).toContain("community");
});

it("edits the signed-in user's proposal from an official Discover card", async () => {
  const official = {
    id: id(4),
    ownerId: id(1),
    contractId: id(2),
    name: "Official app",
    tagline: "Official metadata",
    category: "other" as const,
    tags: [],
    revision: 1n,
  };
  const ownProposal = {
    ...official,
    id: id(5),
    ownerId: id(6),
    name: "My proposed name",
    tagline: "My proposed metadata",
  };
  // Newest first: the proposal is newer, but the official entry is shown.
  vi.mocked(recentEntries).mockResolvedValue({
    entries: [ownProposal, official],
    cursor: undefined,
  });
  vi.mocked(endorsementsFor).mockResolvedValue(
    new Map([[id(2), endorsement(id(2), id(1))]]),
  );
  vi.mocked(publisherEntriesFor).mockResolvedValue(
    new Map([[id(2), ownProposal]]),
  );
  vi.mocked(useSession).mockReturnValue({
    connection: {
      sdk: {},
      names: { resolve: vi.fn(async () => null) },
    },
    registryId: id(3),
    identityId: id(6),
    keyManager: {},
  } as never);
  const open = vi.fn();

  render(<RegistryExplorer open={open} showNavigation={false} />);

  await screen.findByText("Official app");
  expect(screen.queryByText("My proposed name")).toBeNull();
  expect(publisherEntriesFor).toHaveBeenCalledWith({}, id(3), id(6), [
    id(2),
    id(2),
  ]);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  expect(open).not.toHaveBeenCalled();
  expect(
    screen.getByRole("dialog", { name: "Edit your submission" }),
  ).toBeTruthy();
  expect(screen.getByDisplayValue("My proposed name")).toBeTruthy();
});

function categoryEntry(n: number, contract = n) {
  return {
    id: id(n),
    ownerId: id(1),
    contractId: id(100 + contract),
    name: `App ${n}`,
    tagline: `Tagline ${n}`,
    category: "games" as const,
    tags: [],
    createdAt: BigInt(n),
    revision: 1n,
  };
}

it("pages a category from the server and keeps its order", async () => {
  vi.mocked(useSession).mockReturnValue({
    network: "testnet",
    connection: {
      sdk: {},
      names: { resolve: vi.fn(async () => null) },
    },
    registryId: id(3),
    identityId: id(1),
    keyManager: {},
  } as never);
  const second = deferred<Awaited<ReturnType<typeof entriesByCategory>>>();
  // Server order (not createdAt order) must be kept: 40, 52, then 17, 23.
  vi.mocked(entriesByCategory)
    .mockResolvedValueOnce({
      entries: [categoryEntry(40), categoryEntry(52)],
      cursor: id(52),
    })
    .mockReturnValueOnce(second.promise);
  vi.mocked(endorsementsFor).mockResolvedValue(new Map());
  render(<CategoryBrowser category="games" open={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText("App 52");
  expect(screen.getByText("2+ apps in this category")).toBeTruthy();
  expect(entriesByCategory).toHaveBeenCalledWith({}, id(3), "games");
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  expect(entriesByCategory).toHaveBeenLastCalledWith(
    {},
    id(3),
    "games",
    id(52),
  );
  expect(
    (screen.getByRole("button", { name: "Loading…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await act(async () => {
    second.resolve({
      // App 52 overlaps; 17 shares App 40's target and collapses into it.
      entries: [categoryEntry(52), categoryEntry(17, 40), categoryEntry(23)],
      cursor: undefined,
    });
  });
  expect(
    screen.getAllByText(/^App \d+$/).map((node) => node.textContent),
  ).toEqual(["App 40", "App 52", "App 23"]);
  expect(screen.getByText("3 apps in this category")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});

it("drops a Load more response for a contract no longer shown", async () => {
  const entry = (contract: number, n: number, name: string) => ({
    id: id(n),
    ownerId: id(n + 50),
    contractId: id(contract),
    name,
    tagline: "Metadata",
    category: "other" as const,
    tags: [],
    revision: 1n,
  });
  const pageA = [entry(2, 10, "First A"), entry(2, 11, "Second A")];
  const pageB = [entry(7, 20, "First B"), entry(7, 21, "Second B")];
  const more = deferred<Awaited<ReturnType<typeof contractEntries>>>();
  vi.mocked(contractEntries)
    .mockResolvedValueOnce({ entries: pageA, cursor: pageA[1].id })
    .mockReturnValueOnce(more.promise)
    .mockResolvedValueOnce({ entries: pageB, cursor: undefined });
  vi.mocked(contractEntryCount).mockResolvedValue(3n);
  vi.mocked(officialListing).mockResolvedValue(null);
  vi.mocked(publisherEntry).mockResolvedValue(null);
  vi.mocked(useSession).mockReturnValue({
    connection: { sdk: {}, names: { resolve: vi.fn(async () => null) } },
    registryId: id(3),
    identityId: null,
    keyManager: null,
  } as never);

  const { rerender } = render(
    <ContractRegistry contractId={id(2)} onMutation={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Switch listing/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Load more listings" }));
  rerender(<ContractRegistry contractId={id(7)} onMutation={vi.fn()} />);
  expect((await screen.findAllByText(/Second B/)).length).toBeGreaterThan(0);
  await act(async () =>
    more.resolve({ entries: [entry(2, 12, "Third A")], cursor: undefined }),
  );
  expect(screen.queryByText(/Third A/)).toBeNull();
  expect(screen.getAllByText(/Second B/).length).toBeGreaterThan(0);
});
