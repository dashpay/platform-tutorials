// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IdentityCard } from "../src/components/IdentityCard";
import type { SessionStatus } from "../src/session/SessionContext";

afterEach(() => {
  cleanup();
});

const IDENTITY_ID = "GgZekwh38XcWQTyWWWvmw6CEYFnLU7yiZFPWZEjqKHit";
// IdentityCard calls truncateId(id, 6); head=6 + ellipsis + tail=8.
const TRUNCATED_ID = "GgZekw…ZEjqKHit";
const CONTRACT_ID = "8d6heK6CoskLBi6Rs7cChRG9RuckcZqZst28BdviBe8y";
const TRUNCATED_CONTRACT_LINE = "contract 8d6heK…BdviBe8y";

function renderCard(props: {
  status: SessionStatus;
  identityId: string | null;
  dpnsName: string | null;
  contractId?: string | null;
}) {
  return render(
    <IdentityCard
      status={props.status}
      identityId={props.identityId}
      dpnsName={props.dpnsName}
      contractId={props.contractId ?? null}
      onLoginClick={vi.fn()}
    />,
  );
}

describe("IdentityCard", () => {
  it("shows @-prefixed DPNS name as the primary line when authenticated", () => {
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: "alice",
    });
    expect(screen.getByText("@alice")).toBeTruthy();
    // Identity ID becomes the secondary line.
    expect(screen.getByText(TRUNCATED_ID)).toBeTruthy();
  });

  it("falls back to the truncated identity ID as primary when there is no DPNS name", () => {
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
    });
    expect(screen.getByText(TRUNCATED_ID)).toBeTruthy();
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it("shows the contract line as 'contract <truncated>' when no DPNS name is present", () => {
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
      contractId: CONTRACT_ID,
    });
    expect(screen.getByText(TRUNCATED_CONTRACT_LINE)).toBeTruthy();
  });

  it("renders the same primary/secondary layout in browsing (read-only) mode", () => {
    renderCard({
      status: "browsing",
      identityId: IDENTITY_ID,
      dpnsName: "alice",
    });
    expect(screen.getByText("@alice")).toBeTruthy();
    expect(screen.getByText(TRUNCATED_ID)).toBeTruthy();
  });

  it("hides the identity layout and shows a Login button when not connected", () => {
    renderCard({
      status: "idle",
      identityId: IDENTITY_ID,
      dpnsName: "alice",
    });
    expect(screen.getByRole("button", { name: /login/i })).toBeTruthy();
    // The identity layout (name + truncated id) must not render in the
    // disconnected state, even when an id and name are passed in.
    expect(screen.queryByText("@alice")).toBeNull();
    expect(screen.queryByText(TRUNCATED_ID)).toBeNull();
  });
});
