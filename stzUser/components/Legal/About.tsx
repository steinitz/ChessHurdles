import React from 'react'
import { clientEnv } from '~stzUser/lib/env'
import { ContactLink } from './Links'

export const About = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>About {clientEnv.APP_NAME}</h1>

      <section style={{ marginTop: '2rem' }}>
        <h3>Our Mission</h3>
        <p>Helping you master chess through automated analysis and structured hurdle-based learning. We believe in providing powerful, accessible tools for chess improvement.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Legal Information</h3>
        <p><strong>Entity Name:</strong> {clientEnv.COMPANY_NAME}</p>
        {clientEnv.CONTACT_ADDRESS && <p><strong>Registered Address:</strong> {clientEnv.CONTACT_ADDRESS}</p>}
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Support</h3>
        <p>If you have questions, feedback, or need technical assistance, please <ContactLink />. We typically respond within 1-2 business days.</p>
      </section>
    </div>
  )
}
