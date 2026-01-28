import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'
import { UserBlock } from '../../components/Other/userBlock'

// Mocking TanStack Router and Auth
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

vi.mock('~stzUser/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('~stzUser/lib/wallet.server', () => ({
  getWalletStatus: vi.fn(),
}))

import { useSession } from '~stzUser/lib/auth-client'
import { getWalletStatus } from '~stzUser/lib/wallet.server'

describe('UserBlock & WalletWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render user email and wallet status when logged in', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } }
    } as any)

    vi.mocked(getWalletStatus).mockResolvedValue({
      credits: 50
    })

    const { getByText } = render(<UserBlock />)

    expect(getByText('test@example.com')).toBeDefined()

    await waitFor(() => {
      expect(getByText(/50 Credits/i)).toBeDefined()
    })
  })

  it('should render Sign In link when logged out', () => {
    vi.mocked(useSession).mockReturnValue({ data: null } as any)

    const { getByText } = render(<UserBlock />)

    expect(getByText(/Sign In/i)).toBeDefined()
  })
})
