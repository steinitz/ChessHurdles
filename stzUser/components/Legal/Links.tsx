import React from 'react'
import { Link } from '@tanstack/react-router'
import { clientEnv } from '~stzUser/lib/env'

export const TermsLink = ({ label = 'Terms of Service', style = {} }) => (
  <Link to="/legal/terms" style={{ textDecoration: 'none', color: 'inherit', ...style }}>
    {label}
  </Link>
)

export const PrivacyLink = ({ label = 'Privacy Policy', style = {} }) => (
  <Link to="/legal/privacy" style={{ textDecoration: 'none', color: 'inherit', ...style }}>
    {label}
  </Link>
)

export const ContactLink = ({ label = clientEnv.SUPPORT_LINK_TEXT, style = {} }) => (
  <Link to={clientEnv.SUPPORT_LINK_URL} style={{ textDecoration: 'none', color: 'inherit', ...style }}>
    {label}
  </Link>
)

export const RefundsLink = ({ label = 'Refund Policy', style = {} }) => (
  <Link to={clientEnv.REFUND_POLICY_URL || '/legal/refunds'} style={{ textDecoration: 'none', color: 'inherit', ...style }}>
    {label}
  </Link>
)

export const AboutLink = ({ label = 'About', style = {} }) => (
  <Link to="/legal/about" style={{ textDecoration: 'none', color: 'inherit', ...style }}>
    {label}
  </Link>
)

export const AcknowledgementsLink = ({ label = 'Acknowledgements', style = {} }) => (
  <Link to="/legal/acknowledgements" style={{ textDecoration: 'none', color: 'inherit', ...style }}>
    {label}
  </Link>
)

export const LegalLinksBundle = ({ separator = ' | ', style = {} }) => (
  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', ...style }}>
    <TermsLink />
    {separator}
    <RefundsLink />
    {separator}
    <PrivacyLink />
  </div>
)
