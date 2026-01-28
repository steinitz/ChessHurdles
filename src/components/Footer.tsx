import { clientEnv } from '~stzUser/lib/env'
import { useSession } from '~stzUser/lib/auth-client'
import { userRoles } from '~stzUser/constants'
import { Link } from '@tanstack/react-router'
import {
  AboutLink,
  AcknowledgementsLink,
  ContactLink,
  PrivacyLink,
  RefundsLink,
  TermsLink
} from '~stzUser/components/Legal/Links'

export const Footer = () => {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === userRoles.admin

  const currentYear = new Date().getFullYear()
  const copyrightYear = clientEnv.COPYRIGHT_START_YEAR === currentYear.toString()
    ? currentYear
    : `${clientEnv.COPYRIGHT_START_YEAR}-${currentYear}`

  return (
    <footer
      style={{
        width: '100%',
        backgroundColor: 'var(--color-bg)',
        borderTop: '1px solid var(--color-bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem 0',
        marginTop: '2rem',
      }}
    >
      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        {/* Row 1: Site Information & Interaction */}
        <section
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            gap: '1.5rem',
            fontSize: '0.85rem',
          }}
        >
          <ContactLink />
          <AcknowledgementsLink />
          <AboutLink />
        </section>

        {/* Row 2: Legal & Copyright */}
        <section
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            opacity: 0.8,
          }}
        >
          <div style={{ display: 'flex', gap: '1rem' }}>
            <TermsLink />
            <RefundsLink />
            <PrivacyLink />
            <span>Copyright © {copyrightYear} {clientEnv.COMPANY_NAME}. All Rights Reserved.</span>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link to="/admin" style={{ color: 'inherit', textDecoration: 'underline' }}>
                Admin Tools
              </Link>
            </div>
          )}
        </section>
      </div>
    </footer>
  )
}