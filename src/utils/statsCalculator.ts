import type { MatchDto } from '../types/match';

export interface ChampionStat {
  championName: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  soloKills: number;
}

export interface StatConsistency {
  key: string;
  wins: number;
  losses: number;
  totalGames: number;
  consistency: number;
  lossConsistency: number;
}

export const STAT_ROLE_MAPPING: Record<string, 'ALL' | 'JUNGLE' | 'SUPPORT'> = {
  kda: 'ALL',
  killParticipation: 'ALL',
  damagePerMinute: 'ALL',
  damageTakenOnTeamPercentage: 'ALL',
  goldPerMinute: 'ALL',
  visionScorePerMinute: 'ALL',
  soloKills: 'ALL',
  turretPlatesTaken: 'ALL',
  controlWardsPlaced: 'SUPPORT',
  wardTakedowns: 'SUPPORT',
  effectiveHealAndShielding: 'SUPPORT',
  controlWardTimeCoverageInRiverOrEnemyHalf: 'SUPPORT',
  jungleCsBefore10Minutes: 'JUNGLE',
  enemyJungleMonsterKills: 'JUNGLE',
  scuttleCrabKills: 'JUNGLE',
  earliestBaron: 'JUNGLE',
  earliestDragonTakedown: 'JUNGLE',
  epicMonsterKillsNearEnemyJungler: 'JUNGLE',
  buffsStolen: 'JUNGLE',
  firstTurretKilled: 'ALL',
};

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
  blueSide: {
    games: number;
    wins: number;
    winRate: number;
  };
  redSide: {
    games: number;
    wins: number;
    winRate: number;
  };
}

export interface CalculatedStats {
  championStats: ChampionStat[];
  overallStats: OverallStats;
}

export const calculateConsistency = (matches: MatchDto[], puuid: string) => {
    const statsMap: Record<string, { wins: number; losses: number; totalGames: number }> = {};

    // Calculate Main Role
    const roleCounts: Record<string, number> = {};
    let roleTotalGames = 0;
    matches.forEach(match => {
        const p = match.info?.participants.find(part => part.puuid === puuid);
        if (p && p.teamPosition && p.teamPosition !== 'NONE') {
            roleCounts[p.teamPosition] = (roleCounts[p.teamPosition] || 0) + 1;
            roleTotalGames++;
        }
    });

    let mainRole = '';
    let isMultirole = false;

    if (roleTotalGames > 0) {
        const sortedRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
        if (sortedRoles.length > 0) {
            mainRole = sortedRoles[0][0];
            if (sortedRoles.length > 1 && sortedRoles[1][1] === sortedRoles[0][1]) {
                isMultirole = true;
            }
        }
    }

    // Filter matches to ONLY include Main Role games
    const recentMatches = isMultirole ? matches : matches.filter(match => {
        const p = match.info?.participants.find(part => part.puuid === puuid);
        return p?.teamPosition === mainRole;
    });

    recentMatches.forEach(match => {
      const participants = match.info?.participants;
      const player = participants?.find(p => p.puuid === puuid);
      
      if (!player) return;

      const opponent = participants?.find(p =>
        p.teamId !== player.teamId &&
        p.teamPosition === player.teamPosition &&
        player.teamPosition &&
        player.teamPosition !== 'NONE'
      );

      if (!opponent) return;

      const playerChallenges = (player.challenges || {}) as Record<string, number | undefined>;
      const opponentChallenges = (opponent.challenges || {}) as Record<string, number | undefined>;
      
      const allKeys = new Set([...Object.keys(playerChallenges), ...Object.keys(opponentChallenges)]);
      
      allKeys.forEach(key => {
        if (key === 'legendaryItemUsed' || 
            key === 'legendaryCount' ||
            key === 'playedChampSelectPosition' || 
            key === 'soloKills' || 
            key === 'abilityUses' ||
            key === 'fullTeamTakedown' ||
            key === 'flawlessAces' ||
            key === 'acesBefore15Minutes' ||
            key === 'firstTurretKilledTime' ||
            key === 'bountyGold' ||
            key === 'getTakedownsInAllLanesEarlyJungleAsLaner') return;

        const requiredRole = STAT_ROLE_MAPPING[key];
        
        if (requiredRole === 'JUNGLE' && player.teamPosition !== 'JUNGLE') return;
        if (requiredRole === 'SUPPORT' && player.teamPosition !== 'UTILITY') return;

        const playerValue = playerChallenges[key];
        const opponentValue = opponentChallenges[key];
        
        const isCarryRole = player.teamPosition === 'MIDDLE' || player.teamPosition === 'BOTTOM';
        const isDamageTaken = key === 'damageTakenOnTeamPercentage';

        const isLowerBetter = key.toLowerCase().startsWith('earliest') || 
                              key.toLowerCase().startsWith('fastest') || 
                              key.toLowerCase().startsWith('shortest') ||
                              (isCarryRole && isDamageTaken);

        let pVal = playerValue;
        if (pVal === undefined || pVal === null || (isLowerBetter && pVal === 0)) {
            pVal = isLowerBetter ? Infinity : 0;
        }

        let oppVal = opponentValue;
        if (oppVal === undefined || oppVal === null || (isLowerBetter && oppVal === 0)) {
            oppVal = isLowerBetter ? Infinity : 0;
        }

        if (!statsMap[key]) {
            statsMap[key] = { wins: 0, losses: 0, totalGames: 0 };
        }
        
        statsMap[key].totalGames++;
        
        let isWinner = false;
        if (pVal === oppVal) {
            isWinner = false;
        } else {
            isWinner = isLowerBetter ? pVal < oppVal : pVal > oppVal;
        }

        if (isWinner) {
            statsMap[key].wins++;
        } else if (pVal !== oppVal) {
            statsMap[key].losses++;
        }
      });
    });

    const statsArray: StatConsistency[] = Object.entries(statsMap).map(([key, data]) => ({
        key,
        wins: data.wins,
        losses: data.losses,
        totalGames: data.totalGames,
        consistency: data.totalGames > 0 ? (data.wins / data.totalGames) * 100 : 0,
        lossConsistency: data.totalGames > 0 ? (data.losses / data.totalGames) * 100 : 0
    }));

    const validStats = statsArray.filter(s => s.totalGames >= 3);

    const bestStats = [...validStats]
        .filter(s => s.wins > s.losses)
        .sort((a, b) => b.consistency - a.consistency)
        .slice(0, 5);

    const worstStats = [...validStats]
        .filter(s => s.losses > s.wins)
        .sort((a, b) => b.lossConsistency - a.lossConsistency)
        .slice(0, 5);

    return { bestStats, worstStats };
};

