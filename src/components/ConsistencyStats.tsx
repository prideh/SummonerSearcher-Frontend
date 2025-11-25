import React, { useMemo } from 'react';
import type { MatchDto } from '../types/match';
import { camelCaseToTitleCase } from '../utils/formatters';

interface ConsistencyStatsProps {
  matches: MatchDto[];
  puuid: string;
}

interface StatConsistency {
  key: string;
  wins: number;
  totalGames: number;
  consistency: number;
}

const STAT_ROLE_MAPPING: Record<string, 'ALL' | 'JUNGLE' | 'SUPPORT'> = {
  // Support Only
  controlWardTimeCoverageInRiverOrEnemyHalf: 'SUPPORT',
  fasterSupportQuestCompletion: 'SUPPORT',
  mostWardsDestroyedOneSweeper: 'SUPPORT',
  threeWardsOneSweeperCount: 'SUPPORT',
  visionScoreAdvantageLaneOpponent: 'SUPPORT',
  completeSupportQuestInTime: 'SUPPORT',
  effectiveHealAndShielding: 'SUPPORT',

  // Jungle Only
  earliestBaron: 'JUNGLE',
  earliestDragonTakedown: 'JUNGLE',
  junglerKillsEarlyJungle: 'JUNGLE',
  killsOnLanersEarlyJungleAsJungler: 'JUNGLE',
  voidMonsterKill: 'JUNGLE',
  buffsStolen: 'JUNGLE',
  dragonTakedowns: 'JUNGLE',
  epicMonsterKillsNearEnemyJungler: 'JUNGLE',
  epicMonsterKillsWithin30SecondsOfSpawn: 'JUNGLE',

  // All Roles (Explicitly listed for clarity, default is ALL)
  earlyLaningPhaseGoldExpAdvantage: 'ALL',
  highestChampionDamage: 'ALL',
  highestCrowdControlScore: 'ALL',
  laningPhaseGoldExpAdvantage: 'ALL',
  legendaryCount: 'ALL',
  maxCsAdvantageOnLaneOpponent: 'ALL',
  maxLevelLeadLaneOpponent: 'ALL',
  soloTurretsLategame: 'ALL',
  takedownsFirst25Minutes: 'ALL',
  teleportTakedowns: 'ALL',
  turretPlatesTaken: 'ALL',
  InfernalScalePickup: 'ALL',
  alliedJungleMonsterKills: 'ALL',
  bountyGold: 'ALL',
  controlWardsPlaced: 'ALL',
  damagePerMinute: 'ALL',
  damageTakenOnTeamPercentage: 'ALL',
  dodgeSkillShotsSmallWindow: 'ALL',
  enemyChampionImmobilizations: 'ALL',
  enemyJungleMonsterKills: 'ALL',
  epicMonsterSteals: 'ALL',
  epicMonsterStolenWithoutSmite: 'ALL',
  firstTurretKilled: 'ALL',
};

