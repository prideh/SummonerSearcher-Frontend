import React, { useState } from 'react';
import type { MatchDto, ParticipantDto } from '../types/match';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';

/**
 * Props for the GraphsTab component.
 */
interface GraphsTabProps {
  /** The full match data object. */
  match: MatchDto;
  /** The PUUID of the player whose perspective the graphs are viewed from. */
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
 * Props for the StatGraph component.
 */
interface StatGraphProps {
  /** An array of all participants in the match. */
  participants: ParticipantDto[];
  /** The PUUID of the searched player to highlight them. */
  puuid: string;
  /** Callback function to handle clicks on player names. */
  onPlayerClick: (name: string, tag: string) => void;
  /** A selector function that extracts a specific stat from a participant object. */
  statSelector: (p: ParticipantDto) => number;
}
/**
 * A reusable component that displays a horizontal bar graph for a specific game statistic.
 * It shows all players, sorted by the stat, with bars proportional to their value.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

/**
 * Custom YAxis tick to render champion images and names next to the bars.
 */
const CustomYAxisTick = (props: { x?: number; y?: number; payload?: { value: string } }) => {
  const { x, y, payload } = props;
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  // payload.value is the participant object we stringified or a complex object
  // Recharts passes strings to the tick if dataKey is string, so we'll pass the JSON string 
  // and parse it back, or just use payload.value as the raw data if recharts allows it.
  
  let playerInfo;
  if (!payload) return null;
  try {
    playerInfo = typeof payload.value === 'string' ? JSON.parse(payload.value) : payload.value;
  } catch {
    return null;
  }

  const isSearchedPlayer = playerInfo.isSearchedPlayer;
  
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-140} y={-14} width={130} height={28}>
        <div className="flex items-center justify-end space-x-2 pr-2" title={`${playerInfo.name}#${playerInfo.tag}`}>
          <div className={`truncate text-sm text-right flex-1 ${isSearchedPlayer ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
            {playerInfo.name}
          </div>
          <img 
            src={`${CDN_URL}/img/champion/${getCorrectChampionName(playerInfo.champion)}.png`} 
            alt={playerInfo.champion} 
            className="w-7 h-7 rounded shrink-0" 
          />
        </div>
      </foreignObject>
    </g>
  );
};

/**
 * Custom Tooltip for the Recharts BarChart
 */
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { playerInfo: { name: string; tag: string; champion: string; isSearchedPlayer: boolean }; value: number } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isSearched = data.playerInfo.isSearchedPlayer;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm shadow-xl flex items-center space-x-3">
        <img 
          src={useDataDragonStore.getState().cdnUrl + `/img/champion/${getCorrectChampionName(data.playerInfo.champion)}.png`} 
          alt={data.playerInfo.champion} 
          className="w-10 h-10 rounded shrink-0" 
        />
        <div>
          <p className={`font-bold ${isSearched ? 'text-cyan-400' : 'text-gray-200'}`}>
            {data.playerInfo.name}<span className="text-gray-500 font-normal">#{data.playerInfo.tag}</span>
          </p>
          <p className="text-gray-300 mt-0.5">
            Value: <span className="font-semibold text-white">{data.value.toLocaleString()}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * Recharts implementation of the StatGraph.
 */
const StatGraph: React.FC<StatGraphProps> = ({ participants, puuid, onPlayerClick, statSelector }) => {
  // Sort participants so the highest stat is at the top of the chart
  const sortedParticipants = [...participants].sort((a, b) => (statSelector(b) || 0) - (statSelector(a) || 0));

  // Prepare data for recharts
  const chartData = sortedParticipants.map(player => ({
    // We pass serialized JSON as the YAxis key so our custom tick can access the player details
    playerId: JSON.stringify({
      id: player.puuid,
      name: player.riotIdGameName,
      tag: player.riotIdTagline,
      champion: player.championName,
      isSearchedPlayer: player.puuid === puuid
    }),
    value: statSelector(player) || 0,
    teamId: player.teamId,
    // Store original object for tooltip
    playerInfo: {
      name: player.riotIdGameName,
      tag: player.riotIdTagline,
      champion: player.championName,
      isSearchedPlayer: player.puuid === puuid,
      puuid: player.puuid
    }
  }));

  const onBarClick = (data: unknown) => {
    const d = data as { playerInfo: { name: string; tag: string } };
    onPlayerClick(d.playerInfo.name, d.playerInfo.tag);
  };

  return (
    <div className="w-full h-[400px] sm:h-[450px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
          barSize={24}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" />
          <XAxis 
            type="number" 
            stroke="#6b7280" 
            tickFormatter={(val) => formatNumber(val)}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            axisLine={{ stroke: '#4b5563' }}
            tickLine={false}
          />
          <YAxis 
            type="category" 
            dataKey="playerId" 
            axisLine={false}
            tickLine={false}
            tick={<CustomYAxisTick />}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.2 }} />
          <Bar 
            dataKey="value" 
            radius={[0, 4, 4, 0]} 
            onClick={onBarClick}
            cursor="pointer"
          >
            {chartData.map((entry, index) => {
              // Same colors as original implementation
              const isBlueTeam = entry.teamId === 100;
              const isBlueFilled = isBlueTeam ? '#3b82f6' : '#ef4444'; // Solid colors work better for Recharts cells
              const fill = entry.playerInfo.isSearchedPlayer ? (isBlueTeam ? '#60a5fa' : '#f87171') : isBlueFilled;
              return <Cell key={`cell-${index}`} fill={fill} className="transition-all hover:opacity-80" />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Defines the types of graphs that can be displayed.
 * Each key corresponds to a specific statistic from the match data.
 */
type GraphType = 'damage' | 'damageTaken' | 'damageMitigated' | 'healing' | 'shielding' | 'cs' | 'gold' | 'vision' | 'cc' | 'dpm' | 'objectiveDamage' | 'turretDamage' | 'turretPlates' | 'wardsPlaced' | 'controlWardsPlaced' | 'soloKills' | 'wardsKilled' | 'healsOnTeammates';

/**
 * The GraphsTab component provides a dropdown to select various game statistics
 * and displays them in a bar chart format using the StatGraph component.
 */
const GraphsTab: React.FC<GraphsTabProps> = ({ match, puuid, onPlayerClick }) => {
  const [selectedGraph, setSelectedGraph] = useState<GraphType>('damage');
  const participants = match.info?.participants;

  if (!participants || participants.length === 0) {
    return <p className="p-4 text-gray-500 dark:text-gray-400">No participant data available for analysis.</p>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {/* Dynamically set the title based on the selected graph type */}
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
          className="p-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm self-end sm:self-auto"
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
      {/* Conditionally render the StatGraph component with the appropriate stat selector */}
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