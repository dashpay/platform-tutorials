import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTutorial } from './run-tutorial.mjs';
import {
  assertTutorialSuccess,
  extractId,
  extractKeyId,
} from './assertions.mjs';

// Accumulated state passed forward as env vars to dependent tutorials.
const state = {};

describe('Write tutorials (sequential)', { concurrency: 1 }, () => {
  // -----------------------------------------------------------------------
  // Phase 0: Address transfers (no identity needed)
  // -----------------------------------------------------------------------

  it('send-funds', { timeout: 120_000 }, async () => {
    const result = await runTutorial('send-funds.mjs', { timeoutMs: 120_000 });
    assertTutorialSuccess(result, {
      name: 'send-funds',
      expectedPatterns: ['Transaction broadcast!'],
      errorPatterns: ['Something went wrong'],
    });
  });

  // -----------------------------------------------------------------------
  // Phase 1: Identity
  // -----------------------------------------------------------------------

  it('identity-register', { timeout: 180_000 }, async () => {
    const result = await runTutorial(
      '1-Identities-and-Names/identity-register.mjs',
      { timeoutMs: 180_000 },
    );

    // This tutorial has a known SDK bug workaround — it may extract the
    // identity ID from an error message.  Either path prints "Identity registered!".
    assert.match(
      result.stdout,
      /Identity registered!/,
      `Expected identity registration output.\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`,
    );
    console.log(result.stdout);
  });

  it('identity-retrieve', { timeout: 120_000 }, async () => {
    const result = await runTutorial(
      '1-Identities-and-Names/identity-retrieve.mjs',
      { timeoutMs: 120_000 },
    );
    assertTutorialSuccess(result, {
      name: 'identity-retrieve',
      expectedPatterns: ['Identity retrieved:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('identity-topup', { timeout: 120_000 }, async () => {
    const result = await runTutorial(
      '1-Identities-and-Names/identity-topup.mjs',
      { timeoutMs: 120_000 },
    );
    assertTutorialSuccess(result, {
      name: 'identity-topup',
      expectedPatterns: ['Top-up result:', 'Final balance:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('identity-transfer-credits', { timeout: 120_000 }, async () => {
    const result = await runTutorial(
      '1-Identities-and-Names/identity-transfer-credits.mjs',
      { timeoutMs: 120_000 },
    );
    assertTutorialSuccess(result, {
      name: 'identity-transfer-credits',
      expectedPatterns: ['balance after transfer:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('identity-withdraw-credits', { timeout: 120_000 }, async () => {
    const result = await runTutorial(
      '1-Identities-and-Names/identity-withdraw-credits.mjs',
      { timeoutMs: 120_000 },
    );
    assertTutorialSuccess(result, {
      name: 'identity-withdraw-credits',
      expectedPatterns: ['balance after withdrawal:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('identity-update-add-key', { timeout: 120_000 }, async () => {
    const result = await runTutorial(
      '1-Identities-and-Names/identity-update-add-key.mjs',
      { timeoutMs: 120_000 },
    );
    assertTutorialSuccess(result, {
      name: 'identity-update-add-key',
      expectedPatterns: ['Identity updated:'],
      errorPatterns: ['Something went wrong'],
    });

    const keyId = extractKeyId(result.stdout);
    assert.ok(keyId, `Failed to extract key ID from stdout:\n${result.stdout}`);
    state.addedKeyId = keyId;
  });

  it('identity-update-disable-key', { timeout: 120_000 }, async (ctx) => {
    if (!state.addedKeyId) {
      ctx.skip('No KEY_ID (identity-update-add-key must pass first)');
      return;
    }
    const result = await runTutorial(
      '1-Identities-and-Names/identity-update-disable-key.mjs',
      {
        env: { DISABLE_KEY_ID: state.addedKeyId },
        timeoutMs: 120_000,
      },
    );
    assertTutorialSuccess(result, {
      name: 'identity-update-disable-key',
      expectedPatterns: ['Identity updated:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('name-register', { timeout: 120_000 }, async () => {
    const label = `test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const result = await runTutorial(
      '1-Identities-and-Names/name-register.mjs',
      {
        env: { NAME_LABEL: label },
        timeoutMs: 120_000,
      },
    );
    assertTutorialSuccess(result, {
      name: 'name-register',
      expectedPatterns: ['Name registered:'],
      errorPatterns: ['Something went wrong', 'already registered'],
    });
  });

  // -----------------------------------------------------------------------
  // Phase 2: Contracts
  // -----------------------------------------------------------------------

  it('contract-register-minimal', { timeout: 180_000 }, async () => {
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-register-minimal.mjs',
      { timeoutMs: 180_000 },
    );
    assertTutorialSuccess(result, {
      name: 'contract-register-minimal',
      expectedPatterns: ['Contract registered:'],
      errorPatterns: ['Something went wrong'],
    });
    const id = extractId(result.stdout);
    assert.ok(
      id,
      `Failed to extract contract ID from stdout:\n${result.stdout}`,
    );
    state.dataContractId = id;
  });

  it('contract-register-indexed', { timeout: 180_000 }, async () => {
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-register-indexed.mjs',
      { timeoutMs: 180_000 },
    );
    assertTutorialSuccess(result, {
      name: 'contract-register-indexed',
      expectedPatterns: ['Contract registered:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('contract-register-binary', { timeout: 180_000 }, async () => {
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-register-binary.mjs',
      { timeoutMs: 180_000 },
    );
    assertTutorialSuccess(result, {
      name: 'contract-register-binary',
      expectedPatterns: ['Contract registered:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('contract-register-timestamps', { timeout: 180_000 }, async () => {
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-register-timestamps.mjs',
      { timeoutMs: 180_000 },
    );
    assertTutorialSuccess(result, {
      name: 'contract-register-timestamps',
      expectedPatterns: ['Contract registered:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('contract-register-history', { timeout: 180_000 }, async () => {
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-register-history.mjs',
      { timeoutMs: 180_000 },
    );
    assertTutorialSuccess(result, {
      name: 'contract-register-history',
      expectedPatterns: ['Contract registered:'],
      errorPatterns: ['Something went wrong'],
    });

    const id = extractId(result.stdout);
    assert.ok(
      id,
      `Failed to extract history contract ID from stdout:\n${result.stdout}`,
    );
    state.historyContractId = id;
  });

  it('contract-register-nft', { timeout: 180_000 }, async () => {
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-register-nft.mjs',
      { timeoutMs: 180_000 },
    );
    assertTutorialSuccess(result, {
      name: 'contract-register-nft',
      expectedPatterns: ['Contract registered:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('contract-update-minimal', { timeout: 120_000 }, async (ctx) => {
    if (!state.dataContractId) {
      ctx.skip(
        'No DATA_CONTRACT_ID (contract-register-minimal must pass first)',
      );
      return;
    }
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-update-minimal.mjs',
      {
        env: { DATA_CONTRACT_ID: state.dataContractId },
        timeoutMs: 120_000,
      },
    );
    assertTutorialSuccess(result, {
      name: 'contract-update-minimal',
      expectedPatterns: ['Contract updated:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('contract-update-history', { timeout: 120_000 }, async (ctx) => {
    if (!state.historyContractId) {
      ctx.skip(
        'No DATA_CONTRACT_ID (contract-register-history must pass first)',
      );
      return;
    }
    const result = await runTutorial(
      '2-Contracts-and-Documents/contract-update-history.mjs',
      {
        env: { DATA_CONTRACT_ID: state.historyContractId },
        timeoutMs: 120_000,
      },
    );
    assertTutorialSuccess(result, {
      name: 'contract-update-history',
      expectedPatterns: ['Contract updated:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  // -----------------------------------------------------------------------
  // Phase 3: Documents (depend on contract from Phase 2)
  // -----------------------------------------------------------------------

  it('document-submit', { timeout: 120_000 }, async (ctx) => {
    if (!state.dataContractId) {
      ctx.skip(
        'No DATA_CONTRACT_ID (contract-register-minimal must pass first)',
      );
      return;
    }
    const result = await runTutorial(
      '2-Contracts-and-Documents/document-submit.mjs',
      {
        env: { DATA_CONTRACT_ID: state.dataContractId },
        timeoutMs: 120_000,
      },
    );
    assertTutorialSuccess(result, {
      name: 'document-submit',
      expectedPatterns: ['Document submitted:'],
      errorPatterns: ['Something went wrong'],
    });

    const docId = extractId(result.stdout);
    assert.ok(
      docId,
      `Failed to extract document ID from stdout:\n${result.stdout}`,
    );
    state.documentId = docId;
  });

  it('document-update', { timeout: 120_000 }, async (ctx) => {
    if (!state.dataContractId || !state.documentId) {
      ctx.skip(
        'No DATA_CONTRACT_ID or DOCUMENT_ID (earlier tests must pass first)',
      );
      return;
    }
    const result = await runTutorial(
      '2-Contracts-and-Documents/document-update.mjs',
      {
        env: {
          DATA_CONTRACT_ID: state.dataContractId,
          DOCUMENT_ID: state.documentId,
        },
        timeoutMs: 120_000,
      },
    );
    assertTutorialSuccess(result, {
      name: 'document-update',
      expectedPatterns: ['Document updated:'],
      errorPatterns: ['Something went wrong'],
    });
  });

  it('document-delete', { timeout: 120_000 }, async (ctx) => {
    if (!state.dataContractId || !state.documentId) {
      ctx.skip(
        'No DATA_CONTRACT_ID or DOCUMENT_ID (earlier tests must pass first)',
      );
      return;
    }
    const result = await runTutorial(
      '2-Contracts-and-Documents/document-delete.mjs',
      {
        env: {
          DATA_CONTRACT_ID: state.dataContractId,
          DOCUMENT_ID: state.documentId,
        },
        timeoutMs: 120_000,
      },
    );
    assertTutorialSuccess(result, {
      name: 'document-delete',
      expectedPatterns: ['Document deleted successfully'],
      errorPatterns: ['Something went wrong'],
    });
  });
});
