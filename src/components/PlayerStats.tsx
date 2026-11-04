import React from 'react';
import type { ParticipantDto } from '../types/match';
import RoleIcon from './RoleIcon';
import SummonerSpellIcon from './SummonerSpellIcon';
import RuneIcon from './RuneIcon';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';
import { getKdaColorClass } from '../utils/colorUtils';
import { calculateLaneCsAt10Comparison, isLanerPosition } from '../utils/statsCalculator';

/**
 * Props for the PlayerStats component.
 */
interface PlayerStatsProps {
  /** The participant data for the player whose stats are being displayed. */
  participant: ParticipantDto;
  /** Callback function to handle clicks on the player's name. */
  onPlayerClick?: (name: string, tag: string) => void;
  /** Flag to indicate if this player is the opponent, which alters the layout. */
  isOpponent?: boolean;
  /** An array of all participants on the same team as the player, used for calculating team-wide stats like KP. */
  teamParticipants: ParticipantDto[];
  /** Flag to show condensed view (hide KDA stats) when true. */
  condensed?: boolean;
}

/**
 * Displays a detailed summary of a single player's performance in a match.
 * This includes champion, spells, runes, KDA, CS, and kill participation.
 * It has a different layout when displaying an opponent versus the main player.
 */
const PlayerStats: React.FC<PlayerStatsProps> = ({ participant, onPlayerClick, isOpponent = false, teamParticipants, condensed = false }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const patchVersion = useDataDragonStore(state => state.version);

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

  // Calculate derived stats like KDA, total CS, and Kill Participation.
  const kda = ((kills ?? 0) + (assists ?? 0)) / (deaths === 0 ? 1 : (deaths ?? 1));
  const cs = (totalMinionsKilled ?? 0) + (neutralMinionsKilled ?? 0);
  const laneCsAt10 =
    isLanerPosition(teamPosition) && typeof challenges?.laneMinionsFirst10Minutes === 'number'
      ? calculateLaneCsAt10Comparison(challenges.laneMinionsFirst10Minutes, patchVersion)
      : null;

  const csTooltipParts = [`Minions: ${totalMinionsKilled ?? 0}`, `Jungle: ${neutralMinionsKilled ?? 0}`];
  if (laneCsAt10) {
    csTooltipParts.push(
      `Lane CS @10: ${laneCsAt10.actual} last-hit | Spawned ceiling: ${laneCsAt10.spawnedCeiling} (${laneCsAt10.wavesSpawned} waves; ${laneCsAt10.uncertaintyNote})`
    );
  } else if (teamPosition === 'JUNGLE' && typeof challenges?.jungleCsBefore10Minutes === 'number') {
    csTooltipParts.push(`Jungle CS @10: ${Math.round(challenges.jungleCsBefore10Minutes)}`);
  }
  const csTooltipContent = csTooltipParts.join(' | ');

  const playerStyles = perks?.styles || [];
  const primaryRune = playerStyles[0]?.selections?.[0]?.perk;
  const secondaryPath = playerStyles[1]?.style;

  // Calculate total kills for the player's team.
  const teamKills = teamParticipants.reduce((acc, p) => acc + (p.kills ?? 0), 0);
  // Calculate the player's kill participation percentage.
  const killParticipation = teamKills > 0 ? (((kills ?? 0) + (assists ?? 0)) / teamKills) * 100 : 0;

  // JSX for the core stats block, shared between main player and opponent views.
  const playerStatsContent = (
    <>
      {/* Champion & Spells */}
      <div className="flex items-center space-x-2">
        {!isOpponent && !condensed && (
          <div className="w-5 h-5 hidden md:block shrink-0">
            <RoleIcon role={teamPosition} className="w-5 h-5" />
          </div>
        )}
        <img
          src={`${CDN_URL}/img/champion/${getCorrectChampionName(championName)}.png`}
          alt={`${championName} Champion Icon`}
          loading="lazy"
          className="w-14 h-14 rounded-lg border border-slate-300 dark:border-slate-700 shadow-xs shrink-0"
          data-tooltip-id="player-name-tooltip"
          data-tooltip-content={championName}
        />
        {!condensed && (
          <>
            <div className="flex flex-col space-y-1 shrink-0">
              <SummonerSpellIcon spellId={summoner1Id} className="w-6 h-6" />
              <SummonerSpellIcon spellId={summoner2Id} className="w-6 h-6" />
            </div>
            <div className="flex flex-col space-y-1 shrink-0">
              <RuneIcon runeId={primaryRune} isKeystone={true} className="w-6 h-6" />
              <RuneIcon runeId={secondaryPath} className="w-6 h-6" />
            </div>
          </>
        )}
      </div>
      {/* KDA */}
      {!condensed && (
        <div className="text-center min-h-[92px] flex flex-col justify-center telemetry-nums">
          <p className="text-base font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap tracking-tight">
            <span className="text-emerald-600 dark:text-emerald-400">{kills}</span>
            <span className="text-slate-400 dark:text-slate-500 mx-0.5">/</span>
            <span className="text-rose-600 dark:text-rose-400">{deaths}</span>
            <span className="text-slate-400 dark:text-slate-500 mx-0.5">/</span>
            <span className="text-amber-600 dark:text-amber-400">{assists}</span>
          </p>
          {deaths === 0 ? (
            <p className="text-xs font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">Perfect KDA</p>
          ) : (
            <p className={`text-xs font-extrabold ${getKdaColorClass(kda)} mt-0.5`}>{kda.toFixed(2)} KDA</p>
          )}
          <p
            className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5"
            data-tooltip-id="player-name-tooltip"
            data-tooltip-content={csTooltipContent}
          >
            CS: {cs}
          </p>
          {laneCsAt10 && (
            <p
              className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap"
              data-testid="lane-cs-10"
              title={`Lane minions @ 10:00: ${laneCsAt10.actual} last-hit | Spawned ceiling: ${laneCsAt10.spawnedCeiling} (${laneCsAt10.wavesSpawned} waves; ${laneCsAt10.uncertaintyNote})`}
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={`Lane minions @ 10:00: ${laneCsAt10.actual} last-hit | Spawned ceiling: ${laneCsAt10.spawnedCeiling} (${laneCsAt10.wavesSpawned} waves; ${laneCsAt10.uncertaintyNote})`}
            >
              CS@10: {laneCsAt10.actual}{' '}
              <span className="text-slate-400 dark:text-slate-500">
                (≤{laneCsAt10.spawnedCeiling} spawned*)
              </span>
            </p>
          )}
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">KP: {killParticipation.toFixed(0)}%</p>
          {(challenges?.soloKills ?? 0) > 0 && (
            <div className="mt-1">
              <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded inline-block">Solo Kills: {challenges?.soloKills}</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  // Render the opponent-specific layout, which is more compact and includes their name.
  if (isOpponent) {
    return (
      <div
        className="grid grid-cols-[auto_auto_1fr_auto] gap-x-2.5 items-center w-full cursor-pointer group telemetry-nums"
        onClick={(e) => {
          e.stopPropagation();
          if (onPlayerClick && riotIdGameName && riotIdTagline) {
            onPlayerClick(riotIdGameName, riotIdTagline);
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (onPlayerClick && riotIdGameName && riotIdTagline) {
              onPlayerClick(riotIdGameName, riotIdTagline);
            }
          }
        }}
        aria-label={`View profile for ${riotIdGameName}`}
      >
        <img
          src={`${CDN_URL}/img/champion/${getCorrectChampionName(championName)}.png`}
          alt={`${championName} Champion Icon`}
          loading="lazy"
          className="w-14 h-14 rounded-lg border border-slate-300 dark:border-slate-700 group-hover:border-sky-500 dark:group-hover:border-cyan-400 transition-colors shrink-0"
          data-tooltip-id="player-name-tooltip"
          data-tooltip-content={championName}
        />
        {!condensed && (
          <>
            <div className="flex flex-col space-y-1 shrink-0">
              <SummonerSpellIcon spellId={summoner1Id} className="w-6 h-6" />
              <SummonerSpellIcon spellId={summoner2Id} className="w-6 h-6" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <div className="truncate" title={`${riotIdGameName}#${riotIdTagline}`}>
                <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-cyan-400 transition-colors">
                  {riotIdGameName}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">#{riotIdTagline}</span>
              </div>
              <div className="flex space-x-1 mt-1">
                <RuneIcon runeId={primaryRune} isKeystone={true} className="w-5 h-5" />
                <RuneIcon runeId={secondaryPath} className="w-5 h-5" />
              </div>
            </div>
          </>
        )}
        {!condensed && (
          <div className="text-center min-h-[92px] flex flex-col justify-center">
            <p className="text-base font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap tracking-tight">
              <span className="text-emerald-600 dark:text-emerald-400">{kills}</span>
              <span className="text-slate-400 dark:text-slate-500 mx-0.5">/</span>
              <span className="text-rose-600 dark:text-rose-400">{deaths}</span>
              <span className="text-slate-400 dark:text-slate-500 mx-0.5">/</span>
              <span className="text-amber-600 dark:text-amber-400">{assists}</span>
            </p>
            {deaths === 0 ? (
              <p className="text-xs font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">Perfect KDA</p>
            ) : (
              <p className={`text-xs font-extrabold ${getKdaColorClass(kda)} mt-0.5`}>{kda.toFixed(2)} KDA</p>
            )}
            <p
              className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5"
              data-tooltip-id="player-name-tooltip"
              data-tooltip-content={csTooltipContent}
            >
              CS: {cs}
            </p>
            {laneCsAt10 && (
              <p
                className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap"
                data-testid="lane-cs-10"
                data-tooltip-id="player-name-tooltip"
                data-tooltip-content={`Lane minions @ 10:00: ${laneCsAt10.actual} last-hit | Spawned ceiling: ${laneCsAt10.spawnedCeiling} (${laneCsAt10.wavesSpawned} waves; ${laneCsAt10.uncertaintyNote})`}
              >
                CS@10: {laneCsAt10.actual}{' '}
                <span className="text-slate-400 dark:text-slate-500">
                  (≤{laneCsAt10.spawnedCeiling} spawned*)
                </span>
              </p>
            )}
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">KP: {killParticipation.toFixed(0)}%</p>
            {(challenges?.soloKills ?? 0) > 0 && (
              <div className="mt-1">
                <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded inline-block">Solo Kills: {challenges?.soloKills}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Render the default layout for the main searched player.
  return (
    <div className="flex items-center space-x-3 justify-between">
      {playerStatsContent}
    </div>
  );
};

export default PlayerStats;
