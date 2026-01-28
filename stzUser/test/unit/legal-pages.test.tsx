import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// Mocking TanStack Start and Auth
vi.mock('@tanstack/react-start', () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useRouter: () => ({}),
  useRouterState: () => ({}),
  useLinkProps: () => ({}),
}))

vi.mock('~stzUser/lib/auth-client', () => ({
  useSession: () => ({ data: { user: { id: 'test-user', email: 'test@example.com' } } }),
}))

vi.mock('~stzUser/lib/env', () => ({
  clientEnv: {
    APP_NAME: 'Test App',
    COMPANY_NAME: 'Test Company',
    COPYRIGHT_START_YEAR: '2020',
    SUPPORT_LINK_TEXT: 'Contact our Support Team',
    SUPPORT_LINK_URL: '/contact',
    REFUND_POLICY_URL: '/legal/refunds',
  },
}))

import { About } from '../../components/Legal/About'
import { Acknowledgements } from '../../components/Legal/Acknowledgements'
import { Refunds } from '../../components/Legal/Refunds'
import { Pricing } from '../../components/Legal/Pricing'

describe('Legal Page Components', () => {
  it('should render About page', () => {
    const { getByText } = render(<About />)
    expect(getByText(/Our Mission/i)).toBeDefined()
    expect(getByText(/Test Company/i)).toBeDefined()
  })

  it('should render Acknowledgements page', () => {
    const { getByText, getAllByText } = render(<Acknowledgements />)
    expect(getByText(/Technology Stack/i)).toBeDefined()
    expect(getAllByText(/React/i).length).toBeGreaterThan(0)
  })

  it('should render Refunds page', () => {
    const { getByText } = render(<Refunds />)
    expect(getByText(/Refund Policy/i)).toBeDefined()
    expect(getByText(/Digital Goods Policy/i)).toBeDefined()
  })

  it('should render Pricing page', () => {
    const { getByText, getAllByText } = render(<Pricing />)
    expect(getByText(/Pricing & Credits/i)).toBeDefined()
    expect(getByText(/Free Tier/i)).toBeDefined()
    expect(getAllByText(/Credit Packs/i).length).toBeGreaterThan(0)
  })
})
