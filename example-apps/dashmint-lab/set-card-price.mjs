/**
 * One-shot script to set (or clear) the $price on a single DashMint card
 * directly via the SDK, bypassing the React app.
 *
 * Use case: the card was listed at a price larger than Number.MAX_SAFE_INTEGER,
 * so Document.toJSON() throws (dashpay/platform#3786) and the UI's
 * "Edit price" button can't reach it. setPrice itself does not call toJSON,
 * so this path still works.
 *
 * Run:
 *   node example-apps/dashmint-lab/set-card-price.mjs
 *
 * The mnemonic must own the card.
 */

import {
  createClient,
  IdentityKeyManager,
} from "../../setupDashClient-core.mjs";

// ---------------------------------------------------------------------------
// Edit these.
// ---------------------------------------------------------------------------
const MNEMONIC =
  "arm achieve banana interest leopard life guide squirrel ramp flush cherry begin";
const NETWORK = "testnet";
const CONTRACT_ID = "5hK6SMfN4m2vU1t9qhvngUUQjsXeMNwr8MZdFeGBH8Aa";
const CARD_ID = "DAFsGgv4LW9biqVwqQ66TrJpRkUYV1oveY1BQDEU6RyD";
// Credits. Pass 0n to remove the card from sale.
const NEW_PRICE = 1_000_000_000_000_000n;
// ---------------------------------------------------------------------------

const sdk = await createClient(NETWORK);
const keyManager = await IdentityKeyManager.create({
  sdk,
  mnemonic: MNEMONIC,
  network: NETWORK,
});
const { identity, identityKey, signer } = await keyManager.getAuth();

try {
  const doc = await sdk.documents.get(CONTRACT_ID, "card", CARD_ID);
  if (!doc) throw new Error(`Card ${CARD_ID} not found`);

  if (doc.ownerId?.toString?.() !== identity.id.toString()) {
    throw new Error(
      `Card is owned by ${doc.ownerId} but signed-in identity is ${identity.id}`,
    );
  }

  doc.revision = BigInt(doc.revision ?? 0) + 1n;

  console.log(
    NEW_PRICE === 0n
      ? `Removing price from card ${CARD_ID}…`
      : `Setting price ${NEW_PRICE} credits on card ${CARD_ID}…`,
  );

  await sdk.documents.setPrice({
    document: doc,
    price: NEW_PRICE,
    identityKey,
    signer,
  });

  console.log(NEW_PRICE === 0n ? "Card removed from sale." : "Price set.");
} catch (e) {
  console.error("Something went wrong:\n", e.message);
  process.exitCode = 1;
}
