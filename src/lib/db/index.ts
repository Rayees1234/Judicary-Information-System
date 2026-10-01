import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  // Database location in the project's data directory
  const dbDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'jis_database.sqlite');
  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL and Foreign Keys for relational integrity and concurrent safety
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');

  // Run migrations/schema setup
  initSchema(dbInstance);

  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  // Check if users table exists
  const check = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!check) {
    const schemaPath = path.resolve(process.cwd(), 'src/lib/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(sql);
    }
  }
}
