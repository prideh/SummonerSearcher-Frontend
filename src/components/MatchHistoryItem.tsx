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
    <div className={`border-l-4 ${outcome.container} ${showDetails ? 'rounded-t-lg' : 'rounded-lg'}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4 p-3 text-sm">
        {/* Game Info (Left Column on Desktop) */}
        <div className="flex justify-between items-center md:flex-col md:items-start md:justify-start md:w-[110px] md:text-left shrink-0">
          <div className="md:w-full">
            <p className="font-bold text-white truncate">{getQueueType(queueId)}</p>
            <p
              className="text-xs text-gray-400"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={gameCreation ? new Date(gameCreation).toLocaleString() : 'Unknown time'}
            >
              {timeAgo(gameCreation)}
            </p>
          </div>
          <div className="text-right md:text-left">
            <div className="w-12 border-t border-gray-600 my-1 hidden md:block"></div>
            <p className={`font-semibold ${outcome.text}`}>{outcome.label}</p>
            <p className="text-gray-400 text-xs">{formatDuration(gameDuration)}</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
          {/* Player & Opponent Stats */}
          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {/* Player Stats */}
            <div className="flex items-center space-x-2">
              <div className="relative shrink-0">
                <img
                  src={`${CDN_URL}/img/champion/${getCorrectChampionName(championName)}.png`}
                  alt={championName}
                  className="w-12 h-12 rounded-md"
                />
                <RoleIcon role={teamPosition} className="absolute -bottom-1 -left-1 w-5 h-5" />
              </div>
              <div className="flex flex-col space-y-1 shrink-0">
                <SummonerSpellIcon spellId={summoner1Id} className="w-6 h-6" />
                <SummonerSpellIcon spellId={summoner2Id} className="w-6 h-6" />
              </div>
              <div className="flex flex-col space-y-1 shrink-0">
                <RuneIcon runeId={primaryRune} isKeystone={true} className="w-6 h-6" />
                <RuneIcon runeId={secondaryPath} className="w-6 h-6" />
              </div>
            </div>

            {/* "VS" Separator */}
            <div className="text-center">
              {opponent && <span className="text-lg font-bold text-gray-500">vs</span>}
            </div>

            {/* Opponent Stats */}
            <div className="flex items-center justify-end space-x-2">
              {opponent && (
                <>
                  <div className="flex flex-col space-y-1 shrink-0">
                    <RuneIcon runeId={opponent.perks?.styles?.[0]?.selections?.[0]?.perk} isKeystone={true} className="w-6 h-6" />
                    <RuneIcon runeId={opponent.perks?.styles?.[1]?.style} className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col space-y-1 shrink-0">
                    <SummonerSpellIcon spellId={opponent.summoner1Id} className="w-6 h-6" />
                    <SummonerSpellIcon spellId={opponent.summoner2Id} className="w-6 h-6" />
                  </div>
                  <div
                    className="relative shrink-0 cursor-pointer group"
                    onClick={() => onPlayerClick(opponent.riotIdGameName!, opponent.riotIdTagline!)}
                  >
                    <img
                      src={`${CDN_URL}/img/champion/${getCorrectChampionName(opponent.championName)}.png`}
                      alt={opponent.championName}
                      className="w-12 h-12 rounded-md group-hover:opacity-80"
                    />
                    <RoleIcon role={opponent.teamPosition} className="absolute -bottom-1 -right-1 w-5 h-5" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* KDA, CS, KP Stats */}
          <div className="flex justify-around items-center text-center md:w-[150px] shrink-0">
            <div>
              <p className="font-bold text-white whitespace-nowrap">
                <span className="text-green-400">{kills}</span> / <span className="text-red-400">{deaths}</span> / <span className="text-yellow-400">{assists}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{kda.toFixed(2)} KDA</p>
            </div>
            <div className="h-5 mt-1">
              {(challenges?.soloKills ?? 0) > 0 && (
                <p className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded inline-block">Solo Kills: {challenges.soloKills}</p>
              )}
            </div>
            <div>
              <p className="text-gray-300">CS {cs}</p>
              <p className="text-xs text-red-300 mt-1">KP {killParticipation.toFixed(0)}%</p>
            </div>
          </div>

          {/* Items */}
          <div className="flex items-center space-x-1 justify-center md:justify-start">
            <div className="grid grid-cols-3 gap-1">
              {mainItems.map((item, i) => (
                <ItemIcon key={i} itemId={item} />
              ))}
            </div>
            <div className="ml-1">
              <ItemIcon itemId={trinket} />
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <div className="flex items-center justify-center md:w-[40px] shrink-0">
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
