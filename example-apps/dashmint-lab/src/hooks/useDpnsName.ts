/**
 * Resolves DPNS usernames for identity IDs without blocking card rendering.
 *
 * Uses a module-level cache so repeated renders (or multiple cards with the
 * same owner) only trigger one network call per identity.
 */
import { useEffect, useState } from 'react'

// Module-level cache shared across all hook instances.
// Values: resolved username string, null (no name), or a pending Promise.
const cache = new Map<string, string | null | Promise<string | null>>()

async function resolve(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any,
  identityId: string,
): Promise<string | null> {
  try {
    const result = await sdk.dpns.username(identityId)
    if (typeof result !== 'string') return null
    // Strip the ".dash" TLD suffix for display.
    return result.endsWith('.dash') ? result.slice(0, -5) : result
  } catch {
    return null
  }
}

/**
 * Returns the DPNS username for an identity, or null while loading / if none.
 * Does not delay initial render — the name appears once the async lookup completes.
 */
export function useDpnsName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any | null,
  identityId: string | undefined | null,
): string | null {
  const cachedNow = identityId ? cache.get(identityId) : undefined
  const initialName =
    typeof cachedNow === 'string' ? cachedNow : null

  const [name, setName] = useState<string | null>(initialName)

  // Reset synchronously when identityId changes and we already know the answer.
  // This avoids a stale name flash without calling setState inside the effect.
  if (name !== initialName) {
    setName(initialName)
  }

  useEffect(() => {
    if (!sdk || !identityId) return

    const cached = cache.get(identityId)

    // Already resolved (string or null) — handled by the sync reset above.
    if (cached !== undefined && !(cached instanceof Promise)) return

    // Already in-flight — wait on the existing promise
    if (cached instanceof Promise) {
      let cancelled = false
      cached.then((val) => {
        if (!cancelled) setName(val)
      })
      return () => { cancelled = true }
    }

    // Start a new lookup
    const promise = resolve(sdk, identityId)
    cache.set(identityId, promise)

    let cancelled = false
    promise.then((val) => {
      cache.set(identityId, val)
      if (!cancelled) setName(val)
    })

    return () => { cancelled = true }
  }, [sdk, identityId])

  return name
}
