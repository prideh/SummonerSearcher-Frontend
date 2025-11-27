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
  losses: number;
  totalGames: number;
  consistency: number;
  lossConsistency: number;
}

const STAT_ROLE_MAPPING: Record<string, 'ALL' | 'JUNGLE' | 'SUPPORT'> = {
  // ... (unchanged)
  controlWardTimeCoverageInRiverOrEnemyHalf: 'SUPPORT',
  // ... (rest of the mapping is unchanged, just showing context)
  earliestBaron: 'JUNGLE',
  earliestDragonTakedown: 'JUNGLE',
  epicMonsterKillsNearEnemyJungler: 'JUNGLE',
  buffsStolen: 'JUNGLE',
  firstTurretKilled: 'ALL',
};

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  earliestBaron: "First Baron",
  earliestDragonTakedown: "First Dragon",
  maxCsAdvantageOnLaneOpponent: "CS lead vs opponent",
  maxLevelLeadLaneOpponent: "Level lead vs opponent",
  damageTakenOnTeamPercentage: "Damage taken compared to opponent",
  turretPlatesTaken: "Plates lead vs opponent",
  buffsStolen: "Buffs stolen"
};

const ConsistencyStats: React.FC<ConsistencyStatsProps> = ({ matches, puuid }) => {
  const consistentStats = useMemo(() => {
    const statsMap: Record<string, { wins: number; losses: number; totalGames: number }> = {};
    // const recentMatches = matches; // Removed to allow filtering later

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
            // Check for tie
            if (sortedRoles.length > 1 && sortedRoles[1][1] === sortedRoles[0][1]) {
                isMultirole = true;
            }
        }
    }

    // Filter matches to ONLY include Main Role games, UNLESS it's a multirole situation
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
      
      // Get all unique keys from both player and opponent
      const allKeys = new Set([...Object.keys(playerChallenges), ...Object.keys(opponentChallenges)]);
      
      allKeys.forEach(key => {
        // Exclusions
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

        // Role Filtering
        // Role Filtering - STRICT CHECK
        // If a stat is role-specific, we ONLY count it if the player was actually playing that role.
        // Otherwise, we'd be counting "0 wins" for a Jungler stat when playing Support, which is unfair.
        const requiredRole = STAT_ROLE_MAPPING[key];
        
        // If the stat is specific to JUNGLE, but the player is NOT playing JUNGLE in this specific match, skip it.
        if (requiredRole === 'JUNGLE' && player.teamPosition !== 'JUNGLE') return;
        
        // If the stat is specific to SUPPORT, but the player is NOT playing UTILITY in this specific match, skip it.
        if (requiredRole === 'SUPPORT' && player.teamPosition !== 'UTILITY') return;

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

        // PREVIOUS LOGIC REMOVED:
        // if (isPlayerMissing && isOpponentMissing) return;
        // We NOW want to count these "neutral" games (where neither got the stat) as part of the totalGames.
        // This ensures that "100% consistency" actually means "happens in every game", not "happens in every game where at least one person got it".

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
            // If not a winner and values are different, it's a loss
            statsMap[key].losses++;
        }
      });
    });

    // Convert to array and calculate consistency
    const statsArray: StatConsistency[] = Object.entries(statsMap).map(([key, data]) => ({
        key,
        wins: data.wins,
        losses: data.losses,
        totalGames: data.totalGames,
        // Consistency is now just a display value, logic depends on wins vs losses
        consistency: data.totalGames > 0 ? (data.wins / data.totalGames) * 100 : 0,
        lossConsistency: data.totalGames > 0 ? (data.losses / data.totalGames) * 100 : 0
    }));

    // Filter for reasonable sample size (e.g. at least 3 games)
    const validStats = statsArray.filter(s => s.totalGames >= 3);

    // Strength: Wins > Losses
    const bestStats = [...validStats]
        .filter(s => s.wins > s.losses)
        .sort((a, b) => b.consistency - a.consistency)
        .slice(0, 5);

    // Weakness: Losses > Wins
    const worstStats = [...validStats]
        .filter(s => s.losses > s.wins)
        .sort((a, b) => b.lossConsistency - a.lossConsistency) // Sort by how often opponent wins
        .slice(0, 5);

    return { bestStats, worstStats };

  }, [matches, puuid]);

  if (!consistentStats || (consistentStats.bestStats.length === 0 && consistentStats.worstStats.length === 0)) {
      return null; 
  }

  return (
    <div className="grid grid-cols-1 gap-3">
        {consistentStats.bestStats.length > 0 && (
            <div className="text-center md:text-left">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Top Strengths</h3>
                <ul className="space-y-0.5">
                    {consistentStats.bestStats.slice(0, 5).map(stat => {
                        const displayName = DISPLAY_NAME_OVERRIDES[stat.key] || camelCaseToTitleCase(stat.key);
                        return (
                            <li key={stat.key} className="text-xs text-gray-700 dark:text-gray-300 flex justify-between items-center">
                                <span className="flex-1 min-w-0 truncate mr-2" title={displayName}>{displayName}</span>
                                <span className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">{stat.consistency.toFixed(0)}%</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        )}

        {consistentStats.worstStats.length > 0 && (
            <div className="text-center md:text-left">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Top Weaknesses</h3>
                <ul className="space-y-0.5">
                    {consistentStats.worstStats.slice(0, 5).map(stat => {
                        const displayName = DISPLAY_NAME_OVERRIDES[stat.key] || camelCaseToTitleCase(stat.key);
                        return (
                            <li key={stat.key} className="text-xs text-gray-700 dark:text-gray-300 flex justify-between items-center">
                                <span className="flex-1 min-w-0 truncate mr-2" title={displayName}>{displayName}</span>
                                <span className="font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">{stat.lossConsistency.toFixed(0)}%</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        )}
    </div>
  );
};

export default ConsistencyStats;
