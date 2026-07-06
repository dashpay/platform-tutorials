/**
 * Bug-report data contract schema + registerContract / ensureContract.
 *
 * WHAT: A Dash Platform "data contract" defines the schema for documents.
 * This one describes a single document type (`report`) plus a "Researcher
 * Credit" token at position 0 and a "Triage Panel" group at position 0.
 *
 * report.tokenCost.create charges 1 Researcher Credit per submission,
 * transferred to the contract owner (effect: TransferTokenToContractOwner,
 * i.e. `effect: 0`) — a plain, non-refundable filing fee, same as any real
 * submission/listing fee. This is deliberately NOT `effect: 1` (BurnToken):
 * that value burns the charged token immediately and irreversibly at
 * submission time, which would make it impossible for the *same* charge to
 * later be "returned" — so a per-report fee can never itself be the thing
 * that gets frozen/destroyed. Freeze/destroy instead target a researcher's
 * *separately held, ongoing* credit balance (see researcherCredit.ts /
 * freezeCredit.ts / destroyFrozenCredit.ts).
 *
 * The Triage Panel is 3 members at equal power (1 each) with
 * requiredPower: 2 — genuine 2-of-3, verified against Platform's consensus
 * validation rule for groups (GroupV0::validate in rs-dpp): total power
 * (3) >= requiredPower (2), and no single member's power (1) alone meets
 * requiredPower (2), so it always takes exactly 2 signers to act.
 *
 * `freezeRules` / `unfreezeRules` / `destroyFrozenFundsRules` are gated on
 * `AuthorizedActionTakers.MainGroup()` — whichever group is the token's
 * *current* main control group (initially group 0) can freeze/unfreeze/
 * destroy a researcher's credits, acting together. That "current" group can
 * change: the roster rotates via append-and-repoint (a published group is
 * immutable), which is why the rules point at MainGroup() rather than a
 * hard-coded position. See rotatePanelRoster.ts for the full mechanism.
 *
 * Storage helpers (loadStoredContractId, saveContractId, …) and the owner
 * lookup live in contractStorage.ts so they can be imported without
 * pulling the @dashevo/evo-sdk runtime into the entry bundle.
 *
 * SDK methods: new DataContract({ ... }), dataContract.groups = {...},
 * sdk.contracts.publish(...)
 */
import {
  AuthorizedActionTakers,
  ChangeControlRules,
  DataContract,
  Group,
  TokenConfiguration,
  TokenConfigurationConvention,
  TokenConfigurationLocalization,
  TokenDistributionRules,
  TokenKeepsHistoryRules,
  TokenMarketplaceRules,
  TokenTradeMode,
} from "@dashevo/evo-sdk";

import { loadStoredContractId, saveContractId } from "./contractStorage";
import type { Logger } from "./logger";
import {
  RESEARCHER_CREDIT_NAME,
  RESEARCHER_CREDIT_PLURAL,
  RESEARCHER_CREDIT_POSITION,
  RESEARCHER_CREDIT_BASE_SUPPLY,
} from "./researcherCredit";
import type { DashKeyManager, DashSdk } from "./types";

export {
  DEFAULT_CONTRACT_ID,
  clearStoredContractId,
  fetchContractOwnerId,
  loadStoredContractId,
  saveContractId,
} from "./contractStorage";

// Position of the FOUNDING panel group only. After a rotation the active
// group lives at a higher position — resolve it at runtime with
// panel.ts's fetchActivePanelPosition instead of using this constant.
export const PANEL_GROUP_POSITION = 0;
export const PANEL_REQUIRED_POWER = 2;

