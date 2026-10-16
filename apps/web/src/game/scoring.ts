import type { EventResult, GameEvent, Placements, Team, TeamId } from './types';

/**
 * Points for standard competition ranking (1,2,2,4). Teams sharing a rank split
 * the points of the places they occupy, so a tie for 2nd between two teams gives
 * each (points[1] + points[2]) / 2.
 */
export function pointsForPlacements(placements: Placements, points: number[]): Record<TeamId, number> {
  const out: Record<TeamId, number> = {};
  const ranks = Object.values(placements);
  for (const [teamId, rank] of Object.entries(placements)) {
    const tied = ranks.filter((r) => r === rank).length;
    let sum = 0;
    for (let place = rank; place < rank + tied; place++) {
      sum += points[place - 1] ?? 0;
    }
    out[teamId] = Math.round((sum / tied) * 10) / 10;
  }
  return out;
}

export function buildResult(
  event: GameEvent,
  teams: Team[],
  input: { placements?: Placements; loser?: TeamId; hits?: TeamId[]; adjust?: Record<TeamId, number>; note?: string },
): EventResult {
  const points: Record<TeamId, number> = {};
  for (const t of teams) points[t.id] = 0;

  if (event.kind === 'six') {
    if (input.loser) points[input.loser] = -Math.abs(event.penalty);
    return { eventId: event.id, loser: input.loser, points, note: input.note };
  }

  if (event.kind === 'wheel') {
    const hits = input.hits ?? [];
    for (const id of hits) points[id] = event.points[0] ?? 0;
    return { eventId: event.id, hits, points, note: input.note };
  }

  const placements = input.placements ?? {};
  Object.assign(points, pointsForPlacements(placements, event.points));
  const adjust = input.adjust && Object.values(input.adjust).some((v) => v !== 0) ? input.adjust : undefined;
  if (adjust) {
    for (const [id, delta] of Object.entries(adjust)) points[id] = Math.round(((points[id] ?? 0) + delta) * 10) / 10;
  }
  return { eventId: event.id, placements, points, adjust, note: input.note };
}

export function totals(teams: Team[], results: EventResult[]): Record<TeamId, number> {
  const out: Record<TeamId, number> = {};
  for (const t of teams) out[t.id] = 0;
  for (const r of results) {
    for (const [id, p] of Object.entries(r.points)) out[id] = (out[id] ?? 0) + p;
  }
  return out;
}

/** Teams ordered by total points; ties keep the current order. */
export function standings(teams: Team[], results: EventResult[]): { team: Team; total: number; rank: number }[] {
  const t = totals(teams, results);
  const sorted = [...teams].sort((a, b) => t[b.id] - t[a.id]);
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((team, i) => {
    if (prev === null || t[team.id] !== prev) rank = i + 1;
    prev = t[team.id];
    return { team, total: t[team.id], rank };
  });
}

/** Convert an ordered list (best first) to placements; groups express ties. */
export function placementsFromGroups(groups: TeamId[][]): Placements {
  const out: Placements = {};
  let place = 1;
  for (const group of groups) {
    for (const id of group) out[id] = place;
    place += group.length;
  }
  return out;
}
