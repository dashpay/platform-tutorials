# SDK Feature Coverage Matrix

Coverage of `@dashevo/evo-sdk` methods across the Node tutorials at the repo root and the React example apps under [example-apps/](example-apps/).

Legend:

- ✅ — used (linked to the tutorial when a single tutorial exercises that method)
- ✅ (multiple) — covered by more than one tutorial file
- — — not used
- *italic row* — SDK method **not exercised anywhere in the repo**

> **Column note:** `dashmint-cli` is a build-output directory only (no `package.json`, no `src/`) and gets no column. `dashnote-starter` is a strict subset of `dashnote`'s document surface (`documents.create` / `query` / `get` / `replace` / `delete`, mnemonic auth only) and exercises no SDK method that `dashnote` doesn't, so it has no separate column.

## Identity — `sdk.identities.*` and `sdk.addresses.*`

| Method | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `addresses.createIdentity` | [identity-register.mjs](1-Identities-and-Names/identity-register.mjs) | — | — | — | — | — |
| `addresses.topUpIdentity` | [identity-topup.mjs](1-Identities-and-Names/identity-topup.mjs) | — | — | — | — | — |
| `addresses.transfer` (L1 send-funds) | [send-funds.mjs](send-funds.mjs) | — | — | — | — | — |
| `addresses.get` | [setupDashClient-core.mjs](setupDashClient-core.mjs) | — | — | — | — | — |
| `identities.fetch` | ✅ (multiple) | — | — | — | — | ✅ |
| `identities.balance` | — | ✅ | — | — | — | — |
| `identities.nonce` | ✅ (multiple) | — | ✅ | ✅ | ✅ | ✅ |
| `identities.byPublicKeyHash` | [setupDashClient-core.mjs](setupDashClient-core.mjs) | — | — | ✅ | — | ✅ |
| `identities.creditTransfer` | [identity-transfer-credits.mjs](1-Identities-and-Names/identity-transfer-credits.mjs) | — | — | — | — | — |
| `identities.creditWithdrawal` | [identity-withdraw-credits.mjs](1-Identities-and-Names/identity-withdraw-credits.mjs) | — | — | — | — | — |
| `identities.update` (add / disable key) | ✅ (multiple) | — | — | — | — | — |
| `identities.byNonUniquePublicKeyHash` | — | — | — | ✅ | — | ✅ |
| *`identities.create`* | — | — | — | — | — | — |
| *`identities.topUp`* (raw, not via addresses) | — | — | — | — | — | — |
| *`identities.balances`, `balanceAndRevision`* | — | — | — | — | — | — |
| *`identities.contractKeys`, `contractNonce`* | — | — | — | — | — | — |
| *`identities.getKeys`, `fetchUnproved`* | — | — | — | — | — | — |
| *`identities.tokenBalances`* | — | — | — | — | — | — |
| *`addresses.getMany`, `fundFromAssetLock`, `transferFromIdentity`, `withdraw`* | — | — | — | — | — | — |

## DPNS / Names — `sdk.dpns.*`

| Method | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `dpns.registerName` | [name-register.mjs](1-Identities-and-Names/name-register.mjs) | — | — | — | — | — |
| `dpns.resolveName` | [name-resolve-by-name.mjs](1-Identities-and-Names/name-resolve-by-name.mjs) | ✅ | — | — | — | — |
| `dpns.usernames` (by identity, plural) | [name-get-identity-names.mjs](1-Identities-and-Names/name-get-identity-names.mjs) | — | — | — | — | — |
| `dpns.username` (singular) | — | ✅ | — | ✅ | ✅ | ✅ |
| `dpns.convertToHomographSafe` | [name-search-by-name.mjs](1-Identities-and-Names/name-search-by-name.mjs) | — | — | — | — | — |
| *`dpns.getUsernameByName`* | — | — | — | — | — | — |
| *`dpns.isContestedUsername`* | — | — | — | — | — | — |
| *`dpns.isNameAvailable`* | — | — | — | — | — | — |
| *`dpns.isValidUsername`* | — | — | — | — | — | — |

## Data Contracts — `sdk.contracts.*`

| Method | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `contracts.publish` | ✅ (multiple) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `contracts.fetch` | ✅ (multiple) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `contracts.update` | ✅ (multiple) | — | — | — | — | ✅ |
| `contracts.getHistory` | ✅ (multiple) | — | — | — | — | — |
| *`contracts.getMany`* | — | — | — | — | — | — |

## Documents — `sdk.documents.*`

