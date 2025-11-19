import React, { memo } from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import ItemIcon from './ItemIcon';
import SummonerSpellIcon from './SummonerSpellIcon';
import RuneIcon from './RuneIcon';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';

interface ScoreboardTabProps {
  match: MatchDto;
  puuid: string;
  onPlayerClick: (name: string, tag: string) => void;
}

const formatNumber = (num: number | undefined) => {
  if (num === undefined) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

const TeamDetails: React.FC<{ team: ParticipantDto[]; searchedPlayerPuuid: string; teamId: number; isWin: boolean | undefined; onPlayerClick: (name: string, tag: string) => void; isRemake: boolean; }> = memo(({ team, searchedPlayerPuuid, teamId, isWin, onPlayerClick, isRemake }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const teamKills = team.reduce((acc, p) => acc + (p.kills ?? 0), 0);
  const teamDeaths = team.reduce((acc, p) => acc + (p.deaths ?? 0), 0);
  const teamAssists = team.reduce((acc, p) => acc + (p.assists ?? 0), 0);
  const teamGold = team.reduce((acc, p) => acc + (p.goldEarned ?? 0), 0);

  const getHeaderInfo = () => {
    if (isRemake) {
      return {
        bgClass: 'bg-gray-500/20',
        textClass: 'text-gray-400',
        label: 'Remake',
      };
    }
    return isWin
      ? { bgClass: 'bg-blue-500/10', textClass: teamId === 100 ? 'text-blue-400' : 'text-red-400', label: 'Victory' }
      : { bgClass: 'bg-red-900/30', textClass: teamId === 100 ? 'text-blue-400' : 'text-red-400', label: 'Defeat' };
  };
  const headerInfo = getHeaderInfo();
  return (
    <div className="bg-black/10 rounded-md">
      {/* Team Header */}
      <div className={`flex justify-between items-center p-2 rounded-t-md ${headerInfo.bgClass}`}>
        <p className={`font-bold ${headerInfo.textClass}`}>
          {headerInfo.label} ({teamId === 100 ? 'Blue' : 'Red'} Team)
        </p>
        <div className="flex items-center space-x-4 text-gray-300 text-xs">
          <span title="Gold"><span className="font-semibold text-white">{formatNumber(teamGold)}</span> G</span>
          <span className="font-semibold text-white">{teamKills} / {teamDeaths} / {teamAssists}</span>
        </div>
      </div>

      {/* Player Rows */}
      <div className="text-xs">
        {team.map((p, index) => (
          <div 
            key={p.participantId} 
            className={`grid grid-cols-[1fr_90px_60px_40px_200px] gap-x-2 items-center p-1.5 cursor-pointer hover:bg-gray-500/20 transition-colors duration-150 ${p.puuid === searchedPlayerPuuid ? 'bg-blue-500/20' : (index % 2 === 0 ? 'bg-gray-500/5' : 'bg-transparent')}`}
            onClick={() => {
              if (p.riotIdGameName && p.riotIdTagline) {
                onPlayerClick(p.riotIdGameName, p.riotIdTagline);
              }
            }}
          >
            {/* Player */}
            <div className="flex items-center space-x-2 min-w-0">
              <div className="shrink-0">
                <img src={`${CDN_URL}/img/champion/${getCorrectChampionName(p.championName)}.png`} alt={p.championName} className="w-8 h-8 rounded" />
              </div>
              <div className="flex flex-col space-y-0.5 shrink-0">
                <SummonerSpellIcon spellId={p.summoner1Id} className="w-5 h-5" />
                <SummonerSpellIcon spellId={p.summoner2Id} className="w-5 h-5" /> 
              </div>
              <div className="flex flex-col space-y-0.5 shrink-0">
                <RuneIcon 
                  runeId={(p.perks?.styles || [])[0]?.selections?.[0]?.perk}
                  isKeystone={true} 
                  className="w-5 h-5" 
                />
                <RuneIcon 
                  runeId={(p.perks?.styles || [])[1]?.style}
                  className="w-5 h-5" 
                />
              </div>
              <div 
                className="truncate" 
                data-tooltip-id="player-name-tooltip"
                data-tooltip-content={`${p.riotIdGameName}#${p.riotIdTagline}`}
              >
                <span className={`font-semibold ${p.puuid === searchedPlayerPuuid ? 'text-blue-300' : 'text-white'}`}>{p.riotIdGameName}</span>
                <span className="text-gray-500 ml-1">#{p.riotIdTagline}</span>
              </div>
            </div>
            {/* KDA */}
            <div className="text-center font-semibold text-white text-[11px]">{p.kills} / {p.deaths} / {p.assists}</div>
            {/* Damage */}
            <div 
              className="text-center text-gray-300"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={`Physical: ${formatNumber(p.physicalDamageDealtToChampions)} | Magic: ${formatNumber(p.magicDamageDealtToChampions)} | True: ${formatNumber(p.trueDamageDealtToChampions)}`}
            >
              {formatNumber(p.totalDamageDealtToChampions)}
            </div>
            {/* CS */}
            <div 
              className="text-center text-gray-300"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={`Minions: ${p.totalMinionsKilled} | Jungle: ${p.neutralMinionsKilled}`}
            >
              {(p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)}
            </div>
            {/* Items */}
            <div className="flex items-center space-x-1 justify-center">
              {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map((item, i) => (
                <ItemIcon key={i} itemId={item} className={`w-6 h-6 ${i === 6 ? 'ml-1' : ''}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const ScoreboardTab: React.FC<ScoreboardTabProps> = ({ match, puuid, onPlayerClick }) => {
  if (!match.info) return null;

  const blueTeam = match.info.participants.filter(p => p.teamId === 100);
  const redTeam = match.info.participants.filter(p => p.teamId === 200);
  const isRemake = match.info.participants[0]?.gameEndedInEarlySurrender || false;

  return (
    <div className="grid grid-cols-2 gap-x-3 p-3">
      <TeamDetails team={blueTeam} searchedPlayerPuuid={puuid} teamId={100} isWin={blueTeam[0]?.win} onPlayerClick={onPlayerClick} isRemake={isRemake} />
      <TeamDetails team={redTeam} searchedPlayerPuuid={puuid} teamId={200} isWin={redTeam[0]?.win} onPlayerClick={onPlayerClick} isRemake={isRemake} />
    </div>
  );
};

export default ScoreboardTab;