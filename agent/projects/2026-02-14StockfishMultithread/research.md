# Stockfish Multi-threaded Upgrade Research

## Project Context
Previous attempt (different LLM): rolled back hundreds of changes after upgrade failed catastrophically. Two main issues identified:
1. **CORS requirements**: Multi-threading either requires adding or removing CORS (need to verify which)
2. **Multi-part installation**: Multi-threaded Stockfish binary is large and split into parts, making installation/running complex

## Development Strategy
**Approach**: Feature branch + incremental development over weeks
- Create dedicated `feature/stockfish-multithread` branch
- Allows aggressive experimentation without risking main branch
- Can run side-by-side testing (checkout main vs feature to compare)
- Merge only when fully validated and proven stable
- **pnpm advantage**: Easy switching between branches with different `package.json` configs
  - `pnpm install` handles dependency differences cleanly
  - No need to clear `node_modules` between checkouts

## Initial Reconnaissance Notes (2026-02-14 02:07:48)

### Known Challenges
- **CORS Configuration**: Multi-threaded web workers have different origin/header requirements than single-threaded
  - Current implementation uses single-threaded Stockfish WASM
  - Multi-threaded version requires SharedArrayBuffer, which has strict security requirements:
    - `Cross-Origin-Embedder-Policy: require-corp`
    - `Cross-Origin-Opener-Policy: same-origin`
  - Need to audit current CORS setup in Vite config and deployment (Netlify)
  
- **Binary Size and Loading**:
  - Multi-threaded Stockfish typically 10-20MB vs ~1-2MB for single-threaded
  - Often split into multiple files (.wasm + .worker.js + data files)
  - Need strategy for lazy loading / chunking to avoid massive bundle impact
  - Current location: `public/stockfish/` (need to verify exact structure)

- **Thread Management**:
  - Current single worker: simple postMessage interface
  - Multi-threaded: need to manage worker pool, thread count configuration
  - UX consideration: expose thread count setting? Auto-detect based on device?

### Research Questions
1. What's the current Stockfish version/source in use?
2. What are the exact CORS headers currently configured in Vite and Netlify?
3. What's the standard multi-threaded Stockfish.js integration pattern?
4. Can we use stockfish.wasm from npm or do we need manual WASM files?
5. What's the performance benefit for our use case (analysis depth/speed)?

### Protocol Reminders
From the 2am debugging post-mortem: this is NOT a surgical fix. Multiple files, configuration changes, external dependencies. Full planning protocol required:
1. Comprehensive research phase
2. Formal `implementation_plan.md` with:
   - Explicit CORS changes documented
   - Binary loading strategy
   - Rollback plan if things go wrong
   - Test criteria before considering "done"
3. Explicit approval before touching any config or code
4. Incremental verification at each step

### Performance Benchmarks
**Lichess reference** (2026-02-14): 
- Runs multi-threaded Stockfish in browser
- Achieves depth 30 in reasonable time
- Performance comparable to native engines
- Proof that browser-based multi-threading is viable and fast

**Current ChessHurdles baseline**: TBD (need to measure)

### Success Criteria
- [ ] Multi-threaded Stockfish loads and responds to UCI commands
- [ ] No CORS errors in browser console
- [ ] Analysis performance measurably improved (benchmark current vs new)
- [ ] No bundle size regression (lazy loading works)
- [ ] All existing Stockfish integration tests pass
- [ ] Clean rollback path documented if needed

### References to Gather
- [ ] Stockfish.js multi-threaded documentation
- [ ] SharedArrayBuffer security requirements (MDN)
- [ ] Current ChessHurdles Stockfish integration code
- [ ] Vite CORS configuration options
- [ ] Netlify header configuration for SharedArrayBuffer
