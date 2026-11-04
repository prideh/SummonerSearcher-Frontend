import React from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import {
  camelCaseToTitleCase,
  formatDuration,
  isTimeChallenge,
  formatPercentage,
  isPercentageChallenge,
  formatNumber
} from '../utils/formatters';
import { useDataDragonStore } from '../store/dataDragonStore';
import { calculateLaneCsAt10Comparison, isStatAllowedForPosition } from '../utils/statsCalculator';
import { getCorrectChampionName } from '../utils/championNameHelper';

/**
 * Props for the AnalysisTab component.
 */
interface AnalysisTabProps {
  /** The full match data object. */
  match: MatchDto;
  /** The PUUID of the player whose perspective the analysis is from. */
  puuid: string;
  /** Callback function to handle clicks on player names. */
  onPlayerClick: (name: string, tag: string) => void;
}

/**
 * The AnalysisTab component displays a side-by-side comparison of the main player's
 * and their lane opponent's performance metrics (challenges) from the match.
 */
const AnalysisTab: React.FC<AnalysisTabProps> = ({ match, puuid }) => {
  const storeVersion = useDataDragonStore(state => state.version);
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const patchVersion = match.info?.gameVersion || storeVersion;
  const participants = match.info?.participants;
  const mainPlayer = participants?.find(p => p.puuid === puuid);

  if (!mainPlayer) {
    return <p className="p-4 text-slate-500 dark:text-slate-400">Main player data not found for analysis.</p>;
  }

  // Find the direct lane opponent by matching team position and ensuring they are on the opposite team.
  const opponent = participants?.find(p =>
    p.teamId !== mainPlayer.teamId &&
    p.teamPosition === mainPlayer.teamPosition &&
    mainPlayer.teamPosition &&
    mainPlayer.teamPosition !== 'NONE'
  );

  /**
   * Renders a list of challenges for a given player, comparing their values against an opponent.
   * It highlights challenges where the player performed better.
   * @param player - The participant data for the player to display.
   * @param opponentData - Optional participant data for the opponent to compare against.
   * @returns A React element containing the list of challenges.
   */
  const renderPlayerChallenges = (player: ParticipantDto, opponentData?: ParticipantDto) => {
    // Filter out challenges that are null, undefined, or zero.
    const playerChallenges = Object.fromEntries(Object.entries(player.challenges || {}).filter(([, v]) => v != null && v > 0));
    const opponentChallenges = opponentData ? Object.fromEntries(Object.entries(opponentData.challenges || {}).filter(([, v]) => v != null && v > 0)) : {};

    // Combine all unique challenge keys from both players, filter by role applicability, and sort alphabetically.
    const allChallengeKeys = [...new Set([...Object.keys(playerChallenges), ...Object.keys(opponentChallenges)])]
        .filter(key => key !== 'legendaryItemUsed' && isStatAllowedForPosition(key, player.teamPosition))
        .sort();

    if (allChallengeKeys.length === 0) {
      return <p className="text-slate-500 dark:text-slate-400 text-center mt-4">No challenges data available for {player.riotIdGameName}.</p>;
    }

    return (
      <ul className="space-y-1 text-xs telemetry-nums">
        {allChallengeKeys.map(key => {
          const playerValue = playerChallenges[key] as number | undefined;
          const opponentValue = opponentChallenges[key] as number | undefined;

          // A player is considered the "winner" of a challenge if their value is higher, or if the opponent has no value for it.
          // For time-based challenges (earliest/fastest/shortest), lower is usually better.
          const isLowerBetter = key.toLowerCase().startsWith('earliest') || key.toLowerCase().startsWith('fastest') || key.toLowerCase().startsWith('shortest');
          
          let isWinner = false;
          if (playerValue !== undefined) {
             if (opponentValue === undefined) {
                 isWinner = true;
             } else {
                 isWinner = isLowerBetter ? playerValue < opponentValue : playerValue > opponentValue;
             }
          }

          const isTime = isTimeChallenge(key);
          const isPercentage = isPercentageChallenge(key);
          const laneCsComparison =
            key === 'laneMinionsFirst10Minutes' && typeof playerValue === 'number'
              ? calculateLaneCsAt10Comparison(playerValue, patchVersion)
              : null;

          return (
            <li
              key={key}
              className={`flex justify-between items-start sm:items-center gap-2 min-w-0 px-2.5 py-1.5 rounded transition-colors ${
                isWinner
                  ? 'bg-emerald-500/12 dark:bg-emerald-500/15 border-l-2 border-l-emerald-500'
                  : 'bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60'
              }`}
            >
              <span className={`min-w-0 break-words font-medium ${isWinner ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                {camelCaseToTitleCase(key)}:
              </span>
              {laneCsComparison ? (
                <span
                  className={`font-bold pl-2 shrink-0 text-right ${isWinner ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                  title={`${laneCsComparison.wavesSpawned} waves spawned by 10:00 (${laneCsComparison.cannonWavesSpawned} cannon waves). ${laneCsComparison.uncertaintyNote}.`}
                >
                  {laneCsComparison.actual} last-hit <span className="font-normal text-slate-400 dark:text-slate-500">(≤{laneCsComparison.spawnedCeiling} spawned, ±1–2 waves in transit)</span>
                </span>
              ) : typeof playerValue === 'number' ? (
                <span className={`font-bold pl-2 shrink-0 text-right ${isWinner ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isTime ? formatDuration(playerValue) : isPercentage ? formatPercentage(playerValue) : formatNumber(playerValue)}
                </span>
              ) : playerValue !== undefined ? (
                <span className={`font-bold pl-2 shrink-0 text-right ${isWinner ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{String(playerValue)}</span>
              ) : (
                <span className="font-bold pl-2 shrink-0 text-right text-slate-400 dark:text-slate-600">-</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="w-full min-w-0 p-3 sm:p-3.5 grid grid-cols-1 lg:grid-cols-2 gap-3.5 max-h-[500px] overflow-y-auto telemetry-nums">
      <div className="min-w-0 bg-slate-50/80 dark:bg-[#0b101d] border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 rounded-lg">
        <div className="flex items-center justify-between gap-2 min-w-0 border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={`${CDN_URL}/img/champion/${getCorrectChampionName(mainPlayer.championName)}.png`}
              alt={mainPlayer.championName}
              loading="lazy"
              className="w-6 h-6 rounded border border-sky-500 dark:border-cyan-400 shrink-0"
            />
            <h4 className="font-extrabold text-sm text-sky-600 dark:text-cyan-400 truncate">
              {mainPlayer.riotIdGameName} (You)
            </h4>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
            {mainPlayer.championName}
          </span>
        </div>
        {renderPlayerChallenges(mainPlayer, opponent)}
      </div>
      {opponent ? (
        <div className="min-w-0 bg-slate-50/80 dark:bg-[#0b101d] border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 rounded-lg">
          <div className="flex items-center justify-between gap-2 min-w-0 border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={`${CDN_URL}/img/champion/${getCorrectChampionName(opponent.championName)}.png`}
                alt={opponent.championName}
                loading="lazy"
                className="w-6 h-6 rounded border border-rose-500 shrink-0"
              />
              <h4 className="font-extrabold text-sm text-rose-600 dark:text-rose-400 truncate">
                {opponent.riotIdGameName} (Opponent)
              </h4>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
              {opponent.championName}
            </span>
          </div>
          {renderPlayerChallenges(opponent, mainPlayer)}
        </div>
      ) : <p className="p-4 text-slate-500 dark:text-slate-400 text-center lg:text-left">No direct lane opponent found for analysis.</p>}
    </div>
  );
};

export default AnalysisTab;