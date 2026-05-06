// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveIdentityFromWif,
  mockResolveDpnsName,
  WrongKeyPurposeError,
  KeyDisabledError,
  UnknownIdentityError,
  InvalidPrivateKeyError,
} = vi.hoisted(() => {
  class WrongKeyPurposeError extends Error {
    identityId: string;
    purposeName: string;
    securityLevelName: string;
    constructor(
      identityId: string,
      purposeName: string,
      securityLevelName: string,
    ) {
      super("wrong purpose");
      this.identityId = identityId;
      this.purposeName = purposeName;
      this.securityLevelName = securityLevelName;
    }
  }
  class KeyDisabledError extends Error {
    identityId: string;
    constructor(identityId: string) {
      super("disabled");
      this.identityId = identityId;
    }
  }
  class UnknownIdentityError extends Error {}
  class InvalidPrivateKeyError extends Error {}
  return {
    mockResolveIdentityFromWif: vi.fn(),
    mockResolveDpnsName: vi.fn(),
    WrongKeyPurposeError,
    KeyDisabledError,
    UnknownIdentityError,
    InvalidPrivateKeyError,
  };
});

vi.mock("../src/dash/loginWithPrivateKey", () => ({
  resolveIdentityFromWif: mockResolveIdentityFromWif,
  WrongKeyPurposeError,
  KeyDisabledError,
  UnknownIdentityError,
  InvalidPrivateKeyError,
}));

vi.mock("../src/dash/resolveDpnsName", () => ({
  resolveDpnsName: mockResolveDpnsName,
}));

import {
  useWifPreview,
  type WifPreviewState,
} from "../src/hooks/useWifPreview";
import type { DashSdk } from "../src/dash/types";

// 52-char compressed-WIF-shaped string. Content is irrelevant — `looksLikeWif`
// only checks length + base58 charset, and the resolver is mocked.
const VALID_WIF = "cVHcfvcWNc7DvqaPCwM6Z3DqZQqZqZqZqZqZqZqZqZqZqZqZqZqZ";
const VALID_WIF_2 = "cWxKJZQqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq";
const sdk = { tag: "fake-sdk" } as unknown as DashSdk;

