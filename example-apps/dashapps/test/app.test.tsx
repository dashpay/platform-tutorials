// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../src/App";
import { loadSdkCore } from "../src/dash/sdkCore";
import { DEFAULT_CONTRACT_IDS } from "../src/dash/contractStore";
import { contract, deferred, id, sdk } from "./helpers";
import type { ContractHandle } from "../src/dash/types";
import { ContractSummaryStore } from "../src/dash/contractSummaryStore";
vi.mock("../src/dash/sdkCore", () => ({ loadSdkCore: vi.fn() }));
beforeEach(() => {
  // jsdom does not implement scrolling; the detail page scrolls to top on open.
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  localStorage.clear();
  vi.resetAllMocks();
});
function connect(client = sdk()) {
  vi.mocked(loadSdkCore).mockResolvedValue({
    createClient: vi.fn(async () => client),
  } as unknown as Awaited<ReturnType<typeof loadSdkCore>>);
  return client;
}
async function ready() {
  await screen.findByText("Connected · Read-only");
}
function openSearch() {
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
}
it("invalid IDs never reach the SDK and failures are not rendered as missing", async () => {
  const client = connect();
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: "invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  await screen.findByRole("alert");
  expect(client.contracts.getMany).not.toHaveBeenCalled();
  vi.mocked(client.contracts.getMany).mockRejectedValue(
    new Error("proof verification failed"),
  );
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  await screen.findByText(/proof verification failed/);
  expect(screen.queryByText(/deleted or never existed/)).toBeNull();
});
it("navigation discards late contract results", async () => {
  const client = connect();
  const pending = deferred<Map<string, ContractHandle | undefined>>();
  vi.mocked(client.contracts.getMany).mockReturnValue(pending.promise);
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.click(screen.getByRole("button", { name: "Discover" }));
  await act(async () => {
    pending.resolve(new Map([[id(2), contract()]]));
  });
  expect(screen.queryByText("Example contract")).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Declared by contract" }),
  ).toBeNull();
});
it("changing an input supersedes an in-flight lookup", async () => {
  const client = connect();
  const pending = deferred<Map<string, ContractHandle | undefined>>();
  vi.mocked(client.contracts.getMany).mockReturnValue(pending.promise);
  render(<App />);
  await ready();
  openSearch();
  const input = screen.getByLabelText("Open a contract");
  fireEvent.change(input, { target: { value: id(2) } });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.change(input, { target: { value: id(3) } });
  await act(async () => {
    pending.resolve(new Map([[id(2), contract()]]));
  });
  expect(screen.queryByText("Example contract")).toBeNull();
});
it("does not insert a loading message while opening an app", async () => {
  const client = connect();
  const pending = deferred<Map<string, ContractHandle | undefined>>();
  vi.mocked(client.contracts.getMany).mockReturnValue(pending.promise);
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));

  expect(screen.queryByText("Loading…")).toBeNull();

  await act(async () => {
    pending.resolve(new Map([[id(2), contract()]]));
  });
});
it("refresh forces fresh contract facts and short description", async () => {
  const client = connect();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([[id(2), contract()]]),
  );
  vi.mocked(client.documents.query).mockResolvedValue([
    { properties: { description: "Declared summary" } },
  ]);
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  await screen.findAllByText("Declared summary");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() =>
    expect(
      vi
        .mocked(client.documents.query)
        .mock.calls.filter(
          ([args]) => args.documentTypeName === "shortDescription",
        ),
    ).toHaveLength(2),
  );
  expect(client.contracts.getMany).toHaveBeenCalledTimes(2);
});

it("renders a persisted contract summary immediately while revalidating", async () => {
  new ContractSummaryStore("testnet").set({
    contractId: id(2),
    ownerId: id(1),
    version: 1,
    description: "Saved contract",
    keywords: ["saved"],
    documentTypes: ["savedNote"],
    fetchedAt: 1,
  });
  const client = connect();
  const pending = deferred<Map<string, ContractHandle | undefined>>();
  vi.mocked(client.contracts.getMany).mockReturnValue(pending.promise);
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));

  expect(screen.getByText("Saved contract")).toBeTruthy();
  expect(screen.getByText("savedNote")).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Refreshing…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(client.contracts.getMany).toHaveBeenCalledOnce();

  await act(async () => pending.resolve(new Map([[id(2), contract()]])));
  await screen.findByText("Example contract");
  expect(screen.queryByText("Saved contract")).toBeNull();
});

it("keeps a persisted summary visible when background revalidation fails", async () => {
  new ContractSummaryStore("testnet").set({
    contractId: id(2),
    ownerId: id(1),
    version: 1,
    description: "Saved offline contract",
    keywords: [],
    documentTypes: ["note"],
    fetchedAt: 1,
  });
  const client = connect();
  vi.mocked(client.contracts.getMany).mockRejectedValue(new Error("offline"));
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));

  await screen.findByText(/offline/);
  expect(screen.getByText("Saved offline contract")).toBeTruthy();
  expect(screen.getByText("note")).toBeTruthy();
});

