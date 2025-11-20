import React, { useState } from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';

interface GraphsTabProps {
  match: MatchDto;
  puuid: string;
  onPlayerClick: (name: string, tag: string) => void;
}

const formatNumber = (num: number | undefined) => {
  if (num === undefined) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

interface StatGraphProps {
  participants: ParticipantDto[];
  puuid: string;
  onPlayerClick: (name: string, tag: string) => void;
  statSelector: (p: ParticipantDto) => number;
}

const StatGraph: React.FC<StatGraphProps> = ({ participants, puuid, onPlayerClick, statSelector }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  const maxStat = Math.max(...participants.map(p => statSelector(p) || 0));
  const sortedParticipants = [...participants].sort((a, b) => (statSelector(b) || 0) - (statSelector(a) || 0));

  return (
    <div className="space-y-2">
      {sortedParticipants.map(player => {
        const statValue = statSelector(player) || 0;
        const barWidth = maxStat > 0 ? (statValue / maxStat) * 100 : 0;
        const isSearchedPlayer = player.puuid === puuid;

        const gradientClass = player.teamId === 100 
          ? 'from-blue-500 to-blue-400' 
          : 'from-red-600 to-red-500';

        return (
          <div key={player.puuid} className={`flex items-center space-x-3 text-sm p-1 rounded-md transition-colors ${isSearchedPlayer ? 'bg-gray-800/50' : ''}`}>
            <img src={`${CDN_URL}/img/champion/${getCorrectChampionName(player.championName)}.png`} alt={player.championName} className="w-8 h-8 rounded shrink-0" />
            <div
              className={`w-24 md:w-32 truncate cursor-pointer ${isSearchedPlayer ? 'text-gray-100 font-bold' : 'text-gray-300 hover:text-gray-100'}`}
              onClick={() => onPlayerClick(player.riotIdGameName!, player.riotIdTagline!)}
            >
              {player.riotIdGameName}
            </div>
            <div className="flex-1 bg-gray-900/50 rounded-full h-5 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-500 ease-out`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <div className="w-12 md:w-16 text-right font-semibold text-white shrink-0">{formatNumber(statValue)}</div>
          </div>
        );
      })}
    </div>
  );
};

type GraphType = 'damage' | 'damageTaken' | 'damageMitigated' | 'healing' | 'shielding' | 'cs' | 'gold' | 'vision' | 'cc' | 'dpm' | 'objectiveDamage' | 'turretDamage' | 'turretPlates' | 'wardsPlaced' | 'controlWardsPlaced' | 'soloKills' | 'wardsKilled' | 'healsOnTeammates';

const GraphsTab: React.FC<GraphsTabProps> = ({ match, puuid, onPlayerClick }) => {
  const [selectedGraph, setSelectedGraph] = useState<GraphType>('damage');
  const participants = match.info?.participants;

  if (!participants || participants.length === 0) {
    return <p className="p-4 text-gray-400">No participant data available for analysis.</p>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h3 className="text-lg font-bold text-gray-100">
          {
            selectedGraph === 'damage' ? 'Damage to Champions' :
            selectedGraph === 'damageTaken' ? 'Damage Taken' :
            selectedGraph === 'damageMitigated' ? 'Damage Self-Mitigated' :
            selectedGraph === 'healing' ? 'Total Healing' :
            selectedGraph === 'shielding' ? 'Damage Shielded' :
            selectedGraph === 'objectiveDamage' ? 'Damage to Objectives' :
            selectedGraph === 'dpm' ? 'Damage Per Minute' :
            selectedGraph === 'gold' ? 'Gold Earned' :
            selectedGraph === 'vision' ? 'Vision Score' :
            selectedGraph === 'cc' ? 'CC Score' :
            selectedGraph === 'wardsPlaced' ? 'Wards Placed' :
            selectedGraph === 'controlWardsPlaced' ? 'Control Wards Placed' :
            selectedGraph === 'turretPlates' ? 'Turret Platings' :
            selectedGraph === 'turretDamage' ? 'Damage to Turrets' :
            selectedGraph === 'healsOnTeammates' ? 'Heals on Teammates' :
            selectedGraph === 'soloKills' ? 'Solo Kills' :
            selectedGraph === 'wardsKilled' ? 'Wards Killed' :
            'Total CS' // Fallback
          }
        </h3>
        <select
          value={selectedGraph}
          onChange={(e) => setSelectedGraph(e.target.value as GraphType)}
          className="p-1 border border-gray-700 rounded-md bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm self-end sm:self-auto"
        >
          <option value="damage">Damage</option>
          <option value="damageTaken">Damage Taken</option>
          <option value="damageMitigated">Damage Mitigated</option>
          <option value="turretPlates">Turret Platings</option>
          <option value="turretDamage">Turret Damage</option>
          <option value="objectiveDamage">Objective Damage</option>
          <option value="dpm">Damage/Min</option>
          <option value="healing">Healing</option>
          <option value="shielding">Shielding</option>
          <option value="cs">CS</option>
          <option value="gold">Gold</option>
          <option value="vision">Vision</option>
          <option value="cc">CC Score</option>
          <option value="wardsPlaced">Wards Placed</option>
          <option value="controlWardsPlaced">Control Wards</option>
          <option value="healsOnTeammates">Team Healing</option>
          <option value="soloKills">Solo Kills</option>
          <option value="wardsKilled">Wards Killed</option>
        </select>
      </div>
      {selectedGraph === 'damage' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.totalDamageDealtToChampions || 0} />}
      {selectedGraph === 'damageTaken' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.totalDamageTaken || 0} />}
      {selectedGraph === 'damageMitigated' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.damageSelfMitigated || 0} />}
      {selectedGraph === 'healing' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.totalHeal || 0} />}
      {selectedGraph === 'shielding' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.totalDamageShieldedOnTeammates || 0} />}
      {selectedGraph === 'cs' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0)} />}
      {selectedGraph === 'gold' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.goldEarned || 0} />}
      {selectedGraph === 'vision' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.visionScore || 0} />}
      {selectedGraph === 'cc' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.timeCCingOthers || 0} />}
      {selectedGraph === 'dpm' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.challenges?.damagePerMinute || 0} />}
      {selectedGraph === 'objectiveDamage' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.damageDealtToObjectives || 0} />}
      {selectedGraph === 'wardsPlaced' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.wardsPlaced || 0} />}
      {selectedGraph === 'controlWardsPlaced' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.detectorWardsPlaced || 0} />}
      {selectedGraph === 'turretPlates' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.challenges?.turretPlatesTaken || 0} />}
      {selectedGraph === 'turretDamage' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.damageDealtToTurrets || 0} />}
      {selectedGraph === 'healsOnTeammates' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.totalHealsOnTeammates || 0} />}
      {selectedGraph === 'soloKills' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.challenges?.soloKills || 0} />}
      {selectedGraph === 'wardsKilled' && <StatGraph participants={participants} puuid={puuid} onPlayerClick={onPlayerClick} statSelector={p => p.wardsKilled || 0} />}
    </div>
  );
};

export default GraphsTab;