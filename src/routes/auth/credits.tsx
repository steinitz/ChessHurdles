import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSession } from '~stzUser/lib/auth-client'
import { getTransactions, claimWelcomeGrant, requestBankTransfer, getWalletStatus, type WalletStatus } from '~stzUser/lib/wallet.server'
import { clientEnv } from '~stzUser/lib/env'
import { useEffect, useState } from 'react'
import { Spacer } from '~stzUtils/components/Spacer'
import { Dialog, makeDialogRef } from '~stzUtils/components/Dialog'

function TransactionsPage() {
  const { data: session } = useSession()
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [purchaseAmount, setPurchaseAmount] = useState<number | ''>(clientEnv.DEFAULT_CREDITS_PURCHASE)
  const [isRequesting, setIsRequesting] = useState(false)
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null)

  const navigate = useNavigate()

  const bankDetailsRef = makeDialogRef()

  useEffect(() => {
    const fetchHistory = async () => {
      if (!session?.user) return
      try {
        const [transactionsData, statusData] = await Promise.all([
          getTransactions(),
          getWalletStatus()
        ])
        setTransactions(transactionsData || [])
        setWalletStatus(statusData)
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchHistory()
  }, [session?.user?.id])

  const handleClaimGrant = async () => {
    try {
      const result = await claimWelcomeGrant()
      if (result.success) {
        alert('Welcome grant claimed! 🎁')
        window.location.reload()
      } else if ('message' in result) {
        alert(result.message)
      }
    } catch (err) {
      alert('Failed to claim grant.')
    }
  }

  const handleRequestPurchase = async () => {
    setIsRequesting(true)
    try {
      const result = await requestBankTransfer({ data: { amount: Number(purchaseAmount) } })
      if (result.success) {
        bankDetailsRef.current?.setIsOpen(true)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to request purchase.')
    } finally {
      setIsRequesting(false)
    }
  }

  if (!session?.user) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '1.5rem', opacity: 0.9 }}>
          Please sign in to add credits and view your transaction history.
        </p>
        <Link to="/" style={{ textDecoration: 'underline' }}>Back to Home</Link>
      </div>
    )
  }

  const showBankSection = !clientEnv.IS_STRIPE_ENABLED && clientEnv.BANK_TRANSFER_BSB && clientEnv.BANK_TRANSFER_ACC
  const totalCost = (Number(purchaseAmount || 0) * clientEnv.CREDIT_PRICE_AUD).toFixed(2)

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Credits</h1>

      <section style={{
        border: '1px solid var(--color-bg-secondary)',
        padding: '2rem',
        borderRadius: '12px',
        backgroundColor: 'var(--color-bg-alt)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0rem',
        width: '100%',
      }}>
        <h2 style={{ marginTop: '0', marginBottom: '3rem', textAlign: 'center' }}>Top Up Credits</h2>

        {/* Payment Section */}
        <div style={{ textAlign: 'left' }}>
          {clientEnv.IS_STRIPE_ENABLED ? (
            <p>Stripe integration is coming soon</p>
          ) : showBankSection ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p style={{ margin: 0, opacity: 0.9 }}>
                Purchase credits via manual bank transfer (<strong>AUD${clientEnv.CREDIT_PRICE_AUD.toFixed(3)}</strong> per credit).
              </p>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.5rem',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', margin: 0, lineHeight: 'normal' }}>
                    Credits:
                    <input
                      type="number"
                      min={clientEnv.MIN_CREDITS_PURCHASE}
                      value={purchaseAmount}
                      onChange={(e) => {
                        const val = e.target.value
                        setPurchaseAmount(val === '' ? '' : Number(val))
                      }}
                      style={{
                        width: '6rem',
                        minWidth: '0',
                        padding: '0.4rem 0.6rem',
                        margin: 0
                      }}
                    />
                  </label>

                  <span style={{ fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                    Total Cost: <strong style={{ color: 'var(--color-primary)' }}>AUD${totalCost}</strong>
                  </span>
                </div>

                <button
                  onClick={handleRequestPurchase}
                  disabled={isRequesting || !purchaseAmount || purchaseAmount < clientEnv.MIN_CREDITS_PURCHASE}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.6rem 1.2rem',
                  }}
                >
                  {isRequesting ? 'Requesting...' : 'Pay via Bank Transfer'}
                </button>
              </div>
            </div>
          ) : (
            <p>Credit purchasing is currently unavailable.</p>
          )}
        </div>

        <Spacer />
        <hr style={{ width: '100%', margin: 0, opacity: 0.1, border: 'none', borderTop: '1px solid var(--color-text)' }} />
        <Spacer />

        {/* Welcome Grant Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          textAlign: 'left'
        }}>
          <p style={{
            margin: 0,
            flex: '1 1 300px',
            opacity: walletStatus?.welcomeClaimed ? 0.5 : 1
          }}>
            New here? Get started with <strong>{clientEnv.WELCOME_GRANT_CREDITS} free credits</strong>:
          </p>
          <button
            onClick={handleClaimGrant}
            disabled={walletStatus?.welcomeClaimed || isRequesting}
            style={{
              whiteSpace: 'nowrap',
              padding: '0.6rem 1.2rem',
              minWidth: '180px',
              opacity: walletStatus?.welcomeClaimed ? 0.5 : 1,
              cursor: walletStatus?.welcomeClaimed ? 'not-allowed' : 'pointer'
            }}
          >
            {walletStatus?.welcomeClaimed ? 'Welcome Grant Claimed' : 'Claim Welcome Grant'}
          </button>
        </div>

        <p style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.85rem' }}>
          You{walletStatus?.welcomeClaimed ? '' : "'ll also"} receive an automatic <strong>{clientEnv.DAILY_GRANT_CREDITS} credit top-up</strong> on your first visit or action each day.
        </p>
      </section>

      <Spacer orientation="vertical" />

      <div style={{ marginTop: '2rem' }}>
        <h3>History Ledger</h3>
        <p>A complete ledger of your credit grants and consumption.</p>
        {isLoading ? (
          <p>Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p>No transactions found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-bg-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Type</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--color-bg-secondary)' }}>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                    {t.type.replace('_', ' ')}
                  </td>
                  <td style={{
                    padding: '0.5rem',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: t.amount > 0 ? 'green' : 'inherit'
                  }}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog ref={bankDetailsRef}>
        <h2>Bank Transfer Instructions</h2>
        <p>Please transfer <strong>${totalCost} AUD</strong> to the following account:</p>
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          padding: '1rem',
          borderRadius: '4px',
          fontFamily: 'monospace'
        }}>
          <p><strong>BSB:</strong> {clientEnv.BANK_TRANSFER_BSB}</p>
          <p><strong>Account:</strong> {clientEnv.BANK_TRANSFER_ACC}</p>
          <p><strong>Reference:</strong> {(session.user.name && session.user.name.length >= 5) ? session.user.name : session.user.email}</p>
        </div>
        <p style={{ marginTop: '1rem' }}>
          We have been notified of your request and will credit your account as soon as the funds arrive.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={() => bankDetailsRef.current?.setIsOpen(false)}>Got it</button>
        </div>
      </Dialog>

      <Spacer orientation="vertical" />
      <Link to="/">Back to Home</Link>
    </div>
  )
}

export const Route = createFileRoute('/auth/credits')({
  component: TransactionsPage,
})
