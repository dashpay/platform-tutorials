import { expect, it } from "vitest";
import {
  explainWriteError,
  isDuplicate,
  submit,
  type WriteKind,
} from "../src/dash/documentWrites";

// Messages as the network returned them on testnet.
const REFUSALS = {
  missingPublisher: {
    code: 40120,
    message:
      "state transition broadcast error: referenced deletable document (own contract, document type appMetadata, found by $ownerId, contractId) EHL9en7PxuBtjRsrVD7j5ApipmTHYMeqocacBagvHNEB not found for path publisherId",
  },
  missingContract: {
    code: 40120,
    message:
      "state transition broadcast error: referenced contract 11111111111111111111111111111112 not found for path contractId",
  },
  notOwner: {
    code: 40135,
    message:
      "state transition broadcast error: referenced contract EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz for path contractId does not meet the reference's requirement owner self",
  },
  ownReview: {
    code: 40135,
    message:
      "state transition broadcast error: referenced contract EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz for path contractId does not meet the reference's requirement owner other",
  },
  immutable: {
    code: 40128,
    message:
      "state transition broadcast error: property 'contractId' of document A5PVnApWijD5pcLd8Viy7C55VifRdNTXWg6d7WG4dApk (type 'appEndorsement') is immutable and cannot be changed by a replace",
  },
  duplicate: {
    code: 40105,
    message:
      'state transition broadcast error: Document 9VZ8C9yuxVNor6fEhcQMPuVjhPdHk9VobYxqKZtb8SmH has duplicate unique properties ["contractId"] with other documents',
  },
};

function explained(error: unknown, kind: WriteKind) {
  return (explainWriteError(error, kind) as Error).message;
}

it("rewords reference, owner-requirement and immutability refusals", () => {
  expect(explained(REFUSALS.missingPublisher, "endorsement")).toBe(
    "That publisher has no entry for this contract. They need to publish one first.",
  );
  expect(explained(REFUSALS.missingContract, "entry")).toBe(
    "The target contract does not exist on this network.",
  );
  expect(explained(REFUSALS.notOwner, "endorsement")).toBe(
    "Only the contract's owner can choose its official entry.",
  );
  expect(explained(REFUSALS.ownReview, "review")).toBe(
    "You can't review a contract you own.",
  );
  expect(explained(REFUSALS.immutable, "entry")).toBe(
    "A registry document can't be moved to a different contract.",
  );
  // The message alone is enough when an error carries no code.
  expect(explained(new Error(REFUSALS.notOwner.message), "endorsement")).toBe(
    "Only the contract's owner can choose its official entry.",
  );
  expect((explainWriteError(REFUSALS.immutable, "entry") as Error).cause).toBe(
    REFUSALS.immutable,
  );
});

it("leaves duplicates and unrelated failures for the caller", async () => {
  expect(explainWriteError(REFUSALS.duplicate, "endorsement")).toBe(
    REFUSALS.duplicate,
  );
  expect(isDuplicate(REFUSALS.duplicate)).toBe(true);
  expect(isDuplicate({ message: REFUSALS.duplicate.message })).toBe(true);
  expect(isDuplicate(REFUSALS.immutable)).toBe(false);
  const failure = new Error("insufficient balance");
  await expect(submit("entry", () => Promise.reject(failure))).rejects.toBe(
    failure,
  );
  await expect(
    submit("review", () => Promise.reject(REFUSALS.ownReview)),
  ).rejects.toThrow("You can't review a contract you own.");
  expect(await submit("entry", async () => "done")).toBe("done");
});
