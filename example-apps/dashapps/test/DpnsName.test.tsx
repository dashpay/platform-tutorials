// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DpnsName } from "../src/components/DpnsName";
import { id } from "./helpers";

afterEach(cleanup);

it("shows a resolved DPNS name with the identity ID as its tooltip", async () => {
  const identityId = id(1);
  render(
    <DpnsName
      identityId={identityId}
      resolver={{ resolve: vi.fn(async () => "alice") } as never}
      nameOnly
    />,
  );

  const name = await screen.findByText("alice.dash");
  expect(name.getAttribute("title")).toBe(identityId);
  expect(screen.queryByText(identityId)).toBeNull();
});

it("falls back to the identity ID when no DPNS name resolves", async () => {
  const identityId = id(1);
  render(
    <DpnsName
      identityId={identityId}
      resolver={{ resolve: vi.fn(async () => null) } as never}
      nameOnly
    />,
  );

  expect(await screen.findByText(identityId)).toBeTruthy();
});
