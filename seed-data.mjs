/**
 * Review text pools for seed-reviews.mjs, keyed by resourceId → rating → texts.
 *
 * Multiple texts per (resource, rating) so several identities landing on the
 * same pair get varied wording. seed-reviews.mjs cycles through each pool.
 * A missing rating bucket just means that review is submitted with no text.
 */
export const REVIEW_TEXTS = {
  intro: {
    5: [
      'Clearest on-ramp to Platform I have found. Had a testnet connection working in about ten minutes.',
      'Perfect first step. Everything ran on the first try.',
    ],
    4: [
      'Solid starting point. Would have liked a diagram of how the SDK, identities, and network fit together.',
      'Good intro — connected without trouble, just wanted a bit more depth.',
    ],
    3: [
      'Gets you connected but stops right when it gets interesting. Felt more like a checklist than an explanation.',
    ],
    2: [
      'Spent more time fighting Node/SDK version mismatches than learning anything. Assumes your environment is already perfect.',
    ],
  },
  'identities-names': {
    5: [
      'The DPNS section finally made name registration click. The derivation-path table is worth bookmarking.',
      'Registered an identity and a name without a hitch. Great walkthrough.',
    ],
    4: [
      'Funding via the faucet worked first try. Could be clearer that you must wait for confirmation before registering.',
    ],
    3: [
      'Identity registration is fine, but the key-management part glosses over which key index does what.',
    ],
    2: [
      "Got stuck for an hour because my identity wasn't funded yet and the error gave no hint. Needs a troubleshooting note.",
    ],
    1: [
      'Followed it exactly and name registration kept failing with a cryptic error. No guidance on recovery.',
    ],
  },
  'contracts-documents': {
    5: [
      'Best part of the whole tutorial set. The indexed-contract example is exactly what I needed for my own app.',
      'Documents and contracts explained really well. Reused this directly.',
    ],
    4: [
      'Document CRUD is well covered. The history/keepHistory example is a nice touch most docs skip.',
    ],
    3: [
      'Good breadth but the index rules (which orderBy is valid for which query) are buried — the part people actually get wrong.',
    ],
    2: [
      'The minimal contract works, but the moment I added a second index my inserts started failing and there is no warning about it.',
    ],
  },
  tokens: {
    5: [
      'Minting and transferring tokens was way smoother than I expected. Copy-paste and it just works.',
      'Token lifecycle made simple. Great examples.',
    ],
    4: [
      'Covers the full lifecycle. The burn example is short but does the job.',
    ],
    3: [
      'Fine for the happy path. No mention of what permissions/keys you need for mint vs transfer.',
    ],
    2: [
      'Transfer kept rejecting until I realized the recipient ID format was wrong. Easy to miss.',
    ],
  },
  dashnote: {
    5: [
      'Great real-world example of mutable documents. Seeing edit history in a working app made the concept stick.',
    ],
    4: [
      'Clean little app and the code is readable. The ~8MB SDK bundle makes the first load feel slow, though.',
    ],
    3: [
      'Useful as a reference but light on inline comments — had to cross-check the tutorials to follow some of it.',
    ],
  },
  'dashmint-lab': {
    5: [
      'Token-gated document creation is a clever pattern and this nails the demo. Inspired my own collectible idea.',
    ],
    4: [
      'The NFT-style modeling is well done. Setup has a few more moving parts than the other apps.',
    ],
    3: [
      'Cool concept but I hit a couple of confusing states when the gating token was not set up right.',
    ],
    1: [
      'Could not get it running locally — dependency install failed under my Node version and there is no note about which one to use.',
    ],
  },
  'dashproof-lab': {
    5: [
      'Proof-of-existence done right. Anchoring a hash and verifying it later worked exactly as described.',
    ],
    4: [
      'Good, focused example. The verification step is satisfying to watch succeed.',
    ],
    3: [
      'Does what it says, but I wanted more on how this compares to anchoring on other chains.',
    ],
  },
};
