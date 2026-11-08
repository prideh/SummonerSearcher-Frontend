import React, { memo, useMemo, useState } from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import ItemIcon from './ItemIcon';
import SummonerSpellIcon from './SummonerSpellIcon';
import RuneIcon from './RuneIcon';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';
import { getKdaColorClass } from '../utils/colorUtils';

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

type SortCol = 'kda' | 'dmg' | 'cs' | 'gold';

const TeamDetails: React.FC<{
  team: ParticipantDto[];
  searchedPlayerPuuid: string;
  teamId: number;
  isWin: boolean | undefined;
  onPlayerClick: (name: string, tag: string) => void;
  isRemake: boolean;
  maxMatchDmg: number;
}> = memo(({ team, searchedPlayerPuuid, teamId, isWin, onPlayerClick, isRemake, maxMatchDmg }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const [sortConfig, setSortConfig] = useState<{ col: SortCol | null; desc: boolean }>({
    col: null,
    desc: true,
  });

  const teamKills = team.reduce((acc, p) => acc + (p.kills ?? 0), 0);
  const teamDeaths = team.reduce((acc, p) => acc + (p.deaths ?? 0), 0);
  const teamAssists = team.reduce((acc, p) => acc + (p.assists ?? 0), 0);
  const teamGold = team.reduce((acc, p) => acc + (p.goldEarned ?? 0), 0);

  const sortedTeam = useMemo(() => {
    if (!sortConfig.col) return team;
    const getVal = (p: ParticipantDto, col: SortCol): number => {
      if (col === 'kda') return ((p.kills ?? 0) + (p.assists ?? 0)) / Math.max(1, p.deaths ?? 1);
      if (col === 'dmg') return p.totalDamageDealtToChampions ?? 0;
      if (col === 'cs') return (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
      return p.goldEarned ?? 0;
    };
    return [...team].sort((a, b) => {
      const diff = getVal(b, sortConfig.col!) - getVal(a, sortConfig.col!);
      return sortConfig.desc ? diff : -diff;
    });
  }, [team, sortConfig]);

  const toggleSort = (colId: SortCol) => {
    setSortConfig((prev) =>
      prev.col === colId
        ? prev.desc
          ? { col: colId, desc: false }
          : { col: null, desc: true }
        : { col: colId, desc: true }
    );
  };

  const sortArrow = (colId: SortCol) => {
    if (sortConfig.col !== colId) return '';
    return sortConfig.desc ? ' ↓' : ' ↑';
  };

  const getHeaderInfo = () => {
    if (isRemake) {
      return {
        bgClass: 'bg-slate-200/70 dark:bg-slate-800/70 border-b border-slate-300 dark:border-slate-700',
        textClass: 'text-slate-500 dark:text-slate-400',
        label: 'Remake',
      };
    }

    const teamColorClass = teamId === 100 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400';
    const outcomeLabel = isWin ? 'Victory' : 'Defeat';

    return {
      bgClass: 'bg-slate-100 dark:bg-[#090d16] border-b border-slate-200 dark:border-slate-800',
      textClass: teamColorClass,
      label: outcomeLabel,
    };
  };

  const headerInfo = getHeaderInfo();
  const barColor = teamId === 100 ? 'bg-sky-500 dark:bg-cyan-400' : 'bg-rose-500 dark:bg-rose-400';

  return (
    <div className="bg-slate-50/70 dark:bg-[#0b101d] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden telemetry-nums">
      {/* Team Header + Sortable Column Controls */}
      <div className={`flex flex-wrap justify-between items-center gap-2 px-3 py-2 ${headerInfo.bgClass}`}>
        <div className="flex items-center gap-2">
          <p className={`text-xs font-extrabold uppercase tracking-wider ${headerInfo.textClass}`}>
            {headerInfo.label} ({teamId === 100 ? 'Blue' : 'Red'} Team)
          </p>
        </div>
        <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider border-r border-slate-300 dark:border-slate-700 pr-2.5">
            <span className="text-slate-400">Sort:</span>
            <button type="button" onClick={() => toggleSort('kda')} className="hover:text-sky-500 dark:hover:text-cyan-400">
              KDA{sortArrow('kda')}
            </button>
            <span>·</span>
            <button type="button" onClick={() => toggleSort('dmg')} className="hover:text-sky-500 dark:hover:text-cyan-400">
              DMG{sortArrow('dmg')}
            </button>
            <span>·</span>
            <button type="button" onClick={() => toggleSort('cs')} className="hover:text-sky-500 dark:hover:text-cyan-400">
              CS{sortArrow('cs')}
            </button>
          </div>
          <span title="Gold"><span className="font-bold text-slate-900 dark:text-slate-200">{formatNumber(teamGold)}</span> G</span>
          <span className="font-bold text-slate-900 dark:text-slate-200">{teamKills} / {teamDeaths} / {teamAssists}</span>
        </div>
      </div>

      {/* Player Rows */}
      <div className="text-xs divide-y divide-slate-200/70 dark:divide-slate-800/70">
        {sortedTeam.map((p, index) => {
          const kdaRatio = ((p.kills ?? 0) + (p.assists ?? 0)) / (p.deaths === 0 ? 1 : (p.deaths ?? 1));
          const dmgPct = Math.min(100, Math.round(((p.totalDamageDealtToChampions ?? 0) / Math.max(1, maxMatchDmg)) * 100));
          const kpPct = teamKills > 0 ? Math.round((((p.kills ?? 0) + (p.assists ?? 0)) / teamKills) * 100) : 0;

          return (
            <div 
              key={p.participantId ?? p.puuid} 
              className={`grid grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_92px_84px_44px_196px] gap-x-2 items-center px-2.5 py-2 cursor-pointer hover:bg-sky-50/70 dark:hover:bg-slate-800/60 transition-colors duration-150 ${p.puuid === searchedPlayerPuuid ? 'bg-sky-500/10 dark:bg-cyan-500/15 border-l-2 border-l-sky-500 dark:border-l-cyan-400' : (index % 2 === 0 ? 'bg-white/60 dark:bg-slate-900/30' : 'bg-transparent')}`}
              onClick={() => {
                if (p.riotIdGameName && p.riotIdTagline) {
                  onPlayerClick(p.riotIdGameName, p.riotIdTagline);
                }
              }}
            >
              {/* Player (Champion, Name) */}
              <div className="flex items-center space-x-2 min-w-0 col-span-2 md:col-span-1">
                <div className="shrink-0">
                  <img src={`${CDN_URL}/img/champion/${getCorrectChampionName(p.championName)}.png`} loading="lazy" alt={p.championName} className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700" />
                </div>
                <div className="hidden md:flex flex-col space-y-0.5 shrink-0">
                  <SummonerSpellIcon spellId={p.summoner1Id} className="w-4 h-4" />
                  <SummonerSpellIcon spellId={p.summoner2Id} className="w-4 h-4" /> 
                </div>
                <div className="hidden md:flex flex-col space-y-0.5 shrink-0">
                  <RuneIcon 
                    runeId={(p.perks?.styles || [])[0]?.selections?.[0]?.perk}
                    isKeystone={true} 
                    className="w-4 h-4" 
                  />
                  <RuneIcon 
                    runeId={(p.perks?.styles || [])[1]?.style}
                    className="w-4 h-4" 
                  />
                </div>
                <div 
                  className="truncate font-sans" 
                  data-tooltip-id="player-name-tooltip"
                  data-tooltip-content={`${p.riotIdGameName}#${p.riotIdTagline}`}
                >
                  <span className={`font-bold ${p.puuid === searchedPlayerPuuid ? 'text-sky-600 dark:text-cyan-400' : 'text-slate-900 dark:text-slate-200'}`}>{p.riotIdGameName}</span>
                  <span className="text-slate-400 dark:text-slate-500 ml-1 telemetry-nums">#{p.riotIdTagline}</span>
                </div>
              </div>

              {/* KDA + KP% */}
              <div className="text-right md:text-center">
                <div className={`font-bold text-[11px] ${getKdaColorClass(kdaRatio)}`}>
                  {p.kills} / {p.deaths} / {p.assists}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {kpPct}% KP
                </div>
              </div>

              {/* Damage with proportional micro-bar */}
              <div 
                className="hidden md:flex flex-col justify-center font-medium text-slate-700 dark:text-slate-200"
                data-tooltip-id="player-name-tooltip"
                data-tooltip-content={`Physical: ${formatNumber(p.physicalDamageDealtToChampions)} | Magic: ${formatNumber(p.magicDamageDealtToChampions)} | True: ${formatNumber(p.trueDamageDealtToChampions)}`}
              >
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="font-bold">{formatNumber(p.totalDamageDealtToChampions)}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">{dmgPct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${dmgPct}%` }} />
                </div>
              </div>

              {/* CS */}
              <div 
                className="hidden md:block text-center font-semibold text-slate-600 dark:text-slate-300"
                data-tooltip-id="player-name-tooltip"
                data-tooltip-content={`Minions: ${p.totalMinionsKilled} | Jungle: ${p.neutralMinionsKilled}`}
              >
                {(p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)}
              </div>

              {/* Items */}
              <div className="col-span-3 md:col-span-1 flex items-center space-x-1 justify-start md:justify-center mt-1 md:mt-0">
                {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map((item, i) => (
                  <ItemIcon key={i} itemId={item} className={`w-6 h-6 ${i === 6 ? 'ml-1' : ''}`} />
                ))}
                <div className="flex-grow flex justify-end md:hidden">
                  <div className="text-slate-600 dark:text-slate-300 text-right text-[10px] leading-tight">
                    <p>{formatNumber(p.totalDamageDealtToChampions)} DMG</p>
                    <p>{(p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)} CS</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
  const maxMatchDmg = Math.max(
    ...match.info.participants.map(p => p.totalDamageDealtToChampions ?? 0),
    1
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5">
      <TeamDetails team={blueTeam} searchedPlayerPuuid={puuid} teamId={100} isWin={blueTeam[0]?.win} onPlayerClick={onPlayerClick} isRemake={isRemake} maxMatchDmg={maxMatchDmg} />
      <TeamDetails team={redTeam} searchedPlayerPuuid={puuid} teamId={200} isWin={redTeam[0]?.win} onPlayerClick={onPlayerClick} isRemake={isRemake} maxMatchDmg={maxMatchDmg} />
    </div>
  );
};

export default ScoreboardTab;