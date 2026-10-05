import type { TicketPanel } from '../types/ticket.js';
import type { SqliteDatabase } from './connection.js';

interface PanelRow {
  guild_id: string;
  channel_id: string;
  message_id: string;
  updated_at: string;
}

function prepareStatements(db: SqliteDatabase) {
  return {
    find: db.prepare<[string], PanelRow>('SELECT * FROM ticket_panels WHERE guild_id = ?'),
    upsert: db.prepare<PanelRow>(
      `INSERT INTO ticket_panels (guild_id, channel_id, message_id, updated_at)
       VALUES (@guild_id, @channel_id, @message_id, @updated_at)
       ON CONFLICT (guild_id) DO UPDATE SET
         channel_id = excluded.channel_id,
         message_id = excluded.message_id,
         updated_at = excluded.updated_at`,
    ),
    remove: db.prepare<[string]>('DELETE FROM ticket_panels WHERE guild_id = ?'),
  };
}

/** Guarda qué mensaje es el panel de tickets para no publicarlo dos veces. */
export class PanelRepository {
  private readonly statements: ReturnType<typeof prepareStatements>;

  constructor(db: SqliteDatabase) {
    this.statements = prepareStatements(db);
  }

  find(guildId: string): TicketPanel | undefined {
    const row = this.statements.find.get(guildId);
    if (!row) return undefined;
    return {
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      updatedAt: row.updated_at,
    };
  }

  save(panel: TicketPanel): void {
    this.statements.upsert.run({
      guild_id: panel.guildId,
      channel_id: panel.channelId,
      message_id: panel.messageId,
      updated_at: panel.updatedAt,
    });
  }

  remove(guildId: string): void {
    this.statements.remove.run(guildId);
  }
}
