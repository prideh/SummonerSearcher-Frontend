import React, { useState } from 'react';
import type { SummonerData } from '../types/summoner';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';

interface PlayerProfileProps {
  summonerData: SummonerData;
  onClose: () => void;
}

const PlayerProfile: React.FC<PlayerProfileProps> = ({ summonerData, onClose }) => {
  const communityDragonUrl = useDataDragonStore(state => state.communityDragonUrl);
  const cdnUrl = useDataDragonStore(state => state.cdnUrl);
  const { overallStats, championStats, soloQueueRank } = summonerData;
  const [isExpanded, setIsExpanded] = useState(false);

  if (!overallStats) return null;

  const winRate = Number(overallStats.winRate || 0).toFixed(1);

  return (
    <div className="bg-white dark:bg-transparent rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl p-4 mt-4 relative animate-fade-in overflow-hidden">
      
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mr-4 tracking-tight">
          Seasonal Performance
        </h2>
        <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 rounded-full border border-cyan-100 dark:border-cyan-800">
            {summonerData.totalMatches} Matches
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Champion Statistics (Swapped) */}
        <div className="lg:col-span-7 flex flex-col relative h-full">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                Champion Statistics
            </h3>
            
            <div className={`relative rounded-xl bg-gray-50 dark:bg-gray-700/10 border border-gray-100 dark:border-gray-700/50 ${isExpanded ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`} style={{ height: '370px' }}>
              <div className="p-2 space-y-2">
                {championStats.map((stat, index) => (
                  <div key={stat.championName} className="group flex items-center justify-between bg-white dark:bg-gray-700/30 p-2 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                          <img 
                          src={`${cdnUrl}/img/champion/${getCorrectChampionName(stat.championName)}.png`} 
                          alt={stat.championName} 
                          className="w-10 h-10 rounded-lg shadow-sm"
                          />
                          <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[9px] px-1 rounded-md font-bold border border-gray-600">
                              #{index + 1}
                          </div>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{stat.championName}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{stat.games} Games</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 sm:space-x-2 text-right pr-1">
                      <div className="w-12 sm:w-16">
                        <div className="flex items-center justify-end space-x-1">
                            <p className={`font-bold text-xs sm:text-sm ${Number(stat.winRate) >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {Number(stat.winRate || 0).toFixed(0)}%
                            </p>
                            {Number(stat.winRate) >= 60 && <span className="text-[8px] sm:text-[10px] text-yellow-500">🔥</span>}
                        </div>
                        <p className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wide font-medium">Winrate</p>
                      </div>
                      <div className="w-12 sm:w-16">
                        <p className={`font-bold text-xs sm:text-sm ${Number(stat.kda) >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                          {Number(stat.kda) === Infinity ? 'Perf' : Number(stat.kda || 0).toFixed(2)}
                        </p>
                        <p className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wide font-medium">KDA</p>
                      </div>
                      <div className="w-10 sm:w-16">
                        <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                          {Number(stat.averageCsPerMinute || 0).toFixed(1)}
                        </p>
                        <p className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-wide font-medium">CS/M</p>
                      </div>
                      <div className="w-16 hidden sm:block">
                        <p className="font-bold text-sm text-gray-900 dark:text-white">
                          {Number(stat.averageSoloKills || 0).toFixed(1)}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Avg Solo</p>
                      </div>
                      <div className="w-16 hidden sm:block">
                        <p className="font-bold text-sm text-gray-900 dark:text-white">
                          {Number(stat.averageTurretPlates || 0).toFixed(1)}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Avg Plates</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!isExpanded && championStats.length > 5 && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent dark:from-gray-800 dark:via-gray-800/90 dark:to-transparent flex items-end justify-center pb-4 rounded-b-xl">
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-full shadow-lg transition-transform transform hover:scale-105 flex items-center"
                    >
                        Show All Champions
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
              )}
            </div>
        </div>

        {/* Right Column: Rank & Overall Stats (Swapped) */}
        <div className="lg:col-span-5 space-y-5">
            {/* Rank Card */}
            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                <div className="flex items-center space-x-4">
                    {soloQueueRank?.tier ? (
                    <img
                        src={`${communityDragonUrl}/rcp-fe-lol-shared-components/global/default/images/${soloQueueRank.tier.toLowerCase()}.png`}
                        alt={soloQueueRank.tier}
                        className="w-16 h-16 drop-shadow-md"
                    />
                    ) : (
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 text-xs">
                            Unranked
                        </div>
                    )}
                    <div>
                        <p className="text-xl font-black capitalize text-gray-900 dark:text-white tracking-tight">
                            {soloQueueRank?.tier?.toLowerCase() || 'Unranked'} {soloQueueRank?.rank}
                        </p>
                        <div className="flex items-center text-gray-600 dark:text-gray-300 space-x-2 mt-0.5">
                            <span className="font-medium text-sm">{soloQueueRank?.leaguePoints || 0} LP</span>
                            <span className="text-gray-300 dark:text-gray-600 text-xs">|</span>
                            <span className={`${parseFloat(winRate) > 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'} font-bold text-sm`}>
                                {winRate}% WR
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 font-medium">
                            {overallStats.wins} Wins  &bull;  {overallStats.losses} Losses
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 font-semibold">KDA Ratio</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {Number(overallStats.kda) === Infinity ? 'Perfect' : Number(overallStats.kda || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                        {Number(overallStats.avgKills || 0).toFixed(1)} / {Number(overallStats.avgDeaths || 0).toFixed(1)} / {Number(overallStats.avgAssists || 0).toFixed(1)}
                    </p>
                 </div>
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 font-semibold">CS / Min</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{Number(overallStats.avgCsPerMinute || 0).toFixed(1)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Creep Score</p>
                 </div>
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 font-semibold">Kill Part.</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{Number(overallStats.avgKillParticipation || 0).toFixed(0)}%</p>
                 </div>
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 font-semibold">Vision</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{Number(overallStats.avgVisionScore || 0).toFixed(1)}</p>
                 </div>
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 font-semibold">Avg Plates</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{Number(overallStats.avgTurretPlates || 0).toFixed(1)}</p>
                 </div>
                 <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 font-semibold">Avg Solo Kills</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{Number(overallStats.avgSoloKills || 0).toFixed(1)}</p>
                 </div>
            </div>

            {/* Side Winrates */}
            <div className="grid grid-cols-2 gap-3">
                 <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30 flex items-center justify-between">
                    <div>
                        <span className="text-blue-600 dark:text-blue-400 font-bold uppercase text-[10px] tracking-wider block">Blue Side</span>
                        <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded mt-1 inline-block">{overallStats.blueSide.games} G</span>
                    </div>
                    <div className="text-xl font-black text-gray-900 dark:text-white">
                        {Number(overallStats.blueSide.winRate || 0).toFixed(0)}%
                    </div>
                 </div>
                 <div className="bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-800/30 flex items-center justify-between">
                    <div>
                        <span className="text-red-600 dark:text-red-400 font-bold uppercase text-[10px] tracking-wider block">Red Side</span>
                        <span className="text-[9px] font-bold bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded mt-1 inline-block">{overallStats.redSide.games} G</span>
                    </div>
                    <div className="text-xl font-black text-gray-900 dark:text-white">
                        {Number(overallStats.redSide.winRate || 0).toFixed(0)}%
                    </div>
                 </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PlayerProfile;
