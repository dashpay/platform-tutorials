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
import { useSession } from "../src/session/useSession";

vi.mock("../src/session/useSession", () => ({
  useSession: vi.fn(),
}));

describe("LoginModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function mockSession(login = vi.fn().mockResolvedValue(undefined)) {
    vi.mocked(useSession).mockReturnValue({
      login,
    } as never);
    return login;
  }

  it("renders nothing when closed", () => {
    mockSession();

    const { container } = render(<LoginModal open={false} onClose={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it("stays open when launched during an authenticated session", () => {
    const onClose = vi.fn();
    mockSession();

    render(<LoginModal open onClose={onClose} />);

    expect(
      screen.getByRole("dialog", { name: "Sign in to TokenOps" }),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focuses the secret field when opened", () => {
    mockSession();

    const { rerender } = render(<LoginModal open={false} onClose={vi.fn()} />);
    rerender(<LoginModal open onClose={vi.fn()} />);

    expect(document.activeElement).toBe(
      screen.getByLabelText("Mnemonic or private key"),
    );
  });

  it("keeps the submit button disabled for empty or whitespace-only secrets", () => {
    mockSession();

    render(<LoginModal open onClose={vi.fn()} />);

    const submit = screen.getByRole("button", {
      name: "Sign in",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
      target: { value: "   \t  " },
    });

    expect(submit.disabled).toBe(true);
  });

  it("submits mnemonic login with an identity index", async () => {
    const login = mockSession();
    const onClose = vi.fn();

    render(<LoginModal open onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Sign in to TokenOps" });
    fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
      target: { value: "abandon abandon abandon" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Show advanced settings" }),
    );
    fireEvent.change(screen.getByLabelText(/identity index/i), {
      target: { value: "3" },
    });
    fireEvent.click(
      dialog.querySelector('button[type="submit"]') as HTMLButtonElement,
    );

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("abandon abandon abandon", {
        identityIndex: 3,
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hides mnemonic-only advanced settings for WIF-shaped input", () => {
    mockSession();

    render(<LoginModal open onClose={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Show advanced settings" }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
      target: { value: "cVHcfvcWNc7DvqaPCwM6Z3DqZ" },
    });

    expect(
      screen.queryByRole("button", { name: "Show advanced settings" }),
    ).toBeNull();
  });

  it("falls back to identityIndex=0 when the index field is non-numeric", async () => {
    const login = mockSession();

    render(<LoginModal open onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Sign in to TokenOps" });
    fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
      target: { value: "abandon abandon abandon" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Show advanced settings" }),
    );
    fireEvent.change(screen.getByLabelText(/identity index/i), {
      target: { value: "abc" },
    });
    fireEvent.click(
      dialog.querySelector('button[type="submit"]') as HTMLButtonElement,
    );

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("abandon abandon abandon", {
        identityIndex: 0,
      }),
    );
  });

  it("disables the submit button while login is in flight", async () => {
    let resolveLogin: (() => void) | undefined;
    mockSession(
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve;
          }),
      ),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
      target: { value: "abandon abandon abandon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const connecting = (await screen.findByRole("button", {
      name: "Connecting...",
    })) as HTMLButtonElement;
    expect(connecting.disabled).toBe(true);

    resolveLogin?.();
  });

  it("calls onClose from cancel and Escape", () => {
    const onClose = vi.fn();
    mockSession();

    const { rerender } = render(<LoginModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();

    onClose.mockClear();
    rerender(<LoginModal open onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("surfaces login errors and keeps the modal open", async () => {
    const login = mockSession(vi.fn().mockRejectedValue(new Error("bad key")));
    const onClose = vi.fn();

    render(<LoginModal open onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Sign in to TokenOps" });
    fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
      target: { value: "bad-key" },
    });
    fireEvent.click(
      dialog.querySelector('button[type="submit"]') as HTMLButtonElement,
    );

    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    expect(await screen.findByText("bad key")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
