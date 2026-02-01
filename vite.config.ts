// vite.config.ts
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react-swc'

export default defineConfig({
  server: {
    port: 3000,
    allowedHosts: [
      'xwhsw-1-158-105-155.a.free.pinggy.link' // temp, expiring url for pinggy https tunnel for dev server
    ]
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      customViteReactPlugin: true
    }),
    viteReact()
  ],
  resolve: {
    alias: process.env.NETLIFY
      ? {
        '@libsql/client': '@libsql/client/web',
        'better-sqlite3': '/Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/stzUser/lib/mock-sqlite.ts'
      }
      : undefined,
  },
  build: {
    rollupOptions: {
      external: [
        // Exclude reference directory from build
        /^\/reference\//,
      ],
    },
  },
  // Exclude reference directory from file watching and processing
  optimizeDeps: {
    exclude: ['reference'],
  },
  ssr: {
    noExternal: ['better-auth', 'kysely-libsql', '@libsql/client'],
  },
})