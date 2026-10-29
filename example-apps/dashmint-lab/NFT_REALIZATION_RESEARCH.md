# NFT Realization Research

This note captures a path for turning `dashmint-lab` from a tutorial-style Dash Platform NFT demo into something closer to a production collectible system with hard scarcity, mint economics, and non-client-authoritative rarity.

## Current state

The app already uses real Dash Platform document primitives:

- NFT-like documents are defined in [src/dash/contract.ts](./src/dash/contract.ts)
- minting is `sdk.documents.create(...)` in [src/dash/mintCard.ts](./src/dash/mintCard.ts)
- rarity is currently derived entirely client-side in [src/lib/rarity.ts](./src/lib/rarity.ts)

Important limitations today:

- only the contract owner can mint (`creationRestrictionMode: 1`)
- there is no native contract token gating mint
- attack/defense stats are chosen by app logic, not enforced by contract rules
- rarity is presentation logic, not an on-chain fact

## Recommended scarcity model

The cleanest hard-cap design is:

- one data contract
- one native mint-pass token per series
- one NFT document type per series if mint rules or rarity rules differ
- burn one mint-pass token per NFT mint

### Why burn instead of transfer-to-owner

If minting transfers a scarce token to the owner, the owner can circulate that token again, so the same token can fund multiple mints over time.

If minting burns a scarce token:

- every mint permanently destroys one pass
- a fixed token `maxSupply = N` enforces at most `N` lifetime mints for that series

That is the simplest way to get a true hard cap.

## Series structure

### Series 1

- token position `0` = `MINTPASS_S1`
- fixed supply
- `decimals: 0`
- no perpetual distribution
- burn 1 pass on each mint
- NFT document type `cardS1`

### Series 2 later

- contract update adds token position `1` = `MINTPASS_S2`
- add NFT document type `cardS2`
- burn 1 `MINTPASS_S2` per Series 2 mint
- Series 1 stays untouched

This preserves Series 1's hard cap while allowing a new capped series later.

## Recommended contract shape

Illustrative contract fragment:

```json
{
  "$formatVersion": "1",
  "documentSchemas": {
    "cardS1": {
      "type": "object",
      "creationRestrictionMode": 0,
      "transferable": 1,
      "tradeMode": 1,
      "tokenCost": {
        "create": {
          "tokenPosition": 0,
          "amount": 1,
          "effect": 1,
          "gasFeesPaidBy": 0
        }
      },
      "properties": {
        "seriesId": { "type": "string", "const": "S1", "position": 0 },
        "templateId": { "type": "string", "position": 1 },
        "serialNumber": { "type": "integer", "position": 2 },
        "rarityTier": { "type": "string", "position": 3 },
        "artHash": {
          "type": "array",
          "byteArray": true,
          "minItems": 32,
          "maxItems": 32,
          "position": 4
        },
        "metadataHash": {
          "type": "array",
          "byteArray": true,
          "minItems": 32,
          "maxItems": 32,
          "position": 5
        }
      },
      "required": ["seriesId", "templateId", "serialNumber", "rarityTier"],
      "indices": [
        { "name": "owner", "properties": [{ "$ownerId": "asc" }] },
        {
          "name": "seriesSerial",
          "properties": [{ "seriesId": "asc" }, { "serialNumber": "asc" }],
          "unique": true
        }
      ],
      "additionalProperties": false
    }
  },
  "tokens": {
    "0": {
      "conventions": {
        "decimals": 0,
        "localizations": {
          "en": {
            "singularForm": "Mint Pass",
            "pluralForm": "Mint Passes"
          }
        }
      },
      "maxSupply": 10000,
      "distributionRules": {
        "perpetualDistribution": null,
        "preProgrammedDistribution": null,
        "mintingAllowChoosingDestination": false
      },
      "manualMintingRules": {
        "authorizedToMakeChange": "ContractOwner",
        "adminActionTakers": "ContractOwner"
      },
      "marketplaceRules": {
        "tradeMode": "NotTradeable"
      }
    }
  }
}
```

Notes:

- `creationRestrictionMode` must be `0` if pass holders mint directly
- `effect: 1` means `BurnToken`
- `gasFeesPaidBy: 0` means document owner pays gas fees

## Why separate document types per series

Using `cardS1`, `cardS2`, etc. is cleaner than reusing a single `card` type if:

- the mint token changes
- the metadata structure changes
- the rarity logic changes
- the art pipeline changes

An alternative is a single `card` type with immutable `seriesId`, but separate types are easier to audit and less error-prone if series semantics diverge.

