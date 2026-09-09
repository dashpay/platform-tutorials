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
import { afterEach, expect, it, vi } from "vitest";
import App from "../src/App";
import { loadSdkCore } from "../src/dash/sdkCore";
import { contract, deferred, id, sdk } from "./helpers";
import type { ContractHandle } from "../src/dash/types";
import { ContractSummaryStore } from "../src/dash/contractSummaryStore";
vi.mock("../src/dash/sdkCore", () => ({ loadSdkCore: vi.fn() }));
afterEach(() => {
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
