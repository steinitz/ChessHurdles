import React from 'react'
import { ContactLink, RefundsLink } from './Links'

export const Terms = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Terms of Service</h1>
      <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>

      <section style={{ marginTop: '2rem' }}>
        <h3>Digital Goods Policy</h3>
        <p>Our service provides digital credits and AI-driven analysis. Credits that have been used are non-refundable. However, <strong>unused credit balances</strong> may be refunded within 14 days of the original purchase upon request, subject to the conditions below.</p>
        <p>A "change of mind" refund is only available if you have not substantially consumed the purchased credit pack.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Refund Conditions & Fees</h3>
        <ul>
          <li><strong>Processing Fee:</strong> A 10% administrative fee will be deducted from all approved refunds to cover payment processor and handling costs.</li>
          <li><strong>Minimum Balance:</strong> Refunds can only be processed for credit balances equivalent to at least AUD $5.00. Balances below this amount are non-refundable.</li>
          <li><strong>Timeframe:</strong> Requests must be made within 14 days of the original purchase.</li>
        </ul>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>2. No Warranties</h3>
        <p>This is a tool provided "as is". If it misses a chess tactic, the engine makes a mistake, or the server goes down, we aren't liable. Use it as a guide, not gospel.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>3. Refunds</h3>
        <p>We offer a 14-day refund window for unused credit balances, subject to a minimum amount and processing fee. Credits that have already been used for analysis are non-refundable. Please see our full <RefundsLink label="Refund Policy" /> for details.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>4. Credit Expiration</h3>
        <p>Credits generally do not expire as long as your account remains active. However, we reserve the right to expire credits if an account has been inactive (no logins or usage) for a continuous period of 12 months.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>4. Changes</h3>
        <p>We might update these rules as the project evolves. By continuing to use the site, you're agreeing to the updated terms.</p>
      </section>

      <p style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'gray' }}>
        Thanks for being part of the community.
      </p>
    </div>
  )
}
