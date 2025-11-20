import React, { useState, useEffect } from 'react';
import type { MatchDto } from '../types/match';
import MatchHistoryItem from './MatchHistoryItem';

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
}

/** The number of matches to display per page/load. */
const MATCHES_PER_PAGE = 10;

/**
 * Renders a list of a summoner's recent matches.
 * It implements a "Load More" functionality to progressively display the match history.
 */
const MatchHistory: React.FC<MatchHistoryProps> = ({ puuid, matches, onPlayerClick }) => {
  const [visibleCount, setVisibleCount] = useState(MATCHES_PER_PAGE);

  /** Effect to reset the visible match count when a new summoner is searched (i.e., the `matches` prop changes). */
  useEffect(() => {
    setVisibleCount(MATCHES_PER_PAGE);
  }, [matches]);

  // The loading and error states are now handled by SearchPage.
  // We just need to handle the case where there are no matches.

  if (!matches || matches.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center mt-4">No recent matches found.</p>;
  }
  
  // Slice the full matches array to get only the ones that should be currently visible.
  const visibleMatches = matches.slice(0, visibleCount);

  return (
    <div className="mt-4 space-y-2">
      {visibleMatches.map((match, index) => (
        // Each match is rendered by the MatchHistoryItem component.
        <MatchHistoryItem key={index} match={match} puuid={puuid} onPlayerClick={onPlayerClick} />
      ))}
      {visibleCount < matches.length && (
        <div className="mt-4 text-center">
          <button onClick={() => setVisibleCount(prev => prev + MATCHES_PER_PAGE)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors duration-200">
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchHistory;
