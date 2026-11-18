// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  CategoryBrowser,
  ContractRegistry,
  MyEndorsements,
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
  myEndorsements,
  officialFeed,
  officialListing,
  officialListingOf,
  type Endorsement,
} from "../src/dash/endorsementReads";
import { endorse, withdrawEndorsement } from "../src/dash/endorsementWrites";
import { createMetadata } from "../src/dash/registryWrites";
import { ratingAverages } from "../src/dash/ratingReads";
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
  myEndorsements: vi.fn(),
  officialFeed: vi.fn(),
  officialListing: vi.fn(),
  officialListingOf: vi.fn(),
}));
vi.mock("../src/dash/endorsementWrites", () => ({
  endorse: vi.fn(),
  withdrawEndorsement: vi.fn(),
}));
vi.mock("../src/dash/registryWrites", () => ({
  createMetadata: vi.fn(),
  editMetadata: vi.fn(),
  withdrawMetadata: vi.fn(),
}));
vi.mock("../src/dash/ratingReads", () => ({ ratingAverages: vi.fn() }));

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

beforeEach(() => {
  vi.mocked(ratingAverages).mockResolvedValue(new Map());
});

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

function listing(n: number, contract: number, owner: number, name: string) {
  return {
    id: id(n),
    ownerId: id(owner),
    contractId: id(contract),
    name,
    tagline: `${name} tagline`,
    category: "other" as const,
    tags: [],
    revision: 1n,
  };
}

function signedInAs(identity: number | null) {
  vi.mocked(useSession).mockReturnValue({
    network: "testnet",
    connection: { sdk: {}, names: { resolve: vi.fn(async () => null) } },
    registryId: id(3),
    identityId: identity === null ? null : id(identity),
    keyManager: identity === null ? null : {},
    refreshBalance: vi.fn(async () => undefined),
  } as never);
}

it("badges each listing official or community and shows its rating", async () => {
  signedInAs(null);
  vi.mocked(recentEntries).mockResolvedValue({
    entries: [listing(10, 20, 1, "Endorsed"), listing(11, 21, 2, "Proposed")],
    cursor: undefined,
  });
  vi.mocked(endorsementsFor).mockResolvedValue(
    new Map([[id(20), endorsement(id(20), id(1))]]),
  );
  vi.mocked(ratingAverages).mockResolvedValue(
    new Map([
      [id(20), { count: 3n, sum: 13n, average: 13 / 3 }],
      [id(21), { count: 0n, sum: 0n, average: null }],
    ]),
  );
  render(<RegistryExplorer open={vi.fn()} showNavigation={false} />);
  const endorsed = (await screen.findByText("Endorsed")).closest("article")!;
  const proposed = screen.getByText("Proposed").closest("article")!;
  await within(endorsed).findByText("Official");
  expect(within(proposed).getByText("Community")).toBeTruthy();
  await within(endorsed).findByText("★ 4.3 · 3 reviews");
  expect(within(proposed).getByText("No reviews yet")).toBeTruthy();
  expect(ratingAverages).toHaveBeenCalledWith({}, id(3), [id(20), id(21)]);
});

it("switches the feed to official listings and filters to 4★+", async () => {
  signedInAs(null);
  vi.mocked(recentEntries).mockResolvedValue({
    entries: [listing(10, 20, 1, "Alpha"), listing(11, 21, 2, "Beta")],
    cursor: undefined,
  });
  vi.mocked(endorsementsFor).mockResolvedValue(new Map());
  const endorsed = listing(12, 22, 4, "Gamma");
  vi.mocked(officialFeed).mockResolvedValue({
    listings: [
      { endorsement: endorsement(id(22), id(4)), entry: endorsed },
      // The publisher withdrew this one; there is nothing to list.
      { endorsement: endorsement(id(23), id(5)), entry: null },
    ],
    cursor: undefined,
  });
  const onEntries = vi.fn();
  render(
    <RegistryExplorer
      open={vi.fn()}
      showNavigation={false}
      filters
      highlyRated={new Set([id(21)])}
      onEntries={onEntries}
    />,
  );
  await screen.findByText("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "4★+" }));
  expect(screen.queryByText("Alpha")).toBeNull();
  expect(screen.getByText("Beta")).toBeTruthy();
  expect(
    screen.getByText(/1 of 2 loaded apps average 4★ or more/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "4★+" }));
  fireEvent.click(screen.getByRole("button", { name: "Official only" }));
  await screen.findByText("Gamma");
  expect(officialFeed).toHaveBeenCalledWith({}, id(3), undefined);
  expect(screen.queryByText("Alpha")).toBeNull();
  expect(screen.getAllByRole("link", { name: /View details/ })).toHaveLength(1);
  expect(
    screen.getByText("Chosen by contract owners · newest first"),
  ).toBeTruthy();
  // The featured shelves keep the full feed, not the filtered one.
  expect(onEntries).not.toHaveBeenCalledWith([endorsed]);
});

