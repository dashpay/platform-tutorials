import { describe, expect, it } from "vitest";

import { classifyRecipientInput } from "../src/dash/classifyRecipientInput";

describe("classifyRecipientInput", () => {
  it("treats empty input as invalid", () => {
    expect(classifyRecipientInput("")).toBe("invalid");
  });

  it("treats anything with a dot as a name", () => {
    expect(classifyRecipientInput("alice.dash")).toBe("name");
    expect(classifyRecipientInput("Alice.Dash")).toBe("name");
    expect(classifyRecipientInput("weird.nested.name")).toBe("name");
  });

  it("treats hyphenated inputs as names (hyphen is not in base58)", () => {
    expect(classifyRecipientInput("alice-bob")).toBe("name");
    expect(classifyRecipientInput("-leading")).toBe("name");
  });

  it("treats inputs containing 0/O/I/l as names (non-base58 chars)", () => {
    expect(classifyRecipientInput("ahoy0")).toBe("name");
    expect(classifyRecipientInput("Oliver")).toBe("name");
    expect(classifyRecipientInput("Ivan")).toBe("name");
    expect(classifyRecipientInput("allen")).toBe("name");
  });

  it("treats strings with chars outside [A-Za-z0-9.-] as invalid", () => {
    expect(classifyRecipientInput("alice@dash")).toBe("invalid");
    expect(classifyRecipientInput("alice_dash")).toBe("invalid");
    expect(classifyRecipientInput("ali ce")).toBe("invalid");
    expect(classifyRecipientInput("alice!")).toBe("invalid");
  });

  it("treats pure base58 strings (any case, any length) as ambiguous", () => {
    // Pure base58 alphabet excludes 0 O I l and .- — short and long forms.
    expect(classifyRecipientInput("abc")).toBe("ambiguous");
    expect(classifyRecipientInput("ABC")).toBe("ambiguous");
    expect(classifyRecipientInput("Abc123")).toBe("ambiguous");
    expect(
      classifyRecipientInput("5Lmvdk2Z3y5bwa2YcX9hk5GhVePtkT21a2mxAn"),
    ).toBe("ambiguous");
  });
});
