import { Link, useNavigate } from '@tanstack/react-router'
import { signOut, useSession } from '~stzUser/lib/auth-client'
import { routeStrings } from "~/constants";
import { activeLinkStyle } from "~stzUtils/components/styles";
import { WalletWidget } from './WalletWidget'


/*
const loggedInTextTopMarginTweak = 21

export const adjustVerticalLocationStyle = (fineAdjustment = 0) => {
  // Decommissioned tweak - messes with the whole header alignment
  return {
    marginTop: `${loggedInTextTopMarginTweak + (fineAdjustment || 0)}px`,
    marginBottom: `${loggedInTextTopMarginTweak * 2}px`,
  }
}
*/

export const navLinkStyle = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
}

export function UserBlock() {
  const navigate = useNavigate()
  const { data: session } = useSession()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        // not a good idea - messes with the whole header alignment ...adjustVerticalLocationStyle(1),
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginRight: '1rem',
        fontSize: '0.9rem',
      }}>
        <p style={{
          fontWeight: '200',
          margin: 0,
          opacity: 0.8
        }}
        >
          {session?.user.email}
        </p>
        <WalletWidget style={{
          whiteSpace: 'nowrap',
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link
          style={{ ...navLinkStyle, marginRight: '1rem' }}
          to={'/auth/profile'}
          activeProps={{
            style: { ...navLinkStyle, ...activeLinkStyle, marginRight: '1rem' }
          }}
        >
          Profile
        </Link>
      </div>
      {
        session?.user ?
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Link
              onClick={() => {
                signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      navigate({ to: routeStrings.signin })
                    },
                  },
                })
              }}
              style={navLinkStyle}
              to={routeStrings.signin}
            >
              Sign Out
            </Link>
          </div>
          :
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Link
              to={routeStrings.signin}
              style={navLinkStyle}
              activeProps={{
                style: { ...navLinkStyle, ...activeLinkStyle }
              }}
            >
              Sign In
            </Link>
          </div>
      }
    </div>
  )
}
