import React, { memo } from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import ItemIcon from './ItemIcon';
import SummonerSpellIcon from './SummonerSpellIcon';
import RuneIcon from './RuneIcon';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';

/**
 * Props for the ScoreboardTab component.
 */
interface ScoreboardTabProps {
  /** The full match data object. */
  match: MatchDto;
  /** The PUUID of the searched player to highlight their row. */
  puuid: string;
  /** Callback function to handle clicks on player names. */
  onPlayerClick: (name: string, tag: string) => void;
}

/**
 * Formats a number for display, using 'k' for thousands.
 * @param num - The number to format.
 * @returns A formatted string (e.g., 1234 becomes '1.2k').
 */
const formatNumber = (num: number | undefined) => {
  if (num === undefined) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

/**
 * A memoized component that renders the scoreboard for a single team.
 * `React.memo` is used to prevent re-renders if the team's data hasn't changed.
 * @param {object} props - The component props.
 * @param {ParticipantDto[]} props.team - Array of participants for one team.
 * @param {string} props.searchedPlayerPuuid - The PUUID of the main player.
 * @param {number} props.teamId - The ID of the team (100 for blue, 200 for red).
 * @param {boolean | undefined} props.isWin - Whether the team won the match.
 * @param {function} props.onPlayerClick - Callback for clicking a player.
 * @param {boolean} props.isRemake - Whether the game was a remake.
 */
const TeamDetails: React.FC<{ team: ParticipantDto[]; searchedPlayerPuuid: string; teamId: number; isWin: boolean | undefined; onPlayerClick: (name: string, tag: string) => void; isRemake: boolean; }> = memo(({ team, searchedPlayerPuuid, teamId, isWin, onPlayerClick, isRemake }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  // Calculate team-wide totals for display in the header.
  const teamKills = team.reduce((acc, p) => acc + (p.kills ?? 0), 0);
  const teamDeaths = team.reduce((acc, p) => acc + (p.deaths ?? 0), 0);
  const teamAssists = team.reduce((acc, p) => acc + (p.assists ?? 0), 0);
  const teamGold = team.reduce((acc, p) => acc + (p.goldEarned ?? 0), 0);

  const getHeaderInfo = () => {
    if (isRemake) {
      return {
        bgClass: 'bg-gray-400/20 dark:bg-gray-500/20',
        textClass: 'text-gray-400',
        label: 'Remake',
      };
    }
    
    const teamColorClass = teamId === 100 ? 'text-blue-400' : 'text-red-400';
    const outcomeLabel = isWin ? 'Victory' : 'Defeat';

    return { bgClass: 'bg-gray-200/50 dark:bg-gray-900/20', textClass: teamColorClass, label: outcomeLabel };
  };
  const headerInfo = getHeaderInfo();
  return (
    <div className="bg-black/5 dark:bg-black/10 rounded-md">
      {/* Team Header */}
      <div className={`flex justify-between items-center p-2 rounded-t-md ${headerInfo.bgClass}`}>
        <p className={`font-bold ${headerInfo.textClass}`}>
          {headerInfo.label} ({teamId === 100 ? 'Blue' : 'Red'} Team)
        </p>
        <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-300 text-xs">
          <span title="Gold"><span className="font-semibold text-gray-800 dark:text-gray-200">{formatNumber(teamGold)}</span> G</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{teamKills} / {teamDeaths} / {teamAssists}</span>
        </div>
      </div>

      {/* Player Rows */}
      <div className="text-xs">
        {team.map((p, index) => (
          <div 
            key={p.participantId} 
            className={`grid grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_90px_60px_40px_200px] gap-x-2 items-center p-1.5 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800/60 transition-colors duration-150 ${p.puuid === searchedPlayerPuuid ? 'bg-cyan-500/10 dark:bg-cyan-500/20' : (index % 2 === 0 ? 'bg-black/5 dark:bg-white/5' : 'bg-transparent')}`}
            onClick={() => {
              if (p.riotIdGameName && p.riotIdTagline) {
                onPlayerClick(p.riotIdGameName, p.riotIdTagline);
              }
            }}
          >
            {/* Player (Champion, Name) - Combined for mobile and desktop */}
            <div className="flex items-center space-x-2 min-w-0 col-span-2 md:col-span-1">
              <div className="shrink-0">
                <img src={`${CDN_URL}/img/champion/${getCorrectChampionName(p.championName)}.png`} alt={p.championName} className="w-8 h-8 rounded" />
              </div>
              <div className="hidden md:flex flex-col space-y-0.5 shrink-0">
                <SummonerSpellIcon spellId={p.summoner1Id} className="w-5 h-5" />
                <SummonerSpellIcon spellId={p.summoner2Id} className="w-5 h-5" /> 
              </div>
              <div className="hidden md:flex flex-col space-y-0.5 shrink-0">
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
                <span className={`font-semibold ${p.puuid === searchedPlayerPuuid ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-800 dark:text-gray-200'}`}>{p.riotIdGameName}</span>
                <span className="text-gray-500 dark:text-gray-500 ml-1">#{p.riotIdTagline}</span>
              </div>
            </div>

            {/* KDA - Repositioned for mobile */}
            <div className="text-right md:text-center font-semibold text-gray-800 dark:text-gray-200 text-[11px]">{p.kills} / {p.deaths} / {p.assists}</div>

            {/* Damage - Hidden on mobile */}
            <div 
              className="hidden md:block text-center text-gray-600 dark:text-gray-300"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={`Physical: ${formatNumber(p.physicalDamageDealtToChampions)} | Magic: ${formatNumber(p.magicDamageDealtToChampions)} | True: ${formatNumber(p.trueDamageDealtToChampions)}`}
            >
              {formatNumber(p.totalDamageDealtToChampions)}
            </div>

            {/* CS - Hidden on mobile */}
            <div 
              className="hidden md:block text-center text-gray-600 dark:text-gray-300"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={`Minions: ${p.totalMinionsKilled} | Jungle: ${p.neutralMinionsKilled}`}
            >
              {(p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)}
            </div>

            {/* Items - Spans full width on mobile's next row */}
            <div className="col-span-3 md:col-span-1 flex items-center space-x-1 justify-start md:justify-center mt-1 md:mt-0">
              {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map((item, i) => (
                <ItemIcon key={i} itemId={item} className={`w-6 h-6 ${i === 6 ? 'ml-1' : ''}`} />
              ))}
              <div className="flex-grow flex justify-end md:hidden">
                <div className="text-gray-600 dark:text-gray-300 text-right text-[10px] leading-tight">
                  <p>{formatNumber(p.totalDamageDealtToChampions)} DMG</p>
                  <p>{(p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)} CS</p>
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * The ScoreboardTab component displays the classic end-of-game scoreboard,
 * showing detailed stats for every player, separated by team.
 */
const ScoreboardTab: React.FC<ScoreboardTabProps> = ({ match, puuid, onPlayerClick }) => {
  if (!match.info) return null;

  const blueTeam = match.info.participants.filter(p => p.teamId === 100);
  const redTeam = match.info.participants.filter(p => p.teamId === 200);
  const isRemake = match.info.participants[0]?.gameEndedInEarlySurrender || false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
      <TeamDetails team={blueTeam} searchedPlayerPuuid={puuid} teamId={100} isWin={blueTeam[0]?.win} onPlayerClick={onPlayerClick} isRemake={isRemake} />
      <TeamDetails team={redTeam} searchedPlayerPuuid={puuid} teamId={200} isWin={redTeam[0]?.win} onPlayerClick={onPlayerClick} isRemake={isRemake} />
    </div>
  );
};

export default ScoreboardTab;