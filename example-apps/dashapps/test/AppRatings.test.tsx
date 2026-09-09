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
import { AppRatings } from "../src/components/AppRatings";
import { useSession } from "../src/session/useSession";
import {
  listRatings,
  ownRating,
  ratingSummary,
  summarize,
  type RatingRecord,
} from "../src/dash/ratingReads";
import { removeRating, saveRating } from "../src/dash/ratingWrites";
import { deferred, id } from "./helpers";

vi.mock("../src/session/useSession", () => ({ useSession: vi.fn() }));
vi.mock("../src/dash/ratingReads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/dash/ratingReads")>()),
  listRatings: vi.fn(),
  ownRating: vi.fn(),
  ratingSummary: vi.fn(),
}));
vi.mock("../src/dash/ratingWrites", () => ({
  saveRating: vi.fn(),
  removeRating: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const summary = summarize({ 1: 0n, 2: 1n, 3: 3n, 4: 7n, 5: 16n });
const now = Date.now();
function rating(n: number, stars = 5, owner = 7): RatingRecord {
  return {
    id: id(n),
    ownerId: id(owner),
    contractId: id(2),
    stars: stars as 5,
    title: `Title ${n}`,
    body: n % 2 ? `Body ${n}` : undefined,
    createdAt: BigInt(now - n * 86_400_000),
    updatedAt: BigInt(now - n * 86_400_000),
    revision: 1n,
  };
}
function session(overrides: Record<string, unknown> = {}) {
  vi.mocked(useSession).mockReturnValue({
    network: "testnet",
    connection: { sdk: {}, names: { resolve: vi.fn(async () => null) } },
    registryId: id(3),
    identityId: null,
    keyManager: null,
    refreshBalance: vi.fn(async () => undefined),
    ...overrides,
  } as never);
}
function signedIn(own: RatingRecord | null = null) {
  session({ identityId: id(1), keyManager: {} });
  vi.mocked(ownRating).mockResolvedValue(own);
}

it("renders the average, histogram and list, and reports the summary upward", async () => {
  session();
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  vi.mocked(listRatings).mockResolvedValue({
    ratings: [rating(1), rating(2, 3)],
    cursor: undefined,
  });
  const onSummary = vi.fn();
  render(<AppRatings contractId={id(2)} onSummary={onSummary} />);
  await screen.findByText("4.4");
  expect(onSummary).toHaveBeenLastCalledWith(summary);
  expect(screen.getAllByText("27 ratings").length).toBeGreaterThan(0);
  const histogram = screen.getByRole("group", { name: "Ratings by star" });
  expect(
    within(histogram).getByRole("button", { name: "5 stars: 16" }),
  ).toBeTruthy();
  expect(
    within(histogram).getByRole("button", { name: "1 star: 0" }),
  ).toBeTruthy();
  expect(screen.getByText("Title 1")).toBeTruthy();
  expect(screen.getByText("Rated without a written review.")).toBeTruthy();
  expect(screen.getByText("1 day ago")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign in to rate" })).toBeTruthy();
  expect(listRatings).toHaveBeenCalledWith({}, id(3), id(2), {
    sort: "recent",
    stars: undefined,
    cursor: undefined,
  });
});

it("shows the empty state and keeps the list when the summary fails", async () => {
  session();
  vi.mocked(ratingSummary).mockRejectedValue(new Error("count unavailable"));
  vi.mocked(listRatings).mockResolvedValue({ ratings: [], cursor: undefined });
  const onSummary = vi.fn();
  render(<AppRatings contractId={id(2)} onSummary={onSummary} />);
  await screen.findByText(/count unavailable/);
  expect(screen.getByRole("alert").textContent).toContain(
    "Could not load the rating summary",
  );
  await screen.findByText("No ratings yet. Be the first to rate this app.");
  expect(onSummary).toHaveBeenCalledWith(null);
  expect(onSummary).not.toHaveBeenCalledWith(
    expect.objectContaining({ count: expect.anything() }),
  );
});

it("filters by star from the histogram and sorts with the chips", async () => {
  session();
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  vi.mocked(listRatings).mockResolvedValue({ ratings: [], cursor: undefined });
  render(<AppRatings contractId={id(2)} />);
  await screen.findByText("4.4");
  fireEvent.click(screen.getByRole("button", { name: "5 stars: 16" }));
  await waitFor(() =>
    expect(listRatings).toHaveBeenLastCalledWith(
      {},
      id(3),
      id(2),
      expect.objectContaining({ stars: 5 }),
    ),
  );
  expect(screen.getByText("Showing 5-star ratings only.")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Highest rated" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  fireEvent.click(screen.getByRole("button", { name: "Highest rated" }));
  await waitFor(() =>
    expect(listRatings).toHaveBeenLastCalledWith(
      {},
      id(3),
      id(2),
      expect.objectContaining({ sort: "highest", stars: undefined }),
    ),
  );
});

it("hides ratings without text when Written only is on", async () => {
  session();
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  vi.mocked(listRatings).mockResolvedValue({
    ratings: [rating(1), rating(2)],
    cursor: id(50),
  });
  render(<AppRatings contractId={id(2)} />);
  await screen.findByText("Title 2");
  fireEvent.click(screen.getByRole("button", { name: "Written only" }));
  expect(screen.queryByText("Title 2")).toBeNull();
  expect(screen.getByText("Title 1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await waitFor(() =>
    expect(listRatings).toHaveBeenLastCalledWith(
      {},
      id(3),
      id(2),
      expect.objectContaining({ cursor: id(50) }),
    ),
  );
});

it("lets a signed-in user pick stars, write a review and save it", async () => {
  signedIn(null);
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  vi.mocked(listRatings).mockResolvedValue({ ratings: [], cursor: undefined });
  vi.mocked(saveRating).mockResolvedValue("created");
  render(<AppRatings contractId={id(2)} />);
  await screen.findByText("Used this app?");
  await screen.findByRole("button", { name: "Write a review" });
  fireEvent.click(
    within(screen.getByRole("radiogroup", { name: "Your rating" })).getByRole(
      "radio",
      { name: "4 stars" },
    ),
  );
  const dialog = await screen.findByRole("dialog", { name: "Write a review" });
  expect(
    within(dialog)
      .getByRole("radio", { name: "4 stars" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.change(within(dialog).getByLabelText("Title (optional)"), {
    target: { value: "Solid" },
  });
  fireEvent.change(within(dialog).getByLabelText("Review (optional)"), {
    target: { value: "Works well." },
  });
  const before = vi.mocked(ratingSummary).mock.calls.length;
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Submit rating" }),
  );
  await screen.findByText("Rating saved.");
  expect(saveRating).toHaveBeenCalledWith(
    expect.objectContaining({
      registryId: id(3),
      targetId: id(2),
      input: { stars: 4, title: "Solid", body: "Works well." },
    }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() =>
    expect(vi.mocked(ratingSummary).mock.calls.length).toBeGreaterThan(before),
  );
});

it("shows the user's existing rating and lets them remove it", async () => {
  const own = rating(9, 3, 1);
  signedIn(own);
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  vi.mocked(listRatings).mockResolvedValue({
    ratings: [rating(1), own],
    cursor: undefined,
  });
  vi.mocked(removeRating).mockResolvedValue(undefined);
  render(<AppRatings contractId={id(2)} />);
  await waitFor(() =>
    expect(screen.getAllByText("Your rating")).toHaveLength(2),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit review" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Edit your review",
  });
  expect(
    (within(dialog).getByLabelText("Title (optional)") as HTMLInputElement)
      .value,
  ).toBe("Title 9");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Remove rating" }),
  );
  await screen.findByText("Rating removed.");
  expect(removeRating).toHaveBeenCalledWith(
    expect.objectContaining({ registryId: id(3), rating: own }),
  );
});

it("surfaces write failures inside the editor", async () => {
  signedIn(null);
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  vi.mocked(listRatings).mockResolvedValue({ ratings: [], cursor: undefined });
  vi.mocked(saveRating).mockRejectedValue(new Error("insufficient balance"));
  render(<AppRatings contractId={id(2)} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Write a review" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Submit rating",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole("radio", { name: "5 stars" }));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Submit rating" }),
  );
  await within(dialog).findByText("insufficient balance");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("ignores a late list response after the sort changed", async () => {
  session();
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  const slow = deferred<{
    ratings: RatingRecord[];
    cursor: string | undefined;
  }>();
  vi.mocked(listRatings)
    .mockReturnValueOnce(slow.promise)
    .mockResolvedValue({ ratings: [rating(2, 1)], cursor: undefined });
  render(<AppRatings contractId={id(2)} />);
  await screen.findByText("4.4");
  fireEvent.click(screen.getByRole("button", { name: "Lowest rated" }));
  await screen.findByText("Title 2");
  await act(async () => {
    slow.resolve({ ratings: [rating(1)], cursor: undefined });
  });
  expect(screen.queryByText("Title 1")).toBeNull();
});

it("renders nothing without a registry and a mainnet-only prompt when signed out", async () => {
  session({ registryId: "" });
  const { container } = render(<AppRatings contractId={id(2)} />);
  expect(container.innerHTML).toBe("");
  cleanup();
  session({ network: "mainnet" });
  vi.mocked(ratingSummary).mockResolvedValue(summary);
  vi.mocked(listRatings).mockResolvedValue({ ratings: [], cursor: undefined });
  render(<AppRatings contractId={id(2)} />);
  expect(
    (
      (await screen.findByRole("button", {
        name: "Testnet only",
      })) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
