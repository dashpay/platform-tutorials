import { expect, it } from "vitest";
import type { EvoSDK } from "@dashevo/evo-sdk";
import type { ReadSdk } from "../src/dash/types";
// Compilation checks structural compatibility with the pinned SDK.
function asReadSdk(sdk: EvoSDK): ReadSdk {
  return sdk;
}
it("defines a structural SDK adapter", () => {
  expect(asReadSdk).toBeTypeOf("function");
});
