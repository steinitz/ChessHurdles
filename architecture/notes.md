# Project Technical Notes

## 🎨 Layout & UI
- **HUD Layout**: "Aligned Vertical Sandwich" in [PlayVsEngine.tsx](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx). Rows must match board `width` with `space-between` justification to guarantee strict vertical clock alignment.
- **Minimal Styling**: Rely on [mvp.css](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/reference/mvp.css). 
- **Strictly No Tailwind**: Strip Tailwind classes from components. Use inline CSS flexbox only for board-relative layout logic.

## 🔑 Authentication
- **Password Change**: Implemented in `Profile.tsx` using `PasswordInput`.

## ⚠️ Development Gotchas
- **package.json**: Avoid single quotes in script names.
