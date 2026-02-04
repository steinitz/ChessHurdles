# Project Technical Notes

## 🎨 Layout & UI
- **HUD Layout**: "Aligned Vertical Sandwich" in [PlayVsEngine.tsx](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/src/components/PlayVsEngine/PlayVsEngine.tsx). Rows must match board `width` with `space-between` justification to guarantee strict vertical clock alignment.
- **Minimal Styling**: Rely on [mvp.css](file:///Users/steinitz/Documents/Projects/Web/Chess/ChessHurdles/ChessHurdles/reference/mvp.css). 
- **Strictly No Tailwind**: Strip Tailwind classes from components. Use inline CSS flexbox only for board-relative layout logic.

## 🔑 Authentication
- **Password Change**: Implemented in `Profile.tsx` using `PasswordInput`.

## ⚠️ Development Gotchas
- **package.json**: Avoid single quotes in script names.

{
  "contents": [...],
  "generationConfig": {
    "temperature": 0.8
  }
}

To run the dev server in https, after starting the dev server use this command
ssh -p 443 -R0:localhost:3000 qr@free.pinggy.io
then add the resulting url to vite.config.ts server.allowedHosts

## 📚 Reference Material
- **External Code**: `reference/Upstream` contains a symlink to the `TanStackStartBetterAuth` repository.
- **Reference Folder**: `reference/` contains external git repos and notes.

## 🚀 Deployment
- **No Automatic Pushes**: Do NOT push to remote. User handles pushes to manage Netlify limits.

Google Gemini's Pricing Ideas:

Avoid min purchase being less than the Stripe min of $0.50

DAILY_GRANT: 10 credits ($0.10 value).
DEFAULT_PURCHASE: 500 credits ($5.00 value).