export const calculateStats = (matches: MatchDto[], puuid: string): CalculatedStats => {
  const stats: Record<string, ChampionStat> = {};

  let totalGames = 0;
  let totalWins = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;

  let totalCs = 0;
  let totalDurationInMinutes = 0;
  let totalKillParticipation = 0;
  let totalSoloKills = 0;
  let totalTurretPlates = 0;
  let totalVisionScore = 0;

  // Opponent Stats
  let oppTotalKills = 0;
  let oppTotalDeaths = 0;
  let oppTotalAssists = 0;
  let oppTotalCs = 0;
  let oppTotalSoloKills = 0;
  let oppTotalTurretPlates = 0;
  let oppTotalKillParticipation = 0;
  let oppTotalVisionScore = 0;

  let blueSideGames = 0;
  let blueSideWins = 0;
  let redSideGames = 0;
  let redSideWins = 0;

  matches.forEach(match => {
    const player = match.info?.participants.find(p => p.puuid === puuid);
    if (!player || !player.championName || !match.info?.gameDuration) return;

    totalGames++;

    if (player.win) {
      totalWins++;
    }

    if (player.teamId === 100) {
      blueSideGames++;
      if (player.win) blueSideWins++;
    } else if (player.teamId === 200) {
      redSideGames++;
      if (player.win) redSideWins++;
    }

    // Find direct lane opponent
    const opponent = match.info.participants.find(p => 
      p.teamPosition === player.teamPosition && p.teamId !== player.teamId
    );

    // Calculate team-wide stats for this match to determine KP.
    const teamKills = match.info.participants
      .filter(p => p.teamId === player.teamId)
      .reduce((acc, p) => acc + (p.kills ?? 0), 0);
    
    const oppTeamKills = opponent ? match.info.participants
      .filter(p => p.teamId === opponent.teamId)
      .reduce((acc, p) => acc + (p.kills ?? 0), 0) : 0;

    totalKills += player.kills ?? 0;
    totalDeaths += player.deaths ?? 0;
    totalAssists += player.assists ?? 0;
    totalSoloKills += player.challenges?.soloKills ?? 0;
    totalTurretPlates += player.challenges?.turretPlatesTaken ?? 0;
    totalVisionScore += player.visionScore ?? 0;

    totalCs += (player.totalMinionsKilled ?? 0) + (player.neutralMinionsKilled ?? 0);
    totalDurationInMinutes += match.info.gameDuration / 60;
    if (teamKills > 0) {
      totalKillParticipation += ((player.kills ?? 0) + (player.assists ?? 0)) / teamKills;
    }

    // Accumulate Opponent Stats
    if (opponent) {
      oppTotalKills += opponent.kills ?? 0;
      oppTotalDeaths += opponent.deaths ?? 0;
      oppTotalAssists += opponent.assists ?? 0;
      oppTotalCs += (opponent.totalMinionsKilled ?? 0) + (opponent.neutralMinionsKilled ?? 0);
      oppTotalSoloKills += opponent.challenges?.soloKills ?? 0;
      oppTotalTurretPlates += opponent.challenges?.turretPlatesTaken ?? 0;
      oppTotalVisionScore += opponent.visionScore ?? 0;
      oppTotalTurretPlates += opponent.challenges?.turretPlatesTaken ?? 0;
      oppTotalVisionScore += opponent.visionScore ?? 0;
      
      if (oppTeamKills > 0) {
          oppTotalKillParticipation += ((opponent.kills ?? 0) + (opponent.assists ?? 0)) / oppTeamKills;
      }
    }

    const championKey = player.championName;

    // Initialize the stats object for a champion if it's the first time we've seen them.
    if (!stats[championKey]) {
      stats[championKey] = {
        championName: player.championName,
        games: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        soloKills: 0,
      };
    }

    // Aggregate the stats for the current champion.
    const champ = stats[championKey];
    champ.games++;
    if (player.win) {
      champ.wins++;
    } else {
      champ.losses++;
    }
    champ.kills += player.kills ?? 0;
    champ.deaths += player.deaths ?? 0;
    champ.assists += player.assists ?? 0;
    champ.soloKills += player.challenges?.soloKills ?? 0;
  });
  
  // Calculate overall average stats across all processed games.
  const overallWinRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
  const overallKda = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : Infinity;
  const avgCsPerMinute = totalDurationInMinutes > 0 ? totalCs / totalDurationInMinutes : 0;
  const avgKillParticipation = totalGames > 0 ? (totalKillParticipation / totalGames) * 100 : 0;
  const avgSoloKills = totalGames > 0 ? totalSoloKills / totalGames : 0;
  const avgTurretPlates = totalGames > 0 ? totalTurretPlates / totalGames : 0;
  const avgVisionScore = totalGames > 0 ? totalVisionScore / totalGames : 0;

  // Opponent Averages
  const oppAvgKda = oppTotalDeaths > 0 ? (oppTotalKills + oppTotalAssists) / oppTotalDeaths : Infinity;
  const oppAvgCsPerMinute = totalDurationInMinutes > 0 ? oppTotalCs / totalDurationInMinutes : 0;
  const oppAvgKillParticipation = totalGames > 0 ? (oppTotalKillParticipation / totalGames) * 100 : 0;
  const oppAvgSoloKills = totalGames > 0 ? oppTotalSoloKills / totalGames : 0;
  const oppAvgTurretPlates = totalGames > 0 ? oppTotalTurretPlates / totalGames : 0;
  const oppAvgVisionScore = totalGames > 0 ? oppTotalVisionScore / totalGames : 0;

  const blueSideWinRate = blueSideGames > 0 ? (blueSideWins / blueSideGames) * 100 : 0;
  const redSideWinRate = redSideGames > 0 ? (redSideWins / redSideGames) * 100 : 0;

  return {
    championStats: Object.values(stats).sort((a, b) => b.games - a.games),
    overallStats: {
      winRate: overallWinRate,
      kda: overallKda,
      wins: totalWins,
      losses: totalGames - totalWins,
      avgCsPerMinute: avgCsPerMinute,
      avgKillParticipation: avgKillParticipation,
      avgSoloKills: avgSoloKills,
      avgTurretPlates: avgTurretPlates,
      avgKills: totalGames > 0 ? totalKills / totalGames : 0,
      avgDeaths: totalGames > 0 ? totalDeaths / totalGames : 0,
      avgAssists: totalGames > 0 ? totalAssists / totalGames : 0,
      
      // Opponent Stats
      oppAvgKda,
      oppAvgCsPerMinute,
      oppAvgKillParticipation,
      oppAvgSoloKills,
      oppAvgTurretPlates,
      avgVisionScore,
      oppAvgVisionScore,

      blueSide: {
        games: blueSideGames,
        wins: blueSideWins,
        winRate: blueSideWinRate
      },
      redSide: {
        games: redSideGames,
        wins: redSideWins,
        winRate: redSideWinRate
      }
    }
  };
};
