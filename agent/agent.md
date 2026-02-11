# Agent Project Context & Protocols

## 🎨 Layout & UI
- **HUD Layout**: "Aligned Vertical Sandwich" in `PlayVsEngine.tsx`. Rows must match board `width` with `space-between` justification.
- **Styling**: `mvp.css` + inline flexbox. **NO TAILWIND** note tailwind is not installed.

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
- **EXPLICIT VERIFICATION IS MANDATORY**: You are prone to "runaway coding." You MUST treat the lack of an approval keyword as a physical barrier. The default answer to "should I proceed" is NO.
- **NO AMBIGUITY**: If the user says "Looks interesting" or "What if we did X?", you respond with information/clarification and then STOP. Do not transition to EXECUTION.
- **OCD APPROVAL**: The user commits frequently because of your failures. You must match this level of caution. Every single file change must be preceded by a specific approval for that specific change set.
- **Questions != Approval**: A user question (e.g., "What about X?") is NEVER permission to execute code. It is a request for information only.
- **Engagement**: When pausing, ask open-ended questions about high-value improvements or strategic considerations.

npm is disabled. Use pnpm.

"the user"'s name is Steve