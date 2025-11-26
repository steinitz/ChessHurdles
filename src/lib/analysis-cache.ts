// src/lib/analysis-cache.ts
// Lightweight localStorage-backed analysis cache with an in-memory index.
// Normalization is de-emphasized per request; keys use raw FEN as provided.

export type CachedEval = {
  cp: number
  depth: number
  bestMove?: string
  multiPV?: Array<{ move: string; cp: number }>
  ts: number // epoch millis of when the eval was stored
}

const NAMESPACE = 'analysis::'

// In-memory index mirrors a subset of localStorage entries for fast lookups.
const memory = new Map<string, CachedEval>()

// Build a stable key combining engine fingerprint and normalized FEN.
// Fingerprint should reflect engine identity and relevant options (e.g., MultiPV).
export function makeKey(fen: string, fingerprint: string): string {
  return `${NAMESPACE}${fingerprint}::${fen}`
}

// Get a cached evaluation. Checks memory first; falls back to localStorage.
export function getCachedEval(key: string): CachedEval | null {
  const fromMem = memory.get(key)
  if (fromMem) return fromMem

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedEval
    memory.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

// Set a cached evaluation. Writes to memory and persists to localStorage.
export function setCachedEval(key: string, value: CachedEval): void {
  memory.set(key, value)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // Swallow quota or serialization errors; callers can still rely on memory.
  }
}

// Initialize the in-memory index by scanning localStorage for our namespace.
// Logs the number of entries loaded for visibility at app startup.
export function initAnalysisCache(namespacePrefix: string = NAMESPACE): number {
  let loaded = 0
  try {
    if (typeof localStorage === 'undefined') {
      console.info('[analysis-cache] localStorage not available; starting with empty memory index')
      return 0
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(namespacePrefix)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as CachedEval
        memory.set(key, parsed)
        loaded++
      } catch {
        // Skip malformed entries
      }
    }
  } finally {
    console.info(`[analysis-cache] loaded ${loaded} entr${loaded === 1 ? 'y' : 'ies'} into memory`)
  }
  return loaded
}

// Current count of entries in the in-memory index.
export function memoryEntryCount(): number {
  return memory.size
}

// Optional utilities for developer tooling and maintenance.
export function listMemoryKeys(): string[] {
  return Array.from(memory.keys())
}

export function clearMemoryCache(): void {
  memory.clear()
}

export function clearPersistentCache(namespacePrefix: string = NAMESPACE): number {
  if (typeof localStorage === 'undefined') return 0
  let removed = 0
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(namespacePrefix)) keysToRemove.push(key)
  }
  for (const k of keysToRemove) {
    try {
      localStorage.removeItem(k)
      memory.delete(k)
      removed++
    } catch {
      // ignore
    }
  }
  console.info(`[analysis-cache] cleared ${removed} persistent entr${removed === 1 ? 'y' : 'ies'}`)
  return removed
}

// Clear the persistent cache exactly once per browser/session, guarded by a marker key.
// This is useful for debugging runs where we want a single reset without repeated clears.
export function clearPersistentCacheOnce(
  markerKey: string = `${NAMESPACE}clearOnceMarker`,
  namespacePrefix: string = NAMESPACE
): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const alreadyCleared = localStorage.getItem(markerKey)
    if (alreadyCleared === '1') {
      console.info('[analysis-cache] clearOnce: already performed; skipping')
      return false
    }
    const removed = clearPersistentCache(namespacePrefix)
    localStorage.setItem(markerKey, '1')
    console.info(`[analysis-cache] clearOnce: performed; removed=${removed}`)
    return true
  } catch {
    return false
  }
}