it("disables the 4★+ chip until the set has loaded", async () => {
  signedInAs(null);
  vi.mocked(recentEntries).mockResolvedValue({
    entries: [],
    cursor: undefined,
  });
  render(<RegistryExplorer open={vi.fn()} showNavigation={false} filters />);
  await screen.findByText("No registry entries found.");
  expect(
    (screen.getByRole("button", { name: "4★+" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("offers endorsement controls to the contract owner only", async () => {
  const own = listing(10, 2, 1, "Owner listing");
  const delegate = listing(11, 2, 6, "Delegate listing");
  mockContract([own, delegate], own, own);
  vi.mocked(endorse).mockResolvedValue("updated");
  signedInAs(6);
  const { unmount } = render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={vi.fn()}
    />,
  );
  await screen.findByRole("button", { name: /Switch listing/ });
  expect(screen.queryByText("You own this contract")).toBeNull();
  expect(screen.queryByRole("button", { name: "Make official" })).toBeNull();
  unmount();

  signedInAs(1);
  const onMutation = vi.fn();
  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={onMutation}
    />,
  );
  const panel = await screen.findByLabelText("Official listing");
  expect(panel.textContent).toContain("Official listing: Owner listing");
  expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
  fireEvent.click(within(panel).getByRole("button", { name: "Make official" }));
  await screen.findByText("Delegate listing is now the official listing.");
  expect(endorse).toHaveBeenCalledWith(
    expect.objectContaining({ contractId: id(2), publisherId: id(6) }),
  );
  expect(onMutation).toHaveBeenCalled();
  vi.mocked(withdrawEndorsement).mockResolvedValue(undefined);
  fireEvent.click(
    await screen.findByRole("button", { name: "Withdraw endorsement" }),
  );
  await screen.findByText(/Endorsement withdrawn/);
  expect(withdrawEndorsement).toHaveBeenCalledWith(
    expect.objectContaining({ endorsement: endorsement(id(2), id(1)) }),
  );
});

it("prompts an owner whose entry is not endorsed to mark it official", async () => {
  const own = listing(10, 2, 1, "Owner listing");
  mockContract([own], null, own);
  vi.mocked(endorse).mockResolvedValue("created");
  signedInAs(1);
  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={vi.fn()}
    />,
  );
  await screen.findByText("Your entry isn't official yet.");
  expect(
    screen.queryByRole("button", { name: "Withdraw endorsement" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Mark as official" }));
  await screen.findByText("Owner listing is now the official listing.");
  expect(endorse).toHaveBeenCalledWith(
    expect.objectContaining({ publisherId: id(1) }),
  );
});

it("explains a dangling endorsement to the owner and to everyone else", async () => {
  const community = listing(11, 2, 6, "Community listing");
  vi.mocked(contractEntries).mockResolvedValue({
    entries: [community],
    cursor: undefined,
  });
  vi.mocked(contractEntryCount).mockResolvedValue(1n);
  vi.mocked(officialListing).mockResolvedValue({
    endorsement: endorsement(id(2), id(5)),
    entry: null,
  });
  vi.mocked(publisherEntry).mockResolvedValue(null);
  signedInAs(null);
  const { unmount } = render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={vi.fn()}
    />,
  );
  await screen.findByText(/official listing was withdrawn by its publisher/);
  expect(screen.queryByRole("button", { name: "Make official" })).toBeNull();
  unmount();

  signedInAs(1);
  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={vi.fn()}
    />,
  );
  const panel = await screen.findByLabelText("Official listing");
  expect(panel.textContent).toContain("nothing is official right now");
  expect(
    within(panel).getByRole("button", { name: "Make official" }),
  ).toBeTruthy();
  expect(
    within(panel).getByRole("button", { name: "Withdraw endorsement" }),
  ).toBeTruthy();
});

it("offers to mark a new entry official when the signer owns the contract", async () => {
  mockContract([], null, null);
  vi.mocked(createMetadata).mockResolvedValue({ contractOwnerId: id(1) });
  vi.mocked(endorse).mockResolvedValue("created");
  signedInAs(1);
  const onMutation = vi.fn();
  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={onMutation}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Add your entry" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Submit metadata" });
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "New app" },
  });
  fireEvent.change(within(dialog).getByLabelText("Tagline"), {
    target: { value: "Does things" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Submit metadata" }),
  );
  await within(dialog).findByRole("heading", { name: "Mark it as official?" });
  expect(onMutation).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Mark as official" }),
  );
  await vi.waitFor(() => expect(onMutation).toHaveBeenCalled());
  expect(endorse).toHaveBeenCalledWith(
    expect.objectContaining({ contractId: id(2), publisherId: id(1) }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("closes straight after creating an entry for someone else's contract", async () => {
  mockContract([], null, null);
  vi.mocked(createMetadata).mockResolvedValue({ contractOwnerId: id(9) });
  signedInAs(1);
  const onMutation = vi.fn();
  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(9)}
      onMutation={onMutation}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Add your entry" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Submit metadata" });
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "New app" },
  });
  fireEvent.change(within(dialog).getByLabelText("Tagline"), {
    target: { value: "Does things" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Submit metadata" }),
  );
  await vi.waitFor(() => expect(onMutation).toHaveBeenCalled());
  expect(screen.queryByText("Mark it as official?")).toBeNull();
  expect(endorse).not.toHaveBeenCalled();
});

