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
 * Minion wave spawn parameters used to compute the provisional theoretical spawned
 * single-lane minion supply before a given minute mark (e.g., 10:00).
 *
 * Verified Sources:
 * - Riot Official Patch 26.1 Notes / Season 2026 Gameplay Preview & LoL Wiki (Minion):
 *   - First wave spawns at 0:30 (30s); subsequent waves spawn every 30s until 14:00.
 *   - Each standard wave has 3 melee + 3 caster minions (6 total).
 *   - Cannon (siege) minions spawn on Wave 3 (1:30) and every 3rd wave thereafter until 14:00
 *     (waves 3, 6, 9, 12, 15, 18).
 *   - Waves spawned strictly before 10:00 (`spawnSeconds < 600`): 19 waves (0:30 through 9:30),
 *     containing 6 cannon waves (3, 6, 9, 12, 15, 18) -> 19 * 6 + 6 = 120 minions.
 *   - Because the final spawned wave(s) are still in transit / not guaranteed farmable by 10:00,
 *     this value is surfaced as a provisional theoretical spawned supply ceiling (not guaranteed
 *     farmable) alongside actual lane-only CS (`challenges.laneMinionsFirst10Minutes`), with no
 *     role-specific arrival cutoffs.
 */
export interface MinionWaveTimingConfig {
  /** Game clock (in seconds) when Wave 1 spawns at the Nexus. */
  firstWaveSpawnSeconds: number;
  /** Interval (in seconds) between consecutive wave spawns during the first 10 minutes. */
  waveIntervalSeconds: number;
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
  firstWaveSpawnSeconds: 65, // 1:05 (pre-26.1 / DDragon <= 15.x)
  waveIntervalSeconds: 30,
  meleePerWave: 3,
  casterPerWave: 3,
  firstCannonWave: 3,
  cannonWaveInterval: 3,
};

export const SEASON_2026_MINION_WAVE_CONFIG: MinionWaveTimingConfig = {
  firstWaveSpawnSeconds: 30, // 0:30 (Patch 26.1 / DDragon 16.x+)
  waveIntervalSeconds: 30,
  meleePerWave: 3,
  casterPerWave: 3,
  firstCannonWave: 3,
  cannonWaveInterval: 3,
};

/**
 * Checks whether a match's `gameVersion` / patch string corresponds to Season 2026 Patch 26.1+
 * (Riot Match-V5 `16.1+` internal versioning or `26.1+` display versioning), where first wave
 * spawns at 0:30 and cannons spawn from wave 3 every 3rd wave.
 * Returns `false` for pre-26.1 patches (major <= 15) and for missing/unparseable versions.
 */
export const isPost26_1Patch = (patchVersion?: string): boolean => {
  if (!patchVersion || !patchVersion.trim()) {
    return false;
  }
  const parts = patchVersion.trim().split('.');
  const major = Number.parseInt(parts[0], 10);
  if (Number.isNaN(major) || major < 16) {
    return false;
  }
  if (parts.length > 1) {
    const minor = Number.parseInt(parts[1], 10);
    if (!Number.isNaN(minor) && minor < 1) {
      return false;
    }
  }
  return true;
};

/**
 * Resolves the post-26.1 minion wave spawn configuration only when `patchVersion` is verified
 * to be Patch 26.1+ (`16.1+` / `26.1+`). Returns `null` for older patches or missing patch strings
 * so older matches are never silently computed under post-26.1 constants.
 */
export const getMinionWaveConfigForPatch = (patchVersion?: string): MinionWaveTimingConfig | null => {
  if (!isPost26_1Patch(patchVersion)) {
    return null;
  }
  return SEASON_2026_MINION_WAVE_CONFIG;
};

export interface SpawnedLaneMinionsResult {
  wavesSpawned: number;
  cannonWavesSpawned: number;
  spawnedSupply: number;
}

/**
 * Computes from patch-parameterized spawn rules how many single-lane minions have spawned
 * strictly before `minute` (default 10:00, i.e. 19 waves spawning at 0:30..9:30 x6 + 6 cannons = 120
 * under post-26.1 rules).
 */
export const calculateSpawnedLaneMinionsByMinute = (
  minute: number = 10,
  config: MinionWaveTimingConfig = SEASON_2026_MINION_WAVE_CONFIG
): SpawnedLaneMinionsResult => {
  const cutoffSeconds = minute * 60;

  let wavesSpawned = 0;
  let cannonWavesSpawned = 0;
  let spawnedSupply = 0;

  for (
    let spawnSeconds = config.firstWaveSpawnSeconds, waveIndex = 1;
    spawnSeconds < cutoffSeconds;
    spawnSeconds += config.waveIntervalSeconds, waveIndex += 1
  ) {
    wavesSpawned += 1;
    const isCannonWave =
      waveIndex >= config.firstCannonWave &&
      (waveIndex - config.firstCannonWave) % config.cannonWaveInterval === 0;
    if (isCannonWave) {
      cannonWavesSpawned += 1;
    }
    spawnedSupply += config.meleePerWave + config.casterPerWave + (isCannonWave ? 1 : 0);
  }

  return {
    wavesSpawned,
    cannonWavesSpawned,
    spawnedSupply,
  };
};

export interface LaneCsAt10Comparison {
  /** Actual lane-only minions last-hit in the first 10 minutes (`challenges.laneMinionsFirst10Minutes`). */
  actual: number;
  /** Provisional theoretical spawned supply before 10:00 for post-26.1 matches (120 = 19 waves x6 + 6 cannons), or `null` for older/unknown patches. */
  spawnedSupply: number | null;
  /** Number of waves spawned before 10:00 (19 in post-26.1 rules), or `null` for older/unknown patches. */
  wavesSpawned: number | null;
  /** Number of cannon waves spawned before 10:00 (6 on waves 3, 6, 9, 12, 15, 18), or `null` for older/unknown patches. */
  cannonWavesSpawned: number | null;
  /** Explicit label stating this ceiling is theoretical spawned supply, not guaranteed farmable, or `null` when ceiling is excluded. */
  supplyLabel: string | null;
}

/**
 * Builds the provisional comparison between actual lane-only minions last-hit by 10:00
 * (`challenges.laneMinionsFirst10Minutes`) and the post-26.1 theoretical spawned supply
 * (120 = 19 waves x6 + 6 cannons). Older matches (pre-26.1) or matches without a verified
 * 26.1+ `gameVersion` are excluded from the ceiling (`spawnedSupply: null`) rather than
 * silently computed under post-26.1 constants.
 */
export const calculateLaneCsAt10Comparison = (
  laneMinionsFirst10Minutes: number,
  patchOrConfig?: string | MinionWaveTimingConfig
): LaneCsAt10Comparison => {
  const actual = Math.max(0, Math.round(laneMinionsFirst10Minutes));
  const config =
    typeof patchOrConfig === 'object' && patchOrConfig !== null
      ? patchOrConfig
      : getMinionWaveConfigForPatch(patchOrConfig);

  if (!config) {
    return {
      actual,
      spawnedSupply: null,
      wavesSpawned: null,
      cannonWavesSpawned: null,
      supplyLabel: null,
    };
  }

  const { spawnedSupply, wavesSpawned, cannonWavesSpawned } = calculateSpawnedLaneMinionsByMinute(
    10,
    config
  );

  return {
    actual,
    spawnedSupply,
    wavesSpawned,
    cannonWavesSpawned,
    supplyLabel: 'Theoretical spawned supply (not guaranteed farmable)',
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
