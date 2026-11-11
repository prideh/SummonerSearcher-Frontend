import React, { useState, useRef, useEffect, memo } from 'react';
import type { MatchDto } from '../types/match';
import MatchDetails from './MatchDetails.tsx';
import { getQueueType, formatDuration, getMatchOutcomeStyles } from '../utils/matchHistoryHelper';
import PlayerStats from './PlayerStats.tsx';
import { useTimeAgo } from '../hooks/useTimeAgo';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';

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
  /** The server region, used for timeline API calls in the Details tab. */
  region: string;
}

import ItemList from './ItemList';
/**
 * Represents a single match in the match history list. It provides a summary view
 * and can be expanded to show more detailed information via the MatchDetails component.
 */
const MatchHistoryItem: React.FC<MatchHistoryItemProps> = ({ match, puuid, onPlayerClick, region }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [timeAgo, ref] = useTimeAgo(match.info?.gameCreation);
  const cardRef = useRef<HTMLDivElement>(null);
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

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
      <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg mb-2 flex items-center justify-between text-sm">
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
  const blueTeam = participants.filter(p => p.teamId === 100);
  const redTeam = participants.filter(p => p.teamId === 200);

  // Determine styling and labels based on the match outcome.
  const outcome = getMatchOutcomeStyles(win, gameEndedInEarlySurrender);
  const teamColorClass = teamId === 100 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      ref={(el: HTMLDivElement | null) => {
        // Assign to both refs
        if (ref && 'current' in ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
        cardRef.current = el;
      }}
      className={cn("relative w-full max-w-full min-w-0 shadow-xs hover:shadow-sm transition-shadow overflow-hidden telemetry-nums", outcome.container, 'rounded-lg')}
    >
      <div
        className={cn(
          "flex items-center w-full min-w-0 cursor-pointer transition-colors",
          "hover:bg-white/40 dark:hover:bg-slate-900/40"
        )}
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Main content area that changes on expand/collapse */}
        <div className={`flex-grow min-w-0 ${showDetails ? "flex items-center justify-between px-3 sm:px-4 py-2.5 text-sm" : "grid grid-cols-1 md:grid-cols-[125px_1fr_auto_1fr_auto] xl:grid-cols-[125px_1fr_auto_1fr_auto_185px] gap-3 items-center px-3.5 py-3 text-sm"}`}>

          {/* Title when expanded */}
          {showDetails && (
            <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
              <span className={cn(
                "px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider rounded border shrink-0",
                outcome.label === 'Victory'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : outcome.label === 'Defeat'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-400/30'
              )}>
                {outcome.label}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {getQueueType(queueId)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                · {formatDuration(gameDuration)} · {timeAgo}
              </span>
            </div>
          )}

          {/* Game Info - Hidden when details are shown */}
          {!showDetails && (
            <div className="flex justify-between items-center md:flex-col md:items-start md:justify-start pr-2 md:pr-0">
              <div>
                <p className={cn("text-xs font-extrabold uppercase tracking-wider", outcome.text)}>
                  {outcome.label}
                </p>
                <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate text-sm mt-0.5">{getQueueType(queueId)}</p>
                <p
                  className="text-[11px] text-slate-500 dark:text-slate-400"
                  data-tooltip-id="player-name-tooltip"
                  data-tooltip-content={gameCreation ? new Date(gameCreation).toLocaleString() : 'Unknown time'}
                >
                  {timeAgo}
                </p>
              </div>
              <div className="hidden md:block w-10 border-t border-slate-300/80 dark:border-slate-700/80 my-1.5"></div>
              <div className="text-right md:text-left">
                {outcome.label === 'Remake' ? (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Remake</p>
                ) : (
                  <p className={`text-xs font-bold ${teamColorClass}`}>{teamId === 100 ? 'Blue Side' : 'Red Side'}</p>
                )}
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{formatDuration(gameDuration)}</p>
              </div>
            </div>
          )}

          {/* Player Stats - Hidden when details are shown */}
          {!showDetails && (
            <PlayerStats
              participant={player}
              teamParticipants={participants.filter(p => p.teamId === player.teamId)}
              gameVersion={match.info.gameVersion}
            />
          )}

          {/* "VS" Separator - Hidden when details are shown */}
          {!showDetails && (
            <div className="text-center">
              {opponent && (
                <span className="inline-block text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded">
                  vs
                </span>
              )}
            </div>
          )}

          {/* Opponent Stats - Hidden when details are shown */}
          {!showDetails && (
            <div className="text-slate-500 dark:text-slate-400 flex justify-start w-full min-w-0">
              {opponent && (
                <PlayerStats
                  participant={opponent}
                  teamParticipants={participants.filter(p => p.teamId === opponent.teamId)}
                  onPlayerClick={onPlayerClick}
                  isOpponent={true}
                  gameVersion={match.info.gameVersion}
                />
              )}
            </div>
          )}

          {/* Items - Hidden when details are shown */}
          {!showDetails && (
            <div className="flex items-center justify-center">
              <ItemList mainItems={mainItems} trinket={trinket} roleBoundItem={player.roleBoundItem} />
            </div>
          )}

          {/* 10-Player Telemetry Roster - Shown on XL desktop when collapsed */}
          {!showDetails && (
            <div className="hidden xl:grid grid-cols-2 gap-x-2 text-[11px] leading-tight border-l border-slate-200/80 dark:border-slate-800/80 pl-3">
              {[blueTeam, redTeam].map((teamRoster, teamIdx) => (
                <div key={teamIdx} className="space-y-1 min-w-0">
                  {teamRoster.map(p => (
                    <div
                      key={p.puuid}
                      className="flex items-center space-x-1 min-w-0 cursor-pointer group/roster"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (p.riotIdGameName && p.riotIdTagline) {
                          onPlayerClick(p.riotIdGameName, p.riotIdTagline);
                        }
                      }}
                      title={`${p.riotIdGameName}#${p.riotIdTagline}`}
                    >
                      <img
                        src={`${CDN_URL}/img/champion/${getCorrectChampionName(p.championName)}.png`}
                        alt={p.championName}
                        loading="lazy"
                        className="w-3.5 h-3.5 rounded-xs shrink-0 border border-slate-300/60 dark:border-slate-700"
                      />
                      <span
                        className={cn(
                          "truncate group-hover/roster:text-sky-600 dark:group-hover/roster:text-cyan-400 transition-colors",
                          p.puuid === puuid
                            ? "font-extrabold text-slate-900 dark:text-white"
                            : "font-medium text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {p.riotIdGameName || p.summonerName}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expand Button */}
        <div className="flex-shrink-0 flex items-center justify-center w-11 self-stretch border-l border-slate-200/60 dark:border-slate-800/60">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className={`p-1.5 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 ${showDetails ? 'rotate-180 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'}`}
            aria-expanded={showDetails}
            aria-label={showDetails ? 'Collapse match details' : 'Expand match details'}
            aria-controls={`match-details-${match.info.gameId}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <MatchDetails match={match} puuid={puuid} onPlayerClick={onPlayerClick} id={`match-details-${match.info.gameId}`} region={region} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default memo(MatchHistoryItem, (prevProps, nextProps) => {
  if (prevProps.puuid !== nextProps.puuid) return false;
  if (prevProps.match.info?.gameId !== nextProps.match.info?.gameId) return false;
  const prevParts = prevProps.match.info?.participants;
  const nextParts = nextProps.match.info?.participants;
  if (prevParts?.length !== nextParts?.length) return false;
  if (prevParts && nextParts) {
    for (let i = 0; i < prevParts.length; i++) {
      if (prevParts[i].roleBoundItem !== nextParts[i].roleBoundItem) return false;
    }
  }
  return true;
});
