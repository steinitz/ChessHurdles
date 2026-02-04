# Agent Project Context & Protocols

## 🎨 Layout & UI
- **HUD Layout**: "Aligned Vertical Sandwich" in `PlayVsEngine.tsx`. Rows must match board `width` with `space-between` justification.
- **Styling**: `mvp.css` + inline flexbox. **NO TAILWIND** unless explicitly requested.

## ⚠️ Development Gotchas
- **package.json**: Avoid single quotes in script names.
- **Netlify**: No automatic pushes. User handles deployment.

## 🧪 Testing State
- **Browser**: User uses Brave (`localhost:3000`).
- **Agent**: Use Chrome DevTools.

## 📚 References
- **Architecture Docs**: See `architecture/` folder.
- **Scratchpad**: See `architecture/notes.md`.

## 💬 Communication Protocols
- **Explicit Verification**: Never assume approval. The default answer to "should I proceed" is NO. Stop, present the state, and wait for explicit user direction.
- **Questions != Approval**: A user question (e.g., "What about X?") is NEVER permission to execute code. It is a request for information only.
- **Engagement**: When pausing, ask open-ended questions about high-value improvements or strategic considerations.
- **Signal-to-Noise**: Avoid trivial suggestions just to fill space. Only suggest improvements if they are "low hanging fruit" with clear value.