const ConsistencyStats: React.FC<ConsistencyStatsProps> = ({ matches, puuid }) => {
  const consistentStats = useMemo(() => {
    const statsMap: Record<string, { wins: number; totalGames: number }> = {};
    const recentMatches = matches.slice(0, 20); // Analyze last 20 games

    // Calculate Main Role
    const roleCounts: Record<string, number> = {};
    let roleTotalGames = 0;
    recentMatches.forEach(match => {
        const p = match.info?.participants.find(part => part.puuid === puuid);
        if (p && p.teamPosition && p.teamPosition !== 'NONE') {
            roleCounts[p.teamPosition] = (roleCounts[p.teamPosition] || 0) + 1;
            roleTotalGames++;
        }
    });

    let mainRole: 'JUNGLE' | 'SUPPORT' | 'ALL' = 'ALL';
    if (roleTotalGames > 0) {
        const sortedRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
        if (sortedRoles.length > 0) {
            const [bestRole, count] = sortedRoles[0];
            const percentage = (count / roleTotalGames) * 100;
            if (percentage >= 60) {
                if (bestRole === 'JUNGLE') mainRole = 'JUNGLE';
                else if (bestRole === 'UTILITY') mainRole = 'SUPPORT';
            }
        }
    }

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

      const playerChallenges = (player.challenges || {}) as Record<string, any>;
      const opponentChallenges = (opponent.challenges || {}) as Record<string, any>;
      
      // Get all unique keys from both player and opponent
      const allKeys = new Set([...Object.keys(playerChallenges), ...Object.keys(opponentChallenges)]);
      
      allKeys.forEach(key => {
        // Exclusions
        if (key === 'legendaryItemUsed' || 
            key === 'playedChampSelectPosition' || 
            key === 'soloKills' || 
            key === 'abilityUses' ||
            key === 'fullTeamTakedown' ||
            key === 'flawlessAces' ||
            key === 'acesBefore15Minutes' ||
            key === 'firstTurretKilledTime' ||
            key === 'bountyGold' ||
            key === 'getTakedownsInAllLanesEarlyJungleAsLaner') return;

        // Role Filtering
        const requiredRole = STAT_ROLE_MAPPING[key];
        if (requiredRole === 'JUNGLE' && mainRole !== 'JUNGLE') return;
        if (requiredRole === 'SUPPORT' && mainRole !== 'SUPPORT') return;

        const playerValue = playerChallenges[key];
        const opponentValue = opponentChallenges[key];
        
        // Determine winner
        const isLowerBetter = key.toLowerCase().startsWith('earliest') || 
                              key.toLowerCase().startsWith('fastest') || 
                              key.toLowerCase().startsWith('shortest');

        // Treat undefined/null values as 0 for higher-better, or Infinity for lower-better
        // Also treat 0 as Infinity for time-based stats (since 0 usually means didn't happen)
        let pVal = playerValue;
        if (pVal === undefined || pVal === null || (isLowerBetter && pVal === 0)) {
            pVal = isLowerBetter ? Infinity : 0;
        }

        let oppVal = opponentValue;
        if (oppVal === undefined || oppVal === null || (isLowerBetter && oppVal === 0)) {
            oppVal = isLowerBetter ? Infinity : 0;
        }

        // If both are "missing" (0, null, or undefined), skip this stat
        const isPlayerMissing = playerValue === undefined || playerValue === null || playerValue === 0;
        const isOpponentMissing = opponentValue === undefined || opponentValue === null || opponentValue === 0;
        
        if (isPlayerMissing && isOpponentMissing) return;

        if (!statsMap[key]) {
            statsMap[key] = { wins: 0, totalGames: 0 };
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
        }
      });
    });

    // Convert to array and calculate consistency
    const statsArray: StatConsistency[] = Object.entries(statsMap).map(([key, data]) => ({
        key,
        wins: data.wins,
        totalGames: data.totalGames,
        consistency: data.totalGames > 0 ? (data.wins / data.totalGames) * 100 : 0
    }));

    // Filter for reasonable sample size (e.g. at least 3 games)
    const validStats = statsArray.filter(s => s.totalGames >= 3);

    const bestStats = [...validStats]
        .filter(s => s.consistency >= 50)
        .sort((a, b) => b.consistency - a.consistency)
        .slice(0, 5);

    const worstStats = [...validStats]
        .filter(s => s.consistency < 50)
        .sort((a, b) => a.consistency - b.consistency)
        .slice(0, 5);

    return { bestStats, worstStats };

  }, [matches, puuid]);

  if (consistentStats.bestStats.length === 0 && consistentStats.worstStats.length === 0) {
      return null; 
  }

  return (
    <div className="grid grid-cols-1 gap-3">
        {consistentStats.bestStats.length > 0 && (
            <div className="text-center md:text-left">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Top Strengths</h3>
                <ul className="space-y-0.5">
                    {consistentStats.bestStats.slice(0, 5).map(stat => (
                        <li key={stat.key} className="text-xs text-gray-700 dark:text-gray-300 flex justify-between items-center">
                            <span className="flex-1 min-w-0 truncate mr-2" title={camelCaseToTitleCase(stat.key)}>{camelCaseToTitleCase(stat.key)}</span>
                            <span className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">{stat.consistency.toFixed(0)}%</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {consistentStats.worstStats.length > 0 && (
            <div className="text-center md:text-left">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Top Weaknesses</h3>
                <ul className="space-y-0.5">
                    {consistentStats.worstStats.slice(0, 5).map(stat => (
                        <li key={stat.key} className="text-xs text-gray-700 dark:text-gray-300 flex justify-between items-center">
                            <span className="flex-1 min-w-0 truncate mr-2" title={camelCaseToTitleCase(stat.key)}>{camelCaseToTitleCase(stat.key)}</span>
                            <span className="font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">{stat.consistency.toFixed(0)}%</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
  );
};

export default ConsistencyStats;
