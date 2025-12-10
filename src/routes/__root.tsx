// src/routes/__root.tsx
/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { clientEnv } from '~stzUser/lib/env'

import { MainLayout } from '~/components/MainLayout'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
      },
      {
        title: 'Chess Hurdles',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: 'https://unpkg.com/mvp.css',
      },
      {
        rel: 'stylesheet',
        href: '/mvp-css-override.css',
      },
      {
        rel: 'stylesheet',
        href: '/styles.css',
      },

      // fonts from https://fontawesome.com/
      {
        rel: 'stylesheet',
        type: 'text/css',
        href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
      }
    ]
  }),
  component: RootComponent,
  // loader: async () => {
  //   const [count] = await Promise.all([
  //     getCount(),
  //   ])
  //   return { count }
  // },
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html color-mode="user">
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV = ${JSON.stringify(clientEnv)};`,
          }}
        />
        <MainLayout>{children}</MainLayout>
        <Scripts />
      </body>
    </html>
  )
}