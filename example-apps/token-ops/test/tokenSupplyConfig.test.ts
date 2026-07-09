import { describe, expect, it, vi } from "vitest";

// token.ts imports TOKEN_POSITION from contract.ts, which pulls in the
// evo-sdk WASM module. Stub it — readTokenSupplyConfig only reads plain JSON.
vi.mock("@dashevo/evo-sdk", () => ({}));

import { readTokenSupplyConfig } from "../src/dash/token";
import type { DashContractLike } from "../src/dash/types";

/**
 * A fetched contract exposes its config via `.toJSON()`. These fixtures mirror
 * the shape captured from a real testnet contract: `tokens[pos].baseSupply` /
 * `maxSupply` (number or null) and `distributionRules` with nullable
 * `perpetualDistribution` / `preProgrammedDistribution`.
 */
function contractWith(tokenConfig: Record<string, unknown>): DashContractLike {
  return {
    toJSON: () => ({ tokens: { "0": tokenConfig } }),
  } as unknown as DashContractLike;
}

describe("readTokenSupplyConfig", () => {
  it("reads an uncapped token with perpetual distribution (the real probed case)", () => {
    const config = readTokenSupplyConfig(
      contractWith({
        baseSupply: 100000,
        maxSupply: null,
        distributionRules: {
          perpetualDistribution: {
            distributionType: {
              BlockBasedDistribution: {
                interval: 100,
                function: { FixedAmount: { amount: 5 } },
              },
            },
            distributionRecipient: "ContractOwner",
          },
          preProgrammedDistribution: null,
        },
      }),
      0,
    );
    expect(config.baseSupply).toBe(100000n);
    expect(config.maxSupply).toBeNull();
    expect(config.hasPerpetualDistribution).toBe(true);
    expect(config.hasPreProgrammedDistribution).toBe(false);
  });

  it("reads a capped token with no distribution rules", () => {
    const config = readTokenSupplyConfig(
      contractWith({
        baseSupply: 10000,
        maxSupply: 10000,
        distributionRules: {
          perpetualDistribution: null,
          preProgrammedDistribution: null,
        },
      }),
      0,
    );
    expect(config.baseSupply).toBe(10000n);
    expect(config.maxSupply).toBe(10000n);
    expect(config.hasPerpetualDistribution).toBe(false);
    expect(config.hasPreProgrammedDistribution).toBe(false);
  });

  it("detects pre-programmed distribution independently of perpetual", () => {
    const config = readTokenSupplyConfig(
      contractWith({
        baseSupply: 0,
        maxSupply: null,
        distributionRules: {
          perpetualDistribution: null,
          preProgrammedDistribution: { "1700000000000": {} },
        },
      }),
      0,
    );
    expect(config.hasPerpetualDistribution).toBe(false);
    expect(config.hasPreProgrammedDistribution).toBe(true);
  });

  it("coerces a string maxSupply and defaults a missing baseSupply to 0", () => {
    const config = readTokenSupplyConfig(
      contractWith({ maxSupply: "21000000" }),
      0,
    );
    expect(config.baseSupply).toBe(0n);
    expect(config.maxSupply).toBe(21000000n);
  });

  it("returns an uncapped, no-distribution config for a missing contract", () => {
    const config = readTokenSupplyConfig(undefined, 0);
    expect(config.baseSupply).toBe(0n);
    expect(config.maxSupply).toBeNull();
    expect(config.hasPerpetualDistribution).toBe(false);
    expect(config.hasPreProgrammedDistribution).toBe(false);
  });
});
