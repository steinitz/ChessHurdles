# Upstream Merge Notes

This document contains specific instructions for merging changes from this upstream repository (`TanStackStartBetterAuth`) into downstream projects (e.g., `ChessHurdles`).

## Pending Merge: Header Alignment & Stub Page (Feb 1 2026)

When merging the recent header alignment fixes:

1.  **SAFE (Accept Upstream)**:
    -   `stzUser/**/*` (Includes the critical fix in `userBlock.tsx` removing `adjustVerticalLocationStyle`).
    -   `stzUtils/**/*` (Includes the `activeLinkStyle` export).

2.  **MANUAL INTERVENTION REQUIRED**:
    -   `src/components/Header.tsx`: **DO NOT ACCEPT UPSTREAM**.
        -   The downstream file has custom navigation (e.g., "Play vs Computer").
        -   **Action**: Manually apply the fix:
            -   Insert a `<Spacer orientation="horizontal" />` between the Logo and your custom link(s) to center them.
            -   Apply `activeProps={{ style: { ...navLinkStyle, ...activeLinkStyle } }}` to your custom links.

3.  **IGNORE/DELETE**:
    -   `src/routes/other.tsx`: This is a purely testing stub in upstream. Do not merge or keep it.
