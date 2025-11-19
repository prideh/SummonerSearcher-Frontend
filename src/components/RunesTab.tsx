import React from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import { useDataDragonStore } from '../store/dataDragonStore';
import RuneIcon from './RuneIcon';
import { getCorrectChampionName } from '../utils/championNameHelper';

interface RunesTabProps {
  match: MatchDto;
  puuid: string;
  onPlayerClick: (name: string, tag: string) => void;
}

const RunesTab: React.FC<RunesTabProps> = ({ match, puuid, onPlayerClick }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  if (!match.info) return null;

  const renderTeamRunes = (team: ParticipantDto[]) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {team.map(player => {
          const perks = player.perks;
          const primaryStyle = perks?.styles?.[0];
          const secondaryStyle = perks?.styles?.[1];

          return (
            <div key={player.puuid} className={`p-3 rounded-lg ${player.puuid === puuid ? 'bg-blue-900/40' : 'bg-gray-900/40'}`}>
              <div 
                className="flex items-center space-x-2 mb-3 cursor-pointer group"
                onClick={() => onPlayerClick(player.riotIdGameName!, player.riotIdTagline!)}
              >
                <img src={`${CDN_URL}/img/champion/${getCorrectChampionName(player.championName)}.png`} alt={player.championName} className="w-8 h-8 rounded-full" />
                <span className="font-semibold text-white truncate group-hover:text-blue-300">{player.riotIdGameName}</span>
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

  const blueTeam = match.info.participants.filter(p => p.teamId === 100);
  const redTeam = match.info.participants.filter(p => p.teamId === 200);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-blue-400 mb-2">Blue Team</h3>
        {renderTeamRunes(blueTeam)}
      </div>
      <div>
        <h3 className="text-lg font-bold text-red-400 mb-2">Red Team</h3>
        {renderTeamRunes(redTeam)}
      </div>
    </div>
  );
};

export default RunesTab;