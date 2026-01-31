// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createRouter } from './router'
import { initializeChessDatabase } from './lib/chess-migrations'
import { ensureAdditionalTables } from '~stzUser/lib/migrations'

// Initialize databases on server startup
try {
  await initializeChessDatabase()
  await ensureAdditionalTables()
  console.log('✅ All database migrations completed successfully')
} catch (error) {
  console.error('❌ Failed to initialize databases:', error)
}

export default createStartHandler({
  createRouter,
})(defaultStreamHandler)