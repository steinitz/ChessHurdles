import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSession } from '~stzUser/lib/auth-client'
import { getWalletStatus, type WalletStatus } from '~stzUser/lib/wallet.server'
import { WALLET_EVENTS } from '~stzUser/lib/wallet.client'

export function WalletWidget({ style = {} }) {
  const { data: session } = useSession()
  const [wallet, setWallet] = useState<WalletStatus | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    const fetchWallet = () => {
      if (session?.user?.id) {
        // Send offset in milliseconds (inverted from minutes)
        // e.g. UTC+11 is -660 mins. -(-660) * 60 * 1000 = +39600000 ms.
        const offset = -new Date().getTimezoneOffset() * 60 * 1000
        getWalletStatus({ data: offset })
          .then(setWallet)
          .catch(err => console.error('Failed to fetch wallet status:', err))
      }
    }

    fetchWallet()

    if (typeof window !== 'undefined') {
      window.addEventListener(WALLET_EVENTS.UPDATED, fetchWallet)
      return () => {
        window.removeEventListener(WALLET_EVENTS.UPDATED, fetchWallet)
      }
    }
  }, [session?.user?.id])

  if (!wallet) return null

  return (
    <span
      title="View Transaction History"
      onClick={() => navigate({ to: '/auth/credits' })}
      style={{
        padding: '0.2rem 0.6rem',
        border: '1px solid var(--color-bg-secondary)',
        borderRadius: '0.3rem', // Add a tiny rounding
        fontSize: '0.85rem',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        ...style
      }}
    >
      <i className="fa-solid fa-wallet" style={{ marginRight: '0.5rem', opacity: 0.7 }}></i>
      {wallet.credits} Credits
    </span>
  )
}
