import {Link} from "@tanstack/react-router";
import {UserBlock, navLinkStyle} from "~stzUser/components/Other/userBlock";
import {Spacer} from "~stzUtils/components/Spacer";

export const Header = () => {

  return(
    <section
      style={{
        display: 'flex',
        width: '100%',
        backgroundColor: 'var(--color-bg)',
        flexDirection: 'row',
        marginBottom: '-13px',
      }}
    >
      <Link
        style={{
          marginRight: '21px',
        }}
        to="/"
      >
        <img
          style={{
            width: '55px',
            height: '55px',
          }}
          src="/logo.png"
          alt="logo"
        />
      </Link>
      {/* New Games link placed just to the right of the logo */}
      <Link
        to="/auth/games"
        style={navLinkStyle}
        activeProps={{
          style: {
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg)',
          },
        }}
      >
        Games
      </Link>
      <Spacer orientation={'horizontal'} space={1}/>
      <Link
        to="/contact"
        style={navLinkStyle}
        activeProps={{
          style: {
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg)',
          },
        }}
      >
        Contact
      </Link>
      <UserBlock/>
    </section>
  )
}