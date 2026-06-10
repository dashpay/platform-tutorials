// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/tokens/register-a-token-contract.html
import {
  AuthorizedActionTakers,
  ChangeControlRules,
  DataContract,
  TokenConfiguration,
  TokenConfigurationConvention,
  TokenConfigurationLocalization,
  TokenDistributionRules,
  TokenKeepsHistoryRules,
  TokenMarketplaceRules,
  TokenTradeMode,
} from '@dashevo/evo-sdk';
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

const TOKEN_POSITION = 0;
const TOKEN_NAME = 'TutorialToken';
const TOKEN_PLURAL = 'TutorialTokens';
const TOKEN_BASE_SUPPLY = 100n; // Token amounts are bigint values
const TOKEN_MAX_SUPPLY = 1000n;

// This contract includes one small document type so learners can still use the
// standard document tutorials with the same contract if they want to.
const documentSchemas = {
  note: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        position: 0,
      },
    },
    additionalProperties: false,
  },
};

function createTutorialTokenConfiguration(ownerId) {
  const contractOwner = AuthorizedActionTakers.ContractOwner();
  const noOne = AuthorizedActionTakers.NoOne();

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

  return new TokenConfiguration({
    conventions: new TokenConfigurationConvention(
      {
        en: new TokenConfigurationLocalization(false, TOKEN_NAME, TOKEN_PLURAL),
      },
      0,
    ),
    conventionsChangeRules: ownerRules,
    baseSupply: TOKEN_BASE_SUPPLY,
    maxSupply: TOKEN_MAX_SUPPLY,
    keepsHistory: new TokenKeepsHistoryRules({
      isKeepingBurningHistory: true,
      isKeepingMintingHistory: true,
      isKeepingTransferHistory: true,
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
    // Minting and burning are enabled so the next tutorials can demonstrate
    // the normal issuer-managed token lifecycle.
    manualMintingRules: ownerRules,
    manualBurningRules: ownerRules,
    freezeRules: lockedRules,
    unfreezeRules: lockedRules,
    destroyFrozenFundsRules: lockedRules,
    emergencyActionRules: lockedRules,
    mainControlGroupCanBeModified: noOne,
    description: 'Issuer-managed token for Platform token tutorials.',
  });
}

try {
  const identityNonce = await sdk.identities.nonce(identity.id.toString());

  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: documentSchemas,
    tokens: {
      [TOKEN_POSITION]: createTutorialTokenConfiguration(
        identity.id.toString(),
      ),
    },
    fullValidation: true,
  });

  const publishedContract = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });

  const contractId =
    publishedContract.id?.toString() || publishedContract.toJSON?.()?.id;

  if (!contractId) {
    const publishResult = publishedContract.toJSON?.() ?? publishedContract;
    throw new Error(
      `Contract publish returned no id: ${JSON.stringify(publishResult)}`,
    );
  }

  const tokenId = await sdk.tokens.calculateId(contractId, TOKEN_POSITION);

  console.log('Token contract registered:\n', publishedContract.toJSON());
  console.log('Token position:', TOKEN_POSITION);
  console.log('Token ID:', tokenId);
  console.log('Initial owner token balance:', TOKEN_BASE_SUPPLY.toString());
  console.log('Maximum token supply:', TOKEN_MAX_SUPPLY.toString());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