| Method | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `documents.create` | [document-submit.mjs](2-Contracts-and-Documents/document-submit.mjs) | ✅ | ✅ | ✅ | ✅ | — |
| `documents.query` | ✅ (multiple) | ✅ | ✅ | ✅ | ✅ | — |
| `documents.get` | — | ✅ | — | ✅ | ✅ | — |
| `documents.replace` | [document-update.mjs](2-Contracts-and-Documents/document-update.mjs) | — | — | ✅ | ✅ | — |
| `documents.delete` | [document-delete.mjs](2-Contracts-and-Documents/document-delete.mjs) | ✅ | — | ✅ | — | — |
| `documents.transfer` | [document-transfer.mjs](2-Contracts-and-Documents/document-transfer.mjs) | ✅ | — | — | — | — |
| `documents.setPrice` | [document-set-price.mjs](2-Contracts-and-Documents/document-set-price.mjs) | ✅ | — | — | — | — |
| `documents.purchase` | [document-purchase.mjs](2-Contracts-and-Documents/document-purchase.mjs) | ✅ | — | — | — | — |
| `documents.count` **(new in v4)** | — | — | — | — | ✅ | — |
| `documents.count` + `groupBy` **(new in v4)** | — | — | — | — | ✅ | — |
| `documents.history` **(new in v4)** | — | — | — | — | ✅ | — |
| *`documents.sum`, `documents.average`* **(new in v4)** | — | — | — | — | — | — |

## Tokens — `sdk.tokens.*`

| Method | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `tokens.calculateId` | ✅ (multiple) | ✅ | — | — | — | ✅ |
| `tokens.identityBalances` | ✅ (multiple) | ✅ | — | — | — | ✅ |
| `tokenPaymentInfo` on `documents.create` (burn-to-mint) | — | ✅ | — | — | — | — |
| `tokens.mint` | [token-mint.mjs](3-Tokens/token-mint.mjs) | — | — | — | — | ✅ |
| `tokens.burn` | [token-burn.mjs](3-Tokens/token-burn.mjs) | — | — | — | — | ✅ |
| `tokens.transfer` | [token-transfer.mjs](3-Tokens/token-transfer.mjs) | ✅ | — | — | — | ✅ |
| `tokens.freeze`, `unfreeze`, `destroyFrozen` | — | — | — | — | — | ✅ |
| `tokens.emergencyAction` (pause / resume) | — | — | — | — | — | ✅ |
| `tokens.configUpdate` **(new in v4)** | — | — | — | — | — | ✅ |
| `tokens.statuses`, `totalSupply`, `contractInfo` | [token-info.mjs](3-Tokens/token-info.mjs) | ✅ (`totalSupply` only) | — | — | — | ✅ |
| `tokens.identityTokenInfos` | — | — | — | — | — | ✅ |
| *`tokens.claim`* | — | — | — | — | — | — |
| *`tokens.setPrice`, `directPurchase`, `directPurchasePrices`, `priceByContract`* | — | — | — | — | — | — |
| *`tokens.balances`* | — | — | — | — | — | — |
| *`tokens.identitiesTokenInfos`* | — | — | — | — | — | — |
| *`tokens.perpetualDistributionLastClaim`* | — | — | — | — | — | — |

## Groups — `sdk.group.*`

Multi-signer group governance. **token-ops is the only consumer of this facade anywhere in the repo.**

| Method | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `group.info` | — | — | — | — | — | ✅ |
| `group.actions` | — | — | — | — | — | ✅ |
| `group.actionSigners` | — | — | — | — | — | ✅ |
| *`group.infos`, `members`* | — | — | — | — | — | — |
| *`group.identityGroups`, `groupsDataContracts`* | — | — | — | — | — | — |
| *`group.contestedResources`, `contestedResourceVotersForIdentity`* | — | — | — | — | — | — |

## Wallet utilities — `wallet.*` (top-level export, not `sdk.wallet`)

> Example apps share `wallet.*` derivation through the imported `setupDashClient-core.mjs` `IdentityKeyManager`, not via direct calls in their own `src/` — the Tutorials column is the canonical reference for these.

