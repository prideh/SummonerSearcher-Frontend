import React, { useMemo } from 'react';
import type { MatchDto } from '../types/match';
import { camelCaseToTitleCase } from '../utils/formatters';
import { calculateConsistency } from '../utils/statsCalculator';

interface ConsistencyStatsProps {
  matches: MatchDto[];
  puuid: string;
}

const ConsistencyStats: React.FC<ConsistencyStatsProps> = ({ matches, puuid }) => {
  const consistentStats = useMemo(() => {
    return calculateConsistency(matches, puuid);
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
                        const displayName = camelCaseToTitleCase(stat.key);
                        return (
                            <li key={stat.key} className="text-xs text-gray-700 dark:text-gray-300 flex justify-between items-center">
                                <span className="flex-1 min-w-0 truncate mr-2" title={displayName}>{displayName}</span>
                                <span className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">{Number(stat.consistency).toFixed(0)}%</span>
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
                        const displayName = camelCaseToTitleCase(stat.key);
                        return (
                            <li key={stat.key} className="text-xs text-gray-700 dark:text-gray-300 flex justify-between items-center">
                                <span className="flex-1 min-w-0 truncate mr-2" title={displayName}>{displayName}</span>
                                <span className="font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">{Number(stat.lossConsistency).toFixed(0)}%</span>
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
