import type { ModeratorCandidate, ModeratorWorkload } from '../types/ticket.js';

interface RankedCandidate extends ModeratorCandidate {
  readonly openTickets: number;
  readonly lastAssignedAt: string | null;
}

function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (a.presenceRank !== b.presenceRank) return a.presenceRank - b.presenceRank;
  if (a.openTickets !== b.openTickets) return a.openTickets - b.openTickets;
  // Round-robin: primero quien nunca recibió un ticket o hace más tiempo que no recibe uno.
  if (a.lastAssignedAt !== b.lastAssignedAt) {
    if (a.lastAssignedAt === null) return -1;
    if (b.lastAssignedAt === null) return 1;
    return a.lastAssignedAt < b.lastAssignedAt ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Elige qué agente recibe el próximo ticket:
 *   1. mejor presencia (en línea → ausente → no molestar),
 *   2. menos tickets abiertos,
 *   3. el que hace más tiempo no recibe uno (round-robin).
 * Descarta a quienes alcanzaron el máximo de tickets simultáneos (0 = sin límite).
 */
export function pickModerator(
  candidates: readonly ModeratorCandidate[],
  workloads: ReadonlyMap<string, ModeratorWorkload>,
  maxTicketsPerAgent: number,
): string | null {
  const ranked = candidates
    .map((candidate): RankedCandidate => {
      const workload = workloads.get(candidate.id);
      return {
        ...candidate,
        openTickets: workload?.openTickets ?? 0,
        lastAssignedAt: workload?.lastAssignedAt ?? null,
      };
    })
    .filter((candidate) => maxTicketsPerAgent === 0 || candidate.openTickets < maxTicketsPerAgent)
    .sort(compareCandidates);

  return ranked[0]?.id ?? null;
}
