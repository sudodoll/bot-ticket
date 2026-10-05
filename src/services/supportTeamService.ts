import { PermissionFlagsBits, RESTJSONErrorCodes, type Guild, type GuildMember, type PresenceStatus, type Role } from 'discord.js';
import type { BotConfig } from '../config/env.js';
import { Timings } from '../config/constants.js';
import type { ModeratorCandidate } from '../types/ticket.js';
import { isDiscordApiError } from '../utils/discordErrors.js';
import { logger } from '../utils/logger.js';

const PRESENCE_RANK: Partial<Record<PresenceStatus, number>> = {
  online: 0,
  idle: 1,
  dnd: 2,
};

const MISSING_ROLE_WARNING_GAP_MS = 10 * 60_000;

/** Conoce a los miembros del rol "Atención al Cliente" y su disponibilidad. */
export class SupportTeamService {
  private lastFullFetchAt = 0;
  private inFlightFetch: Promise<boolean> | null = null;
  private lastMissingRoleWarningAt = 0;

  constructor(private readonly config: BotConfig) {}

  getRole(guild: Guild): Role | null {
    return guild.roles.cache.get(this.config.supportRoleId) ?? null;
  }

  isSupportAgent(member: GuildMember): boolean {
    return !member.user.bot && member.roles.cache.has(this.config.supportRoleId);
  }

  /**
   * Agentes que pueden recibir un ticket ahora mismo (sin bots).
   * Con el intent de presencia activo, solo cuenta a quienes están conectados.
   */
  getAvailableCandidates(guild: Guild): ModeratorCandidate[] {
    const role = this.getRole(guild);
    if (!role) {
      this.warnMissingRole();
      return [];
    }

    const candidates: ModeratorCandidate[] = [];
    for (const member of role.members.values()) {
      if (member.user.bot) continue;
      const presenceRank = this.presenceRank(member);
      if (presenceRank !== null) candidates.push({ id: member.id, presenceRank });
    }
    return candidates;
  }

  /**
   * Descarga la lista completa de miembros (y presencias) a la caché.
   * Discord limita este pedido, por eso se evita repetirlo seguido salvo que se fuerce.
   */
  async refreshMembers(guild: Guild, force = false): Promise<boolean> {
    if (this.inFlightFetch) return this.inFlightFetch;
    if (!force && Date.now() - this.lastFullFetchAt < Timings.MemberRefreshMinGapMs) return true;

    this.inFlightFetch = this.fetchAllMembers(guild).finally(() => {
      this.inFlightFetch = null;
    });
    return this.inFlightFetch;
  }

  /** true = está en el servidor · false = Discord confirma que no está · null = no se pudo verificar. */
  async memberExists(guild: Guild, userId: string): Promise<boolean | null> {
    if (guild.members.cache.has(userId)) return true;
    try {
      await guild.members.fetch({ user: userId, force: true });
      return true;
    } catch (error) {
      if (isDiscordApiError(error, RESTJSONErrorCodes.UnknownMember, RESTJSONErrorCodes.UnknownUser)) return false;
      logger.warn('TEAM', `No se pudo verificar si el usuario ${userId} sigue en el servidor.`, error);
      return null;
    }
  }

  /** Problemas de configuración del equipo, para mostrarlos al iniciar y en /setup-tickets. */
  diagnose(guild: Guild): string[] {
    const role = this.getRole(guild);
    if (!role) {
      return ['El rol de Atención al Cliente (CUSTOMER_SUPPORT_ROLE_ID) no existe: los tickets nuevos quedarán en espera.'];
    }

    const problems: string[] = [];
    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
      problems.push(
        `El rol ${role.name} tiene permiso de Administrador: sus miembros podrán ver todos los tickets. Quitale ese permiso.`,
      );
    }
    if (!role.members.some((member) => !member.user.bot)) {
      problems.push(`El rol ${role.name} no tiene miembros: los tickets quedarán en espera hasta que alguien lo tenga.`);
    }
    return problems;
  }

  private presenceRank(member: GuildMember): number | null {
    // Sin el intent de presencia no hay forma de saber quién está conectado: todos cuentan igual.
    if (!this.config.enablePresenceIntent) return 0;
    const status = member.presence?.status;
    if (status === undefined) return null;
    return PRESENCE_RANK[status] ?? null;
  }

  private async fetchAllMembers(guild: Guild): Promise<boolean> {
    try {
      const members = await guild.members.fetch({
        withPresences: this.config.enablePresenceIntent,
        time: Timings.MemberFetchTimeoutMs,
      });
      this.lastFullFetchAt = Date.now();
      const agents = this.getRole(guild)?.members.filter((member) => !member.user.bot).size ?? 0;
      logger.info('TEAM', `Miembros sincronizados: ${members.size}. Agentes de Atención al Cliente: ${agents}.`);
      return true;
    } catch (error) {
      logger.warn('TEAM', 'No se pudo descargar la lista de miembros; se usará la caché actual.', error);
      return false;
    }
  }

  private warnMissingRole(): void {
    if (Date.now() - this.lastMissingRoleWarningAt < MISSING_ROLE_WARNING_GAP_MS) return;
    this.lastMissingRoleWarningAt = Date.now();
    logger.warn(
      'TEAM',
      `El rol de Atención al Cliente (${this.config.supportRoleId}) no existe. Los tickets nuevos quedarán en espera.`,
    );
  }
}
