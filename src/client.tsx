// src/client.tsx
import { StartClient } from '@tanstack/react-start'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { createRouter } from './router'
import { initAnalysisCache, clearPersistentCacheOnce } from './lib/analysis-cache'

const router = createRouter()

// Optionally clear the cache once when ?clearCacheOnce=1 is present.
try {
  const params = new URLSearchParams(window.location.search)
  if (params.get('clearCacheOnce') === '1') {
    clearPersistentCacheOnce()
  }
} catch {
  // ignore
}

// Initialize the analysis cache on startup and log entry count.
initAnalysisCache()

hydrateRoot(
  document,
  <StrictMode>
    <StartClient router={router} />
  </StrictMode>,
)