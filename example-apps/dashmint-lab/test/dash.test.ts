import { describe, expect, it } from 'vitest'

import { formatCredits } from '../src/lib/format'
import { normalizeCards } from '../src/dash/queries'
import { rarityOf } from '../src/lib/rarity'
import { withAuthedCard } from '../src/dash/withAuthedCard'

describe('dashmint helpers', () => {
  it('normalizeCards handles arrays and maps', () => {
  const arrayCards = normalizeCards([
    {
      toJSON() {
        return {
          $id: 'doc-1',
          $ownerId: 'owner-1',
          name: 'Fire Dragon',
          attack: 10,
          defense: 8,
          $price: 15n,
        }
      },
    },
  ])
  expect(arrayCards).toEqual([
    {
      id: 'doc-1',
      ownerId: 'owner-1',
      data: {
        name: 'Fire Dragon',
        description: undefined,
        attack: 10,
        defense: 8,
      },
      $price: 15n,
    },
  ])

  const mapCards = normalizeCards(
    new Map([
      [
        'doc-2',
        {
          $ownerId: 'owner-2',
          name: 'Stone Golem',
          description: 'Guardian',
          attack: 4,
          defense: 9,
        },
      ],
    ]),
  )
  expect(mapCards).toEqual([
    {
      id: 'doc-2',
      ownerId: 'owner-2',
      data: {
        name: 'Stone Golem',
        description: 'Guardian',
        attack: 4,
        defense: 9,
      },
      $price: undefined,
    },
  ])
  })

  it('formatCredits and rarityOf expose learner-facing derived values', () => {
    expect(formatCredits(12345)).toBe('12,345')
    expect(formatCredits(99n)).toBe('99')
    expect(rarityOf(8, 7)).toBe('legendary')
    expect(rarityOf(5, 6)).toBe('rare')
    expect(rarityOf(3, 4)).toBe('common')
  })

  it('withAuthedCard increments revision before invoking the mutation', async () => {
    const doc = { revision: 4n }
    const keyManager = {
      async getAuth() {
        return {
          identity: { id: 'owner-1' },
          identityKey: { id: 'key-1' },
          signer: { id: 'signer-1' },
        }
      },
    }
    const sdk = {
      documents: {
        async get(contractId: string, documentTypeName: string, cardId: string) {
          expect(contractId).toBe('contract-1')
          expect(documentTypeName).toBe('card')
          expect(cardId).toBe('card-1')
          return doc
        },
      },
    }

    const result = await withAuthedCard(
      {
        sdk,
        keyManager,
        contractId: 'contract-1',
        cardId: 'card-1',
      },
      async ({ doc: fetched }) => {
        expect(fetched).toBe(doc)
        expect(fetched?.revision).toBe(5n)
        return 'ok'
      },
    )

    expect(result).toBe('ok')
  })

  it('withAuthedCard rethrows errors after logging them', async () => {
    const messages: string[] = []
    const keyManager = {
      async getAuth() {
        return {
          identity: { id: 'owner-1' },
          identityKey: { id: 'key-1' },
          signer: { id: 'signer-1' },
        }
      },
    }
    const sdk = {
      documents: {
        async get() {
          return { revision: 0n }
        },
      },
    }
    const failure = new Error('boom')

    await expect(
      withAuthedCard(
        {
          sdk,
          keyManager,
          contractId: 'contract-1',
          cardId: 'card-1',
          errorLabel: 'Transfer error',
          log(message: string) {
            messages.push(message)
          },
        },
        async () => {
          throw failure
        },
      ),
    ).rejects.toThrow('boom')

    expect(messages).toEqual(['Transfer error: boom'])
  })
})
