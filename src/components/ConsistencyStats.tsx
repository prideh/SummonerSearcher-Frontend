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
    <div className="grid grid-cols-1 gap-3 telemetry-nums">
        {consistentStats.bestStats.length > 0 && (
            <div className="text-center md:text-left">
                <h3 className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">Top Strengths</h3>
                <ul className="space-y-1">
                    {consistentStats.bestStats.slice(0, 3).map(stat => {
                        const displayName = camelCaseToTitleCase(stat.key);
                        return (
                            <li key={stat.key} className="text-xs text-slate-700 dark:text-slate-300 flex justify-between items-center bg-white/80 dark:bg-slate-900/70 px-2.5 py-1 rounded border border-slate-200/80 dark:border-slate-800">
                                <span className="flex-1 min-w-0 truncate mr-2 font-medium" title={displayName}>{displayName}</span>
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{Number(stat.consistency).toFixed(0)}%</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        )}

        {consistentStats.worstStats.length > 0 && (
            <div className="text-center md:text-left">
                <h3 className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1.5">Top Weaknesses</h3>
                <ul className="space-y-1">
                    {consistentStats.worstStats.slice(0, 3).map(stat => {
                        const displayName = camelCaseToTitleCase(stat.key);
                        return (
                            <li key={stat.key} className="text-xs text-slate-700 dark:text-slate-300 flex justify-between items-center bg-white/80 dark:bg-slate-900/70 px-2.5 py-1 rounded border border-slate-200/80 dark:border-slate-800">
                                <span className="flex-1 min-w-0 truncate mr-2 font-medium" title={displayName}>{displayName}</span>
                                <span className="font-extrabold text-rose-600 dark:text-rose-400 whitespace-nowrap">{Number(stat.lossConsistency).toFixed(0)}%</span>
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
