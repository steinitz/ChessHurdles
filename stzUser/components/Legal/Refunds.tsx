import React from 'react'
import { ContactLink } from './Links'

export const Refunds = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Refund Policy</h1>
      <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>

      <section style={{ marginTop: '2rem' }}>
        <h3>Digital Goods Policy</h3>
        <p>Our service provides digital credits and AI-driven analysis that are consumed instantly upon use. As such, we generally do not offer refunds once a transaction is completed and the digital assets have been delivered to your account.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Technical Issues</h3>
        <p>If you experience a genuine technical issue that prevented you from using what you purchased (e.g., a server failure during analysis), please <ContactLink />. We will investigate and, if verified, credit your account or provide an appropriate remedy.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Changes & Cancellations</h3>
        <p>Subscriptions (if applicable) can be cancelled at any time through your profile. Cancellation prevents future billing but does not result in a refund for the current billing period or unused credits.</p>
      </section>
    </div>
  )
}
