import React, { useMemo, useState } from 'react';
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

type OutcomeFilter = 'all' | 'win' | 'loss';

/**
 * Renders a list of a summoner's recent matches.
 * It implements a "Load More" functionality to progressively display the match history.
 */
const MatchHistory: React.FC<MatchHistoryProps> = ({ puuid, matches, onPlayerClick, onLoadMore, hasMore, loadingMore, region }) => {
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  const avgLaneCsAt10 = useMemo(
    () => calculateAverageLaneCsAt10(matches, puuid),
    [matches, puuid]
  );

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    if (outcomeFilter === 'all') return matches;
    return matches.filter((m) => {
      const p = m.info?.participants?.find((part) => part.puuid === puuid);
      if (!p || p.gameEndedInEarlySurrender) return false;
      return outcomeFilter === 'win' ? Boolean(p.win) : !p.win;
    });
  }, [matches, outcomeFilter, puuid]);

  if (!matches || matches.length === 0) {
    return <p className="text-slate-500 dark:text-slate-400 text-center mt-4 text-sm">No recent matches found.</p>;
  }

  const showAvgLaneCsTarget = Boolean(
    avgLaneCsAt10 &&
      avgLaneCsAt10.avgTarget !== null &&
      avgLaneCsAt10.targetMatchCount === avgLaneCsAt10.matchCount
  );

  const avgLaneCsAt10Tooltip = avgLaneCsAt10
    ? showAvgLaneCsTarget
      ? `Average lane-only CS @ 10:00 across ${avgLaneCsAt10.matchCount} laner ${avgLaneCsAt10.matchCount === 1 ? 'game' : 'games'}: ${avgLaneCsAt10.avgActual.toFixed(1)} last-hit / ${avgLaneCsAt10.avgTarget} target (${avgLaneCsAt10.targetLabel}; Top/Bot 114, Mid 120)`
      : `Average lane-only CS @ 10:00 across ${avgLaneCsAt10.matchCount} laner ${avgLaneCsAt10.matchCount === 1 ? 'game' : 'games'}: ${avgLaneCsAt10.avgActual.toFixed(1)} last-hit`
    : undefined;
  
  return (
    <div className="mt-4 space-y-2.5 w-full min-w-0">
      {/* Match Feed Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-[#090d16] p-0.5 border border-slate-200 dark:border-slate-800">
          {([
            { id: 'all', label: 'All Matches' },
            { id: 'win', label: 'Victories' },
            { id: 'loss', label: 'Defeats' },
          ] as { id: OutcomeFilter; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOutcomeFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                outcomeFilter === tab.id
                  ? 'bg-white dark:bg-[#111827] text-sky-600 dark:text-cyan-400 shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 telemetry-nums">
          Showing {filteredMatches.length} of {matches.length} loaded games
        </span>
      </div>

      {avgLaneCsAt10 && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-xs telemetry-nums shadow-xs"
          data-testid="match-history-avg-lane-cs-10"
          title={avgLaneCsAt10Tooltip}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
              Avg Lane CS@10 ({avgLaneCsAt10.matchCount} {avgLaneCsAt10.matchCount === 1 ? 'game' : 'games'}):
            </span>
            <span className="font-extrabold text-sky-600 dark:text-cyan-400">
              {avgLaneCsAt10.avgActual.toFixed(1)}
            </span>
            {showAvgLaneCsTarget && (
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                / {avgLaneCsAt10.avgTarget} target
              </span>
            )}
          </div>
          {showAvgLaneCsTarget && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Lane target ({avgLaneCsAt10.targetLabel}; Top/Bot 114, Mid 120)
            </span>
          )}
        </div>
      )}
      {filteredMatches.map((match, index) => (
        <MatchHistoryItem key={match.metadata?.matchId ?? index} match={match} puuid={puuid} onPlayerClick={onPlayerClick} region={region} />
      ))}
      {loadingMore && (
        <div className="space-y-2.5 mt-4">
          {[...Array(3)].map((_, i) => (
             <Skeleton key={`skeleton-${i}`} className="h-[116px] w-full rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      )}
      
      {hasMore && !loadingMore && (
        <div className="mt-5 text-center">
          <button 
            onClick={onLoadMore} 
            disabled={loadingMore}
            className="bg-white hover:bg-slate-50 dark:bg-[#111827] dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold uppercase tracking-wider py-2.5 px-8 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchHistory;

