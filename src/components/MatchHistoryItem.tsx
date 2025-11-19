import React, { useState } from 'react';
import type { MatchDto } from '../types/match';
import MatchDetails from './MatchDetails.tsx';
import RoleIcon from './RoleIcon.tsx';
import ItemIcon from './ItemIcon.tsx';
import SummonerSpellIcon from './SummonerSpellIcon.tsx';
import RuneIcon from './RuneIcon.tsx';
import { useDataDragonStore } from '../store/dataDragonStore.ts';
import { getCorrectChampionName } from '../utils/championNameHelper.ts';

interface MatchHistoryItemProps {
  match: MatchDto;
  puuid: string; // The PUUID of the summoner we are searching for
  onPlayerClick: (name: string, tag: string) => void;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const timeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

const MatchHistoryItem: React.FC<MatchHistoryItemProps> = ({ match, puuid, onPlayerClick }) => {
  const [showDetails, setShowDetails] = useState(false);
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  if (!match.info) return null;

  const { gameCreation, gameDuration, participants, queueId } = match.info;

  const player = participants.find(p => p.puuid === puuid);

  if (!player) {
    // This can happen in custom games where the searched player might not be a participant
    return (
      <div className="bg-gray-700 p-3 rounded-lg mb-2 flex items-center justify-between text-sm">
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
    championName,
    kills,
    deaths,
    assists,
    item0,
    item1,
    item2,
    item3,
    item4,
    item5,
    item6,
    summoner1Id,
    summoner2Id,
    totalMinionsKilled,
    neutralMinionsKilled,
    teamPosition,
    challenges = {},
    perks = { styles: [] }
    , gameEndedInEarlySurrender
  } = player;

  const kda = ((kills ?? 0) + (assists ?? 0)) / (deaths === 0 ? 1 : (deaths ?? 1));

  const mainItems = [item0, item1, item2, item3, item4, item5];
  const trinket = item6;
  const cs = (totalMinionsKilled ?? 0) + (neutralMinionsKilled ?? 0);
  
  const playerStyles = perks?.styles || [];
  const primaryRune = playerStyles[0]?.selections?.[0]?.perk;
  const secondaryPath = playerStyles[1]?.style;

  const teamKills = participants
    .filter(p => p.teamId === player.teamId)
    .reduce((acc, p) => acc + (p.kills ?? 0), 0);
  const killParticipation = teamKills > 0 ? (((kills ?? 0) + (assists ?? 0)) / teamKills) * 100 : 0;


  const getQueueType = (id: number | undefined) => {
    switch (id) {
      case 420: return 'Ranked Solo';
      case 440: return 'Ranked Flex';
      case 450: return 'ARAM';
      case 400: return 'Normal Draft';
      case 430: return 'Normal Blind';
      default: return 'Other';
    }
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeAgo = (timestamp: number | undefined) => {
    if (!timestamp) return '';
    const elapsed = (timestamp - Date.now()) / 1000;

    for (const [unit, secondsInUnit] of timeUnits) {
      if (Math.abs(elapsed) > secondsInUnit || unit === 'second') {
        const value = Math.round(elapsed / secondsInUnit);
        return rtf.format(value, unit);
      }
    }

    return 'just now';
  };

  const getMatchOutcomeStyles = () => {
    if (gameEndedInEarlySurrender) {
      return {
        container: 'bg-gray-700/20 border-gray-500',
        text: 'text-gray-400',
        label: 'Remake',
      };
    }
    return win
      ? { container: 'bg-blue-900/30 border-blue-500', text: 'text-blue-400', label: 'Victory' }
      : { container: 'bg-red-900/30 border-red-700', text: 'text-red-300', label: 'Defeat' };
  };
  const outcome = getMatchOutcomeStyles();
  return (
    <div className={`relative border-l-4 ${outcome.container} ${showDetails ? 'rounded-t-lg' : 'rounded-lg'}`}>
      <div className="grid grid-cols-1 md:grid-cols-[130px_1fr_auto_1fr_280px_40px] gap-4 items-center p-4 text-sm bg-gray-800/50">
        {/* Game Info */}
        <div className="flex justify-between items-center md:flex-col md:items-start md:justify-start pr-10 md:pr-0">
          <p className="font-bold text-white truncate text-lg md:text-base">{getQueueType(queueId)}</p>
          <p 
            className="text-xs text-gray-400"
            data-tooltip-id="player-name-tooltip"
            data-tooltip-content={gameCreation ? new Date(gameCreation).toLocaleString() : 'Unknown time'}
          >
            {timeAgo(gameCreation)}
          </p>
          <div className="hidden md:block w-12 border-t border-gray-600 my-1"></div>
          <div className="text-right md:text-left">
            <p className={`font-semibold ${outcome.text}`}>{outcome.label}</p>
            <p className="text-gray-400">{formatDuration(gameDuration)}</p>
          </div>
        </div>

        {/* Player Stats */}
        <div className="flex items-center space-x-4 justify-between">
          {/* Champion & Spells */}
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 hidden md:block"> {/* Placeholder container */}
              <RoleIcon role={teamPosition} className="w-6 h-6" />
            </div>
            <img
              src={`${CDN_URL}/img/champion/${getCorrectChampionName(championName)}.png`}
              alt={championName}
              className="w-16 h-16 rounded-md"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={championName}
            />
            <div className="flex flex-col space-y-1 shrink-0">
              <SummonerSpellIcon spellId={summoner1Id} className="w-7 h-7" />
              <SummonerSpellIcon spellId={summoner2Id} className="w-7 h-7" />
            </div>
            <div className="flex flex-col space-y-1 shrink-0">
              <RuneIcon runeId={primaryRune} isKeystone={true} className="w-7 h-7" />
              <RuneIcon runeId={secondaryPath} className="w-7 h-7" />
            </div>
          </div>
          {/* KDA */}
          <div className="text-center min-h-[100px]">
            <p className="text-lg font-bold text-white whitespace-nowrap">
              <span className="text-green-400">{kills}</span> / <span className="text-red-400">{deaths}</span> / <span className="text-yellow-400">{assists}</span>
            </p>
            {deaths === 0 ? (
              <p className="text-xs font-semibold text-yellow-400 mt-1">Infinite KDA</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">{kda.toFixed(2)} KDA</p>
            )}
            <p 
              className="text-xs text-gray-300 mt-1"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={`Minions: ${totalMinionsKilled} | Jungle: ${neutralMinionsKilled}`}
            >
              CS: {cs}
            </p>
            <p className="text-xs text-red-300 mt-1">KP: {killParticipation.toFixed(0)}%</p>
            <div className="h-6 mt-1"> {/* Placeholder container */}
              {(challenges?.soloKills ?? 0) > 0 && (
                <p className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded inline-block">Solo Kills: {challenges?.soloKills}</p>
              )}
            </div>
          </div>
        </div>

        {/* "VS" Separator */}
        <div className="text-center">
          {opponent && <span className="text-lg font-bold text-gray-500 px-2">vs</span>}
        </div>

        {/* Opponent Stats */}
        <div className="text-gray-400 flex justify-start w-full">
          {opponent && (
            <div 
              className="grid grid-cols-[auto_auto_1fr_auto] gap-x-3 items-center w-full cursor-pointer group"
              onClick={() => {
                if (opponent.riotIdGameName && opponent.riotIdTagline) {
                  onPlayerClick(opponent.riotIdGameName, opponent.riotIdTagline);
                }
              }}
            >
              <img 
                src={`${CDN_URL}/img/champion/${getCorrectChampionName(opponent.championName)}.png`} 
                alt={opponent.championName} 
                className="w-16 h-16 rounded-md group-hover:opacity-80 transition-opacity"
                data-tooltip-id="player-name-tooltip"
                data-tooltip-content={opponent.championName}
              />
              <div className="flex flex-col space-y-1 shrink-0">
                <SummonerSpellIcon spellId={opponent.summoner1Id} className="w-7 h-7" /> 
                <SummonerSpellIcon spellId={opponent.summoner2Id} className="w-7 h-7" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="truncate" title={`${opponent.riotIdGameName}#${opponent.riotIdTagline}`}>
                  <span className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {opponent.riotIdGameName}
                  </span>
                  <span className="text-gray-500 ml-1">#{opponent.riotIdTagline}</span>
                </div>
                <div className="flex space-x-1 mt-1">
                  <RuneIcon runeId={opponent.perks?.styles?.[0]?.selections?.[0]?.perk} isKeystone={true} className="w-5 h-5" />
                  <RuneIcon runeId={opponent.perks?.styles?.[1]?.style} className="w-5 h-5" />
                </div>
              </div>
              <div className="text-center min-h-[100px]">
                <p className="text-lg font-bold text-white whitespace-nowrap">
                  <span className="text-green-400">{opponent.kills}</span> / <span className="text-red-400">{opponent.deaths}</span> / <span className="text-yellow-400">{opponent.assists}</span>
                </p>
                {opponent.deaths === 0 ? (
                  <p className="text-xs font-semibold text-yellow-400 mt-1">Infinite KDA</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">{(((opponent.kills ?? 0) + (opponent.assists ?? 0)) / (opponent.deaths ?? 1)).toFixed(2)} KDA</p>
                )}
                <p className="text-xs text-gray-300 mt-1">CS: {(opponent.totalMinionsKilled ?? 0) + (opponent.neutralMinionsKilled ?? 0)}</p>
                <p className="text-xs text-red-300 mt-1">KP: {
                  (() => {
                    const teamKills = participants.filter(p => p.teamId === opponent.teamId).reduce((acc, p) => acc + (p.kills ?? 0), 0);
                    return teamKills > 0 ? (((opponent.kills ?? 0) + (opponent.assists ?? 0)) / teamKills) * 100 : 0;
                  })().toFixed(0)
                }%</p>
                <div className="h-6 mt-1"> {/* Placeholder container */}
                  {(opponent.challenges?.soloKills ?? 0) > 0 && (
                    <p className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded inline-block">Solo Kills: {opponent.challenges?.soloKills}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="flex items-center justify-center">
          {/* Mobile: Single flex row for all items */}
          <div className="flex md:hidden items-center gap-1">
            {mainItems.map((item, i) => (
              <ItemIcon key={`mobile-main-${i}`} itemId={item} className="w-8 h-8" />
            ))}
            <ItemIcon key="mobile-trinket" itemId={trinket} className="w-8 h-8 ml-1" />
          </div>
          {/* Desktop: 3x2 grid for main items, trinket separate */}
          <div className="hidden md:flex items-center">
            <div className="grid grid-cols-3 gap-1">{mainItems.map((item, i) => (<ItemIcon key={`desktop-main-${i}`} itemId={item} className="w-8 h-8" />))}</div>
            <div className="ml-2"><ItemIcon key="desktop-trinket" itemId={trinket} className="w-8 h-8" /></div>
          </div>
        </div>

        {/* Expand Button */}
        <div className="absolute top-2 right-2 md:static flex items-center justify-center">
          <button onClick={() => setShowDetails(!showDetails)} className={`p-2 rounded-md transition-all duration-200 ${showDetails ? 'rotate-180 bg-gray-600' : 'bg-gray-500/20 hover:bg-gray-500/40'}`}>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        </div>
      </div>
      {showDetails && <MatchDetails match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
    </div>
  );
};

export default MatchHistoryItem;
