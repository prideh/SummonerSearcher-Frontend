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
  const participants = match.info?.participants;
  const mainPlayer = participants?.find(p => p.puuid === puuid);

  if (!mainPlayer) {
    return <p className="p-4 text-gray-500 dark:text-gray-400">Main player data not found for analysis.</p>;
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

    // Combine all unique challenge keys from both players and sort them alphabetically.
    const allChallengeKeys = [...new Set([...Object.keys(playerChallenges), ...Object.keys(opponentChallenges)])]
        .filter(key => key !== 'legendaryItemUsed')
        .sort();

    if (allChallengeKeys.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400 text-center mt-4">No challenges data available for {player.riotIdGameName}.</p>;
    }

    return (
      <ul className="space-y-1.5 text-sm">
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

          return (
            <li key={key} className={`flex justify-between break-all p-1.5 rounded-md transition-colors ${isWinner ? 'bg-green-500/10 dark:bg-green-500/10' : 'bg-transparent'}`}>
              <span className={`${isWinner ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>{camelCaseToTitleCase(key)}:</span>
              {typeof playerValue === 'number' ? (
                <span className={`font-semibold pl-2 ${isWinner ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-500'}`}>
                    {isTime ? formatDuration(playerValue) : isPercentage ? formatPercentage(playerValue) : formatNumber(playerValue)}
                </span>
              ) : playerValue !== undefined ? (
                <span className={`font-semibold pl-2 ${isWinner ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-500'}`}>{String(playerValue)}</span>
              ) : (
                <span className="font-semibold pl-2 text-gray-500 dark:text-gray-600">-</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
      <div className="bg-white dark:bg-gray-900/50 p-3 md:p-4 rounded-lg shadow-sm dark:shadow-none">
        <h4 className="font-bold text-cyan-600 dark:text-cyan-400 border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">{mainPlayer.riotIdGameName} (You)</h4>
        {renderPlayerChallenges(mainPlayer, opponent)}
      </div>
      {opponent ? (
        <div className="bg-white dark:bg-gray-900/50 p-3 md:p-4 rounded-lg shadow-sm dark:shadow-none">
          <h4 className="font-bold text-red-600 dark:text-red-400 border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">{opponent.riotIdGameName} (Opponent)</h4>
          {renderPlayerChallenges(opponent, mainPlayer)}
        </div>
      ) : <p className="p-4 text-gray-500 dark:text-gray-400 text-center lg:text-left">No direct lane opponent found for analysis.</p>}
    </div>
  );
};

export default AnalysisTab;