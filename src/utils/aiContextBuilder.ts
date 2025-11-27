import type { MatchDto, ParticipantDto } from '../types/match';
import { calculateStats } from './statsCalculator';

interface MatchDetail {
  champion: string;
  win: boolean;
  kda: string;
  csPerMin: number;
  killParticipation: number;
  opponent: {
    champion: string;
    kda: string;
    csPerMin: number;
  } | null;
  gameDuration: number;
}

/**
 * Finds the lane opponent for a given participant
 */
function findLaneOpponent(
  myParticipant: ParticipantDto,
  allParticipants: ParticipantDto[]
): ParticipantDto | null {
  const myPosition = myParticipant.teamPosition;
  const myTeamId = myParticipant.teamId;
  
  // Find opponent with same position on different team
  const opponent = allParticipants.find(
    p => p.teamPosition === myPosition && p.teamId !== myTeamId
  );
  
  return opponent || null;
}

/**
 * Builds comprehensive AI context from all matches
 */
export function buildAiContext(
  summonerName: string,
  tagLine: string,
  allMatches: MatchDto[],
  puuid: string
): {
  summonerName: string;
  primaryRole: string;
  totalGamesAnalyzed: number;
  winRate: string;
  kda: string;
  avgKills: string;
  avgDeaths: string;
  avgAssists: string;
  avgCsPerMin: string;
  avgKillParticipation: string;
  avgSoloKills: string;
  topChampions: Array<{ name: string; games: number; winRate: string; kda: string }>;
  blueSideWinRate: string;
  redSideWinRate: string;
  recentMatches: MatchDetail[];
} {
  // Calculate aggregate stats from ALL matches
  const { overallStats, championStats } = calculateStats(allMatches, puuid);
  
  // Extract detailed match data
  const matchDetails: MatchDetail[] = [];
  let primaryRole = '';
  const roleCount: Record<string, number> = {};
  
  for (const match of allMatches) {
    if (!match.info?.participants) continue;
    
    const myParticipant = match.info.participants.find(p => p.puuid === puuid);
    if (!myParticipant) continue;
    
    // Count roles to determine primary
    const role = myParticipant.teamPosition || 'UNKNOWN';
    roleCount[role] = (roleCount[role] || 0) + 1;
    
    const gameDuration = (match.info.gameDuration || 0) / 60; // Convert to minutes
    const totalCs = (myParticipant.totalMinionsKilled || 0) + (myParticipant.neutralMinionsKilled || 0);
    const csPerMin = gameDuration > 0 ? totalCs / gameDuration : 0;
    
    const kills = myParticipant.kills || 0;
    const deaths = myParticipant.deaths || 0;
    const assists = myParticipant.assists || 0;
    const kda = deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : 'Perfect';
    
    // Find lane opponent
    const opponent = findLaneOpponent(myParticipant, match.info.participants);
    let opponentData = null;
    
    if (opponent) {
      const oppCs = (opponent.totalMinionsKilled || 0) + (opponent.neutralMinionsKilled || 0);
      const oppCsPerMin = gameDuration > 0 ? oppCs / gameDuration : 0;
      const oppKills = opponent.kills || 0;
      const oppDeaths = opponent.deaths || 0;
      const oppAssists = opponent.assists || 0;
      const oppKda = oppDeaths > 0 ? ((oppKills + oppAssists) / oppDeaths).toFixed(2) : 'Perfect';
      
      opponentData = {
        champion: opponent.championName || 'Unknown',
        kda: oppKda,
        csPerMin: parseFloat(oppCsPerMin.toFixed(1))
      };
    }
    
    // Calculate kill participation
    const teamKills = match.info.participants
      .filter(p => p.teamId === myParticipant.teamId)
      .reduce((sum, p) => sum + (p.kills || 0), 0);
    const killParticipation = teamKills > 0 ? ((kills + assists) / teamKills) * 100 : 0;
    
    matchDetails.push({
      champion: myParticipant.championName || 'Unknown',
      win: myParticipant.win || false,
      kda,
      csPerMin: parseFloat(csPerMin.toFixed(1)),
      killParticipation: parseFloat(killParticipation.toFixed(1)),
      opponent: opponentData,
      gameDuration: parseFloat(gameDuration.toFixed(1))
    });
  }
  
  // Determine primary role
  primaryRole = Object.entries(roleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';
  
  // Filter matches for primary role only
  const primaryRoleMatches = matchDetails.slice(0, 20); // Last 20 games for context size
  
  return {
    summonerName: `${summonerName}#${tagLine}`,
    primaryRole,
    totalGamesAnalyzed: allMatches.length,
    // Aggregate stats
    winRate: overallStats.winRate.toFixed(1),
    kda: overallStats.kda === Infinity ? 'Perfect' : overallStats.kda.toFixed(2),
    avgKills: overallStats.avgKills.toFixed(1),
    avgDeaths: overallStats.avgDeaths.toFixed(1),
    avgAssists: overallStats.avgAssists.toFixed(1),
    avgCsPerMin: overallStats.avgCsPerMinute.toFixed(1),
    avgKillParticipation: overallStats.avgKillParticipation.toFixed(1),
    avgSoloKills: overallStats.avgSoloKills.toFixed(1),
    // Champion pool
    topChampions: championStats.slice(0, 5).map(c => ({
      name: c.championName,
      games: c.games,
      winRate: ((c.wins / c.games) * 100).toFixed(0),
      kda: c.deaths > 0 ? ((c.kills + c.assists) / c.deaths).toFixed(2) : 'Perfect'
    })),
    // Side preference
    blueSideWinRate: overallStats.blueSide.winRate.toFixed(1),
    redSideWinRate: overallStats.redSide.winRate.toFixed(1),
    // Detailed match history for primary role
    recentMatches: primaryRoleMatches
  };
}
