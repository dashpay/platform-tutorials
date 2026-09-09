// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExternalLaunch } from "../src/components/ExternalLaunch";

afterEach(cleanup);

it("warns before opening a community-submitted app URL", () => {
  render(
    <ExternalLaunch
      url="https://community.example/app?from=dashapps"
      verified={false}
      className="launch-pill"
    >
      Launch
    </ExternalLaunch>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Launch" }));

  expect(screen.getByText("Community link")).toBeTruthy();
  expect(screen.getByRole("dialog").textContent).toContain(
    "submitted by a community member",
  );
  expect(screen.getByText("community.example")).toBeTruthy();
  expect(
    screen.getByText("https://community.example/app?from=dashapps"),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Continue ↗" }).getAttribute("href"),
  ).toBe("https://community.example/app?from=dashapps");
});

it("identifies contract-owner links in the confirmation", () => {
  render(
    <ExternalLaunch
      url="https://official.example"
      verified
      className="launch-pill"
    >
      Launch
    </ExternalLaunch>,
  );

  expect(screen.queryByText("Contract-owner link")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
  expect(screen.getByText("Contract-owner link")).toBeTruthy();
  expect(screen.queryByText("Community link")).toBeNull();
});

it("blocks invalid or non-HTTPS destinations", () => {
  render(
    <ExternalLaunch
      url="http://unsafe.example"
      verified={false}
      className="launch-pill"
    >
      Launch
    </ExternalLaunch>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Launch" }));

  expect(screen.getByRole("alert").textContent).toContain("blocked");
  expect(screen.queryByRole("link", { name: "Continue ↗" })).toBeNull();
});

it("closes the confirmation with Escape", () => {
  render(
    <ExternalLaunch
      url="https://official.example"
      verified
      className="launch-pill"
    >
      Launch
    </ExternalLaunch>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
  expect(screen.getByRole("dialog")).toBeTruthy();

  fireEvent.keyDown(document, { key: "Escape" });

  expect(screen.queryByRole("dialog")).toBeNull();
});
