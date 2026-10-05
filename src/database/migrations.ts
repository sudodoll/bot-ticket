import { logger } from '../utils/logger.js';
import type { SqliteDatabase } from './connection.js';

interface Migration {
  readonly version: number;
  readonly description: string;
  readonly sql: string;
}

/**
 * Migraciones en orden. La versión aplicada se guarda en PRAGMA user_version,
 * así el esquema se crea automáticamente y puede evolucionar sin perder datos.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Esquema inicial: tickets, contador y panel',
    sql: `
      CREATE TABLE IF NOT EXISTS counters (
        name  TEXT    PRIMARY KEY,
        value INTEGER NOT NULL CHECK (value >= 0)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS tickets (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number INTEGER NOT NULL UNIQUE CHECK (ticket_number > 0),
        guild_id      TEXT    NOT NULL,
        channel_id    TEXT    UNIQUE,
        customer_id   TEXT    NOT NULL,
        moderator_id  TEXT,
        status        TEXT    NOT NULL CHECK (status IN ('open', 'waiting', 'closed')),
        created_at    TEXT    NOT NULL,
        assigned_at   TEXT,
        closed_at     TEXT,
        closed_by     TEXT,
        close_reason  TEXT    CHECK (close_reason IN (
                                'closed_by_user', 'customer_left', 'channel_deleted',
                                'creation_failed', 'creation_interrupted')),
        -- Un ticket abierto siempre tiene agente; uno en espera nunca.
        CHECK (status <> 'open' OR moderator_id IS NOT NULL),
        CHECK (status <> 'waiting' OR moderator_id IS NULL),
        -- Solo los tickets cerrados tienen fecha y motivo de cierre.
        CHECK ((status = 'closed') = (closed_at IS NOT NULL AND close_reason IS NOT NULL))
      ) STRICT;

      -- Como máximo un ticket abierto/en espera por usuario y servidor (protege contra doble clic).
      CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_one_active_per_customer
        ON tickets (guild_id, customer_id)
        WHERE status IN ('open', 'waiting');

      CREATE INDEX IF NOT EXISTS ix_tickets_guild_status
        ON tickets (guild_id, status, ticket_number);

      CREATE INDEX IF NOT EXISTS ix_tickets_guild_moderator
        ON tickets (guild_id, moderator_id, status);

      CREATE TABLE IF NOT EXISTS ticket_panels (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      INSERT OR IGNORE INTO counters (name, value) VALUES ('ticket_number', 0);
    `,
  },
];

function currentVersion(db: SqliteDatabase): number {
  const version: unknown = db.pragma('user_version', { simple: true });
  return typeof version === 'number' ? version : 0;
}

export function runMigrations(db: SqliteDatabase): void {
  const applied = currentVersion(db);
  const pending = MIGRATIONS.filter((migration) => migration.version > applied);

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    }).immediate();
    logger.info('DB', `Migración ${migration.version} aplicada: ${migration.description}`);
  }

  logger.info('DB', `Esquema de base de datos en la versión ${currentVersion(db)}.`);
}
