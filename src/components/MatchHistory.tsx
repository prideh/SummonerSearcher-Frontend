import React, { useState, useEffect } from 'react';
import type { MatchDto } from '../types/match';
import MatchHistoryItem from './MatchHistoryItem';

interface MatchHistoryProps {
  puuid: string;
  matches: MatchDto[];
  onPlayerClick: (name: string, tag: string) => void;
}

const MATCHES_PER_PAGE = 10;

const MatchHistory: React.FC<MatchHistoryProps> = ({ puuid, matches, onPlayerClick }) => {
  const [visibleCount, setVisibleCount] = useState(MATCHES_PER_PAGE);

  // When the matches prop changes (i.e., a new summoner is searched),
  // reset the number of visible matches back to the initial count.
  useEffect(() => {
    setVisibleCount(MATCHES_PER_PAGE);
  }, [matches]);

  // The loading and error states are now handled by SearchPage.
  // We just need to handle the case where there are no matches.

  if (!matches || matches.length === 0) {
    return <p className="text-gray-400 text-center mt-4">No recent matches found.</p>;
  }
  
  const visibleMatches = matches.slice(0, visibleCount);

  return (
    <div className="mt-4 space-y-2">
      {visibleMatches.map((match, index) => (
        <MatchHistoryItem key={index} match={match} puuid={puuid} onPlayerClick={onPlayerClick} />
      ))}
      {visibleCount < matches.length && (
        <div className="mt-4 text-center">
          <button onClick={() => setVisibleCount(prev => prev + MATCHES_PER_PAGE)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchHistory;