it("skips the mark-official step when the owner already endorsed a listing", async () => {
  const delegated = listing(10, 2, 6, "Delegated");
  mockContract([delegated], delegated, null);
  vi.mocked(createMetadata).mockResolvedValue({ contractOwnerId: id(1) });
  signedInAs(1);
  const onMutation = vi.fn();
  render(
    <ContractRegistry
      contractId={id(2)}
      contractOwnerId={id(1)}
      onMutation={onMutation}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Add your entry" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Submit metadata" });
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "New app" },
  });
  fireEvent.change(within(dialog).getByLabelText("Tagline"), {
    target: { value: "Does things" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Submit metadata" }),
  );
  await vi.waitFor(() => expect(onMutation).toHaveBeenCalled());
  expect(screen.queryByText("Mark it as official?")).toBeNull();
  expect(endorse).not.toHaveBeenCalled();
});

it("lists the contracts the signed-in identity has endorsed", async () => {
  signedInAs(1);
  const mine = listing(10, 20, 1, "Mine");
  const delegated = listing(11, 21, 6, "Delegated");
  const endorsements = [
    endorsement(id(20), id(1)),
    endorsement(id(21), id(6)),
    endorsement(id(22), id(7)),
  ];
  vi.mocked(myEndorsements).mockResolvedValue({
    endorsements,
    cursor: undefined,
  });
  vi.mocked(officialListingOf).mockImplementation(async (_sdk, _r, item) => ({
    endorsement: item,
    entry:
      item.contractId === id(20)
        ? mine
        : item.contractId === id(21)
          ? delegated
          : null,
  }));
  const open = vi.fn();
  render(<MyEndorsements open={open} />);
  const rows = await screen.findAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual([
    "MineYour entry",
    "DelegatedA delegate's entry",
    expect.stringContaining("Entry withdrawn"),
  ]);
  expect(myEndorsements).toHaveBeenCalledWith({}, id(3), id(1), undefined);
  fireEvent.click(screen.getByRole("button", { name: /Delegated/ }));
  expect(open).toHaveBeenCalledWith(id(21), "Delegated", delegated);
});
