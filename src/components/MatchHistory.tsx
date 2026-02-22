import React from 'react';
import type { MatchDto } from '../types/match';
import MatchHistoryItem from './MatchHistoryItem';
import { Skeleton } from './ui/Skeleton';

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
}

/**
 * Renders a list of a summoner's recent matches.
 * It implements a "Load More" functionality to progressively display the match history.
 */
const MatchHistory: React.FC<MatchHistoryProps> = ({ puuid, matches, onPlayerClick, onLoadMore, hasMore, loadingMore }) => {
  // The loading and error states are now handled by SearchPage.
  // We just need to handle the case where there are no matches.

  if (!matches || matches.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center mt-4">No recent matches found.</p>;
  }
  
  return (
    <div className="mt-4 space-y-2">
      {matches.map((match, index) => (
        // Each match is rendered by the MatchHistoryItem component.
        <MatchHistoryItem key={index} match={match} puuid={puuid} onPlayerClick={onPlayerClick} />
      ))}
      {loadingMore && (
        <div className="space-y-2 mt-4">
          {[...Array(3)].map((_, i) => (
             <Skeleton key={`skeleton-${i}`} className="h-[120px] w-full rounded-lg bg-white/50 dark:bg-gray-900/40 backdrop-blur-sm" />
          ))}
        </div>
      )}
      
      {hasMore && !loadingMore && (
        <div className="mt-4 text-center">
          <button 
            onClick={onLoadMore} 
            disabled={loadingMore}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchHistory;