## Platform update behavior

The local Platform repo indicates:

- adding new tokens on contract update is supported
- removing an existing token is rejected
- mutating an existing token in place is rejected

Implication:

- use a new token position for each new series
- do not treat a new series as a mutation of the old mint-pass token

## SDK caveat for token-gated mints

The desired contract model depends on document creation being able to provide token payment info.

Platform supports this conceptually, but the current app stack does not appear to expose it cleanly in the JS/WASM path:

- the app calls `sdk.documents.create(...)` directly in `src/dash/mintCard.ts`
- the current WASM document-create path passes `None` for token payment info

Implication:

- changing the contract alone is not enough
- `dashmint-lab` would need SDK/app work before token-gated minting can function

## Real rarity: what to replace

Today:

- `attack` and `defense` are rolled client-side
- rarity is derived from those values client-side
- users are effectively trusting app behavior

That is suitable for a tutorial, not for collectible issuance.

## Option 1: templates

Best practical path.

### Model

Predefine a limited set of templates, each with:

- `templateId`
- `seriesId`
- `rarityTier`
- metadata/art payload
- maximum edition count

Examples:

- `S1-DRAGON-LEGENDARY`, max 50
- `S1-GOLEM-RARE`, max 300
- `S1-FOX-COMMON`, max 3000

Minting then means:

- choose or assign a template
- allocate next `serialNumber`
- mint the document with immutable template and rarity fields

### Benefits

- rarity is explicit and persisted
- edition caps are easy to reason about
- no user input can spoof rarity
- easy marketplace semantics
- no need for randomness infrastructure

### Downsides

- if users choose the template directly, rarity is not random
- if you want randomized pack opening, you need an assignment layer

## Option 2: commit/reveal

Best if randomized assignment matters.

### Model

Two-phase mint:

1. `mintCommit`
   - user submits a commitment like `hash(secret || seriesId || salt)`
   - pass may be burned at this stage

2. `mintReveal`
   - user later reveals `secret`
   - clients derive outcome from a deterministic formula such as:
     `hash(secret || commitDocId || seriesId)`

The derived output is mapped to a rarity bucket or template range.

### Benefits

- user cannot directly pick rarity
- anyone can verify the outcome from on-chain commitment and reveal data
- works with finite template buckets if the reveal picks from remaining inventory

### Downsides

- more complex UX
- reveals can stall
- someone needs to define how unresolved commits expire
- on current Platform this is best treated as app-level verifiable logic, not general-purpose protocol-executed custom logic

## Important limitation on custom on-chain logic

The local Platform source contains data triggers, but the trigger registry appears to be limited to built-in/system contracts such as DPNS, DashPay, and withdrawals.

Implication:

- do not assume arbitrary app-defined rarity logic can run natively on-chain
- treat commit/reveal as verifiable application logic unless/until custom trigger support exists

## Recommended rarity path

Recommended rollout:

### Phase 1

Use templates only.

- hard-cap each series with burn-on-mint passes
- hard-cap each template by edition count
- persist `templateId`, `rarityTier`, and `serialNumber`
- remove client-authoritative stat rolling from mint semantics

### Phase 2

Add randomized assignment if desired.

Best form:

- commit/reveal selects a template bucket
- inventory accounting still uses finite templates

This gives both:

- verifiable randomness-style assignment
- deterministic real scarcity

## Suggested app changes

### Contract layer

- replace current `card` schema with `cardS1`
- add native token configuration for `MINTPASS_S1`
- add `tokenCost.create`
- add immutable provenance fields
- add unique index on `seriesId + serialNumber`

### Mint flow

- stop letting the client define collectible power/rarity at mint time
- mint either:
  - from a chosen template, or
  - from a verified reveal outcome

### Query/UI layer

- display `seriesId`, `templateId`, `serialNumber`, `rarityTier`
- stop computing rarity from `attack + defense` as the source of truth
- if stats remain, treat them as template attributes, not client-generated mint output

### SDK work

- verify whether current `@dashevo/evo-sdk` / WASM bindings expose token payment info for document create
- if not, add or patch that path before enabling token-gated minting

## Bottom line

For a production-like collectible model on Dash Platform:

- use one burn-on-mint pass token per series
- use a new token position for each future series
- prefer a new document type per series
- use templates for the first real rarity model
- optionally add commit/reveal later for randomized assignment

The strongest near-term design is:

- Series 1 token at position `0`
- burn 1 pass to mint `cardS1`
- finite templates with capped edition counts
- Series 2 later via contract update adding token position `1` and `cardS2`
