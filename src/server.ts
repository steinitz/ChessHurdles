// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createRouter } from './router'
import { initializeChessDatabase } from './lib/chess-migrations'

// Initialize chess database on server startup
initializeChessDatabase().catch(error => {
  console.error('Failed to initialize chess database:', error)
  // Don't exit the process - let the app start but log the error
})

export default createStartHandler({
  createRouter,
})(defaultStreamHandler)