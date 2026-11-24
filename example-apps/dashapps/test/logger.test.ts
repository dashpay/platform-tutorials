import { expect, it } from "vitest";
import { errorMessage } from "../src/lib/logger";
it("reads Error, plain-object and WASM message methods", () => {
  expect(errorMessage(new Error("offline"))).toBe("offline");
  expect(errorMessage({ message: "invalid query" })).toBe("invalid query");
  expect(
    errorMessage({
      message() {
        return "serde deserialization error";
      },
    }),
  ).toBe("serde deserialization error");
  expect(errorMessage({})).toBe("Unknown error");
});
