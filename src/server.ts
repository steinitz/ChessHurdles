// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createRouter } from './router'
import { initializeChessDatabase } from './lib/chess-migrations'
import { ensureAdditionalTables } from '~stzUser/lib/migrations'

// Initialize databases on server startup
const initDatabases = async () => {
  try {
    await initializeChessDatabase()
    await ensureAdditionalTables()
  } catch (error) {
    console.error('Failed to initialize databases:', error)
  }
}

initDatabases()

export default createStartHandler({
  createRouter,
})(defaultStreamHandler)