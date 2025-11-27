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

  // Opponent Stats
  let oppTotalKills = 0;
  let oppTotalDeaths = 0;
  let oppTotalAssists = 0;
  let oppTotalCs = 0;
  let oppTotalSoloKills = 0;
  let oppTotalTurretPlates = 0;
  let oppTotalKillParticipation = 0;

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

  // Opponent Averages
  const oppAvgKda = oppTotalDeaths > 0 ? (oppTotalKills + oppTotalAssists) / oppTotalDeaths : Infinity;
  const oppAvgCsPerMinute = totalDurationInMinutes > 0 ? oppTotalCs / totalDurationInMinutes : 0;
  const oppAvgKillParticipation = totalGames > 0 ? (oppTotalKillParticipation / totalGames) * 100 : 0;
  const oppAvgSoloKills = totalGames > 0 ? oppTotalSoloKills / totalGames : 0;
  const oppAvgTurretPlates = totalGames > 0 ? oppTotalTurretPlates / totalGames : 0;

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
