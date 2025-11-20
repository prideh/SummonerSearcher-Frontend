import React from 'react';
import type { ParticipantDto } from '../types/match';
import RoleIcon from './RoleIcon';
import SummonerSpellIcon from './SummonerSpellIcon';
import RuneIcon from './RuneIcon';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';

interface PlayerStatsProps {
  participant: ParticipantDto;
  onPlayerClick?: (name: string, tag: string) => void;
  isOpponent?: boolean;
  teamParticipants: ParticipantDto[];
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ participant, onPlayerClick, isOpponent = false, teamParticipants }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  const {
    championName,
    kills,
    deaths,
    assists,
    summoner1Id,
    summoner2Id,
    totalMinionsKilled,
    neutralMinionsKilled,
    teamPosition,
    challenges = {},
    perks = { styles: [] },
    riotIdGameName,
    riotIdTagline,
  } = participant;

  const kda = ((kills ?? 0) + (assists ?? 0)) / (deaths === 0 ? 1 : (deaths ?? 1));
  const cs = (totalMinionsKilled ?? 0) + (neutralMinionsKilled ?? 0);
  
  const playerStyles = perks?.styles || [];
  const primaryRune = playerStyles[0]?.selections?.[0]?.perk;
  const secondaryPath = playerStyles[1]?.style;

  const teamKills = teamParticipants.reduce((acc, p) => acc + (p.kills ?? 0), 0);
  const killParticipation = teamKills > 0 ? (((kills ?? 0) + (assists ?? 0)) / teamKills) * 100 : 0;

  const playerStatsContent = (
    <>
      {/* Champion & Spells */}
      <div className="flex items-center space-x-2">
        {!isOpponent && (
          <div className="w-6 h-6 hidden md:block">
            <RoleIcon role={teamPosition} className="w-6 h-6" />
          </div>
        )}
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
        <div className="h-6 mt-1">
          {(challenges?.soloKills ?? 0) > 0 && (
            <p className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded inline-block">Solo Kills: {challenges?.soloKills}</p>
          )}
        </div>
      </div>
    </>
  );

  if (isOpponent) {
    return (
      <div 
        className="grid grid-cols-[auto_auto_1fr_auto] gap-x-3 items-center w-full cursor-pointer group"
        onClick={() => {
          if (onPlayerClick && riotIdGameName && riotIdTagline) {
            onPlayerClick(riotIdGameName, riotIdTagline);
          }
        }}
      >
        <img 
          src={`${CDN_URL}/img/champion/${getCorrectChampionName(championName)}.png`} 
          alt={championName} 
          className="w-16 h-16 rounded-md group-hover:opacity-80 transition-opacity"
          data-tooltip-id="player-name-tooltip"
          data-tooltip-content={championName}
        />
        <div className="flex flex-col space-y-1 shrink-0">
          <SummonerSpellIcon spellId={summoner1Id} className="w-7 h-7" /> 
          <SummonerSpellIcon spellId={summoner2Id} className="w-7 h-7" />
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <div className="truncate" title={`${riotIdGameName}#${riotIdTagline}`}>
            <span className="font-semibold text-white group-hover:text-blue-300 transition-colors">
              {riotIdGameName}
            </span>
            <span className="text-gray-500 ml-1">#{riotIdTagline}</span>
          </div>
          <div className="flex space-x-1 mt-1">
            <RuneIcon runeId={primaryRune} isKeystone={true} className="w-5 h-5" />
            <RuneIcon runeId={secondaryPath} className="w-5 h-5" />
          </div>
        </div>
        <div className="text-center min-h-[100px]">
          <p className="text-lg font-bold text-white whitespace-nowrap">
            <span className="text-green-400">{kills}</span> / <span className="text-red-400">{deaths}</span> / <span className="text-yellow-400">{assists}</span>
          </p>
          {deaths === 0 ? (
            <p className="text-xs font-semibold text-yellow-400 mt-1">Infinite KDA</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">{kda.toFixed(2)} KDA</p>
          )}
          <p className="text-xs text-gray-300 mt-1">CS: {cs}</p>
          <p className="text-xs text-red-300 mt-1">KP: {killParticipation.toFixed(0)}%</p>
          <div className="h-6 mt-1">
            {(challenges?.soloKills ?? 0) > 0 && (
              <p className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded inline-block">Solo Kills: {challenges?.soloKills}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4 justify-between">
      {playerStatsContent}
    </div>
  );
};

export default PlayerStats;
