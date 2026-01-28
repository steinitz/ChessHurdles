# Upstream Pending Changes

This document tracks technical improvements identified during the development of ChessHurdles that should be merged back into the upstream `stzUser` / `stzUtils` templates.

- **Admin Page Migration**: Successfully moved Developer Tools from a footer expansion to a dedicated, secure `/admin` route. Simplified `UserManagement` by removing redundant internal role checks.
- **Tech Stack Polish**: Refined `Acknowledgements.tsx` terminology for Vite, SQLite, and Google Gemini.

## Payment Compliance & Polish

### Stripe-Ready Foundation
To ensure smooth approval for direct Stripe accounts (and future MoRs), the foundation should include "boilerplate" that projects can easily customize.

**Proposed Change:**
- **Refine Legal Text**: Ensure `Terms.tsx` and `Privacy.tsx` have clear placeholders for Refund Policies and Contact Information.
- **Dynamic Contact Info**: Centralize contact email/address in `lib/env.ts` so it propagates to both Legal pages and the Footer automatically.
- **Pricing Visibility**: Add a simple, optional `Pricing` component to the foundation that satisfies Stripe's requirement for clear product descriptions.

## Component Extensibility

### UI Granularity
Currently, foundation elements like the Wallet Status and Legal Links are often bundled into larger components (e.g., `UserBlock`) or hardcoded in example application files. This makes it difficult for downstream projects to customize their placement or appearance without significant refactoring.

**Proposed Change:**
Extract granular, logic-wrapped components that downstream projects can import and place anywhere.

- **`WalletWidget`**: A standalone component (extracted from `UserBlock`) that handles its own data fetching via `getWalletStatus` and renders the allowance/credits badge.
- **`TermsLink` / `PrivacyLink` / `ContactLink`**: Simple wrappers around `@tanstack/react-router`'s `Link` that point to the correct foundation routes and provide consistent default labels.
- **`LegalLinksBundle`**: A small layout component that groups these links (useful for Footers).

This allows the application's `Header` and `Footer` to stay in `src/components` (for maximum layout control) while "plugging in" foundation-managed elements.

## Footer & Legal Compliance

### Bare-Bones Compliance Footer
To satisfy Stripe/Merchant compliance audits, the footer should prioritize low-friction access to contact and legal information over aesthetic flourishes.

**Proposed Change:**
- **Two-Row Layout**: A left-justified, two-row footer.
    - Row 1 (User Interaction): Contact | Acknowledgements | About.
    - Row 2 (Legal Compliance): Terms of Service | Refunds | Privacy Policy | Copyright.
- **Standalone Policy Pages**: Create audit-friendly URLs for compliance bots/auditors.
    - `About`: Mission, Legal Entity Name, Registered Address, Support Email.
    - `Acknowledgements`: Centralizes attributions (e.g., Flaticon) and tech stack nods (React, TanStack, etc.) to declutter the UI.
    - `Refunds`: Explicit policy on non-refundability for instantly consumed digital assets.
- **Implementation Strategy**:
    - **Deep Linking**: Link from Terms of Service directly to the standalone Refund Policy.
    - **Styling Constraints**: Use a minimalist "bare-bones" aesthetic (e.g., `0.75rem`, left-justified) to maintain professional neutrality for financial compliance.
    - **Extension Pattern**: Provide these as local components in `src/components/Legal/` initially, allowing downstream projects to "override" or customize them before they are eventually promoted to a shared upstream package.