it("removes a persisted summary when revalidation confirms the contract is missing", async () => {
  new ContractSummaryStore("testnet").set({
    contractId: id(2),
    ownerId: id(1),
    version: 1,
    description: "Previously found contract",
    keywords: [],
    documentTypes: ["note"],
    fetchedAt: 1,
  });
  const client = connect();
  vi.mocked(client.contracts.getMany).mockResolvedValue(new Map());
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));

  expect(screen.getByText("Previously found contract")).toBeTruthy();
  await screen.findByText("Contract not found on this network.");
  expect(screen.queryByText("Previously found contract")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Information" })).toBeNull();
});

it.each(["Discover", "Search", "Mine"])(
  "%s navigation exits the contract detail screen",
  async (destination) => {
    const client = connect();
    vi.mocked(client.contracts.getMany).mockResolvedValue(
      new Map([[id(2), contract()]]),
    );
    vi.mocked(client.documents.query).mockResolvedValue([]);
    render(<App />);
    await ready();
    openSearch();
    fireEvent.change(screen.getByLabelText("Open a contract"), {
      target: { value: id(2) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("button", { name: "Refresh" });

    fireEvent.click(screen.getByRole("button", { name: destination }));

    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
    if (destination === "Discover")
      expect(screen.getByText("Built on Dash Platform")).toBeTruthy();
    else
      expect(
        screen.getByRole("heading", { name: destination, level: 1 }),
      ).toBeTruthy();
  },
);

it("offers a sign-in action from the Mine screen", async () => {
  connect();
  render(<App />);
  await ready();

  fireEvent.click(screen.getByRole("button", { name: "Mine" }));

  expect(screen.getByText("Sign in to view your entries")).toBeTruthy();
  const mineCard = screen
    .getByText("Sign in to view your entries")
    .closest("section")!;
  fireEvent.click(within(mineCard).getByRole("button", { name: "Sign in" }));
  expect(
    screen.getByRole("heading", { name: "Sign in to dashapps" }),
  ).toBeTruthy();
});

it("keeps contract facts and displays a readable, retryable short-description error", async () => {
  const client = connect();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([[id(2), contract()]]),
  );
  vi.mocked(client.documents.query).mockImplementation(async (args) => {
    if (args.documentTypeName === "shortDescription")
      return Promise.reject({ message: () => "Description proof failed" });
    return [];
  });
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  await screen.findByText(
    /Could not load the short description: Description proof failed/,
  );
  expect(screen.getByText("Example contract")).toBeTruthy();
  expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  expect(screen.queryByText("No short description declared.")).toBeNull();
  vi.mocked(client.documents.query).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByText("No short description declared.");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("validates and saves Settings without carrying pending discovery results", async () => {
  const client = connect();
  const pending = deferred<Map<string, ContractHandle | undefined>>();
  vi.mocked(client.contracts.getMany).mockReturnValue(pending.promise);
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("Registry contract ID"), {
    target: { value: "invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save registry" }));
  await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText("Registry contract ID"), {
    target: { value: id(7) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save registry" }));
  await screen.findByText("Registry selection saved.");
  expect(localStorage.getItem("dashapps.contractId.testnet")).toBe(id(7));
  fireEvent.click(screen.getByRole("button", { name: "Discover" }));
  await act(async () => {
    pending.resolve(new Map([[id(2), contract()]]));
  });
  expect(screen.queryByText("Example contract")).toBeNull();
});

it("saving the default registry stores no override", async () => {
  localStorage.setItem("dashapps.contractId.testnet", id(7));
  const client = connect();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([
      [
        id(7),
        {
          ...contract(),
          schemas: { appMetadata: {}, appEndorsement: {}, appReview: {} },
        },
      ],
    ]),
  );
  render(<App />);
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("Registry contract ID"), {
    target: { value: DEFAULT_CONTRACT_IDS.testnet },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save registry" }));
  await screen.findByText("Registry selection saved.");
  expect(localStorage.getItem("dashapps.contractId.testnet")).toBeNull();
  expect(screen.getByText(DEFAULT_CONTRACT_IDS.testnet)).toBeTruthy();
});

it("shows the rating summary in the hero and the ratings section on an app page", async () => {
  const client = connect();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([[id(2), contract()]]),
  );
  vi.mocked(client.documents.count).mockImplementation(async (args) =>
    args.documentTypeName === "appReview"
      ? new Map([
          ["04", 1n],
          ["05", 3n],
        ])
      : new Map(),
  );
  vi.mocked(client.documents.average).mockResolvedValue(
    new Map([["", { count: 4n, sum: 19n }]]),
  );
  render(<App />);
  await ready();
  openSearch();
  fireEvent.change(screen.getByLabelText("Open a contract"), {
    target: { value: id(2) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  await screen.findByRole("heading", { name: "Ratings & reviews" });
  await waitFor(() =>
    expect(screen.getAllByText("4.8").length).toBeGreaterThan(0),
  );
  expect(screen.getAllByText("4 ratings").length).toBeGreaterThan(0);
  expect(
    vi
      .mocked(client.documents.average)
      .mock.calls.every(
        ([args, property]) =>
          args.documentTypeName === "appReview" && property === "stars",
      ),
  ).toBe(true);
  expect(screen.getByRole("button", { name: "Sign in to rate" })).toBeTruthy();
});

it("flags an older registry and switches back to the default", async () => {
  localStorage.setItem("dashapps.contractId.testnet", id(7));
  const client = connect();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([
      [id(7), { ...contract(), schemas: { appMetadata: {}, appRating: {} } }],
    ]),
  );
  render(<App />);
  await screen.findByText(
    "This registry was made for an older version of the app.",
  );
  expect(client.documents.query).not.toHaveBeenCalled();
  expect(client.documents.ranked).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Use the default registry" }),
  );
  await screen.findByRole("heading", { name: "Built on Dash Platform" });
  expect(localStorage.getItem("dashapps.contractId.testnet")).toBeNull();
  expect(
    screen.queryByText(
      "This registry was made for an older version of the app.",
    ),
  ).toBeNull();
  expect(client.contracts.getMany).toHaveBeenCalledTimes(1);
});

it("browses a saved registry that has every document type", async () => {
  localStorage.setItem("dashapps.contractId.testnet", id(7));
  const client = connect();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([
      [
        id(7),
        {
          ...contract(),
          schemas: { appMetadata: {}, appEndorsement: {}, appReview: {} },
        },
      ],
    ]),
  );
  render(<App />);
  await screen.findByRole("heading", { name: "Built on Dash Platform" });
  await waitFor(() => expect(client.documents.query).toHaveBeenCalled());
  expect(client.contracts.getMany).toHaveBeenCalledWith([id(7)]);
  expect(
    screen.queryByText(
      "This registry was made for an older version of the app.",
    ),
  ).toBeNull();
});

it("waits for the registry check and offers a retry when it fails", async () => {
  localStorage.setItem("dashapps.contractId.testnet", id(7));
  const client = connect();
  const first = deferred<Map<string, ContractHandle | undefined>>();
  vi.mocked(client.contracts.getMany).mockReturnValueOnce(first.promise);
  render(<App />);
  await screen.findByText("Checking the registry…");
  await waitFor(() => expect(client.contracts.getMany).toHaveBeenCalled());
  expect(client.documents.query).not.toHaveBeenCalled();
  first.reject(new Error("timeout"));
  await screen.findByText("Couldn't check the registry.");
  expect(client.documents.query).not.toHaveBeenCalled();
  vi.mocked(client.contracts.getMany).mockResolvedValue(
    new Map([
      [
        id(7),
        {
          ...contract(),
          schemas: { appMetadata: {}, appEndorsement: {}, appReview: {} },
        },
      ],
    ]),
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Built on Dash Platform" });
  await waitFor(() => expect(client.documents.query).toHaveBeenCalled());
});

it("searches registry names on the network, one row per app", async () => {
  const client = connect();
  const listing = (owner: number, name: string) => ({
    id: id(owner + 10),
    ownerId: id(owner),
    revision: 1n,
    properties: {
      contractId: id(2),
      name,
      tagline: "Not in the loaded feed",
      category: "games",
      tags: "",
    },
  });
  vi.mocked(client.documents.query).mockImplementation(async (query) => {
    if (query.documentTypeName === "contractKeywords")
      throw new Error("keyword node down");
    if (query.documentTypeName === "appEndorsement")
      return [
        {
          id: id(9),
          ownerId: id(8),
          revision: 1n,
          properties: { contractId: id(2), publisherId: id(1) },
        },
      ];
    return JSON.stringify(query.where).includes("startsWith")
      ? [listing(3, "Listed copy"), listing(1, "Listed app")]
      : [];
  });
  render(<App />);
  await ready();
  openSearch();
  const keyword = screen.getByLabelText("Discover by keyword");

  fireEvent.change(keyword, { target: { value: "x".repeat(64) } });
  fireEvent.submit(keyword.closest("form")!);
  await screen.findByText(/Use 3–50 characters for a keyword/);

  // Too short for a keyword, but still a name prefix.
  fireEvent.change(keyword, { target: { value: "Li" } });
  fireEvent.submit(keyword.closest("form")!);
  expect(
    await screen.findByRole("button", { name: "Listed app" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Listed copy" })).toBeNull();
  expect(screen.getByText("1 app · keyword “Li”")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.change(keyword, { target: { value: "Listed" } });
  fireEvent.submit(keyword.closest("form")!);
  expect(await screen.findByText(/Part of the search failed/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Listed app" })).toBeTruthy();
});
