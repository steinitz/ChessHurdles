import React from 'react'

export const Terms = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Terms of Service</h1>
      <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>

      <section style={{ marginTop: '2rem' }}>
        <h3>1. Ground Rules</h3>
        <p>Don't hack the site, don't steal the code, and don't abuse the usage limits. We're all here to enjoy the game and improve our skills.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>2. No Warranties</h3>
        <p>This is a tool provided "as is". If it misses a chess tactic, the engine makes a mistake, or the server goes down, we aren't liable. Use it as a guide, not gospel.</p>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>3. Refunds</h3>
        <p>Since digital credits and analysis are consumed instantly, we generally don't offer refunds once used. If you have a genuine technical issue, please contact support.</p>
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
