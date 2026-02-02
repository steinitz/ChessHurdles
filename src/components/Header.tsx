import { Link } from "@tanstack/react-router";
import { UserBlock, navLinkStyle } from "~stzUser/components/Other/userBlock";
import { Spacer } from "~stzUtils/components/Spacer";
import { activeLinkStyle } from "~stzUtils/components/styles";

export const Header = () => {

  return (
    <section
      style={{
        display: 'flex',
        width: '100%',
        backgroundColor: 'var(--color-bg)',
        flexDirection: 'row',
        marginBottom: '-13px',
        alignItems: 'center',
        justifyContent: 'space-between',
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
      <Spacer orientation={'horizontal'} space={1} />
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
      <Spacer orientation={'horizontal'} space={1} />
      <Link
        to="/play"
        style={navLinkStyle}
        activeProps={{ style: { ...navLinkStyle, ...activeLinkStyle } }}
      >
        Computer
      </Link>
      <Spacer orientation={'horizontal'} space={1} />
      <Link
        to="/contact"
        style={navLinkStyle}
        activeProps={{ style: { ...navLinkStyle, ...activeLinkStyle } }}
      >
        Contact
      </Link>
      <Spacer orientation={'horizontal'} space={1} />
      <UserBlock />
    </section>
  )
}