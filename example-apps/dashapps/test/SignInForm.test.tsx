// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SignInForm } from "../src/components/SignInForm";
import { useSession } from "../src/session/useSession";
import { id } from "./helpers";

vi.mock("../src/session/useSession", () => ({ useSession: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderForm(login = vi.fn()) {
  vi.mocked(useSession).mockReturnValue({
    network: "testnet",
    connection: {},
    login,
    logout: vi.fn(),
  } as never);
  render(<SignInForm onClose={vi.fn()} />);
  return login;
}

it("hides mnemonic and WIF-specific fields until needed", () => {
  renderForm();
  expect(screen.queryByLabelText("Identity index")).toBeNull();
  expect(screen.queryByLabelText("Identity ID")).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "Show advanced settings" }),
  );
  expect(screen.getByLabelText("Identity index")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
    target: { value: "single-token-wif" },
  });
  expect(screen.queryByLabelText("Identity index")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /advanced settings/ }),
  ).toBeNull();
});

it("asks for an identity ID only after an ambiguous WIF response", async () => {
  const ambiguous = new Error(
    "This key is associated with multiple identities.",
  );
  ambiguous.name = "AmbiguousIdentityError";
  const login = renderForm(
    vi.fn().mockRejectedValueOnce(ambiguous).mockResolvedValueOnce(undefined),
  );
  fireEvent.change(screen.getByLabelText("Mnemonic or private key"), {
    target: { value: "single-token-wif" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

  const identityInput = await screen.findByLabelText("Identity ID");
  fireEvent.change(identityInput, { target: { value: id(4) } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

  await waitFor(() =>
    expect(login).toHaveBeenLastCalledWith("single-token-wif", {
      identityIndex: 0,
      expectedIdentityId: id(4),
    }),
  );
});
