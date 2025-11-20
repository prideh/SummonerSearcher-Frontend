import React from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import { useDataDragonStore } from '../store/dataDragonStore';
import RuneIcon from './RuneIcon';
import { getCorrectChampionName } from '../utils/championNameHelper';

/**
 * Props for the RunesTab component.
 */
interface RunesTabProps {
  /** The full match data object. */
  match: MatchDto;
  /** The PUUID of the searched player to highlight their runes. */
  puuid: string;
  /** Callback function to handle clicks on player names. */
  onPlayerClick: (name: string, tag: string) => void;
}

/**
 * The RunesTab component displays the rune setups for all players in a match,
 * separated by team. It provides a responsive view, showing a compact version
 * on mobile and the full rune trees on larger screens.
 */
const RunesTab: React.FC<RunesTabProps> = ({ match, puuid, onPlayerClick }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  if (!match.info) return null;

  // A reusable function to render the rune display for a single team.
  const renderTeamRunes = (team: ParticipantDto[]) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {team.map(player => {
          const perks = player.perks;
          const primaryStyle = perks?.styles?.[0];
          const secondaryStyle = perks?.styles?.[1];

          return (
            <div key={player.puuid} className={`p-3 rounded-lg ${player.puuid === puuid ? 'bg-cyan-500/10 dark:bg-cyan-900/30' : 'bg-gray-100 dark:bg-gray-900/40'}`}>
              <div 
                className="flex items-center space-x-2 mb-3 cursor-pointer group"
                onClick={() => onPlayerClick(player.riotIdGameName!, player.riotIdTagline!)}
              >
                <img src={`${CDN_URL}/img/champion/${getCorrectChampionName(player.championName)}.png`} alt={player.championName} className="w-8 h-8 rounded-full" />
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-cyan-500 dark:group-hover:text-cyan-400">{player.riotIdGameName}</span>
              </div>
              {/* Mobile View: Single row of runes */}
              <div className="flex md:hidden justify-start items-center space-x-1.5">
                <RuneIcon runeId={primaryStyle?.selections[0].perk} isKeystone={true} className="w-7 h-7" />
                <RuneIcon runeId={secondaryStyle?.style} className="w-6 h-6" />
              </div>

              {/* Desktop View: Full rune trees */}
              <div className="hidden md:flex justify-center space-x-4">
                {/* Primary Tree */}
                <div className="flex flex-col items-center space-y-2">
                  {primaryStyle?.selections?.map((selection, i) => (
                    <RuneIcon key={i} runeId={selection.perk} isKeystone={i === 0} className="w-7 h-7" />
                  ))}
                </div>
                {/* Secondary Tree */}
                <div className="flex flex-col items-center space-y-2">
                  {secondaryStyle?.selections?.slice(0, 2).map((selection, i) => (
                    <RuneIcon key={i} runeId={selection.perk} className="w-6 h-6" />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Separate participants into blue and red teams.
  const blueTeam = match.info.participants.filter(p => p.teamId === 100);
  const redTeam = match.info.participants.filter(p => p.teamId === 200);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-2">Blue Team</h3>
        {renderTeamRunes(blueTeam)}
      </div>
      <div>
        <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">Red Team</h3>
        {renderTeamRunes(redTeam)}
      </div>
    </div>
  );
};

export default RunesTab;