export const REPORT_SCHEMAS = {
  report: {
    type: "object",
    documentsMutable: true,
    documentsKeepHistory: true,
    canBeDeleted: false,
    creationRestrictionMode: 0,
    tokenCost: {
      create: {
        tokenPosition: RESEARCHER_CREDIT_POSITION,
        amount: 1,
        effect: 0, // TransferTokenToContractOwner — see file header for why
        gasFeesPaidBy: 0, // DocumentOwner
      },
    },
    properties: {
      title: {
        type: "string",
        description: "Short summary of the vulnerability",
        minLength: 1,
        maxLength: 128,
        position: 0,
      },
      severity: {
        type: "string",
        description: "Researcher-assessed severity",
        enum: ["low", "medium", "high", "critical"],
        // Indexed string properties need an explicit maxLength — without
        // one Platform treats it as unbounded and rejects it (schema
        // validation requires indexed string bounds to be <= 63). 8 covers
        // the longest enum value ("critical").
        maxLength: 8,
        position: 1,
      },
      component: {
        type: "string",
        description: "Affected component or area",
        minLength: 1,
        maxLength: 63,
        position: 2,
      },
      description: {
        type: "string",
        description: "Full report body: repro steps, impact, etc.",
        minLength: 1,
        maxLength: 2000,
        position: 3,
      },
      pocHash: {
        type: "string",
        description:
          "Optional base64 SHA-256 of a local proof-of-concept file, hashed client-side. Not indexed — evidence metadata, not a lookup key.",
        minLength: 44,
        maxLength: 44,
        position: 4,
      },
    },
    required: ["title", "severity", "component", "description"],
    additionalProperties: false,
    // Index property direction only supports "asc" — Platform's schema
    // validator rejects "desc" (JsonSchemaError: "desc" is not one of
    // ["asc"]). This is a property of the INDEX definition, not of queries:
    // a query's own `orderBy` can still request "desc" against an
    // "asc"-declared index (reverse scan) — see queries.ts.
    indices: [
      {
        name: "byOwner",
        properties: [{ $ownerId: "asc" }, { $createdAt: "asc" }],
      },
      {
        name: "bySeverity",
        properties: [{ severity: "asc" }, { $createdAt: "asc" }],
      },
      {
        name: "byComponent",
        properties: [{ component: "asc" }, { $createdAt: "asc" }],
      },
    ],
  },
} as const;

export function createResearcherCreditConfiguration(ownerId: string) {
  const contractOwner = AuthorizedActionTakers.ContractOwner();
  const noOne = AuthorizedActionTakers.NoOne();
  // MainGroup() — not Group(0) — so freeze/unfreeze/destroy always follow
  // whichever group is the token's CURRENT main control group. This is what
  // makes roster rotation possible: repointing mainControlGroup at an
  // appended group moves these powers with it, no rule rewrite needed.
  const panel = AuthorizedActionTakers.MainGroup();

  const ownerRules = new ChangeControlRules({
    authorizedToMakeChange: contractOwner,
    adminActionTakers: contractOwner,
    isChangingAuthorizedActionTakersToNoOneAllowed: true,
    isChangingAdminActionTakersToNoOneAllowed: true,
    isSelfChangingAdminActionTakersAllowed: true,
  });
  const lockedRules = new ChangeControlRules({
    authorizedToMakeChange: noOne,
    adminActionTakers: noOne,
  });
  const panelRules = new ChangeControlRules({
    authorizedToMakeChange: panel,
    adminActionTakers: panel,
  });

  return new TokenConfiguration({
    conventions: new TokenConfigurationConvention(
      {
        en: new TokenConfigurationLocalization(
          false,
          RESEARCHER_CREDIT_NAME,
          RESEARCHER_CREDIT_PLURAL,
        ),
      },
      0,
    ),
    conventionsChangeRules: ownerRules,
    // Seeds the contract owner's balance at genesis (per
    // distributionRules.newTokensDestinationIdentity below) so the operator
    // has a working pool to distribute via ordinary sdk.tokens.transfer(...)
    // right after publish, instead of the contract launching with zero
    // credits in existence.
    baseSupply: RESEARCHER_CREDIT_BASE_SUPPLY,
    // Uncapped: the program should be able to onboard new researchers
    // indefinitely, unlike a fixed-supply scarcity token.
    maxSupply: undefined,
    keepsHistory: new TokenKeepsHistoryRules({
      isKeepingMintingHistory: true,
      isKeepingFreezingHistory: true,
    }),
    maxSupplyChangeRules: lockedRules,
    distributionRules: new TokenDistributionRules({
      newTokensDestinationIdentity: ownerId,
      newTokensDestinationIdentityRules: ownerRules,
      mintingAllowChoosingDestination: false,
      mintingAllowChoosingDestinationRules: ownerRules,
      perpetualDistributionRules: lockedRules,
      changeDirectPurchasePricingRules: lockedRules,
    }),
    marketplaceRules: new TokenMarketplaceRules(
      TokenTradeMode.NotTradeable(),
      lockedRules,
    ),
    // Operator can top up the pool later if the seeded 100 runs low.
    manualMintingRules: ownerRules,
    // The only way credits leave circulation is via destroyFrozen — keeps
    // the "burned only by slash" invariant clean and demonstrable.
    manualBurningRules: lockedRules,
    freezeRules: panelRules,
    unfreezeRules: panelRules,
    destroyFrozenFundsRules: panelRules,
    emergencyActionRules: lockedRules,
    // The founding Triage Panel governs the token from launch…
    mainControlGroup: PANEL_GROUP_POSITION,
    // …and ContractOwner (not NoOne) lets the operator later repoint
    // governance at an appended group — the app's admin model is that the
    // bounty operator administers roster membership; the panel does not
    // self-govern its own composition. See rotatePanelRoster.ts.
    mainControlGroupCanBeModified: contractOwner,
    description:
      "Researcher Credit — filing fee + freezable/slashable standing balance for the DashBounty triage panel.",
  });
}

