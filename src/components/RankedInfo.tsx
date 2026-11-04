import React, { useMemo } from 'react';
import type { LeagueEntryDto, SummonerData } from '../types/summoner';
import type { MatchDto } from '../types/match';
import ConsistencyStats from './ConsistencyStats';
import RecentChampionStats from './RecentChampionStats';
import { useDataDragonStore } from '../store/dataDragonStore';
import { calculateStatsFromMatches } from '../utils/statsCalculator';
import { getWinRateColorClass } from '../utils/colorUtils';

/**
 * Props for the RankedInfo component.
 */
interface RankedInfoProps {
  /** The ranked data for the summoner (tier, rank, LP, etc.). */
  rankedData: LeagueEntryDto;
  /** The full summoner data object. */
  summonerData: SummonerData;
  /** The subset of matches currently visible in the match history. */
  matches: MatchDto[];
}

/**
 * Displays a summoner's ranked information, including their tier emblem, rank, LP, and win/loss record.
 * It also includes the `RecentChampionStats` component to show performance on recently played champions.
 */
const RankedInfo: React.FC<RankedInfoProps> = ({ rankedData, summonerData, matches }) => {
  const communityDragonUrl = useDataDragonStore(state => state.communityDragonUrl);
  
  // Calculate recent stats based on visible matches
  const { championStats: recentChampionStats, overallStats: recentOverallStats } = useMemo(() => {
      return calculateStatsFromMatches(matches, summonerData.puuid);
  }, [matches, summonerData.puuid]);

  // Calculate the win rate, handling the case of zero total games.
  const wins = Number(rankedData.wins || 0);
  const losses = Number(rankedData.losses || 0);
  const totalGames = wins + losses;
  const winRate = totalGames > 0
    ? ((wins / totalGames) * 100).toFixed(1)
    : 'N/A';

  return (
    <div className="bg-slate-50/70 dark:bg-[#0b101d] rounded-lg mt-4 border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ranked Solo/Duo</h3>
            {(() => {
              if (!matches || matches.length === 0) return null;
              
              const roleCounts: Record<string, number> = {};
              let totalRoleGames = 0;

              matches.forEach(match => {
                const participant = match.info?.participants.find(p => p.puuid === summonerData.puuid);
                if (participant && participant.teamPosition && participant.teamPosition !== 'NONE') {
                  roleCounts[participant.teamPosition] = (roleCounts[participant.teamPosition] || 0) + 1;
                  totalRoleGames++;
                }
              });

              if (totalRoleGames === 0) return null;

              const sortedRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
              if (sortedRoles.length === 0) return null;

              const [bestRole, count] = sortedRoles[0];
              
              if (sortedRoles.length > 1 && sortedRoles[1][1] === count) {
                  return <p className="text-[10px] px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">Multirole</p>;
              }

              const roleName = bestRole === 'UTILITY' ? 'Support' : 
                               bestRole === 'BOTTOM' ? 'ADC' : 
                               bestRole === 'MIDDLE' ? 'Mid' : 
                               bestRole.charAt(0) + bestRole.slice(1).toLowerCase();
              return <p className="text-[10px] px-2 py-0.5 rounded bg-sky-50 dark:bg-cyan-950/60 border border-sky-200 dark:border-cyan-800/60 text-sky-700 dark:text-cyan-300 font-bold uppercase tracking-wider">{roleName} Main</p>;
            })()}
          </div>
          <div className="flex items-center space-x-3.5">
            {rankedData.tier && (
              <div className="w-16 h-16 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1 shrink-0">
                <img
                  src={`${communityDragonUrl}/rcp-fe-lol-shared-components/global/default/images/${rankedData.tier.toLowerCase()}.png`}
                  alt={rankedData.tier}
                  className="w-14 h-14 object-contain"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-extrabold capitalize text-slate-900 dark:text-white leading-tight tracking-tight">
                {rankedData.tier?.toLowerCase() || 'Unranked'} {rankedData.rank}
              </p>
              <div className="flex items-center text-sm text-slate-700 dark:text-slate-200 space-x-2 mt-1 telemetry-nums">
                <span className="font-bold text-sky-600 dark:text-cyan-400">{rankedData.leaguePoints} LP</span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {rankedData.wins}W / {rankedData.losses}L (<span className={`${getWinRateColorClass(parseFloat(winRate))} font-bold`}>{winRate}%</span>)
                </span>
              </div>
              {totalGames > 0 && (
                <div className="w-full h-1.5 bg-rose-500/30 dark:bg-rose-500/30 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-emerald-500 rounded-l-full"
                    style={{ width: `${Math.min(100, Math.max(0, (wins / totalGames) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4">
          {/* Display stats for recently played champions (calculated from visible matches). */}
          {summonerData && <RecentChampionStats championStats={recentChampionStats} overallStats={recentOverallStats} />}
        </div>
        
        <div className="p-4">
          {/* Display consistent stats (best and worst). */}
          {summonerData && <ConsistencyStats matches={matches} puuid={summonerData.puuid} />}
        </div>
      </div>
    </div>
  );
};

export default RankedInfo;
