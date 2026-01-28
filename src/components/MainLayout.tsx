import type { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { CreditsRequiredDialog } from '~stzUser/components/Other/CreditsRequiredDialog'

export const MainLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}>
      <Header />
      <div style={{ flex: 1, width: '100%' }}>
        {children}
      </div>
      <CreditsRequiredDialog />
      <Footer />
    </main>
  )
}