/**
 * Build the Triage Panel's Group: 3 members at equal power (1 each),
 * requiredPower 2 — genuine 2-of-3. Order of panelMemberIds does not
 * matter; each gets power 1.
 */
export function createTriagePanelGroup(panelMemberIds: string[]) {
  if (panelMemberIds.length !== 3) {
    throw new Error(
      `Triage panel needs exactly 3 members, got ${panelMemberIds.length}`,
    );
  }
  if (new Set(panelMemberIds).size !== panelMemberIds.length) {
    throw new Error(
      "Triage panel members must be 3 distinct identities (duplicate IDs would collapse the group below 3 signers)",
    );
  }
  const members = new Map<string, number>(panelMemberIds.map((id) => [id, 1]));
  return new Group(members, PANEL_REQUIRED_POWER);
}

/**
 * Register a fresh bounty data contract on Platform and persist its ID.
 *
 * SDK methods: sdk.identities.nonce(...), new DataContract(...),
 * dataContract.groups = {...}, sdk.contracts.publish(...).
 */
export async function registerContract({
  sdk,
  keyManager,
  panelMemberIds,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  panelMemberIds: string[];
  log?: Logger;
}): Promise<string> {
  log?.("Registering bounty contract…");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const identityNonce = await sdk.identities.nonce(identity.id.toString());
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: REPORT_SCHEMAS,
    tokens: {
      [RESEARCHER_CREDIT_POSITION]: createResearcherCreditConfiguration(
        identity.id.toString(),
      ),
    },
    fullValidation: true,
  });

  // DataContract.groups is a plain settable property, not a constructor
  // option and not behind a setter method (unlike .schemas, which requires
  // .setSchemas(...)) — assign it directly before publishing.
  dataContract.groups = {
    [PANEL_GROUP_POSITION]: createTriagePanelGroup(panelMemberIds),
  };

  log?.("Publishing contract…");
  const published = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });
  const contractId = published.id?.toString() || published.toJSON?.()?.id;

  if (!contractId) {
    throw new Error(
      `Contract publish returned no id: ${JSON.stringify(published.toJSON?.() ?? published)}`,
    );
  }

  saveContractId(contractId);
  log?.(`Contract registered: ${contractId}`, "success");
  return contractId;
}

/**
 * Ensure a bounty data contract exists for this app. If a contract ID is
 * already persisted in localStorage (or passed in), we reuse it. Otherwise
 * publish a fresh contract owned by the signed-in identity, with the given
 * panel member IDs, and persist its ID for next time.
 */
export async function ensureContract({
  sdk,
  keyManager,
  existingId,
  panelMemberIds,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  existingId?: string | null;
  panelMemberIds: string[];
  log?: Logger;
}): Promise<string> {
  const fromStorage = existingId ?? loadStoredContractId();
  if (fromStorage) {
    log?.(`Using saved contract ID: ${fromStorage}`);
    return fromStorage;
  }
  return registerContract({ sdk, keyManager, panelMemberIds, log });
}
