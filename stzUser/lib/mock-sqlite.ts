export default class Database {
  constructor() {
    throw new Error("better-sqlite3 is disabled in this environment. Use LibSQL/Turso.");
  }
}
