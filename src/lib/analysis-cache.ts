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

// Minimal FEN normalization (disabled for testing cache behavior):
// Previously, we zeroed the halfmove clock and set fullmove number to 1.
// For this experiment, we retain raw FEN clocks to ensure read/write keys match
// exactly what the engine reports for each position.
export function normalizeFenClocks(fen: string): string {
  // return the raw FEN without normalization
  return fen
}

// Build a stable key combining engine fingerprint and normalized FEN.
// Fingerprint should reflect engine identity and relevant options (e.g., MultiPV).
export function makeKey(fen: string, fingerprint: string): string {
  const rawFen = normalizeFenClocks(fen)
  return `${NAMESPACE}${fingerprint}::${rawFen}`
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

// ---------- Debug utilities for FEN inspection and comparison ----------

function splitFenFields(fen: string): string[] {
  return fen.split(/\s+/)
}

export function describeFen(label: string, fen: string): void {
  const fields = splitFenFields(fen)
  const info = {
    label,
    length: fen.length,
    fields,
    piecePlacement: fields[0],
    activeColor: fields[1],
    castling: fields[2],
    enPassant: fields[3],
    halfmoveClock: fields[4],
    fullmoveNumber: fields[5],
  }
  console.log('[fen]', info)
}

export function compareFens(labelA: string, fenA: string, labelB: string, fenB: string): void {
  const a = fenA
  const b = fenB
  const fieldsA = splitFenFields(a)
  const fieldsB = splitFenFields(b)
  const eq = a === b
  console.log(`[fen-compare] eq=${eq} lenA=${a.length} lenB=${b.length}`)
  console.log('[fen-compare] fields', { A: fieldsA, B: fieldsB })
  // Field-by-field summary to make success/mismatch explicit
  const names = ['piecePlacement', 'activeColor', 'castling', 'enPassant', 'halfmoveClock', 'fullmoveNumber']
  const diffs: string[] = []
  for (let i = 0; i < Math.min(fieldsA.length, fieldsB.length, names.length); i++) {
    if (fieldsA[i] !== fieldsB[i]) diffs.push(names[i])
  }
  console.log(`[fen-compare] summary: ${eq ? 'MATCH' : 'MISMATCH'}${diffs.length ? `; differingFields=${diffs.join(',')}` : ''}`)
  // Highlight clock differences
  const clocks = {
    halfmoveClock: { A: fieldsA[4], B: fieldsB[4] },
    fullmoveNumber: { A: fieldsA[5], B: fieldsB[5] },
  }
  console.log('[fen-compare] clocks', clocks)
  // Find first differing index
  const minLen = Math.min(a.length, b.length)
  let diffIdx = -1
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) { diffIdx = i; break }
  }
  if (diffIdx >= 0 || a.length !== b.length) {
    const idx = diffIdx >= 0 ? diffIdx : minLen
    console.log('[fen-compare] firstDiff', {
      index: idx,
      aChar: a[idx], aCode: a.charCodeAt(idx),
      bChar: b[idx], bCode: b.charCodeAt(idx),
    })
  }
}

export function debugCompareAgainstCache(fen: string, fingerprint: string, limit: number = 10): void {
  // Iterate memory entries of same fingerprint and compare FENs
  const prefix = `${NAMESPACE}${fingerprint}::`
  const keys = listMemoryKeys().filter(k => k.startsWith(prefix)).slice(0, limit)
  if (keys.length === 0) {
    console.log('[fen-compare] no memory entries for fingerprint')
    return
  }
  let matched = false
  for (const k of keys) {
    const otherFen = k.substring(prefix.length)
    const eq = fen === otherFen
    compareFens('lookup', fen, 'cacheEntry', otherFen)
    if (eq) matched = true
  }
  console.log(`[fen-compare] cache set summary: entriesChecked=${keys.length}, anyMatch=${matched}`)
}