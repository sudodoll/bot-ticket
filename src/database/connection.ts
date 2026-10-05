import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

export type SqliteDatabase = Database.Database;

export function openDatabase(filePath: string): SqliteDatabase {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const db = new Database(filePath);
  // WAL: lecturas y escrituras concurrentes seguras. FULL: cada commit queda en disco aunque se corte la luz.
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  logger.info('DB', `Base de datos SQLite abierta en ${filePath}`);
  return db;
}

export function closeDatabase(db: SqliteDatabase): void {
  if (!db.open) return;
  db.close();
  logger.info('DB', 'Conexión a SQLite cerrada.');
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Database.SqliteError && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}
