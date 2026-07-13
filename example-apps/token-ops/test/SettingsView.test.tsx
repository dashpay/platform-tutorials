// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsView } from "../src/components/SettingsView";
import { registerContract } from "../src/dash/contract";
import { resolveTokenRef } from "../src/dash/resolveTokenRef";
import { fetchTokenBalance } from "../src/dash/token";
import { useSession } from "../src/session/useSession";

vi.mock("../src/dash/contract", () => ({
  TOKEN_POSITION: 0,
  registerContract: vi.fn(),
}));

vi.mock("../src/dash/resolveTokenRef", () => ({
  resolveTokenRef: vi.fn(),
}));

vi.mock("../src/dash/token", () => ({
  fetchTokenBalance: vi.fn(),
}));

vi.mock("../src/hooks/useDpnsNames", () => ({
  useDpnsNames: vi.fn(() => ({})),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: vi.fn(),
}));

function authenticatedSession() {
  return {
    status: "authenticated",
    sdk: { contracts: {}, tokens: {} },
    keyManager: { id: "key-manager" },
    contractId: "current-contract",
    identityId: "identity-1",
    setContractId: vi.fn(),
    logout: vi.fn(),
    log: vi.fn(),
  };
}

describe("SettingsView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("resolves a trimmed token reference and selects its contract", async () => {
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenBalance).mockResolvedValue(12n);
    vi.mocked(resolveTokenRef).mockResolvedValue({
      contractId: "resolved-contract",
      resolvedFrom: "token",
      tokenId: "token-1",
      tokenPosition: 0,
    });

    render(<SettingsView />);
    fireEvent.change(screen.getByPlaceholderText("Contract or token ID"), {
      target: { value: "  token-1  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use" }));

    await waitFor(() =>
      expect(resolveTokenRef).toHaveBeenCalledWith(session.sdk, "token-1"),
    );
    expect(session.setContractId).toHaveBeenCalledWith("resolved-contract");
    expect(
      (screen.getByPlaceholderText("Contract or token ID") as HTMLInputElement)
        .value,
    ).toBe("resolved-contract");
    expect(screen.getByText(/Resolved token/)).toBeTruthy();
  });

  it("rejects a token at a position the app does not operate", async () => {
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenBalance).mockResolvedValue(0n);
    vi.mocked(resolveTokenRef).mockResolvedValue({
      contractId: "multi-token-contract",
      resolvedFrom: "token",
      tokenId: "other-token",
      tokenPosition: 2,
    });

    render(<SettingsView />);
    fireEvent.change(screen.getByPlaceholderText("Contract or token ID"), {
      target: { value: "other-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use" }));

    expect(
      await screen.findByText(
        "That token is at position 2 on its contract. TokenOps operates the token at position 0.",
      ),
    ).toBeTruthy();
    expect(session.setContractId).not.toHaveBeenCalled();
  });

  it("validates the initial group members before registration", async () => {
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenBalance).mockResolvedValue(0n);

    render(<SettingsView />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Register new TokenOps contract…",
      }),
    );

    const members = screen.getByLabelText("Initial group member identity IDs");
    fireEvent.change(members, { target: { value: "member-a member-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Register contract" }));
    expect(
      await screen.findByText(
        "Enter exactly three TokenOps group member identity IDs before registering a contract.",
      ),
    ).toBeTruthy();

    fireEvent.change(members, {
      target: { value: "member-a, member-a, member-c" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register contract" }));
    expect(
      await screen.findByText("Group member identity IDs must be distinct."),
    ).toBeTruthy();
    expect(registerContract).not.toHaveBeenCalled();
  });

  it("registers a contract with three parsed member IDs", async () => {
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenBalance).mockResolvedValue(0n);
    vi.mocked(registerContract).mockResolvedValue("new-contract");

    render(<SettingsView />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Register new TokenOps contract…",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Initial group member identity IDs"),
      { target: { value: " member-a, member-b\nmember-c " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Register contract" }));

    await waitFor(() =>
      expect(registerContract).toHaveBeenCalledWith({
        sdk: session.sdk,
        keyManager: session.keyManager,
        groupMemberIds: ["member-a", "member-b", "member-c"],
        log: session.log,
      }),
    );
    expect(session.setContractId).toHaveBeenCalledWith("new-contract");
    expect(
      (screen.getByPlaceholderText("Contract or token ID") as HTMLInputElement)
        .value,
    ).toBe("new-contract");
    expect(
      screen.queryByRole("button", { name: "Register contract" }),
    ).toBeNull();
  });

  it("shows the authenticated balance and the read-only alternative", async () => {
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenBalance).mockResolvedValue(42n);

    const view = render(<SettingsView />);
    expect(await screen.findByText("42")).toBeTruthy();
    expect(fetchTokenBalance).toHaveBeenCalledWith({
      sdk: session.sdk,
      contractId: "current-contract",
      identityId: "identity-1",
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(session.logout).toHaveBeenCalledOnce();

    view.unmount();
    vi.mocked(useSession).mockReturnValue({
      status: "readonly",
      sdk: session.sdk,
      keyManager: null,
      contractId: "current-contract",
      identityId: null,
      setContractId: vi.fn(),
      logout: vi.fn(),
      log: vi.fn(),
    } as never);
    render(<SettingsView />);

    expect(
      screen.getByRole("heading", { name: "Read-only mode" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Sign in before registering a new contract."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Register new TokenOps contract…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
