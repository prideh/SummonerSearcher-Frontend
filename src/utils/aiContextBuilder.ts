import type { MatchDto, ParticipantDto } from '../types/match';
import type { ChampionStats, OverallStats } from '../types/summoner';
import { calculateConsistency, STAT_ROLE_MAPPING } from './statsCalculator';
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
    name?: string; // Optional since it might fallback to champion
  } | null;
  gameDuration: number;
  visionScore: number;
  turretPlates: number;
  
  // Advanced Optional Stats
  damagePerMinute?: number;
  goldPerMinute?: number;
  soloKills?: number;
  earlyLaningPhaseGoldExpAdvantage?: number;
  maxCsAdvantageOnLaneOpponent?: number;
  visionScoreAdvantageLaneOpponent?: number;
  timeCCingOthers?: number;
  totalDamageShieldedOnTeammates?: number;
  totalHealsOnTeammates?: number;
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
  rankInfo: { tier: string; rank: string; leaguePoints: number; wins: number; losses: number } | null,
  championStats: ChampionStats[],
  overallStats: OverallStats | null
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
  championMatchups: Record<string, { wins: number; losses: number; total: number; winRate: string }>;
} {
  // Calculate consistency stats (still done on frontend for now)
  const { bestStats, worstStats } = calculateConsistency(allMatches, puuid);
  
  if (!overallStats) {
      // Return empty/default context if no stats available
      return {
          summonerName: `${summonerName}#${tagLine}`,
          rank: 'Unranked',
          totalWins: 0,
          totalLosses: 0,
          primaryRole: 'UNKNOWN',
          totalGamesAnalyzed: 0,
          winRate: '0.0',
          kda: '0.00',
          avgKills: '0.0',
          avgDeaths: '0.0',
          avgAssists: '0.0',
          avgCsPerMin: '0.0',
          avgKillParticipation: '0.0',
          avgSoloKills: '0.0',
          avgTurretPlates: '0.0',
          avgVisionScore: '0.0',
          topChampions: [],
          blueSideWinRate: '0.0',
          redSideWinRate: '0.0',
          recentMatches: [],
          opponentStats: {
              avgKda: '0.00',
              avgCsPerMin: '0.0',
              avgKillParticipation: '0.0',
              avgSoloKills: '0.0',
              avgTurretPlates: '0.0',
              avgVisionScore: '0.0'
          },
          topStrengths: [],
          topWeaknesses: [],
          championMatchups: {}
      };
  }
  
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
      const oppName = opponent.riotIdGameName || opponent.summonerName || opponent.championName || 'Unknown';
      
      // Calculate opponent KP
      const oppTeamKills = match.info.participants
        .filter(p => p.teamId === opponent.teamId)
        .reduce((sum, p) => sum + (p.kills || 0), 0);
      const oppKp = oppTeamKills > 0 ? ((oppKills + oppAssists) / oppTeamKills) * 100 : 0;
      
      opponentData = {
        name: oppName,
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
    
    // Advanced role-filtered stats
    const damagePerMinute = gameDuration > 0 ? (myParticipant.totalDamageDealtToChampions || 0) / gameDuration : 0;
    const goldPerMinute = gameDuration > 0 ? (myParticipant.goldEarned || 0) / gameDuration : 0;
    
    // Helper to check if a stat applies to the current role
    const isStatRelevant = (statKey: string) => {
        const requiredRole = STAT_ROLE_MAPPING[statKey];
        if (!requiredRole || requiredRole === 'ALL') return true;
        
        // Map teamPosition to the role names used in STAT_ROLE_MAPPING
        const currentRole = role === 'UTILITY' ? 'SUPPORT' : role;
        return requiredRole === currentRole;
    };
    
    const soloKills = myParticipant.challenges?.soloKills || 0;
    const earlyLaningPhaseGoldExpAdvantage = myParticipant.challenges?.earlyLaningPhaseGoldExpAdvantage;
    const maxCsAdvantageOnLaneOpponent = myParticipant.challenges?.maxCsAdvantageOnLaneOpponent;
    const visionScoreAdvantageLaneOpponent = myParticipant.challenges?.visionScoreAdvantageLaneOpponent;
    
    const timeCCingOthers = myParticipant.timeCCingOthers;
    const totalDamageShieldedOnTeammates = myParticipant.totalDamageShieldedOnTeammates;
    const totalHealsOnTeammates = myParticipant.totalHealsOnTeammates;
    
    matchDetails.push({
      champion: myParticipant.championName || 'Unknown',
      win: myParticipant.win || false,
      kda,
      csPerMin: parseFloat(csPerMin.toFixed(1)),
      killParticipation: parseFloat(killParticipation.toFixed(1)),
      visionScore: myParticipant.visionScore || 0,
      turretPlates,
      opponent: opponentData,
      gameDuration: parseFloat(gameDuration.toFixed(1)),
      
      // Add advanced stats conditionally & filtered by role
      ...(isStatRelevant('damagePerMinute') ? { damagePerMinute: Math.round(damagePerMinute) } : {}),
      ...(isStatRelevant('goldPerMinute') ? { goldPerMinute: Math.round(goldPerMinute) } : {}),
      ...(isStatRelevant('soloKills') ? { soloKills } : {}),
      
      // These laning advantages are usually 'ALL' but highly relevant for non-junglers
      ...(earlyLaningPhaseGoldExpAdvantage !== undefined ? { earlyLaningPhaseGoldExpAdvantage: Math.round(earlyLaningPhaseGoldExpAdvantage * 100) / 100 } : {}),
      ...(maxCsAdvantageOnLaneOpponent !== undefined ? { maxCsAdvantageOnLaneOpponent: Math.round(maxCsAdvantageOnLaneOpponent * 10) / 10 } : {}),
      ...(visionScoreAdvantageLaneOpponent !== undefined ? { visionScoreAdvantageLaneOpponent: Math.round(visionScoreAdvantageLaneOpponent * 10) / 10 } : {}),
      
      // These are usually support/tank focused
      ...(timeCCingOthers !== undefined ? { timeCCingOthers } : {}),
      ...(totalDamageShieldedOnTeammates !== undefined ? { totalDamageShieldedOnTeammates } : {}),
      ...(totalHealsOnTeammates !== undefined ? { totalHealsOnTeammates } : {})
    });
  }
  
  // Determine primary role
  primaryRole = Object.entries(roleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';
  
  // Filter matches for primary role only
  const primaryRoleMatches = matchDetails.slice(0, 20); // Last 20 games for context size

  // Calculate averages for new stats
  // REMOVED manual calculation, using overallStats
  
  return {
    summonerName: `${summonerName}#${tagLine}`,
    rank: rankInfo ? `${rankInfo.tier} ${rankInfo.rank} (${rankInfo.leaguePoints} LP)` : 'Unranked',
    totalWins: rankInfo ? rankInfo.wins : 0,
    totalLosses: rankInfo ? rankInfo.losses : 0,
    primaryRole,
    totalGamesAnalyzed: allMatches.length,
    // Aggregate stats
    winRate: Number(overallStats.winRate).toFixed(1),
    kda: Number(overallStats.kda) === Infinity ? 'Perfect' : Number(overallStats.kda).toFixed(2),
    avgKills: Number(overallStats.avgKills).toFixed(1),
    avgDeaths: Number(overallStats.avgDeaths).toFixed(1),
    avgAssists: Number(overallStats.avgAssists).toFixed(1),
    avgCsPerMin: Number(overallStats.avgCsPerMinute).toFixed(1),
    avgKillParticipation: Number(overallStats.avgKillParticipation).toFixed(1),
    avgSoloKills: Number(overallStats.avgSoloKills).toFixed(1),
    avgTurretPlates: Number(overallStats.avgTurretPlates).toFixed(1),
    avgVisionScore: Number(overallStats.avgVisionScore).toFixed(1),
    // Champion pool
    topChampions: championStats.slice(0, 5).map(c => ({
      name: c.championName,
      games: c.games,
      winRate: ((c.wins / c.games) * 100).toFixed(0),
      kda: c.deaths > 0 ? ((c.kills + c.assists) / c.deaths).toFixed(2) : 'Perfect'
    })),
    // Side preference
    blueSideWinRate: Number(overallStats.blueSide.winRate).toFixed(1),
    redSideWinRate: Number(overallStats.redSide.winRate).toFixed(1),
    // Detailed match history for primary role
    recentMatches: primaryRoleMatches,
    opponentStats: {
        avgKda: Number(overallStats.oppAvgKda) === Infinity ? 'Perfect' : Number(overallStats.oppAvgKda).toFixed(2),
        avgCsPerMin: Number(overallStats.oppAvgCsPerMinute).toFixed(1),
        avgKillParticipation: Number(overallStats.oppAvgKillParticipation).toFixed(1),
        avgSoloKills: Number(overallStats.oppAvgSoloKills).toFixed(1),
        avgTurretPlates: Number(overallStats.oppAvgTurretPlates).toFixed(1),
        avgVisionScore: Number(overallStats.oppAvgVisionScore).toFixed(1)
    },
    topStrengths: bestStats.map(s => ({ name: camelCaseToTitleCase(s.key), consistency: s.consistency.toFixed(0) + '%' })),
    topWeaknesses: worstStats.map(s => ({ name: camelCaseToTitleCase(s.key), consistency: s.lossConsistency.toFixed(0) + '%' })),
    championMatchups: computeChampionMatchups(primaryRoleMatches)
  };
}

/**
 * Computes win/loss stats against specific opponent champions
 */
function computeChampionMatchups(matches: MatchDetail[]): Record<string, { wins: number; losses: number; total: number; winRate: string }> {
  const matchups: Record<string, { wins: number; losses: number; total: number }> = {};

  matches.forEach(match => {
    if (!match.opponent?.champion) return;
    const oppChamp = match.opponent.champion;
    
    if (!matchups[oppChamp]) {
      matchups[oppChamp] = { wins: 0, losses: 0, total: 0 };
    }
    
    matchups[oppChamp].total++;
    if (match.win) {
      matchups[oppChamp].wins++;
    } else {
      matchups[oppChamp].losses++;
    }
  });

  // Convert to final format with winrate string
  const result: Record<string, { wins: number; losses: number; total: number; winRate: string }> = {};
  Object.entries(matchups).forEach(([champ, stats]) => {
    result[champ] = {
      ...stats,
      winRate: ((stats.wins / stats.total) * 100).toFixed(0) + '%'
    };
  });
  
  return result;
}
