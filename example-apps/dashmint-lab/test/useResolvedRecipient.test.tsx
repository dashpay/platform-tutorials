// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashSdk } from "../src/dash/types";
import { useResolvedRecipient } from "../src/hooks/useResolvedRecipient";

const { mockResolveDpnsName } = vi.hoisted(() => ({
  mockResolveDpnsName: vi.fn(),
}));

vi.mock("../src/dash/resolveRecipient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/dash/resolveRecipient")>();
  return {
    ...actual,
    resolveDpnsName: mockResolveDpnsName,
  };
});

const sdk = {
  dpns: {
    resolveName: vi.fn(),
    username: vi.fn(),
  },
} as unknown as DashSdk;

function Probe({
  currentSdk = sdk,
  input,
}: {
  currentSdk?: DashSdk | null;
  input?: string | null;
}) {
  const state = useResolvedRecipient(currentSdk, input);
  return <div data-testid="state">{JSON.stringify(state)}</div>;
}

function state() {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useResolvedRecipient", () => {
  it("stays idle when there is no sdk or resolvable input", () => {
    render(<Probe currentSdk={null} input="alice.dash" />);
    expect(state()).toEqual({ status: "idle" });
    expect(mockResolveDpnsName).not.toHaveBeenCalled();

    cleanup();

    render(<Probe input="   " />);
    expect(state()).toEqual({ status: "idle" });
    expect(mockResolveDpnsName).not.toHaveBeenCalled();
  });

  it("normalizes a DPNS name, resolves it, and reports the identity id", async () => {
    mockResolveDpnsName.mockResolvedValueOnce("identity-recipient-1");

    render(<Probe input=" Alice.DASH " />);

    expect(state()).toEqual({ status: "resolving" });
    await waitFor(() => {
      expect(state()).toEqual({
        status: "resolved",
        identityId: "identity-recipient-1",
      });
    });
    expect(mockResolveDpnsName).toHaveBeenCalledWith(sdk, "alice.dash");
  });

  it("reports not-found when DPNS resolution completes without an identity", async () => {
    mockResolveDpnsName.mockResolvedValueOnce(null);

    render(<Probe input="missing-recipient-name" />);

    await waitFor(() => {
      expect(state()).toEqual({ status: "not-found" });
    });
    expect(mockResolveDpnsName).toHaveBeenCalledWith(
      sdk,
      "missing-recipient-name.dash",
    );
  });

  it("reuses cached not-found results across hook mounts", async () => {
    mockResolveDpnsName.mockResolvedValueOnce(null);

    const first = render(<Probe input="cached-missing-recipient" />);
    await waitFor(() => {
      expect(state()).toEqual({ status: "not-found" });
    });
    first.unmount();

    render(<Probe input="cached-missing-recipient" />);

    expect(state()).toEqual({ status: "not-found" });
    expect(mockResolveDpnsName).toHaveBeenCalledTimes(1);
  });

  it("reuses cached resolved names across hook mounts", async () => {
    mockResolveDpnsName.mockResolvedValueOnce("identity-recipient-cache");

    const first = render(<Probe input="cached-recipient-name" />);
    await waitFor(() => {
      expect(state()).toEqual({
        status: "resolved",
        identityId: "identity-recipient-cache",
      });
    });
    first.unmount();

    render(<Probe input="cached-recipient-name" />);

    expect(state()).toEqual({
      status: "resolved",
      identityId: "identity-recipient-cache",
    });
    expect(mockResolveDpnsName).toHaveBeenCalledTimes(1);
  });

  it("does not cache transient resolver errors across mounts", async () => {
    mockResolveDpnsName
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValueOnce("identity-recipient-retry");

    const first = render(<Probe input="retry-recipient-name" />);
    await waitFor(() => {
      expect(mockResolveDpnsName).toHaveBeenCalledTimes(1);
    });
    first.unmount();

    render(<Probe input="retry-recipient-name" />);

    await waitFor(() => {
      expect(state()).toEqual({
        status: "resolved",
        identityId: "identity-recipient-retry",
      });
    });
    expect(mockResolveDpnsName).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight lookup across sibling hook instances", async () => {
    // Hold the lookup pending so the second sibling's effect runs while the
    // cache entry is still a Promise, exercising the shared-promise branch.
    let resolveLookup: (value: string) => void = () => {};
    mockResolveDpnsName.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveLookup = resolve;
      }),
    );

    function Pair() {
      return (
        <>
          <Probe input="shared-recipient-name" />
          <Probe input="shared-recipient-name" />
        </>
      );
    }

    render(<Pair />);

    expect(mockResolveDpnsName).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("state").map((el) => el.textContent)).toEqual([
      JSON.stringify({ status: "resolving" }),
      JSON.stringify({ status: "resolving" }),
    ]);

    resolveLookup("identity-recipient-shared");

    await waitFor(() => {
      expect(
        screen
          .getAllByTestId("state")
          .map((el) => JSON.parse(el.textContent ?? "{}")),
      ).toEqual([
        { status: "resolved", identityId: "identity-recipient-shared" },
        { status: "resolved", identityId: "identity-recipient-shared" },
      ]);
    });
    expect(mockResolveDpnsName).toHaveBeenCalledTimes(1);
  });

  it("propagates a rejected shared lookup to sibling hooks", async () => {
    let rejectLookup: (reason: Error) => void = () => {};
    mockResolveDpnsName.mockReturnValueOnce(
      new Promise<string>((_resolve, reject) => {
        rejectLookup = reject;
      }),
    );

    function Pair() {
      return (
        <>
          <Probe input="failing-recipient-name" />
          <Probe input="failing-recipient-name" />
        </>
      );
    }

    render(<Pair />);
    expect(mockResolveDpnsName).toHaveBeenCalledTimes(1);

    rejectLookup(new Error("shared lookup failed"));

    // Both siblings re-render after the rejection; the dropped cache entry
    // returns them to "resolving"; a later remount or key/sdk change can retry.
    await waitFor(() => {
      expect(
        screen.getAllByTestId("state").map((el) => el.textContent),
      ).toEqual([
        JSON.stringify({ status: "resolving" }),
        JSON.stringify({ status: "resolving" }),
      ]);
    });
  });
});
