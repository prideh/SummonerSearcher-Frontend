import type { MatchDto } from '../types/match';
import { hasTag } from './championTags';

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
  voidMonsterKill: 'JUNGLE',
  dragonTakedowns: 'JUNGLE',
  riftHeraldTakedowns: 'JUNGLE',
  baronTakedowns: 'JUNGLE',
  epicMonsterSteals: 'JUNGLE',
  epicMonsterStolenWithoutSmite: 'JUNGLE',
  epicMonsterKillsWithin30SecondsOfSpawn: 'JUNGLE',
};

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

        const champName = player.championName || '';

        // Filter out irrelevant stats based on champion archetype
        if (key === 'effectiveHealAndShielding' && !hasTag(champName, 'Support')) return;
        if ((key === 'timeCCingOthers' || key === 'enemyChampionImmobilizations') && hasTag(champName, 'Assassin')) return;

        const playerValue = playerChallenges[key];
        const opponentValue = opponentChallenges[key];
        
        let isLowerBetter = false;
        const keyLower = key.toLowerCase();

        if (keyLower.startsWith('earliest') || keyLower.startsWith('fastest') || keyLower.startsWith('shortest')) {
            isLowerBetter = true;
        } else if (key === 'damageTakenOnTeamPercentage') {
            const isBackline = hasTag(champName, 'Marksman') || hasTag(champName, 'Mage') || hasTag(champName, 'Assassin');
            const isFrontline = hasTag(champName, 'Tank') || hasTag(champName, 'Fighter');
            const isSupportTag = hasTag(champName, 'Support');
            
            if (isFrontline) {
                isLowerBetter = false; // Tanks should take damage
            } else if (isBackline || isSupportTag) {
                isLowerBetter = true;  // Squishies should avoid taking damage
            } else {
                // Fallback to role if tags are ambiguous
                isLowerBetter = player.teamPosition === 'MIDDLE' || player.teamPosition === 'BOTTOM' || player.teamPosition === 'UTILITY';
            }
        }

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
        .slice(0, 10);

    const worstStats = [...validStats]
        .filter(s => s.losses > s.wins)
        .sort((a, b) => b.lossConsistency - a.lossConsistency)
        .slice(0, 10);

    return { bestStats, worstStats };
};

import type { ChampionStats, OverallStats } from '../types/summoner';

