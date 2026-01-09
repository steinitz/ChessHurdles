# Chess Hurdles: Deployment & Refinement Plan

## 1. Deployment Phase
- [ ] **Test Deploy to Railway**:
    - Build and verify production output.
    - Provision persistent volume for SQLite at `/data`.
    - Configure environment variables and verify persistence.
- [ ] **Domain & Email Setup**:
    - Acquire/Configure `chesshurdles.com`.
    - Set up a professional email address (e.g., `hello@chesshurdles.com`).
    - Note: Check Apple hosting domain availability/quota.

## 2. Completed Milestones (Review)
- [x] **HUD Layout**: "Aligned Vertical Sandwich" implemented in `PlayVsEngine.tsx`.
- [x] **Tailwind Purge**: Successfully stripped Tailwind from the primary play component. 🧟
- [x] **Clocks**: Vertical alignment strictly enforced.
- [x] **Modals**: Working custom confirmation overlays (centering verified).
