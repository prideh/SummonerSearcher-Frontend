import React from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';

interface AnalysisTabProps {
  match: MatchDto;
  puuid: string;
  onPlayerClick: (name: string, tag: string) => void;
}

const camelCaseToTitleCase = (text: string) => {
  const result = text.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const AnalysisTab: React.FC<AnalysisTabProps> = ({ match, puuid }) => {
  const participants = match.info?.participants;
  const mainPlayer = participants?.find(p => p.puuid === puuid);

  if (!mainPlayer) {
    return <p className="p-4 text-gray-400">Main player data not found for analysis.</p>;
  }

  const opponent = participants?.find(p =>
    p.teamId !== mainPlayer.teamId &&
    p.teamPosition === mainPlayer.teamPosition &&
    mainPlayer.teamPosition &&
    mainPlayer.teamPosition !== 'NONE'
  );

  const renderPlayerChallenges = (player: ParticipantDto, opponentData?: ParticipantDto) => {
    const playerChallenges = Object.fromEntries(Object.entries(player.challenges || {}).filter(([, v]) => v != null && v > 0));
    const opponentChallenges = opponentData ? Object.fromEntries(Object.entries(opponentData.challenges || {}).filter(([, v]) => v != null && v > 0)) : {};

    const allChallengeKeys = [...new Set([...Object.keys(playerChallenges), ...Object.keys(opponentChallenges)])].sort();

    if (allChallengeKeys.length === 0) {
      return <p className="text-gray-400 text-center mt-4">No challenges data available for {player.riotIdGameName}.</p>;
    }

    return (
      <ul className="space-y-1.5 text-sm">
        {allChallengeKeys.map(key => {
          const playerValue = playerChallenges[key] as number | undefined;
          const opponentValue = opponentChallenges[key] as number | undefined;

          const isWinner = playerValue !== undefined && (opponentValue === undefined || playerValue > opponentValue);

          return (
            <li key={key} className={`flex justify-between break-all p-1.5 rounded-md transition-colors ${isWinner ? 'bg-green-500/10' : 'bg-transparent'}`}>
              <span className={`${isWinner ? 'text-green-400' : 'text-gray-400'}`}>{camelCaseToTitleCase(key)}:</span>
              {typeof playerValue === 'number' ? (
                <span className={`font-semibold pl-2 ${isWinner ? 'text-gray-200' : 'text-gray-500'}`}>{playerValue.toFixed(2)}</span>
              ) : playerValue !== undefined ? (
                <span className={`font-semibold pl-2 ${isWinner ? 'text-gray-200' : 'text-gray-500'}`}>{String(playerValue)}</span>
              ) : (
                <span className="font-semibold pl-2 text-gray-600">-</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
      <div className="bg-gray-900/50 p-3 md:p-4 rounded-lg">
        <h4 className="font-bold text-cyan-400 border-b border-gray-800 pb-2 mb-3">{mainPlayer.riotIdGameName} (You)</h4>
        {renderPlayerChallenges(mainPlayer, opponent)}
      </div>
      {opponent ? (
        <div className="bg-gray-900/50 p-3 md:p-4 rounded-lg">
          <h4 className="font-bold text-red-400 border-b border-gray-800 pb-2 mb-3">{opponent.riotIdGameName} (Opponent)</h4>
          {renderPlayerChallenges(opponent, mainPlayer)}
        </div>
      ) : <p className="p-4 text-gray-400 text-center lg:text-left">No direct lane opponent found for analysis.</p>}
    </div>
  );
};

export default AnalysisTab;