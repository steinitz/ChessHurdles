import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true, // Re-enable globals for jest-dom compatibility
    watch: false,
    /* Only target *.test.ts files for Vitest unit tests */
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/*.spec.ts', '**/*.spec.tsx', 'node_modules/**'],
  },
  ssr: {
    noExternal: ['better-auth', 'kysely-libsql', '@libsql/client'],
  },
})