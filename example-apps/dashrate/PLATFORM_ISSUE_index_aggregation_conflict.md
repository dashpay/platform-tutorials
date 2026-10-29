# Platform issue: contract with conflicting index aggregation types registers but fails all document inserts

**Tracked as:** [dashpay/platform#3960](https://github.com/dashpay/platform/issues/3960)

**SDK / version:** `@dashevo/evo-sdk@4.0.0-rc.2` (wasm-sdk `4.0.0-rc.2`), testnet.

**Severity:** A contract that passes registration validation is **permanently unusable** — every
`documents.create` / `documents.replace` fails. The bad state is only reachable after spending
credits to publish, and the contract's indices are immutable, so there is no recovery short of
publishing a new contract.

## Summary

Two indices on the same document type that **share an index prefix** but declare **different
aggregation types** at/under that shared prefix register successfully, but make the document type
un-writable. Document insert fails when the drive lays out the index trees, because it tries to
`NotCountedOrSummed`-wrap a count-only child tree under a count+sum parent tree — an unsupported
combination.

Expectation: either (a) contract registration/validation should **reject** this index
combination, or (b) the document-insert tree layout should **support** it. Today it does neither —
registration accepts it and insert hard-fails, which is the worst outcome.

This looks like a validation gap (and likely a missing test): nothing at `dataContract.create` /
`contracts.publish` catches the cross-index tree-type conflict.

## Reproduction

Document type with two indices sharing the `resourceId` prefix:

```jsonc
"indices": [
  // ... ownerAndResource (unique), ownerReviews ...
  {
    "name": "resourceRatingAggregate",
    "properties": [{ "resourceId": "asc" }],
    "countable": "countable",
    "summable": "rating"          // → resourceId value tree is a CountSumTree
  },
  {
    "name": "resourceRatingDistribution",
    "properties": [{ "resourceId": "asc" }, { "rating": "asc" }],
    "countable": "countable",
    "rangeCountable": true         // → rating property-name level is a (count-only) ProvableCountTree
  }
]
```

(`rating` is `type: integer`, `minimum: 1`, `maximum: 5`, and in the doctype `required` array.)

Steps:

1. Publish the contract → **succeeds**, returns a contract ID.
2. Create any `review` document (any resourceId / rating) → **fails**.

Observed error (base64-wrapped on the wire; decoded):

```
storage: drive: not supported error: NotCountedOrSummed-wrapping is only supported for
the six sum-bearing tree variants — see `for_known_path_key_empty_not_summed_tree`.
```

## Root cause analysis (from platform source)

Indices compile into a shared `IndexLevel` tree keyed by property path; index aggregation info is
attached at the level where each index **terminates**
(`rs-dpp/src/data_contract/document_type/index_level/mod.rs:240-272`).

- `resourceRatingAggregate` terminates at the **`resourceId`** level with `countable + summable` →
  that level's value tree becomes a **`CountSumTree`**.
- `resourceRatingDistribution` shares the `resourceId` prefix and terminates at **`rating`** with
  `countable + rangeCountable` → the `rating` property-name continuation tree becomes a count-only
  **`ProvableCountTree`** (`property_name_tree_type` in
  `rs-drive/src/drive/document/insert/add_indices_for_index_level_for_contract_operations/v1/mod.rs:196-202`).

At insert, the `rating` continuation must be inserted **under** the shared `resourceId` value tree.
Because that parent aggregates (`CountSumTree`), the child is wrapped via
`wrap_in_non_aggregated_for_parent_tree_type` (`rs-drive/src/fees/op.rs:601-647`). A `CountSumTree`
parent dispatches to `for_known_path_key_empty_not_counted_or_summed_tree`
(`rs-drive/src/fees/op.rs:658-692`), whose accepted set is **only the six sum-bearing tree
variants** (`SumTree`, `BigSumTree`, `ProvableSumTree`, `CountSumTree`, `ProvableCountSumTree`,
`ProvableCountProvableSumTree`). The inner tree here is a count-only `ProvableCountTree`, which is
not in that set → `DriveError::NotSupported`.

In short: **a count-only continuation cannot be `NotCountedOrSummed`-wrapped under a count+sum
parent**, but the contract validator allows two indices to produce exactly that shared-prefix
layout.

## Why it's a platform-side gap

- **Validation should catch it at registration.** The conflict is statically determinable from the
  index set (shared prefix where one index makes the prefix value tree count+sum and a deeper index
  needs a non-sum continuation under it). `validate_update` already reasons about index
  countability changes (`index_level/mod.rs:315-328`), so there is precedent for cross-index
  countability validation — it just doesn't cover this create-time prefix-aggregation conflict.
- **Or insert should support it.** If the layout is intended to be legal, the wrapper dispatch
  needs a path for wrapping a count-only (or normal) child under a count+sum parent.
- Likely a **missing test**: a doctype with `[a]` countable+summable AND `[a, b]` countable
  (+rangeCountable) — i.e. an aggregate index and a distribution/range index sharing a prefix — does
  not appear to be exercised end-to-end (register → insert).

## Suggested investigation entry points (platform repo)

- `rs-drive/src/fees/op.rs` — `wrap_in_non_aggregated_for_parent_tree_type` (~:601),
  `for_known_path_key_empty_not_counted_or_summed_tree` (~:658), and the error string (~:678).
- `rs-drive/src/drive/document/insert/add_indices_for_index_level_for_contract_operations/v1/mod.rs`
  — `property_name_tree_type` / `value_tree_type` selection (~:196-253), child-wrap decision
  (~:255-262).
- `rs-dpp/src/data_contract/document_type/index_level/mod.rs` — index-tree assembly (:200-277),
  `validate_update` countability checks (:315-328) as a model for a create-time check.
- Contract-creation validator (`rs-dpp` document-type / index validation) — where a new rule
  rejecting conflicting shared-prefix aggregation types would live.

## Workaround for app authors (until fixed)

Avoid two indices that share a prefix while disagreeing on aggregation at/under that prefix. Either:

- make the range/distribution index independent of the aggregate index's prefix, or
- don't combine `summable` on a short prefix with a deeper `countable`/`rangeCountable` index on the
  same prefix, or
- compute one of the two (e.g. the distribution) client-side.
