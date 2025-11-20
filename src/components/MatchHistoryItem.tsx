import React, { useState } from 'react';
import type { MatchDto } from '../types/match';
import MatchDetails from './MatchDetails.tsx';
import { getQueueType, formatDuration, getMatchOutcomeStyles } from '../utils/matchHistoryHelper';
import PlayerStats from './PlayerStats.tsx';
import { useTimeAgo } from '../hooks/useTimeAgo';

interface MatchHistoryItemProps {
  match: MatchDto;
  puuid: string; // The PUUID of the summoner we are searching for
  onPlayerClick: (name: string, tag: string) => void;
}

import ItemList from './ItemList';

const MatchHistoryItem: React.FC<MatchHistoryItemProps> = ({ match, puuid, onPlayerClick }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [timeAgo, ref] = useTimeAgo(match.info?.gameCreation);

  if (!match.info) return null;

  const { gameCreation, gameDuration, participants, queueId } = match.info;

  const player = participants.find(p => p.puuid === puuid);

  if (!player) {
    return (
      <div className="bg-gray-800 p-3 rounded-lg mb-2 flex items-center justify-between text-sm">
        <p>Player data not found for this match.</p>
      </div>
    );
  }

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
    gameEndedInEarlySurrender
  } = player;

  const mainItems = [item0, item1, item2, item3, item4, item5];
  const trinket = item6;

  const outcome = getMatchOutcomeStyles(win, gameEndedInEarlySurrender);
  return (
    <div ref={ref} className={`relative border-l-4 ${outcome.container} ${showDetails ? 'rounded-t-lg' : 'rounded-lg'}`}>
      <div className="grid grid-cols-1 md:grid-cols-[130px_1fr_auto_1fr_280px_40px] gap-4 items-center p-4 text-sm bg-gray-900/50">
        {/* Game Info */}
        <div className="flex justify-between items-center md:flex-col md:items-start md:justify-start pr-10 md:pr-0">
          <p className="font-bold text-gray-100 truncate text-lg md:text-base">{getQueueType(queueId)}</p>
          <p 
            className="text-xs text-gray-400"
            data-tooltip-id="player-name-tooltip"
            data-tooltip-content={gameCreation ? new Date(gameCreation).toLocaleString() : 'Unknown time'}
          >
            {timeAgo}
          </p>
          <div className="hidden md:block w-12 border-t border-gray-700 my-1"></div>
          <div className="text-right md:text-left">
            <p className={`font-semibold ${outcome.text}`}>{outcome.label}</p>
            <p className="text-gray-400">{formatDuration(gameDuration)}</p>
          </div>
        </div>

        {/* Player Stats */}
        <PlayerStats 
          participant={player} 
          teamParticipants={participants.filter(p => p.teamId === player.teamId)} 
        />

        {/* "VS" Separator */}
        <div className="text-center">
          {opponent && <span className="text-lg font-bold text-gray-600 px-2">vs</span>}
        </div>

        {/* Opponent Stats */}
        <div className="text-gray-400 flex justify-start w-full">
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
          <button onClick={() => setShowDetails(!showDetails)} className={`p-2 rounded-md transition-all duration-200 ${showDetails ? 'rotate-180 bg-gray-700' : 'bg-gray-800/50 hover:bg-gray-800'}`}>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        </div>
      </div>
      {showDetails && <MatchDetails match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
    </div>
  );
};

export default MatchHistoryItem;
