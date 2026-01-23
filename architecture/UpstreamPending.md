# Upstream Pending Changes

This document tracks technical improvements identified during the development of ChessHurdles that should be merged back into the upstream `stzUser` / `stzUtils` templates.

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
