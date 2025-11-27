import type { MatchDto, ParticipantDto } from '../types/match';
import { calculateStats, calculateConsistency } from './statsCalculator';
import { camelCaseToTitleCase } from './formatters';

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
    killParticipation: number;
    visionScore: number;
    turretPlates: number;
  } | null;
  gameDuration: number;
  visionScore: number;
  turretPlates: number;
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
  puuid: string,
  rankInfo: { tier: string; rank: string; leaguePoints: number; wins: number; losses: number } | null
): {
  summonerName: string;
  rank: string;
  totalWins: number;
  totalLosses: number;
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
  avgTurretPlates: string;
  avgVisionScore: string;
  topChampions: Array<{ name: string; games: number; winRate: string; kda: string }>;
    blueSideWinRate: string;
    redSideWinRate: string;
    recentMatches: MatchDetail[];
    opponentStats: {
      avgKda: string;
      avgCsPerMin: string;
      avgKillParticipation: string;
      avgSoloKills: string;
      avgTurretPlates: string;
      avgVisionScore: string;
    };
  topStrengths: Array<{ name: string; consistency: string }>;
  topWeaknesses: Array<{ name: string; consistency: string }>;
} {
  // Calculate aggregate stats from ALL matches
  const { overallStats, championStats } = calculateStats(allMatches, puuid);
  const { bestStats, worstStats } = calculateConsistency(allMatches, puuid);
  
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
    const turretPlates = myParticipant.challenges?.turretPlatesTaken || 0;
    
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
      const oppTurretPlates = opponent.challenges?.turretPlatesTaken || 0;
      
      // Calculate opponent KP
      const oppTeamKills = match.info.participants
        .filter(p => p.teamId === opponent.teamId)
        .reduce((sum, p) => sum + (p.kills || 0), 0);
      const oppKp = oppTeamKills > 0 ? ((oppKills + oppAssists) / oppTeamKills) * 100 : 0;
      
      opponentData = {
        champion: opponent.championName || 'Unknown',
        kda: oppKda,
        csPerMin: parseFloat(oppCsPerMin.toFixed(1)),
        killParticipation: parseFloat(oppKp.toFixed(1)),
        visionScore: opponent.visionScore || 0,
        turretPlates: oppTurretPlates
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
      visionScore: myParticipant.visionScore || 0,
      turretPlates,
      opponent: opponentData,
      gameDuration: parseFloat(gameDuration.toFixed(1))
    });
  }
  
  // Determine primary role
  primaryRole = Object.entries(roleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';
  
  // Filter matches for primary role only
  const primaryRoleMatches = matchDetails.slice(0, 20); // Last 20 games for context size

  // Calculate averages for new stats
  // REMOVED manual calculation, using overallStats
  const avgVisionScore = overallStats.avgVisionScore.toFixed(1);
  
  return {
    summonerName: `${summonerName}#${tagLine}`,
    rank: rankInfo ? `${rankInfo.tier} ${rankInfo.rank} (${rankInfo.leaguePoints} LP)` : 'Unranked',
    totalWins: rankInfo ? rankInfo.wins : 0,
    totalLosses: rankInfo ? rankInfo.losses : 0,
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
    avgTurretPlates: overallStats.avgTurretPlates.toFixed(1),
    avgVisionScore,
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
    recentMatches: primaryRoleMatches,
    opponentStats: {
        avgKda: overallStats.oppAvgKda === Infinity ? 'Perfect' : overallStats.oppAvgKda.toFixed(2),
        avgCsPerMin: overallStats.oppAvgCsPerMinute.toFixed(1),
        avgKillParticipation: overallStats.oppAvgKillParticipation.toFixed(1),
        avgSoloKills: overallStats.oppAvgSoloKills.toFixed(1),
        avgTurretPlates: overallStats.oppAvgTurretPlates.toFixed(1),
        avgVisionScore: overallStats.oppAvgVisionScore.toFixed(1)
    },
    topStrengths: bestStats.map(s => ({ name: camelCaseToTitleCase(s.key), consistency: s.consistency.toFixed(0) + '%' })),
    topWeaknesses: worstStats.map(s => ({ name: camelCaseToTitleCase(s.key), consistency: s.lossConsistency.toFixed(0) + '%' }))
  };
}
