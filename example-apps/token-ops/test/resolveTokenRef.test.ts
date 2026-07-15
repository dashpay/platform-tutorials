import { describe, expect, it, vi } from "vitest";

// resolveTokenRef imports TOKEN_POSITION from contract.ts, which pulls in the
// evo-sdk WASM module. Stub it — the resolver never touches these exports.
vi.mock("@dashevo/evo-sdk", () => ({}));

import { resolveTokenRef } from "../src/dash/resolveTokenRef";
import type { DashSdk } from "../src/dash/types";

const CONTRACT_ID = "ContractId1111111111111111111111111111111111";
const TOKEN_ID = "TokenId22222222222222222222222222222222222222";

/**
 * Stub `sdk.tokens` with the two calls the resolver uses. `contractInfo`
 * returns whatever the passed map has for a given id, defaulting to undefined
 * (the SDK's "not a token ID" answer). `calculateId` maps a contract ID to its
 * position-0 token ID.
 *
 * NOTE: these tests verify the resolver's control flow (token-first ordering,
 * contract fallback, guards), NOT that it reads the SDK response shape right.
 * The `{ contractId, tokenContractPosition }` shape below mirrors the wasm
 * getters in packages/wasm-dpp2/src/tokens/contract_info.rs; if the SDK ever
 * changes that shape, these stubs go stale silently and only a testnet run
 * catches it.
 */
function makeSdk({
  contractInfoById = new Map<string, unknown>(),
  calculateId = vi.fn(),
}: {
  contractInfoById?: Map<string, unknown>;
  calculateId?: ReturnType<typeof vi.fn>;
}) {
  const contractInfo = vi.fn(async (id: string) => contractInfoById.get(id));
  return {
    sdk: { tokens: { contractInfo, calculateId } } as unknown as DashSdk,
    contractInfo,
    calculateId,
  };
}

describe("resolveTokenRef", () => {
  it("resolves a token ID to its contract without calling calculateId", async () => {
    const { sdk, calculateId } = makeSdk({
      contractInfoById: new Map([
        [TOKEN_ID, { contractId: CONTRACT_ID, tokenContractPosition: 0 }],
      ]),
    });

    const ref = await resolveTokenRef(sdk, TOKEN_ID);

    expect(ref).toEqual({
      contractId: CONTRACT_ID,
      resolvedFrom: "token",
      tokenId: TOKEN_ID,
      tokenPosition: 0,
    });
    expect(calculateId).not.toHaveBeenCalled();
  });

  it("falls back to a contract ID and verifies its position-0 token", async () => {
    const calculateId = vi.fn(async () => TOKEN_ID);
    const { sdk, contractInfo } = makeSdk({
      // First lookup (input as token ID) misses; second (derived token) hits.
      contractInfoById: new Map([
        [TOKEN_ID, { contractId: CONTRACT_ID, tokenContractPosition: 0 }],
      ]),
      calculateId,
    });

    const ref = await resolveTokenRef(sdk, CONTRACT_ID);

    expect(ref).toEqual({
      contractId: CONTRACT_ID,
      resolvedFrom: "contract",
      tokenPosition: 0,
    });
    expect(calculateId).toHaveBeenCalledWith(CONTRACT_ID, 0);
    // once for the input-as-token miss, once for the derived-token verify
    expect(contractInfo).toHaveBeenCalledTimes(2);
  });

  it("throws when the input is neither a token nor a contract", async () => {
    // A real derivation: calculateId maps whatever contract ID it's given to a
    // deterministic token ID. Neither the input nor its derived token is a
    // known token, so both contractInfo lookups miss and resolution fails.
    const bogus = "Bogus3333333333333333333333333333333333333333";
    const derivedFromBogus = "DerivedTokenForBogus4444444444444444444444444";
    const calculateId = vi.fn(async (id: string) =>
      id === bogus ? derivedFromBogus : TOKEN_ID,
    );
    // Populate a *real* token so an empty map isn't what forces the throw.
    const { sdk, contractInfo } = makeSdk({
      contractInfoById: new Map([
        [TOKEN_ID, { contractId: CONTRACT_ID, tokenContractPosition: 0 }],
      ]),
      calculateId,
    });

    await expect(resolveTokenRef(sdk, bogus)).rejects.toThrow(
      /not a recognized/i,
    );
    // Proves both paths were tried: input-as-token, then bogus's derived token.
    expect(contractInfo).toHaveBeenNthCalledWith(1, bogus);
    expect(contractInfo).toHaveBeenNthCalledWith(2, derivedFromBogus);
  });

  it("rejects empty input before touching the SDK", async () => {
    const { sdk, contractInfo, calculateId } = makeSdk({});

    await expect(resolveTokenRef(sdk, "   ")).rejects.toThrow(
      /contract or token id/i,
    );
    expect(contractInfo).not.toHaveBeenCalled();
    expect(calculateId).not.toHaveBeenCalled();
  });
});
