import React, { useState, useRef, useEffect } from 'react';
import type { MatchDto } from '../types/match';
import MatchDetails from './MatchDetails.tsx';
import { getQueueType, formatDuration, getMatchOutcomeStyles } from '../utils/matchHistoryHelper';
import PlayerStats from './PlayerStats.tsx';
import { useTimeAgo } from '../hooks/useTimeAgo';

/**
 * Props for the MatchHistoryItem component.
 */
interface MatchHistoryItemProps {
  /** The full data for a single match. */
  match: MatchDto;
  /** The PUUID of the summoner we are searching for, to highlight their data. */
  puuid: string;
  /** Callback function to handle clicks on player names, allowing for a new search. */
  onPlayerClick: (name: string, tag: string) => void;
}

import ItemList from './ItemList';
/**
 * Represents a single match in the match history list. It provides a summary view
 * and can be expanded to show more detailed information via the MatchDetails component.
 */
const MatchHistoryItem: React.FC<MatchHistoryItemProps> = ({ match, puuid, onPlayerClick }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [timeAgo, ref] = useTimeAgo(match.info?.gameCreation);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to card when details are expanded
  useEffect(() => {
    if (showDetails && cardRef.current) {
      // Wait for the details to render, then scroll
      setTimeout(() => {
        if (cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
          
          // Only scroll if the bottom of the card is not fully visible
          if (!isVisible) {
            cardRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest' 
            });
          }
        }
      }, 100); // Small delay to ensure MatchDetails has rendered
    }
  }, [showDetails]);

  if (!match.info) return null;

  const { gameCreation, gameDuration, participants, queueId } = match.info;

  // Find the main player's data within the participants list.
  const player = participants.find(p => p.puuid === puuid);

  if (!player) {
    return (
      <div className="bg-gray-200 dark:bg-gray-800 p-3 rounded-lg mb-2 flex items-center justify-between text-sm">
        <p>Player data not found for this match.</p>
      </div>
    );
  }

  // Find the direct lane opponent for a quick "vs" comparison in the summary.
  const opponent = participants.find(p => 
    p.teamId !== player.teamId && 
    p.teamPosition === player.teamPosition &&
    p.teamPosition &&
    p.teamPosition !== 'NONE'
  );

  const {
    win,
    item0,
    item1,
    item2,
    item3,
    item4,
    item5,
    item6,
    teamId,
    gameEndedInEarlySurrender
  } = player;

  const mainItems = [item0, item1, item2, item3, item4, item5];
  const trinket = item6;

  // Determine styling and labels based on the match outcome.
  const outcome = getMatchOutcomeStyles(win, gameEndedInEarlySurrender);
  const teamColorClass = teamId === 100 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';
  return (
    <div 
      ref={(el) => {
        // Assign to both refs
        if (ref && 'current' in ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
        cardRef.current = el;
      }}
      className={`relative border-l-4 ${outcome.container} ${showDetails ? 'rounded-t-lg' : 'rounded-lg'}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[130px_1fr_auto_1fr_280px_40px] gap-4 items-center p-4 text-sm bg-white/50 dark:bg-gray-900/50">
        {/* Game Info */}
        <div className="flex justify-between items-center md:flex-col md:items-start md:justify-start pr-10 md:pr-0">
          <p className="font-bold text-gray-800 dark:text-gray-100 truncate text-lg md:text-base">{getQueueType(queueId)}</p>
          <p 
            className="text-xs text-gray-500 dark:text-gray-400"
            data-tooltip-id="player-name-tooltip"
            data-tooltip-content={gameCreation ? new Date(gameCreation).toLocaleString() : 'Unknown time'}
          >
            {timeAgo}
          </p>
          <div className="hidden md:block w-12 border-t border-gray-300 dark:border-gray-700 my-1"></div>
          <div className="text-right md:text-left">
            {outcome.label === 'Remake' ? (
              <p className="font-semibold text-gray-500 dark:text-gray-400">Remake</p>
            ) : (
              <p className={`font-semibold ${teamColorClass}`}>{teamId === 100 ? 'Blue Side' : 'Red Side'}</p>
            )}
            <p className="text-gray-500 dark:text-gray-400">{formatDuration(gameDuration)}</p>
          </div>
        </div>

        {/* Player Stats */}
        <PlayerStats 
          participant={player} 
          teamParticipants={participants.filter(p => p.teamId === player.teamId)} 
        />

        {/* "VS" Separator */}
        <div className="text-center">
          {opponent && <span className="text-lg font-bold text-gray-400 dark:text-gray-600 px-2">vs</span>}
        </div>

        {/* Opponent Stats */}
        <div className="text-gray-500 dark:text-gray-400 flex justify-start w-full">
          {opponent && (
            <PlayerStats 
              participant={opponent}
              teamParticipants={participants.filter(p => p.teamId === opponent.teamId)}
              onPlayerClick={onPlayerClick}
              isOpponent={true}
            />
          )}
        </div>

        {/* Items */}
        <div className="flex items-center justify-center">
          <ItemList mainItems={mainItems} trinket={trinket} />
        </div>

        {/* Expand Button */}
        <div className="absolute top-2 right-2 md:static flex items-center justify-center">
          <button 
            onClick={() => setShowDetails(!showDetails)} 
            className={`p-2 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${showDetails ? 'rotate-180 bg-gray-300 dark:bg-gray-700' : 'bg-gray-200 dark:bg-gray-800/50 hover:bg-gray-300 dark:hover:bg-gray-800'}`}
            aria-expanded={showDetails}
            aria-label={showDetails ? 'Collapse match details' : 'Expand match details'}
            aria-controls={`match-details-${match.info.gameId}`}
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        </div>
      </div>
      {showDetails && <MatchDetails match={match} puuid={puuid} onPlayerClick={onPlayerClick} id={`match-details-${match.info.gameId}`} />}
    </div>
  );
};

export default MatchHistoryItem;
