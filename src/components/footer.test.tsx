import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { Footer } from './Footer'

// Mocking TanStack Router and Auth
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useRouter: () => ({
    navigate: vi.fn(),
    state: { location: { pathname: '/' } },
  }),
  useRouterState: () => ({ location: { pathname: '/' } }),
}))

vi.mock('~stzUser/lib/auth-client', () => ({
  useSession: vi.fn(),
}))

// Mock env.ts with all required exports
vi.mock('~stzUser/lib/env', () => ({
  isServer: () => true,
  getEnvVar: (name: string) => name,
  clientEnv: {
    APP_NAME: 'Test App',
    COMPANY_NAME: 'Test Company',
    COPYRIGHT_START_YEAR: '2024',
    SUPPORT_LINK_TEXT: 'Contact our Support Team',
    SUPPORT_LINK_URL: '/contact',
    REFUND_POLICY_URL: '/legal/refunds',
  },
}))

import { clientEnv } from '~stzUser/lib/env'
import { useSession } from '~stzUser/lib/auth-client'

describe('Footer', () => {
  it('should render two-row layout with correct content for admin', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'admin' } }
    } as any)

    const { getByText } = render(<Footer />)

    // Row 1
    expect(getByText('Contact our Support Team')).toBeDefined()
    expect(getByText('Acknowledgements')).toBeDefined()
    expect(getByText('About')).toBeDefined()

    // Row 2
    expect(getByText('Terms of Service')).toBeDefined()
    expect(getByText('Privacy Policy')).toBeDefined()
    expect(getByText(/Refund Policy/i)).toBeDefined()

    // Dynamic Copyright
    const currentYear = new Date().getFullYear()
    expect(getByText(new RegExp(`Copyright © 2024-${currentYear} Test Company`, 'i'))).toBeDefined()

    // Admin should see Admin Tools
    expect(getByText('Admin Tools')).toBeDefined()
  })

  it('should NOT render Admin Tools for regular user', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'user' } }
    } as any)

    const { queryByText } = render(<Footer />)
    expect(queryByText('Admin Tools')).toBeNull()
  })

  it('should render single year copyright when start year is current year', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'admin' } }
    } as any)

    const currentYear = new Date().getFullYear()

    // Use vi.mocked to override the value
    vi.mocked(clientEnv).COPYRIGHT_START_YEAR = currentYear.toString()

    const { getByText } = render(<Footer />)
    expect(getByText(new RegExp(`Copyright © ${currentYear} Test Company`, 'i'))).toBeDefined()
  })
})
