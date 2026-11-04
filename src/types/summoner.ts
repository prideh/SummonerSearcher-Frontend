import type { MatchDto } from './match';

export interface LeagueEntryDto {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface ChampionStats {
  championName: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  soloKills: number;
  winRate: number;
  kda: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  averageCsPerMinute: number;
  averageSoloKills: number;
  averageTurretPlates: number;
}

export interface SideStats {
  games: number;
  wins: number;
  winRate: number;
}

export interface AverageLaneCsAt10Summary {
  /** Average actual lane-only minions last-hit by 10:00 across eligible laner games with `laneMinionsFirst10Minutes`. */
  avgActual: number;
  /** Number of eligible laner games with a numeric `laneMinionsFirst10Minutes` included in `avgActual`. */
  matchCount: number;
  /** Average actual lane-only minions last-hit by 10:00 across the Patch 26.1+ supported subset (`ceilingMatchCount` games), or `null` when `ceilingMatchCount === 0`. */
  avgSupportedActual?: number | null;
  /** Average theoretical spawned supply ceiling when all eligible games are on patch 26.1+ (`ceilingMatchCount === matchCount`), or `null` when mixed-patch or pre-26.1 so an all-patch actual average is never paired with a subset ceiling denominator. */
  avgSpawnedSupply: number | null;
  /** Number of eligible 26.1+ laner games. */
  ceilingMatchCount: number;
  /** Explicit label stating the ceiling is theoretical spawned supply, not guaranteed farmable (`null` when `avgSpawnedSupply` is `null`). */
  supplyLabel: string | null;
}

export interface OverallStats {
  winRate: number;
  kda: number;
  wins: number;
  losses: number;
  avgCsPerMinute: number;
  avgKillParticipation: number;
  avgSoloKills: number;
  avgTurretPlates: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  oppAvgKda: number;
  oppAvgCsPerMinute: number;
  oppAvgKillParticipation: number;
  oppAvgSoloKills: number;
  oppAvgTurretPlates: number;
  avgVisionScore: number;
  oppAvgVisionScore: number;
  blueSide: SideStats;
  redSide: SideStats;
  avgLaneCsAt10?: AverageLaneCsAt10Summary | null;
}

export interface SummonerData {
  id: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
  soloQueueRank: LeagueEntryDto | null;
  recentMatches: MatchDto[];
  championStats: ChampionStats[];
  overallStats: OverallStats | null;

  totalMatches: number;
  region: string;
  lastUpdated: string; // ISO string format
}
