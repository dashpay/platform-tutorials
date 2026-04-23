// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransferModal } from "../src/components/TransferModal";
import type { Card } from "../src/dash/queries";
import type { DashKeyManager, DashSdk } from "../src/dash/types";
import type { ResolvedRecipient } from "../src/hooks/useResolvedRecipient";

const {
  mockUseSession,
  mockTransferCard,
  mockUseDpnsName,
  mockUseResolvedRecipient,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockTransferCard: vi.fn(),
  mockUseDpnsName: vi.fn(),
  mockUseResolvedRecipient: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/transferCard", () => ({
  transferCard: mockTransferCard,
}));

vi.mock("../src/hooks/useDpnsName", () => ({
  useDpnsName: mockUseDpnsName,
}));

vi.mock("../src/hooks/useResolvedRecipient", () => ({
  useResolvedRecipient: mockUseResolvedRecipient,
}));

const card: Card = {
  id: "card-1",
  ownerId: "owner-1",
  data: {
    name: "Fire Dragon",
    attack: 9,
    defense: 8,
  },
};

const sessionValue = {
  sdk: {} as DashSdk,
  keyManager: {} as DashKeyManager,
  contractId: "contract-1",
  log: vi.fn(),
};

// An identity ID that includes `0`/`O`/`I`/`l`-free characters so it
// classifies as "ambiguous" (not forced into "name" by the classifier).
const SAMPLE_ID = "5LmvdJbGAtnk2Z3y5bwa2YcX9hk5GhVePtkT21a2mxAn";

const idle: ResolvedRecipient = { status: "idle" };
function resolved(identityId: string): ResolvedRecipient {
  return { status: "resolved", identityId };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function settle() {
  await act(async () => {
    await flushPromises();
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("TransferModal", () => {
  it("shows an inline error and stays open when transfer fails", async () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    // Ambiguous fallback: the name lookup misses so we submit the raw input.
    mockUseResolvedRecipient.mockReturnValue({ status: "not-found" });
    mockTransferCard.mockRejectedValueOnce(new Error("Transfer failed"));

    render(<TransferModal card={card} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: SAMPLE_ID },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Transfer failed");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows inline success before closing", async () => {
    const onClose = vi.fn();
    const onTransferred = vi.fn();
    vi.useFakeTimers();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue("alice");
    mockUseResolvedRecipient.mockReturnValue({ status: "not-found" });
    mockTransferCard.mockResolvedValueOnce(undefined);

    render(
      <TransferModal
        card={card}
        onClose={onClose}
        onTransferred={onTransferred}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: `  ${SAMPLE_ID}  ` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    expect(mockTransferCard).toHaveBeenCalledWith({
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      cardId: "card-1",
      recipientId: SAMPLE_ID,
      log: sessionValue.log,
    });

    await settle();
    expect(screen.getByRole("status").textContent).toContain(
      "Card transferred successfully.",
    );

    expect(onTransferred).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(onTransferred).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes the trimmed input into the resolver hook for ambiguous strings", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(idle);

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: `  ${SAMPLE_ID}  ` },
    });

    expect(mockUseResolvedRecipient).toHaveBeenLastCalledWith(
      sessionValue.sdk,
      SAMPLE_ID,
    );
  });

  it("shows the reverse DPNS hint when a pasted ID resolves via ambiguous fallback", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue("alice");
    mockUseResolvedRecipient.mockReturnValue({ status: "not-found" });

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: SAMPLE_ID },
    });

    expect(screen.getByText("✓ alice.dash")).toBeTruthy();
    expect(screen.getByText(/Transferring/).textContent).toContain(
      "alice.dash",
    );
    expect(screen.getByText(/Transferring/).textContent).toContain("…");
  });

  it("resolves a DPNS name, submits the resolved ID, and shows the summary", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferCard.mockResolvedValueOnce(undefined);

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: "Alice.dash" },
    });

    expect(screen.getByText(/Transferring/).textContent).toContain(
      "alice.dash",
    );

    const explorerLinks = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("href")?.includes("/identity/"));
    expect(explorerLinks.length).toBeGreaterThan(0);
    expect(explorerLinks[0].getAttribute("href")).toBe(
      `https://testnet.platform-explorer.com/identity/${SAMPLE_ID}`,
    );
    expect(explorerLinks[0].getAttribute("target")).toBe("_blank");

    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    expect(mockTransferCard).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: SAMPLE_ID }),
    );
  });

  it("shows 'No identity found' and disables Transfer when a name does not resolve", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue({ status: "not-found" });

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: "nobody.dash" },
    });

    expect(screen.getByText(/No identity found for/).textContent).toContain(
      "nobody.dash",
    );
    expect(
      (screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("never submits a not-found name as a raw identity ID", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue({ status: "not-found" });

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: "nobody.dash" },
    });

    // Even if the button were somehow clicked (e.g. via form submit), the
    // handler must guard against sending the typed name as a recipientId.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    });

    expect(mockTransferCard).not.toHaveBeenCalled();
  });

  it("shows 'Resolving…' and disables Transfer while a name lookup is in flight", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue({ status: "resolving" });

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: "alice.dash" },
    });

    expect(screen.getByText("Resolving…")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("blocks submission and shows an inline error for invalid characters", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(idle);

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: "alice@dash" },
    });

    expect(screen.getByText(/letters, digits, and hyphens only/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("closes when cancel is clicked", () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(idle);

    render(<TransferModal card={card} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables controls and shows the in-flight label while submitting", async () => {
    const transfer = deferred<void>();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferCard.mockReturnValueOnce(transfer.promise);

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "alice.dash" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    });

    await settle();
    expect(
      (
        screen.getByRole("button", {
          name: "Transferring…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      transfer.resolve();
      await transfer.promise;
    });
    await settle();
    expect(screen.getByRole("status").textContent).toContain(
      "Card transferred successfully.",
    );
  });
});
