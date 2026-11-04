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

export type StatRole = 'ALL' | 'JUNGLE' | 'SUPPORT' | 'LANER';

export const STAT_ROLE_MAPPING: Record<string, StatRole> = {
  kda: 'ALL',
  killParticipation: 'ALL',
  damagePerMinute: 'ALL',
  damageTakenOnTeamPercentage: 'ALL',
  goldPerMinute: 'ALL',
  visionScorePerMinute: 'ALL',
  soloKills: 'ALL',
  turretPlatesTaken: 'ALL',
  laneMinionsFirst10Minutes: 'LANER',
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

/**
 * Returns true when the given Riot teamPosition represents a farming lane role
 * (TOP, MIDDLE, or BOTTOM), excluding JUNGLE and UTILITY (support).
 */
export const isLanerPosition = (teamPosition?: string): boolean => {
  return teamPosition === 'TOP' || teamPosition === 'MIDDLE' || teamPosition === 'BOTTOM';
};

/**
 * Checks whether a challenge stat key is applicable to a participant's assigned role.
 */
export const isStatAllowedForPosition = (statKey: string, teamPosition?: string): boolean => {
  const requiredRole = STAT_ROLE_MAPPING[statKey];
  if (requiredRole === 'JUNGLE') return teamPosition === 'JUNGLE';
  if (requiredRole === 'SUPPORT') return teamPosition === 'UTILITY';
  if (requiredRole === 'LANER') return isLanerPosition(teamPosition);
  return true;
};

/**
 * Parameters defining Summoner's Rift minion wave spawn and lane arrival rules
 * during the early laning phase (first 10 minutes).
 *
 * Sources:
 * - League of Legends Wiki ("Minion (League of Legends)" / "Farming"):
 *   - Pre-Season 2026 (through Patch 15.x): Wave 1 spawns at 1:05 (65s), subsequent waves
 *     spawn every 30s. Each wave has 3 melee + 3 caster minions, plus 1 siege (cannon)
 *     minion every 3rd wave starting on Wave 3 (waves 3, 6, 9, 12, 15, ...).
 *   - Since Patch 13.10, side-lane minions receive bonus movement speed before 14:00 so
 *     that Top, Mid, and Bot waves all reach the lane clash point ~28s after spawning
 *     (clashing at ~1:33-1:35 for a 1:05 spawn), requiring ~5s to be last-hit.
 * - Riot Official Patch 26.1 Notes (Season 2026 / Data Dragon 16.x):
 *   - Minion first spawn shifted 35s earlier from 1:05 (65s) to 0:30 (30s).
 *   - Pre-14:00 wave interval remains 30s; cannon cadence every 3 waves starting Wave 3.
 */
export interface MinionWaveTimingConfig {
  /** Game clock (in seconds) when Wave 1 spawns at the Nexus. */
  firstWaveSpawnSeconds: number;
  /** Interval (in seconds) between consecutive wave spawns during the first 10 minutes. */
  waveIntervalSeconds: number;
  /** Travel time (in seconds) from Nexus spawn to the lane center clash point. */
  travelToClashSeconds: number;
  /** Minimum window (in seconds) after waves clash for all minions in the wave to be last-hittable. */
  clearBufferSeconds: number;
  /** Number of melee minions per wave. */
  meleePerWave: number;
  /** Number of caster minions per wave. */
  casterPerWave: number;
  /** 1-indexed wave number of the first cannon (siege) wave. */
  firstCannonWave: number;
  /** Number of waves between cannon waves during the first 10 minutes. */
  cannonWaveInterval: number;
}

export const CLASSIC_MINION_WAVE_CONFIG: MinionWaveTimingConfig = {
  firstWaveSpawnSeconds: 65, // 1:05
  waveIntervalSeconds: 30,
  travelToClashSeconds: 28,
  clearBufferSeconds: 5,
  meleePerWave: 3,
  casterPerWave: 3,
  firstCannonWave: 3,
  cannonWaveInterval: 3,
};

export const SEASON_2026_MINION_WAVE_CONFIG: MinionWaveTimingConfig = {
  firstWaveSpawnSeconds: 30, // 0:30 (Patch 26.1 / DDragon 16.x+)
  waveIntervalSeconds: 30,
  travelToClashSeconds: 28,
  clearBufferSeconds: 5,
  meleePerWave: 3,
  casterPerWave: 3,
  firstCannonWave: 3,
  cannonWaveInterval: 3,
};

/**
 * Resolves the minion wave timing configuration for a given Data Dragon or match patch version.
 * Season 2026 (Patch 26.1 / Data Dragon 16.x+, the current live patch) spawns Wave 1 at 0:30;
 * pre-Season 2026 patches (major version <= 15) spawned Wave 1 at 1:05.
 */
export const getMinionWaveConfigForPatch = (patchVersion?: string): MinionWaveTimingConfig => {
  if (!patchVersion || !patchVersion.trim()) {
    return SEASON_2026_MINION_WAVE_CONFIG;
  }
  const majorStr = patchVersion.trim().split('.')[0];
  const major = Number.parseInt(majorStr, 10);
  if (!Number.isNaN(major) && major <= 15) {
    return CLASSIC_MINION_WAVE_CONFIG;
  }
  return SEASON_2026_MINION_WAVE_CONFIG;
};

export interface AvailableLaneMinionsResult {
  wavesArrived: number;
  cannonWavesArrived: number;
  availableMinions: number;
}

/**
 * Computes from wave spawn and arrival timings how many single-lane minions have spawned,
 * reached the lane clash point, and become available to last-hit by `minute` (default 10:00).
 */
export const calculateAvailableLaneMinionsByMinute = (
  minute: number = 10,
  config: MinionWaveTimingConfig = SEASON_2026_MINION_WAVE_CONFIG
): AvailableLaneMinionsResult => {
  const cutoffSeconds = minute * 60;
  const arrivalAndClearOffset = config.travelToClashSeconds + config.clearBufferSeconds;

  let wavesArrived = 0;
  let cannonWavesArrived = 0;
  let availableMinions = 0;

  for (
    let spawnSeconds = config.firstWaveSpawnSeconds, waveIndex = 1;
    spawnSeconds + arrivalAndClearOffset <= cutoffSeconds;
    spawnSeconds += config.waveIntervalSeconds, waveIndex += 1
  ) {
    wavesArrived += 1;
    const isCannonWave =
      waveIndex >= config.firstCannonWave &&
      (waveIndex - config.firstCannonWave) % config.cannonWaveInterval === 0;
    if (isCannonWave) {
      cannonWavesArrived += 1;
    }
    availableMinions += config.meleePerWave + config.casterPerWave + (isCannonWave ? 1 : 0);
  }

  return {
    wavesArrived,
    cannonWavesArrived,
    availableMinions,
  };
};

export interface LaneCsAt10Breakdown {
  /** Actual lane minions last-hit in the first 10 minutes (`challenges.laneMinionsFirst10Minutes`). */
  hit: number;
  /** Theoretical maximum single-lane minions available to last-hit by 10:00 for the patch. */
  available: number;
  /** Perfect possible lane CS minus actual lane minions last-hit (`Math.max(0, available - hit)`). */
  missed: number;
  /** Number of waves that arrived in lane by 10:00. */
  wavesArrived: number;
}

/**
 * Calculates the player's Lane CS @10 breakdown (hit, available baseline, and missed CS)
 * using `challenges.laneMinionsFirst10Minutes` (which strictly counts lane minions and
 * excludes jungle monsters).
 */
export const calculateLaneCsMissedAt10 = (
  laneMinionsFirst10Minutes: number,
  patchOrConfig?: string | MinionWaveTimingConfig
): LaneCsAt10Breakdown => {
  const config =
    typeof patchOrConfig === 'object' && patchOrConfig !== null
      ? patchOrConfig
      : getMinionWaveConfigForPatch(patchOrConfig);
  const { availableMinions, wavesArrived } = calculateAvailableLaneMinionsByMinute(10, config);
  const hit = Math.max(0, Math.round(laneMinionsFirst10Minutes));
  const missed = Math.max(0, availableMinions - hit);

  return {
    hit,
    available: availableMinions,
    missed,
    wavesArrived,
  };
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

        if (!isStatAllowedForPosition(key, player.teamPosition)) return;

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
