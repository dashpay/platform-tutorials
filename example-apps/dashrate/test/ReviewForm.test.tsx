// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewForm } from "../src/components/ReviewForm";
import type { ReviewHistoryEntry } from "../src/dash/history";

afterEach(() => {
  cleanup();
});

type Props = Parameters<typeof ReviewForm>[0];

function renderForm(overrides: Partial<Props> = {}) {
  const props: Props = {
    signedIn: true,
    busy: false,
    contractId: "c1",
    rating: null,
    hoverRating: null,
    reviewText: "",
    hasSelectedReview: false,
    history: [],
    onSubmit: vi.fn(),
    onOpenSettings: vi.fn(),
    onRatingChange: vi.fn(),
    onHoverRatingChange: vi.fn(),
    onReviewTextChange: vi.fn(),
    onLoadHistory: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ReviewForm {...props} />) };
}

describe("ReviewForm (signed out)", () => {
  it("shows the sign-in CTA and no rating picker", () => {
    const onOpenSettings = vi.fn();
    renderForm({ signedIn: false, onOpenSettings });
    expect(screen.getByText("Sign in to review this resource")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});

describe("ReviewForm (signed in)", () => {
  it("renders five rating radios and reports clicks", () => {
    const onRatingChange = vi.fn();
    renderForm({ onRatingChange });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    fireEvent.click(radios[3]);
    expect(onRatingChange).toHaveBeenCalledWith(4);
  });

  it("reflects the selected rating via aria-checked", () => {
    renderForm({ rating: 3 });
    const radios = screen.getAllByRole("radio");
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
    expect(radios[0].getAttribute("aria-checked")).toBe("false");
  });

  it("reports hover on enter/focus and clears on leave/blur", () => {
    const onHoverRatingChange = vi.fn();
    renderForm({ onHoverRatingChange });
    const radios = screen.getAllByRole("radio");
    fireEvent.mouseEnter(radios[1]);
    expect(onHoverRatingChange).toHaveBeenCalledWith(2);
    fireEvent.blur(radios[1]);
    expect(onHoverRatingChange).toHaveBeenCalledWith(null);
  });

  it("forwards textarea input and caps its length", () => {
    const onReviewTextChange = vi.fn();
    renderForm({ onReviewTextChange });
    const textarea = screen.getByPlaceholderText(/share what worked/i);
    expect(textarea.getAttribute("maxLength")).toBe("1000");
    fireEvent.change(textarea, { target: { value: "neat" } });
    expect(onReviewTextChange).toHaveBeenCalledWith("neat");
  });

  it("disables Save until a contract and rating are present", () => {
    const noRating = renderForm({ rating: null });
    expect(
      (noRating.getByText("Save review") as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    const noContract = renderForm({ rating: 4, contractId: "" });
    expect(
      (noContract.getByText("Save review") as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    const ready = renderForm({ rating: 4, contractId: "c1" });
    expect((ready.getByText("Save review") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("submits the form", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const { container } = renderForm({ rating: 4, onSubmit });
    const form = container.querySelector("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("shows the closed history control and calls onLoadHistory when clicked", () => {
    const onLoadHistory = vi.fn();
    renderForm({ hasSelectedReview: true, onLoadHistory });

    const toggle = screen.getByRole("button", {
      name: /show previous versions/i,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // No history is rendered while closed.
    expect(screen.queryByText(/^Revision/)).toBeNull();

    fireEvent.click(toggle);
    expect(onLoadHistory).toHaveBeenCalledOnce();
  });

  it("renders the open state with the history list for a non-empty history", () => {
    const history: ReviewHistoryEntry[] = [
      {
        blockTimeMs: 1_700_000_000_000,
        revision: 1,
        rating: 5,
        reviewText: "v1",
      },
    ];
    renderForm({ hasSelectedReview: true, history });

    const toggle = screen.getByRole("button", {
      name: /hide previous versions/i,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Revision 1: 5 stars")).toBeTruthy();
  });
});