| Function | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `wallet.generateMnemonic` | [create-wallet.mjs](create-wallet.mjs) | — | — | — | — | — |
| `wallet.validateMnemonic` | [setupDashClient.mjs](setupDashClient.mjs) | — | — | — | — | — |
| `wallet.derivationPathBip44Testnet` / `derivationPathBip44Mainnet` | ✅ (multiple: [create-wallet.mjs](create-wallet.mjs), [setupDashClient-core.mjs](setupDashClient-core.mjs)) | — | — | — | — | — |
| `wallet.derivationPathDip13Testnet` / `derivationPathDip13Mainnet` | [setupDashClient-core.mjs](setupDashClient-core.mjs) | — | — | — | — | — |
| `wallet.deriveKeyFromSeedWithPath` | ✅ (multiple: [create-wallet.mjs](create-wallet.mjs), [setupDashClient-core.mjs](setupDashClient-core.mjs)) | — | — | — | — | — |
| *`wallet.mnemonicToSeed`* | — | — | — | — | — | — |
| *`wallet.deriveKeyFromSeedPhrase`, `deriveKeyFromSeedWithExtendedPath`* | — | — | — | — | — | — |
| *`wallet.deriveDashpayContactKey`* | — | — | — | — | — | — |
| *`wallet.derivationPathDip9Testnet`, `derivationPathDip9Mainnet`* | — | — | — | — | — | — |
| *`wallet.deriveChildPublicKey`, `xprvToXpub`* **(new in v4)** | — | — | — | — | — | — |
| *`wallet.generateKeyPair`, `generateKeyPairs`, `keyPairFromWif`, `keyPairFromHex`* **(new in v4)** | — | — | — | — | — | — |
| *`wallet.pubkeyToAddress`, `validateAddress`* **(new in v4)** | — | — | — | — | — | — |
| *`wallet.signMessage`* (no `verifyMessage` export) **(new in v4)** | — | — | — | — | — | — |

## Value exports — `PrivateKey`, `PlatformAddressSigner`, `IdentitySigner`

| Export | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `PrivateKey.fromWIF` | ✅ (multiple: [create-wallet.mjs](create-wallet.mjs), [setupDashClient-core.mjs](setupDashClient-core.mjs)) | — | — | ✅ | — | ✅ |
| `PrivateKey.toPublicKey` | — | — | — | — | — | ✅ |
| `PlatformAddressSigner` (+ `.addKey`, `.toBech32m`) | ✅ (multiple: [create-wallet.mjs](create-wallet.mjs), [setupDashClient-core.mjs](setupDashClient-core.mjs)) | — | — | — | — | — |
| `IdentitySigner` | [setupDashClient-core.mjs](setupDashClient-core.mjs) | — | — | ✅ | ✅ | ✅ |

## System — `sdk.system.*`

| Method | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `system.status` | [connect.mjs](connect.mjs) | — | — | — | — | — |
| *`system.currentQuorumsInfo`* | — | — | — | — | — | — |
| *`system.pathElements`* | — | — | — | — | — | — |
| *`system.prefundedSpecializedBalance`* | — | — | — | — | — | — |
| *`system.totalCreditsInPlatform`* | — | — | — | — | — | — |

## Wallet / Keys

| Capability | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| BIP-39 mnemonic + DIP-13 derivation (`IdentityKeyManager`) | ✅ (multiple) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `keyManager.getAuth()` for signing | ✅ (multiple) | ✅ | ✅ | ✅ | ✅ | ✅ |
| WIF / `PrivateKey` + `IdentitySigner` single-key auth | — | — | — | ✅ | — | ✅ |
| Read-only `sdk.connect()` (no identity) | [connect.mjs](connect.mjs) | — | ✅ | ✅ | ✅ | ✅ |

## Contract-schema features

Capabilities expressed in the data-contract definition (not as an `sdk.*` method call) — several of these gate the v4 SDK methods above.

| Schema feature | Tutorials | dashmint-lab | dashproof-lab | dashnote | dashrate | token-ops |
|---|---|:-:|:-:|:-:|:-:|:-:|
| NFT `tradeMode` / `transferable` / `creationRestrictionMode` | [contract-register-nft.mjs](2-Contracts-and-Documents/contract-register-nft.mjs) | ✅ | — | — | — | — |
| `tokenCost.create` (token-gated document creation) | — | ✅ | — | — | — | — |
| `documentsKeepHistory` (per-type / contract default) | [contract-register-history.mjs](2-Contracts-and-Documents/contract-register-history.mjs) | — | — | — | ✅ | — |
| Immutable / non-deletable documents (`documentsMutable: false`, `canBeDeleted: false`) | ✅ (multiple) | — | ✅ | — | — | — |
| `countable` aggregation index **(new in v4)** | — | — | — | — | ✅ | — |
| `rangeCountable` aggregation index **(new in v4)** | — | — | — | — | ✅ | — |
| *`summable` aggregation index* **(new in v4)** | — | — | — | — | — | — |
| Contract `groups` (multi-signer, unit-power members + `requiredPower`) | — | — | — | — | — | ✅ |
| `ChangeControlRules` (`authorizedToMakeChange` / `adminActionTakers`) | [token-register.mjs](3-Tokens/token-register.mjs) | — | — | — | — | ✅ |
| `TokenConfiguration` (base/max supply, `mainControlGroup`, per-capability rules) | [token-register.mjs](3-Tokens/token-register.mjs) | ✅ | — | — | — | ✅ |
| `TokenKeepsHistoryRules` (mint / burn / freeze / transfer / pricing history) | [token-register.mjs](3-Tokens/token-register.mjs) (mint / burn / transfer only) | — | — | — | — | ✅ |
| `TokenDistributionRules` (minting destination + choosable destination) | [token-register.mjs](3-Tokens/token-register.mjs) | — | — | — | — | ✅ |
| `TokenMarketplaceRules` / `TokenTradeMode` | [token-register.mjs](3-Tokens/token-register.mjs) (`NotTradeable`) | ✅ | — | — | — | ✅ |

