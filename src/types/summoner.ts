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

export interface SummonerData {
  id: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
  soloQueueRank: LeagueEntryDto | null;
  recentMatches: MatchDto[];
  region: string;
  lastUpdated: string; // ISO string format
}
