// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppNotices } from "../src/components/AppNotices";

afterEach(() => {
  cleanup();
});

describe("AppNotices", () => {
  it("renders nothing when there is no status and a contract is set", () => {
    const { container } = render(<AppNotices status="" hasContract />);
    expect(container.querySelector(".status")).toBeNull();
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("shows the status text when present", () => {
    render(<AppNotices status="Save failed: boom" hasContract />);
    const status = screen.getByText("Save failed: boom");
    expect(status.className).toBe("status");
  });

  it("shows the no-contract notice when no contract is configured", () => {
    const { container } = render(<AppNotices status="" hasContract={false} />);
    const notice = container.querySelector(".notice");
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("No default contract is bundled yet");
  });

  it("can show both the status and the no-contract notice", () => {
    const { container } = render(
      <AppNotices status="Connecting..." hasContract={false} />,
    );
    expect(container.querySelector(".status")?.textContent).toBe(
      "Connecting...",
    );
    expect(container.querySelector(".notice")).not.toBeNull();
  });
});
