import React, { useMemo } from 'react';
import type { MatchDto } from '../types/match';
import MatchHistoryItem from './MatchHistoryItem';
import { Skeleton } from './ui/Skeleton';
import { calculateAverageLaneCsAt10 } from '../utils/statsCalculator';

/**
 * Props for the MatchHistory component.
 */
interface MatchHistoryProps {
  /** The PUUID of the searched summoner. */
  puuid: string;
  /** An array of the summoner's recent matches. */
  matches: MatchDto[];
  /** Callback function to handle clicks on player names within a match. */
  onPlayerClick: (name: string, tag: string) => void;
  /** Callback to load more matches. */
  onLoadMore: () => void;
  /** Whether there are more matches to load. */
  hasMore: boolean;
  /** Whether more matches are currently loading. */
  loadingMore: boolean;
  /** The server region, forwarded to the Details timeline tab. */
  region: string;
}

/**
 * Renders a list of a summoner's recent matches.
 * It implements a "Load More" functionality to progressively display the match history.
 */
const MatchHistory: React.FC<MatchHistoryProps> = ({ puuid, matches, onPlayerClick, onLoadMore, hasMore, loadingMore, region }) => {
  // The loading and error states are now handled by SearchPage.
  // We just need to handle the case where there are no matches.
  const avgLaneCsAt10 = useMemo(
    () => calculateAverageLaneCsAt10(matches, puuid),
    [matches, puuid]
  );

  if (!matches || matches.length === 0) {
    return <p className="text-slate-500 dark:text-slate-400 text-center mt-4 text-sm">No recent matches found.</p>;
  }

  const avgLaneCsAt10Tooltip = avgLaneCsAt10
    ? avgLaneCsAt10.avgSpawnedSupply !== null
      ? `Average lane-only CS @ 10:00 across ${avgLaneCsAt10.matchCount} laner ${avgLaneCsAt10.matchCount === 1 ? 'game' : 'games'}: ${avgLaneCsAt10.avgActual.toFixed(1)} last-hit / ${avgLaneCsAt10.avgSpawnedSupply} theoretical spawned supply (${avgLaneCsAt10.ceilingMatchCount} patch 26.1+ ${avgLaneCsAt10.ceilingMatchCount === 1 ? 'game' : 'games'}; not guaranteed farmable)`
      : `Average lane-only CS @ 10:00 across ${avgLaneCsAt10.matchCount} laner ${avgLaneCsAt10.matchCount === 1 ? 'game' : 'games'}: ${avgLaneCsAt10.avgActual.toFixed(1)} last-hit`
    : undefined;
  
  return (
    <div className="mt-4 space-y-2.5 w-full min-w-0">
      {avgLaneCsAt10 && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-xs telemetry-nums shadow-xs"
          data-testid="match-history-avg-lane-cs-10"
          title={avgLaneCsAt10Tooltip}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
              Avg Lane CS@10 ({avgLaneCsAt10.matchCount} {avgLaneCsAt10.matchCount === 1 ? 'game' : 'games'}):
            </span>
            <span className="font-extrabold text-slate-900 dark:text-slate-100">
              {avgLaneCsAt10.avgActual.toFixed(1)}
            </span>
            {avgLaneCsAt10.avgSpawnedSupply !== null && (
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                / {avgLaneCsAt10.avgSpawnedSupply} spawned*
              </span>
            )}
          </div>
          {avgLaneCsAt10.avgSpawnedSupply !== null && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              *Theoretical spawned supply ({avgLaneCsAt10.ceilingMatchCount} patch 26.1+ {avgLaneCsAt10.ceilingMatchCount === 1 ? 'game' : 'games'}), not guaranteed farmable
            </span>
          )}
        </div>
      )}
      {matches.map((match, index) => (
        // Each match is rendered by the MatchHistoryItem component.
        <MatchHistoryItem key={index} match={match} puuid={puuid} onPlayerClick={onPlayerClick} region={region} />
      ))}
      {loadingMore && (
        <div className="space-y-2.5 mt-4">
          {[...Array(3)].map((_, i) => (
             <Skeleton key={`skeleton-${i}`} className="h-[116px] w-full rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      )}
      
      {hasMore && !loadingMore && (
        <div className="mt-5 text-center">
          <button 
            onClick={onLoadMore} 
            disabled={loadingMore}
            className="bg-white hover:bg-slate-50 dark:bg-[#111827] dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold uppercase tracking-wider py-2.5 px-8 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchHistory;
