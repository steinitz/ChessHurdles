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
- **OCD APPROVAL**: Every single file change must be preceded by a specific approval for that specific change set. Approval keywords: `Approved`, `Go ahead`, or `Proceed`.
- **AGENTIC REASONING PROTOCOL**:
    1.  **Macro-Planning**: For complex features or multi-session work, create/update `implementation_plan.md`.
    2.  **Micro-Planning**:
        - **Formal**: Use `implementation_plan.md` for logic-heavy or interconnected changes.
        - **Informal**: For minor/obvious fixes, propose the plan and potential diff directly in chat. **You still MUST wait for a keyword before writing any files.**
    3.  **Vigilance**: Resist "early implementation." Focus on refining the plan until the user signals the transition to execution.
    4.  **Preservation**: `reference/Temp Implementation/` is READ-ONLY for the assistant.
    5.  **Persistence**: Formal design artifacts (`implementation_plan.md`, `task.md`) must be preserved across sessions unless explicitly abandoned.

npm is disabled. Use pnpm.

"the user"'s name is Steve