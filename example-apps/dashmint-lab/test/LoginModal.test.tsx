// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginModal } from "../src/components/LoginModal";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

const { mockUseSession, mockRegisterContract } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockRegisterContract: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/contract", () => ({
  registerContract: mockRegisterContract,
}));

const sessionValue = {
  status: "browsing" as const,
  sdk: {} as DashSdk,
  keyManager: {} as DashKeyManager,
  identityId: null,
  contractId: "contract-1",
  log: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  setContractId: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginModal", () => {
  it("logs in with the advanced identity index and closes on success", async () => {
    const onClose = vi.fn();
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({ ...sessionValue, login });

    render(<LoginModal open onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("mnemonic phrase"), {
      target: { value: "test mnemonic words" },
    });
    fireEvent.click(screen.getByRole("button", { name: /advanced settings/i }));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("test mnemonic words", 2);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the login error and stays open when login fails", async () => {
    const onClose = vi.fn();
    const login = vi.fn().mockRejectedValue(new Error("Bad mnemonic"));
    mockUseSession.mockReturnValue({ ...sessionValue, login });

    render(<LoginModal open onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("mnemonic phrase"), {
      target: { value: "bad mnemonic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByText("Bad mnemonic")).toBeTruthy();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies a trimmed contract id from advanced settings", () => {
    const setContractId = vi.fn();
    mockUseSession.mockReturnValue({ ...sessionValue, setContractId });

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /advanced settings/i }));
    fireEvent.change(
      screen.getByPlaceholderText("Default testnet contract used if blank"),
      {
        target: { value: "  contract-2  " },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Use this ID" }));

    expect(setContractId).toHaveBeenCalledWith("contract-2");
  });

  it("registers a new contract in settings mode and stores the returned id", async () => {
    const setContractId = vi.fn();
    mockUseSession.mockReturnValue({
      ...sessionValue,
      status: "authenticated" as const,
      identityId: "owner-1",
      setContractId,
    });
    mockRegisterContract.mockResolvedValueOnce("contract-99");

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Register new" }));

    await waitFor(() => {
      expect(mockRegisterContract).toHaveBeenCalledWith({
        sdk: sessionValue.sdk,
        keyManager: sessionValue.keyManager,
        log: sessionValue.log,
      });
    });

    expect(setContractId).toHaveBeenCalledWith("contract-99");
  });

  it("logs out and closes in settings mode", () => {
    const onClose = vi.fn();
    const logout = vi.fn();
    mockUseSession.mockReturnValue({
      ...sessionValue,
      status: "authenticated" as const,
      identityId: "owner-1",
      logout,
    });

    render(<LoginModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