> dashrate deliberately omits `summable` — a count+sum value tree at a shared index prefix triggers an index-aggregation conflict that fails all document writes, so the per-resource average is derived in JS from the grouped `count`.

## Entirely unused v4 facades

New in evo-sdk v4, with **zero references** in tutorials or example apps:

- **`sdk.stateTransitions.*`** — `broadcastStateTransition`, `waitForResponse`, `broadcastAndWait`, `waitForStateTransitionResult` (the last moved here from `sdk.system` in v4)
- **`sdk.shielded.*`** — the shielded-pool query surface (`poolState`, `encryptedNotes`, `anchors`, `mostRecentAnchor`, `nullifiers`); the headline v4 protocol theme has no example coverage
- New devnet factories — `EvoSDK.devnet` / `devnetTrusted`

## Proofs

All default `sdk.*` query methods request and verify Platform proofs internally when the SDK is in trusted mode (which `setupDashClient-core.mjs` uses); the verified proof is then discarded and only the typed result is returned.

The `*WithProof` variants do the same verification but additionally **return the proof bytes plus block metadata** to the caller — useful for forwarding proofs to a third party, recording block height, or archiving for later audit. No code in the repo currently asks for proofs back, so every `*WithProof` method is unused, as is the genuinely unverified path `identities.fetchUnproved` and the SDK-wide `proofs: false` constructor option.

## Entirely unused SDK surfaces

These facades have zero references in tutorials or example apps:

- **`sdk.epoch.*`** — `current`, `epochsInfo`, `evonodesProposedBlocksByIds`, `evonodesProposedBlocksByRange`, `finalizedInfos`
- **`sdk.voting.*`** — `contestedResourceIdentityVotes`, `contestedResourceVoteState`, `masternodeVote`, `votePollsByEndDate`
- **`sdk.protocol.*`** — `versionUpgradeState`, `versionUpgradeVoteStatus`
- **`sdk.system.*`** — all methods unused except `status` (see table above): `currentQuorumsInfo`, `pathElements`, `prefundedSpecializedBalance`, `totalCreditsInPlatform`

## Notes

- Tutorials uniquely cover: identity lifecycle (register / top-up / key add / key disable / credit transfer / credit withdrawal), L1 send-funds, DPNS name registration, contract update + history, and the indexed / binary / timestamps / history / NFT contract variants.
- Example apps uniquely cover: burn-to-mint via `tokenPaymentInfo`, group-governed token administration, WIF-based auth, and pure read-only `sdk.connect()` flows.
- Marketplace document ops (`transfer` / `setPrice` / `purchase`) are covered in **both** places — by the `document-transfer` / `document-set-price` / `document-purchase` tutorials and by dashmint-lab.
- **v4-specific coverage** lives in three apps. **dashrate** is the only consumer of the v4 document query engine — `documents.count`, `count` + `groupBy`, and `documents.history` over a `documentsKeepHistory: true` type, plus `countable` / `rangeCountable` aggregation indices. **dashmint-lab** is the only consumer of the v4 NFT surface — `tradeMode` / `transferable` + `setPrice` / `purchase`, and `tokenCost.create` token-gated minting. **token-ops** is the only consumer of `tokens.configUpdate` (new in v4) and of the entire **`sdk.group.*`** facade.
- **token-ops** is the deepest token-surface consumer in the repo: it covers every mutating token method except `claim` / `setPrice` / `directPurchase` (`mint`, `burn`, `transfer`, `freeze`, `unfreeze`, `destroyFrozen`, `emergencyAction`, `configUpdate`), all three read methods the tutorials use plus `identityTokenInfos`, and the propose / co-sign group-action lifecycle (`group.actions`, `group.actionSigners`, `group.info`) via `GroupStateTransitionInfoStatus.proposer` / `.otherSigner`. It is also the only app that calls `contracts.update`.
- Biggest gaps: the two new v4 facades **`sdk.stateTransitions.*`** and **`sdk.shielded.*`** (shielded-pool privacy — the headline v4 protocol feature), `documents.sum` / `average`, token distribution and marketplace operations (`claim` / `setPrice` / `directPurchase`), and **all voting / epoch / system / protocol queries** have no coverage at all. Within `sdk.group.*`, the contested-resource and membership-listing queries (`contestedResources`, `identityGroups`, `groupsDataContracts`, `members`, `infos`) remain uncovered.
