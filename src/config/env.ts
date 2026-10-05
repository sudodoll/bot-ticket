import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** Carpeta raíz del proyecto (sirve tanto desde src/config como desde dist/config). */
export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const TOKEN_PATTERN = /^[\w-]+\.[\w-]+\.[\w-]+$/;

export interface DeployConfig {
  readonly token: string;
  readonly clientId: string;
  readonly guildId: string;
}

export interface BotConfig extends DeployConfig {
  readonly ticketChannelId: string;
  readonly ticketsCategoryId: string;
  readonly supportRoleId: string;
  readonly enablePresenceIntent: boolean;
  readonly maxTicketsPerAgent: number;
  readonly closeDelayMs: number;
  readonly databasePath: string;
}

export class ConfigError extends Error {
  constructor(public readonly problems: readonly string[]) {
    super(`Configuración inválida:\n${problems.map((problem) => `  • ${problem}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

/** Lee variables de entorno acumulando todos los problemas para informarlos juntos. */
class EnvReader {
  readonly problems: string[] = [];

  private raw(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
  }

  token(name: string): string {
    const value = this.raw(name);
    if (!value) {
      this.problems.push(`${name} es obligatorio (token del bot en el Developer Portal → Bot).`);
      return '';
    }
    if (!TOKEN_PATTERN.test(value)) {
      this.problems.push(`${name} no tiene el formato de un token de bot de Discord.`);
    }
    return value;
  }

  snowflake(name: string): string {
    const value = this.raw(name);
    if (!value) {
      this.problems.push(`${name} es obligatorio.`);
      return '';
    }
    if (!SNOWFLAKE_PATTERN.test(value)) {
      this.problems.push(`${name} debe ser un ID numérico de Discord (17 a 20 dígitos). Valor recibido: "${value}".`);
    }
    return value;
  }

  boolean(name: string, defaultValue: boolean): boolean {
    const value = this.raw(name)?.toLowerCase();
    if (value === undefined) return defaultValue;
    if (['true', '1', 'yes', 'si', 'sí'].includes(value)) return true;
    if (['false', '0', 'no'].includes(value)) return false;
    this.problems.push(`${name} debe ser "true" o "false". Valor recibido: "${value}".`);
    return defaultValue;
  }

  integer(name: string, defaultValue: number, min: number, max: number): number {
    const value = this.raw(name);
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      this.problems.push(`${name} debe ser un número entero entre ${min} y ${max}. Valor recibido: "${value}".`);
      return defaultValue;
    }
    return parsed;
  }

  filePath(name: string, defaultValue: string): string {
    return path.resolve(PROJECT_ROOT, this.raw(name) ?? defaultValue);
  }

  assertValid(): void {
    if (this.problems.length > 0) throw new ConfigError(this.problems);
  }
}

function readDeployConfig(reader: EnvReader): DeployConfig {
  return {
    token: reader.token('DISCORD_TOKEN'),
    clientId: reader.snowflake('CLIENT_ID'),
    guildId: reader.snowflake('GUILD_ID'),
  };
}

/** Configuración mínima para registrar slash commands. */
export function loadDeployConfig(): DeployConfig {
  const reader = new EnvReader();
  const config = readDeployConfig(reader);
  reader.assertValid();
  return Object.freeze(config);
}

/** Configuración completa del bot. Lanza ConfigError si falta o es inválida alguna variable. */
export function loadBotConfig(): BotConfig {
  const reader = new EnvReader();
  const config: BotConfig = {
    ...readDeployConfig(reader),
    ticketChannelId: reader.snowflake('TICKET_CHANNEL_ID'),
    ticketsCategoryId: reader.snowflake('TICKETS_CATEGORY_ID'),
    supportRoleId: reader.snowflake('CUSTOMER_SUPPORT_ROLE_ID'),
    enablePresenceIntent: reader.boolean('ENABLE_PRESENCE_INTENT', false),
    maxTicketsPerAgent: reader.integer('MAX_TICKETS_PER_AGENT', 0, 0, 1000),
    closeDelayMs: reader.integer('TICKET_CLOSE_DELAY_SECONDS', 5, 1, 60) * 1000,
    databasePath: reader.filePath('DATABASE_PATH', 'data/tickets.sqlite'),
  };

  if (config.supportRoleId && config.supportRoleId === config.guildId) {
    reader.problems.push('CUSTOMER_SUPPORT_ROLE_ID no puede ser el rol @everyone (su ID coincide con GUILD_ID).');
  }

  reader.assertValid();
  return Object.freeze(config);
}
