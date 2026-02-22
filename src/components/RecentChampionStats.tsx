import React from 'react';
import { getCorrectChampionName } from '../utils/championNameHelper';
import { getKdaColorClass, getWinRateColorClass } from '../utils/colorUtils';
import { useDataDragonStore } from '../store/dataDragonStore';
import type { ChampionStats, OverallStats } from '../types/summoner';

/**
 * Props for the RecentChampionStats component.
 */
interface RecentChampionStatsProps {
  championStats: ChampionStats[];
  overallStats: OverallStats | null;
}

/**
import React from 'react';
import { getCorrectChampionName } from '../utils/championNameHelper';
import { useDataDragonStore } from '../store/dataDragonStore';
import type { ChampionStats, OverallStats } from '../types/summoner';

/**
 * Props for the RecentChampionStats component.
 */
interface RecentChampionStatsProps {
  championStats: ChampionStats[];
  overallStats: OverallStats | null;
}

/**
 * Displays aggregated statistics for a summoner's most played champions
 * and overall performance metrics like win rate, KDA, and CS/min.
 */
const RecentChampionStats: React.FC<RecentChampionStatsProps> = ({ championStats, overallStats }) => {
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  if (!overallStats || (championStats.length === 0 && overallStats.wins + overallStats.losses === 0)) {
    return <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">Not enough recent games to show champion stats.</p>;
  }

  return (
    <div className="text-center md:text-left">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last {overallStats.wins + overallStats.losses} Games</h3>
        <div className="text-xs text-right">
          <span className={`font-bold ${getWinRateColorClass(Number(overallStats.winRate))}`}>
            {overallStats.wins}W {overallStats.losses}L ({Number(overallStats.winRate).toFixed(0)}%)
          </span>
        </div>
      </div>
      <div className="flex space-x-2 justify-center md:justify-start mb-3">
        {championStats.slice(0, 5).map(stat => {
          const winRate = stat.games > 0 ? ((stat.wins / stat.games) * 100).toFixed(0) : 0;
          const kda = stat.deaths > 0 ? ((stat.kills + stat.assists) / stat.deaths) : Infinity;
          const avgKda = `${(stat.kills / stat.games).toFixed(1)} / ${(stat.deaths / stat.games).toFixed(1)} / ${(stat.assists / stat.games).toFixed(1)}`;

          // Tooltip content with detailed stats for each champion.
          const tooltipContent = `
            <div class="text-center">
              <div class="font-bold text-gray-100">${stat.championName}</div>
              <div class="text-sm font-bold ${getWinRateColorClass(Number(winRate))}">${winRate}% WR <span class="text-gray-500">(${stat.games} G)</span></div>
              <div class="text-sm font-bold ${getKdaColorClass(kda)} mt-1">${kda === Infinity ? 'Infinite' : kda.toFixed(2)} KDA</div>
              <div class="text-xs text-gray-500">${avgKda}</div>
              ${stat.soloKills > 0 ? `<div class="text-xs text-yellow-400 mt-1">Solo Kills: ${stat.soloKills}</div>` : ''}
            </div>
          `;

          return (
            <img 
              loading="lazy"
              key={stat.championName}
              src={`${CDN_URL}/img/champion/${getCorrectChampionName(stat.championName)}.png`} 
              alt={stat.championName} 
              className="w-12 h-12 rounded-md transition-transform hover:scale-110"
              data-tooltip-id="item-tooltip"
              data-tooltip-content={tooltipContent}
            />
          );
        })}
      </div>
      
      <div className="text-xs border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between items-start">
          <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-1">
                  <span className="text-blue-500 font-bold">Blue:</span>
                  <span className="text-gray-600 dark:text-gray-400">{overallStats.blueSide.games}G</span>
                  <span className={`font-bold ${getWinRateColorClass(Number(overallStats.blueSide.winRate))}`}>({Number(overallStats.blueSide.winRate).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center space-x-1">
                  <span className="text-red-500 font-bold">Red:</span>
                  <span className="text-gray-600 dark:text-gray-400">{overallStats.redSide.games}G</span>
                  <span className={`font-bold ${getWinRateColorClass(Number(overallStats.redSide.winRate))}`}>({Number(overallStats.redSide.winRate).toFixed(0)}%)</span>
              </div>
          </div>
          <div className="flex flex-col space-y-1 text-gray-500 dark:text-gray-400 text-right">
              <div className="text-[10px] text-gray-400 mb-1 font-medium">You <span className="text-gray-300">vs</span> Opp</div>
              <div className="flex items-center justify-end space-x-1">
                  <span>KDA:</span>
                  <div className="flex items-center space-x-1">
                    <span className={`font-bold ${Number(overallStats.kda) >= Number(overallStats.oppAvgKda) ? 'text-cyan-500 dark:text-cyan-400' : getKdaColorClass(Number(overallStats.kda))}`}>
                      {Number(overallStats.kda) === Infinity ? 'Inf' : Number(overallStats.kda).toFixed(2)}
                    </span>
                    <span className={`text-[10px] ${Number(overallStats.oppAvgKda) > Number(overallStats.kda) ? 'text-cyan-500 dark:text-cyan-400 font-semibold' : 'text-gray-500'}`}>
                      ({Number(overallStats.oppAvgKda) === Infinity ? 'Inf' : Number(overallStats.oppAvgKda).toFixed(2)})
                    </span>
                  </div>
              </div>
              <div className="flex items-center justify-end space-x-1">
                  <span>KP:</span>
                  <div className="flex items-center space-x-1">
                    <span className={`font-semibold ${Number(overallStats.avgKillParticipation) >= Number(overallStats.oppAvgKillParticipation) ? 'text-cyan-500 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {Number(overallStats.avgKillParticipation).toFixed(0)}%
                    </span>
                    <span className={`text-[10px] ${Number(overallStats.oppAvgKillParticipation) > Number(overallStats.avgKillParticipation) ? 'text-cyan-500 dark:text-cyan-400 font-semibold' : 'text-gray-500'}`}>
                      ({Number(overallStats.oppAvgKillParticipation).toFixed(0)}%)
                    </span>
                  </div>
              </div>
              <div className="flex items-center justify-end space-x-1">
                  <span>CS/m:</span>
                  <div className="flex items-center space-x-1">
                    <span className={`font-semibold ${Number(overallStats.avgCsPerMinute) >= Number(overallStats.oppAvgCsPerMinute) ? 'text-cyan-500 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {Number(overallStats.avgCsPerMinute).toFixed(1)}
                    </span>
                    <span className={`text-[10px] ${Number(overallStats.oppAvgCsPerMinute) > Number(overallStats.avgCsPerMinute) ? 'text-cyan-500 dark:text-cyan-400 font-semibold' : 'text-gray-500'}`}>
                      ({Number(overallStats.oppAvgCsPerMinute).toFixed(1)})
                    </span>
                  </div>
              </div>
              <div className="flex items-center justify-end space-x-1">
                  <span>Avg Solokills:</span>
                  <div className="flex items-center space-x-1">
                    <span className={`font-semibold ${Number(overallStats.avgSoloKills) >= Number(overallStats.oppAvgSoloKills) ? 'text-cyan-500 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {Number(overallStats.avgSoloKills).toFixed(1)}
                    </span>
                    <span className={`text-[10px] ${Number(overallStats.oppAvgSoloKills) > Number(overallStats.avgSoloKills) ? 'text-cyan-500 dark:text-cyan-400 font-semibold' : 'text-gray-500'}`}>
                      ({Number(overallStats.oppAvgSoloKills).toFixed(1)})
                    </span>
                  </div>
              </div>
              <div className="flex items-center justify-end space-x-1">
                  <span>Avg Tower Plates:</span>
                  <div className="flex items-center space-x-1">
                    <span className={`font-semibold ${Number(overallStats.avgTurretPlates) >= Number(overallStats.oppAvgTurretPlates) ? 'text-cyan-500 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {Number(overallStats.avgTurretPlates).toFixed(1)}
                    </span>
                    <span className={`text-[10px] ${Number(overallStats.oppAvgTurretPlates) > Number(overallStats.avgTurretPlates) ? 'text-cyan-500 dark:text-cyan-400 font-semibold' : 'text-gray-500'}`}>
                      ({Number(overallStats.oppAvgTurretPlates).toFixed(1)})
                    </span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default RecentChampionStats;