export const calculateStatsFromMatches = (matches: MatchDto[], puuid: string): { championStats: ChampionStats[], overallStats: OverallStats | null } => {
    if (!matches || matches.length === 0) {
        return { championStats: [], overallStats: null };
    }

    const championStatsMap: Record<string, {
        games: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
        soloKills: number;
        turretPlates: number;
        cs: number;
        durationMinutes: number;
    }> = {};

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

    let oppTotalKills = 0;
    let oppTotalDeaths = 0;
    let oppTotalAssists = 0;
    let oppTotalCs = 0;
    let oppTotalSoloKills = 0;
    let oppTotalTurretPlates = 0;
    let oppTotalVisionScore = 0;
    let oppTotalKillParticipation = 0;

    let blueSideGames = 0;
    let blueSideWins = 0;
    let redSideGames = 0;
    let redSideWins = 0;

    matches.forEach(match => {
        const info = match.info;
        if (!info || info.gameDuration === 0) return;

        const participant = info.participants.find(p => p.puuid === puuid);
        if (!participant) return;

        totalGames++;
        if (participant.win) totalWins++;

        // Side Stats
        if (participant.teamId === 100) {
            blueSideGames++;
            if (participant.win) blueSideWins++;
        } else {
            redSideGames++;
            if (participant.win) redSideWins++;
        }

        // Player Stats
        const kills = participant.kills || 0;
        const deaths = participant.deaths || 0;
        const assists = participant.assists || 0;
        const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
        const soloKills = participant.challenges?.soloKills || 0;
        const turretPlates = participant.challenges?.turretPlatesTaken || 0;
        const visionScore = participant.visionScore || 0;
        const durationMin = (info.gameDuration || 0) / 60;

        totalKills += kills;
        totalDeaths += deaths;
        totalAssists += assists;
        totalCs += cs;
        totalSoloKills += soloKills;
        totalTurretPlates += turretPlates;
        totalVisionScore += visionScore;
        totalDurationInMinutes += durationMin;

        // KP
        const teamKills = info.participants
            .filter(p => p.teamId === participant.teamId)
            .reduce((sum, p) => sum + (p.kills || 0), 0);
        if (teamKills > 0) {
            totalKillParticipation += (kills + assists) / teamKills;
        }

        // Opponent Stats
        const opponent = info.participants.find(p => 
            p.teamPosition === participant.teamPosition && 
            p.teamId !== participant.teamId && 
            participant.teamPosition !== 'NONE'
        );

        if (opponent) {
            const oppKills = opponent.kills || 0;
            const oppDeaths = opponent.deaths || 0;
            const oppAssists = opponent.assists || 0;
            const oppCs = (opponent.totalMinionsKilled || 0) + (opponent.neutralMinionsKilled || 0);
            
            oppTotalKills += oppKills;
            oppTotalDeaths += oppDeaths;
            oppTotalAssists += oppAssists;
            oppTotalCs += oppCs;
            oppTotalSoloKills += (opponent.challenges?.soloKills || 0);
            oppTotalTurretPlates += (opponent.challenges?.turretPlatesTaken || 0);
            oppTotalVisionScore += (opponent.visionScore || 0);

            const oppTeamKills = info.participants
                .filter(p => p.teamId === opponent.teamId)
                .reduce((sum, p) => sum + (p.kills || 0), 0);
            if (oppTeamKills > 0) {
                oppTotalKillParticipation += (oppKills + oppAssists) / oppTeamKills;
            }
        }

        const champName = participant.championName || 'Unknown';
        if (!championStatsMap[champName]) {
            championStatsMap[champName] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, soloKills: 0, turretPlates: 0, cs: 0, durationMinutes: 0 };
        }
        const stats = championStatsMap[champName];
        stats.games++;
        if (participant.win) stats.wins++;
        stats.kills += kills;
        stats.deaths += deaths;
        stats.assists += assists;
        stats.soloKills += soloKills;
        stats.turretPlates += turretPlates;
        stats.cs += cs;
        stats.durationMinutes += durationMin;
    });

    if (totalGames === 0) return { championStats: [], overallStats: null };

    const overallStats: OverallStats = {
        wins: totalWins,
        losses: totalGames - totalWins,
        winRate: (totalWins / totalGames) * 100,
        kda: totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : Infinity,
        avgKills: totalKills / totalGames,
        avgDeaths: totalDeaths / totalGames,
        avgAssists: totalAssists / totalGames,
        avgCsPerMinute: totalDurationInMinutes > 0 ? totalCs / totalDurationInMinutes : 0,
        avgKillParticipation: (totalKillParticipation / totalGames) * 100,
        avgSoloKills: totalSoloKills / totalGames,
        avgTurretPlates: totalTurretPlates / totalGames,
        avgVisionScore: totalVisionScore / totalGames,
        
        oppAvgKda: oppTotalDeaths > 0 ? (oppTotalKills + oppTotalAssists) / oppTotalDeaths : Infinity,
        oppAvgCsPerMinute: totalDurationInMinutes > 0 ? oppTotalCs / totalDurationInMinutes : 0,
        oppAvgKillParticipation: (oppTotalKillParticipation / totalGames) * 100,
        oppAvgSoloKills: oppTotalSoloKills / totalGames,
        oppAvgTurretPlates: oppTotalTurretPlates / totalGames,
        oppAvgVisionScore: oppTotalVisionScore / totalGames,

        blueSide: {
            games: blueSideGames,
            wins: blueSideWins,
            winRate: blueSideGames > 0 ? (blueSideWins / blueSideGames) * 100 : 0
        },
        redSide: {
            games: redSideGames,
            wins: redSideWins,
            winRate: redSideGames > 0 ? (redSideWins / redSideGames) * 100 : 0
        }
    };

    const championStats: ChampionStats[] = Object.entries(championStatsMap).map(([name, stats]) => ({
        championName: name,
        games: stats.games,
        wins: stats.wins,
        losses: stats.games - stats.wins,
        kills: stats.kills,
        deaths: stats.deaths,
        assists: stats.assists,
        soloKills: stats.soloKills,
        winRate: (stats.wins / stats.games) * 100,
        kda: stats.deaths > 0 ? (stats.kills + stats.assists) / stats.deaths : Infinity,
        averageKills: stats.kills / stats.games,
        averageDeaths: stats.deaths / stats.games,
        averageAssists: stats.assists / stats.games,
        averageCsPerMinute: stats.durationMinutes > 0 ? stats.cs / stats.durationMinutes : 0,
        averageSoloKills: stats.games > 0 ? stats.soloKills / stats.games : 0,
        averageTurretPlates: stats.games > 0 ? stats.turretPlates / stats.games : 0
    })).sort((a, b) => b.games - a.games);

    return { championStats, overallStats };
};
