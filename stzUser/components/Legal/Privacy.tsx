import React from 'react'
import { ContactLink } from './Links'

export const Privacy = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Privacy Policy</h1>
      <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>

      <section style={{ marginTop: '2rem' }}>
        <h3>1. What we collect</h3>
        <p>We only collect your email address and name when you sign up. This allows you to securely log in, save your games, and track your progress across different devices.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>2. AI Data Transparency</h3>
        <p>If you request AI analysis (like move descriptions), we send the minimum data necessary (the chess move history) to our AI provider, Google Gemini. We do <strong>not</strong> send your personally identifiable information to the AI.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>3. No Selling</h3>
        <p>Your data belongs to you. We don't sell your personal information to third parties. We don't use it for advertising. It's only used to provide the services you requested.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>4. Your Rights</h3>
        <p>You have the right to access or delete your data at any time. You can use the "Delete Account" button in your profile, or <ContactLink /> if you need help cleaning things up.</p>
      </section>

      <p style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'gray' }}>
        Your trust is important to us.
      </p>
    </div>
  )
}
