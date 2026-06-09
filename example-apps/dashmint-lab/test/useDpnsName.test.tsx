// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDpnsName } from "../src/hooks/useDpnsName";
import type { DashSdk } from "../src/dash/types";

function makeSdk(username: ReturnType<typeof vi.fn>): DashSdk {
  return {
    dpns: {
      username,
      resolveName: vi.fn(),
    },
  } as unknown as DashSdk;
}

function Probe({
  sdk,
  identityId,
}: {
  sdk?: DashSdk | null;
  identityId?: string | null;
}) {
  const name = useDpnsName(sdk, identityId);
  return <div data-testid="name">{name ?? ""}</div>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useDpnsName", () => {
  it("does not resolve until both sdk and identity id are available", () => {
    const username = vi.fn();
    const sdk = makeSdk(username);

    render(<Probe sdk={sdk} identityId={null} />);

    expect(screen.getByTestId("name").textContent).toBe("");
    expect(username).not.toHaveBeenCalled();
  });

  it("resolves an identity id and strips the display-only .dash suffix", async () => {
    const username = vi.fn().mockResolvedValue("alice.dash");
    const sdk = makeSdk(username);

    render(<Probe sdk={sdk} identityId="identity-use-dpns-name-1" />);

    expect(screen.getByTestId("name").textContent).toBe("");
    await waitFor(() => {
      expect(screen.getByTestId("name").textContent).toBe("alice");
    });
    expect(username).toHaveBeenCalledWith("identity-use-dpns-name-1");
  });

  it("keeps names that do not end in the display-only .dash suffix", async () => {
    const username = vi.fn().mockResolvedValue("alice");
    const sdk = makeSdk(username);

    render(<Probe sdk={sdk} identityId="identity-use-dpns-name-2" />);

    await waitFor(() => {
      expect(screen.getByTestId("name").textContent).toBe("alice");
    });
  });

  it.each([
    ["missing", undefined],
    ["numeric", 123],
    ["object", { label: "alice.dash" }],
  ])("treats %s DPNS responses as no display name", async (_case, value) => {
    const username = vi.fn().mockResolvedValue(value);
    const sdk = makeSdk(username);

    render(<Probe sdk={sdk} identityId={`identity-use-dpns-name-${_case}`} />);

    await waitFor(() => {
      expect(username).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("name").textContent).toBe("");
  });

  it("reuses the module-level cache across hook mounts", async () => {
    const username = vi.fn().mockResolvedValue("cached-name.dash");
    const sdk = makeSdk(username);

    const first = render(
      <Probe sdk={sdk} identityId="identity-use-dpns-name-cache" />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("name").textContent).toBe("cached-name");
    });
    first.unmount();

    render(<Probe sdk={sdk} identityId="identity-use-dpns-name-cache" />);

    expect(screen.getByTestId("name").textContent).toBe("cached-name");
    expect(username).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight lookup across sibling hook instances", async () => {
    const username = vi.fn().mockResolvedValue("shared-name.dash");
    const sdk = makeSdk(username);

    function Pair() {
      return (
        <>
          <Probe sdk={sdk} identityId="identity-use-dpns-name-shared" />
          <Probe sdk={sdk} identityId="identity-use-dpns-name-shared" />
        </>
      );
    }

    render(<Pair />);

    await waitFor(() => {
      expect(screen.getAllByTestId("name").map((el) => el.textContent)).toEqual(
        ["shared-name", "shared-name"],
      );
    });
    expect(username).toHaveBeenCalledTimes(1);
  });
});
