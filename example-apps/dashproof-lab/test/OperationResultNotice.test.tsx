// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OperationResultNotice } from "../src/components/OperationResultNotice";

afterEach(() => {
  cleanup();
});

describe("OperationResultNotice aria-live", () => {
  it("uses role=alert for error tone so screen readers announce immediately", () => {
    render(
      <OperationResultNotice tone="error" title="Verify error">
        body
      </OperationResultNotice>,
    );
    const node = screen.getByRole("alert");
    expect(node.getAttribute("aria-live")).toBe("polite");
    expect(node.textContent).toContain("Verify error");
  });

  it("uses role=status for non-error tones", () => {
    render(
      <OperationResultNotice tone="success" title="Proof found">
        body
      </OperationResultNotice>,
    );
    const node = screen.getByRole("status");
    expect(node.getAttribute("aria-live")).toBe("polite");
  });

  it("defaults to role=status when tone is not provided", () => {
    render(
      <OperationResultNotice title="Heads up">body</OperationResultNotice>,
    );
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
