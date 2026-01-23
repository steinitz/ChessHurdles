import { DeveloperTools } from './DeveloperTools'
import { Link } from '@tanstack/react-router'

export const Footer = () => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '0rem',
        left: '0',
        width: '100%',
        height: '5rem', // Increased height
        backgroundColor: 'var(--color-bg)',
        borderTop: '1px solid var(--color-bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <main style={{
        width: '100%',
        padding: '0 1rem',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly'
      }}>
        {/* Top Row: Legal & Site Links */}
        <section
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            fontSize: '0.85rem',
          }}
        >
          <Link to="/legal/terms" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>Terms of Service</Link>
          <Link to="/legal/privacy" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>Privacy Policy</Link>
          <Link to="/contact" style={{ textDecoration: 'none', color: 'var(--color-text)' }}>Contact</Link>
        </section>

        {/* Bottom Row: Tech Stack & Tools */}
        <section
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: 0.8,
          }}
        >
          <div>
            <p style={{ fontSize: '0.75rem', margin: 0 }}>
              Built with React, TanStack Start, Better-Auth and MVP.css
            </p>
          </div>

          <div style={{ transform: 'scale(0.9)' }}>
            <DeveloperTools
              detailItemsStyleAttribute={{
                position: 'absolute',
                bottom: '100%', // Open upwards
                left: '21%',
              }}
            />
          </div>

          <div>
            <a
              style={{
                fontSize: '0.75rem',
                textWrap: 'nowrap',
                fontWeight: '400',
                textDecoration: 'none',
              }}
              href="https://www.flaticon.com/free-icons/ecology"
              title="landscape icons"
            >
              Ecology icon by Maan Icons
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}