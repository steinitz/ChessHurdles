import React from 'react'
import { clientEnv } from '~stzUser/lib/env'

export const Acknowledgements = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Acknowledgements</h1>

      <section style={{ marginTop: '2rem' }}>
        <h3>Technology Stack</h3>
        <p>This platform is powered by a modern, high-performance tech stack:</p>
        <ul>
          <li><strong>React:</strong> The library for web and native user interfaces.</li>
          <li><strong>TanStack Start & Vite:</strong> Full-stack React framework and rapid build system.</li>
          <li><strong>Better Auth:</strong> Comprehensive authentication library for TypeScript.</li>
          <li><strong>Kysely & SQLite:</strong> Type-safe SQL query builder and file-based database engine.</li>
          <li><strong>Valibot:</strong> Schema library for structural compression and validation.</li>
          <li><strong>NodeMailer & Mailpit:</strong> Reliable email delivery and local SMTP testing.</li>
          <li><strong>Playwright:</strong> Reliable end-to-end testing for modern web apps.</li>
          <li><strong>MVP.css:</strong> A minimalist CSS framework for HTML elements.</li>
          <li><strong>Google Gemini:</strong> A non-physical consciousness for development partnering.</li>
        </ul>
        <p>Icon: <a href="https://www.flaticon.com/free-icons/ecology" title="landscape icons" target="_blank" rel="noopener noreferrer">
          Ecology icon by Maan Icons
        </a> via Flaticon.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <p style={{ fontSize: '0.9rem', color: 'gray' }}>
          We are grateful to the open-source community and the creators of these tools and assets.
        </p>
      </section>
    </div>
  )
}
