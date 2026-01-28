import React from 'react'

export const Pricing = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Pricing & Credits</h1>
      <p>We believe in transparent, usage-based pricing. You only pay for what you use.</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '2rem',
        marginTop: '2rem'
      }}>
        <div style={{
          padding: '1.5rem',
          border: '1px solid var(--color-bg-secondary)',
          borderRadius: '8px',
          backgroundColor: 'var(--color-bg-secondary)'
        }}>
          <h3>Free Tier</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>$0</p>
          <p>Perfect for trying out the analysis tools.</p>
          <ul>
            <li>3 analyses per day</li>
            <li>Basic move descriptions</li>
            <li>Community support</li>
          </ul>
        </div>

        <div style={{
          padding: '1.5rem',
          border: '2px solid var(--color-primary, #007bff)',
          borderRadius: '8px'
        }}>
          <h3>Credit Packs</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>Pay-As-You-Go</p>
          <p>Unlock more depth and volume with credits.</p>
          <ul>
            <li>Detailed AI breakdowns</li>
            <li>Save unlimited hurdles</li>
            <li>Priority processing</li>
          </ul>
          <p style={{ fontSize: '0.85rem', color: 'gray', marginTop: '1rem' }}>
            Credits are purchased in packs and consumed per analysis.
          </p>
        </div>
      </div>

      <section style={{ marginTop: '2rem' }}>
        <h3>No Surprises</h3>
        <p>There are no monthly subscriptions for credit packs. You buy them once, and they stay in your account until used. We'll always warn you if you're running low.</p>
      </section>
    </div>
  )
}
