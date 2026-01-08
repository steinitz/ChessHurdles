# PlayVsEngine Refinement Plan (Tomorrow)

## Objective
Finalize the "Aligned Vertical Sandwich" HUD and clean up all non-functional styling.

## 1. HUD Structural Changes
Restructure `PlayVsEngine.tsx` to use two horizontal flex rows tied to the 60vh board width:
- **Top Row**: Engine Name/Level (Left) and Engine Clock (Right).
- **Center**: ChessBoard (as before).
- **Bottom Row**: Action Buttons (Left) and User Clock (Right).
- All items in the rows will use `justify-content: space-between` to ensure clocks are strictly vertically aligned on the right.

## 2. Confirmation Modals
- Replace existing `abandon` and `resign` local state/overlays with `stzUtils/components/Dialog.tsx`.
- Use `makeDialogRef()` for cleaner control.
- Style the "Yes" buttons in these dialogs with `var(--color-error)` (red) for destructive signaling.

## 3. [DONE] Zombie Tailwind Removal 🧟
- [x] Strip every single `className` containing Tailwind classes from `PlayVsEngine.tsx`.
- [ ] Replace necessary layouts with standard inline CSS (flexbox) to match the desired spacing (Next Step).
- [x] Ensure HUD buttons stay their default `mvp.css` blue.

## 4. Verification
- [x] `pnpm run typecheck`
- [ ] Manual check of alignment at different viewport sizes (Pending layout refactor).
