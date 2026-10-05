import { DiscordAPIError } from 'discord.js';

export type LogTag =
  | 'READY'
  | 'TICKET'
  | 'COMMAND'
  | 'BUTTON'
  | 'PANEL'
  | 'TEAM'
  | 'DB'
  | 'RECOVERY'
  | 'CONFIG'
  | 'DISCORD'
  | 'EVENT'
  | 'PROCESS'
  | 'SHUTDOWN'
  | 'DEPLOY';

function timestamp(): string {
  const now = new Date();
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function describeError(error: unknown): string {
  if (error instanceof DiscordAPIError) {
    return `DiscordAPIError ${error.code} (HTTP ${error.status}) en ${error.method.toUpperCase()} ${error.url}: ${error.message}`;
  }
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}

function withDetails(message: string, error: unknown): string {
  return error === undefined ? message : `${message}\n    ↳ ${describeError(error)}`;
}

export const logger = {
  info(tag: LogTag, message: string): void {
    console.log(`${timestamp()} [${tag}] ${message}`);
  },
  warn(tag: LogTag, message: string, error?: unknown): void {
    console.warn(`${timestamp()} [WARN] [${tag}] ${withDetails(message, error)}`);
  },
  error(tag: LogTag, message: string, error?: unknown): void {
    console.error(`${timestamp()} [ERROR] [${tag}] ${withDetails(message, error)}`);
  },
};
