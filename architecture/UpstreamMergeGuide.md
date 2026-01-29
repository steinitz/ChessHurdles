# Upstream Merge Guide: Lessons Learned

Merging the `TanStackStartBetterAuth` upstream into `ChessHurdles` revealed several non-obvious pitfalls. Follow these safeguards for future merges.

## 1. The Phantom Server Problem
**Issue**: Port 3000 was being hijacked by a dev server running in the *upstream* directory, causing the browser to show template content despite the project files being correct.
**Safeguard**: 
- Before starting a merge, ensure no other Vite/TanStack Start processes are running.
- Use `lsof -i :3000` to verify which PID and directory are controlling the port.
- Kill any conflicting processes: `kill <PID>`.

## 2. Database Corruption & Local Driver
**Issue**: The upstream attempted to switch the driver to Turso/LibSQL, while we require `better-sqlite3`. Additionally, active WAL files during the merge caused `database disk image is malformed`.
**Safeguard**:
- **Protect `database.ts`**: Manually verify `stzUser/lib/database.ts` after the merge. Restore our `SqliteDialect` and `better-sqlite3` import.
- **Clean Slate**: Delete `local.db`, `local.db-shm`, and `local.db-wal` before running tests.
- **Recovery**: If `sqlite.db` is malformed, use `sqlite3 sqlite.db ".recover" | sqlite3 sqlite_recovered.db`.

## 3. Persistent Caches
**Issue**: Even after matching disk content perfectly, the UI may lag behind due to deep TanStack/Nitro caches.
**Safeguard**: 
- Delete the following directories if UI discrepancies persist:
  ```bash
  rm -rf .nitro .output .tanstack node_modules/.vite
  ```
- Regenerate routes immediately: `pnpm dlx @tanstack/router-cli generate --path ./src`.

## 4. Conflict Resolution Strategy
- **`stzUser` / `stzUtils`**: These are "foundation" folders. Lean towards **UPSTREAM** to get new features/security fixes, but *always* revert the database driver changes.
- **`src/`**: These are your application files. Lean towards **LOCAL** and manually integrate upstream components (like `Pricing.tsx` or refined legal links) into our layouts.
- **Admin**: The new upstream `/admin` route is the correct home for developer tools. Merge local logic (e.g., "Save Sample Game") into `src/routes/admin.tsx`.
