import { describe, expect, it, vi } from "vitest";

const { mockDocumentCtor } = vi.hoisted(() => ({
  mockDocumentCtor: vi.fn(function MockDocument(
    this: Record<string, unknown>,
    args: Record<string, unknown>,
  ) {
    Object.assign(this, args);
  }),
}));

vi.mock("@dashevo/evo-sdk", () => ({
  Document: mockDocumentCtor,
}));

describe("submitReport", () => {
  it("charges the researcher 1 Researcher Credit via tokenPaymentInfo", async () => {
    const { submitReport } = await import("../src/dash/submitReport");
    const { RESEARCHER_CREDIT_PAYMENT_INFO } =
      await import("../src/dash/researcherCredit");
    const identity = { id: "identity-1" };
    const identityKey = { id: "key-1" };
    const signer = { id: "signer-1" };
    const create = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();

    await submitReport({
      sdk: { documents: { create } } as never,
      keyManager: {
        async getAuth() {
          return { identity, identityKey, signer };
        },
      } as never,
      contractId: "contract-1",
      report: {
        title: "SQLi in login form",
        severity: "high",
        component: "Auth",
        description: "Unsanitized input allows SQL injection.",
      },
      log,
    });

    expect(mockDocumentCtor).toHaveBeenCalledWith({
      properties: {
        title: "SQLi in login form",
        severity: "high",
        component: "Auth",
        description: "Unsanitized input allows SQL injection.",
      },
      documentTypeName: "report",
      dataContractId: "contract-1",
      ownerId: identity.id,
    });
    expect(create).toHaveBeenCalledWith({
      document: mockDocumentCtor.mock.instances[0],
      identityKey,
      signer,
      tokenPaymentInfo: RESEARCHER_CREDIT_PAYMENT_INFO,
    });
  });

  it("includes the optional pocHash when provided", async () => {
    const { submitReport } = await import("../src/dash/submitReport");
    const create = vi.fn().mockResolvedValue(undefined);

    await submitReport({
      sdk: { documents: { create } } as never,
      keyManager: {
        async getAuth() {
          return {
            identity: { id: "identity-1" },
            identityKey: { id: "key-1" },
            signer: { id: "signer-1" },
          };
        },
      } as never,
      contractId: "contract-1",
      report: {
        title: "XSS in comment field",
        severity: "medium",
        component: "Frontend",
        description: "Reflected XSS via unescaped comment body.",
        pocHash: "a".repeat(44),
      },
    });

    expect(mockDocumentCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ pocHash: "a".repeat(44) }),
      }),
    );
  });

  it("rejects an empty title, component, or description", async () => {
    const { submitReport } = await import("../src/dash/submitReport");
    const base = {
      sdk: { documents: { create: vi.fn() } } as never,
      keyManager: {
        async getAuth() {
          return {
            identity: { id: "identity-1" },
            identityKey: { id: "key-1" },
            signer: { id: "signer-1" },
          };
        },
      } as never,
      contractId: "contract-1",
    };

    await expect(
      submitReport({
        ...base,
        report: {
          title: "  ",
          severity: "low",
          component: "X",
          description: "Y",
        },
      }),
    ).rejects.toThrow(/title/i);

    await expect(
      submitReport({
        ...base,
        report: {
          title: "T",
          severity: "low",
          component: "  ",
          description: "Y",
        },
      }),
    ).rejects.toThrow(/component/i);

    await expect(
      submitReport({
        ...base,
        report: {
          title: "T",
          severity: "low",
          component: "X",
          description: "  ",
        },
      }),
    ).rejects.toThrow(/description/i);
  });
});