function Harness({
  secret,
  enabled = true,
  onState,
  sdkOverride,
}: {
  secret: string;
  enabled?: boolean;
  onState: (state: WifPreviewState) => void;
  sdkOverride?: DashSdk | null;
}) {
  const state = useWifPreview(
    sdkOverride === undefined ? sdk : sdkOverride,
    secret,
    enabled,
  );
  onState(state);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockResolveIdentityFromWif.mockReset();
  mockResolveDpnsName.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

async function flushDebounce() {
  // Advance past the 400ms debounce, then yield once for the inner async
  // resolver to settle.
  await act(async () => {
    vi.advanceTimersByTime(450);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useWifPreview", () => {
  it("returns idle when disabled, even for a valid-shaped WIF", async () => {
    const states: WifPreviewState[] = [];
    render(
      <Harness
        secret={VALID_WIF}
        enabled={false}
        onState={(s) => states.push(s)}
      />,
    );
    await flushDebounce();
    expect(states.every((s) => s.status === "idle")).toBe(true);
    expect(mockResolveIdentityFromWif).not.toHaveBeenCalled();
  });

  it("returns idle for input that fails the structural gate (too short)", async () => {
    const states: WifPreviewState[] = [];
    render(<Harness secret="cVHcfvcWNc7" onState={(s) => states.push(s)} />);
    await flushDebounce();
    expect(states.every((s) => s.status === "idle")).toBe(true);
    expect(mockResolveIdentityFromWif).not.toHaveBeenCalled();
  });

  it("returns idle when the SDK is null", async () => {
    const states: WifPreviewState[] = [];
    render(
      <Harness
        secret={VALID_WIF}
        sdkOverride={null}
        onState={(s) => states.push(s)}
      />,
    );
    await flushDebounce();
    expect(states.every((s) => s.status === "idle")).toBe(true);
    expect(mockResolveIdentityFromWif).not.toHaveBeenCalled();
  });

  it("resolves to identity + DPNS name after the debounce", async () => {
    mockResolveIdentityFromWif.mockResolvedValue({
      identityId: "id-A",
      identity: {},
      matched: { id: 1, purpose: 0, securityLevel: 2 },
      identityKey: {},
    });
    mockResolveDpnsName.mockResolvedValue("alice");

    const states: WifPreviewState[] = [];
    render(<Harness secret={VALID_WIF} onState={(s) => states.push(s)} />);

    // Before the debounce fires the hook should report "checking" once it
    // notices the gate is open.
    expect(states.at(-1)?.status).toBe("checking");
    expect(mockResolveIdentityFromWif).not.toHaveBeenCalled();

    await flushDebounce();

    expect(mockResolveIdentityFromWif).toHaveBeenCalledTimes(1);
    expect(mockResolveDpnsName).toHaveBeenCalledWith(sdk, "id-A");
    expect(states.at(-1)).toEqual({
      status: "resolved",
      identityId: "id-A",
      dpnsName: "alice",
    });
  });

  it("surfaces wrong-purpose with security level + DPNS name", async () => {
    mockResolveIdentityFromWif.mockRejectedValue(
      new WrongKeyPurposeError("id-B", "AUTHENTICATION", "MASTER"),
    );
    mockResolveDpnsName.mockResolvedValue("bob");

    const states: WifPreviewState[] = [];
    render(<Harness secret={VALID_WIF} onState={(s) => states.push(s)} />);
    await flushDebounce();

    expect(states.at(-1)).toEqual({
      status: "wrong-purpose",
      identityId: "id-B",
      dpnsName: "bob",
      purposeName: "AUTHENTICATION",
      securityLevelName: "MASTER",
    });
  });

  it("surfaces key-disabled with DPNS name", async () => {
    mockResolveIdentityFromWif.mockRejectedValue(new KeyDisabledError("id-C"));
    mockResolveDpnsName.mockResolvedValue(null);

    const states: WifPreviewState[] = [];
    render(<Harness secret={VALID_WIF} onState={(s) => states.push(s)} />);
    await flushDebounce();

    expect(states.at(-1)).toEqual({
      status: "key-disabled",
      identityId: "id-C",
      dpnsName: null,
    });
  });

  it("stays silent (idle) for UnknownIdentityError — no pre-submit error UI", async () => {
    mockResolveIdentityFromWif.mockRejectedValue(new UnknownIdentityError());

    const states: WifPreviewState[] = [];
    render(<Harness secret={VALID_WIF} onState={(s) => states.push(s)} />);
    await flushDebounce();

    expect(states.at(-1)?.status).toBe("idle");
    expect(mockResolveDpnsName).not.toHaveBeenCalled();
  });

  it("stays silent for unexpected errors (network blips, etc.)", async () => {
    mockResolveIdentityFromWif.mockRejectedValue(new Error("network down"));

    const states: WifPreviewState[] = [];
    render(<Harness secret={VALID_WIF} onState={(s) => states.push(s)} />);
    await flushDebounce();

    expect(states.at(-1)?.status).toBe("idle");
  });

  it("does not call resolve when the WIF changes within the debounce window", async () => {
    mockResolveIdentityFromWif.mockResolvedValue({
      identityId: "id-D",
      identity: {},
      matched: { id: 1, purpose: 0, securityLevel: 2 },
      identityKey: {},
    });
    mockResolveDpnsName.mockResolvedValue(null);

    let secret = VALID_WIF;
    const states: WifPreviewState[] = [];
    const { rerender } = render(
      <Harness secret={secret} onState={(s) => states.push(s)} />,
    );

    // Halfway through the debounce window, swap to a different WIF.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    secret = VALID_WIF_2;
    rerender(<Harness secret={secret} onState={(s) => states.push(s)} />);

    // Now flush. Only the second WIF should produce a network call.
    await flushDebounce();

    expect(mockResolveIdentityFromWif).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.status).toBe("resolved");
  });

  it("does not retain results across remount — secret state is component-local", async () => {
    // The hook intentionally does not cache resolved outcomes across mounts;
    // every fresh mount that re-passes the WIF performs the network call
    // again. This bounds raw-WIF retention to the form's lifetime.
    mockResolveIdentityFromWif.mockResolvedValue({
      identityId: "id-fresh",
      identity: {},
      matched: { id: 1, purpose: 0, securityLevel: 2 },
      identityKey: {},
    });
    mockResolveDpnsName.mockResolvedValue(null);

    const { unmount } = render(
      <Harness secret={VALID_WIF} onState={() => {}} />,
    );
    await flushDebounce();
    expect(mockResolveIdentityFromWif).toHaveBeenCalledTimes(1);
    unmount();

    render(<Harness secret={VALID_WIF} onState={() => {}} />);
    await flushDebounce();
    expect(mockResolveIdentityFromWif).toHaveBeenCalledTimes(2);
  });

  it("trims whitespace before gating; passes the trimmed WIF to the resolver", async () => {
    mockResolveIdentityFromWif.mockResolvedValue({
      identityId: "id-trim",
      identity: {},
      matched: { id: 1, purpose: 0, securityLevel: 2 },
      identityKey: {},
    });
    mockResolveDpnsName.mockResolvedValue(null);

    const states: WifPreviewState[] = [];
    render(
      <Harness secret={`  ${VALID_WIF}\n`} onState={(s) => states.push(s)} />,
    );
    await flushDebounce();
    expect(mockResolveIdentityFromWif).toHaveBeenCalledTimes(1);
    // Resolver was called with the trimmed WIF, not the padded input.
    expect(mockResolveIdentityFromWif).toHaveBeenCalledWith(sdk, VALID_WIF);
    expect(states.at(-1)?.status).toBe("resolved");
  });

  it("survives DPNS lookup failure on resolved path (returns null name)", async () => {
    mockResolveIdentityFromWif.mockResolvedValue({
      identityId: "id-E",
      identity: {},
      matched: { id: 1, purpose: 0, securityLevel: 2 },
      identityKey: {},
    });
    mockResolveDpnsName.mockRejectedValue(new Error("dpns broken"));

    const states: WifPreviewState[] = [];
    render(<Harness secret={VALID_WIF} onState={(s) => states.push(s)} />);
    await flushDebounce();

    expect(states.at(-1)).toEqual({
      status: "resolved",
      identityId: "id-E",
      dpnsName: null,
    });
  });
});
