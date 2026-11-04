import React, { useState } from 'react';
import type { SummonerData } from '../types/summoner';
import { useDataDragonStore } from '../store/dataDragonStore';
import { getCorrectChampionName } from '../utils/championNameHelper';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';
import { getKdaColorClass, getWinRateColorClass } from '../utils/colorUtils';

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

  const statBoxClass = cn(
    "bg-slate-50 dark:bg-[#0b101d] p-3 rounded-lg border",
    "border-slate-200 dark:border-slate-800 transition-colors",
    "hover:border-sky-300 dark:hover:border-slate-700"
  );
  const statTitleClass = "text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 font-extrabold";
  const statValueClass = "text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight telemetry-nums";

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "rounded-lg border shadow-md p-5 mt-4 mb-4 relative overflow-hidden telemetry-nums",
        "bg-white dark:bg-[#111827]",
        "border-slate-200 dark:border-slate-800"
      )}
    >
      
      <button 
        onClick={onClose}
        aria-label="Close Profile"
        className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center mb-4">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mr-3 tracking-tight">
          Seasonal Performance
        </h2>
        <span className="text-[11px] font-bold text-sky-700 dark:text-cyan-300 bg-sky-50 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded border border-sky-200 dark:border-cyan-800/60">
            {summonerData.totalMatches} Matches
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Champion Statistics */}
        <div className="lg:col-span-7 flex flex-col relative h-full">
            <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                Champion Statistics
            </h3>
            
            <div className={`relative rounded-lg bg-slate-50/70 dark:bg-[#0b101d] border border-slate-200 dark:border-slate-800 ${isExpanded ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`} style={{ height: '370px' }}>
              <motion.div 
                className="p-2 space-y-1.5"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.05 }
                  }
                }}
              >
                {championStats.map((stat, index) => (
                  <motion.div 
                    key={stat.championName} 
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    className="group flex items-center justify-between bg-white dark:bg-[#111827] p-2 rounded-md border border-slate-200/80 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                          <img 
                          src={`${cdnUrl}/img/champion/${getCorrectChampionName(stat.championName)}.png`} 
                          alt={`${stat.championName} Champion Icon`} 
                          loading="lazy"
                          className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-700"
                          />
                          <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[9px] px-1 rounded font-bold border border-slate-700">
                              #{index + 1}
                          </div>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{stat.championName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{stat.games} Games</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 sm:space-x-2 text-right pr-1">
                      <div className="w-12 sm:w-16">
                        <div className="flex items-center justify-end space-x-1">
                            <p className={cn("font-bold text-xs sm:text-sm", getWinRateColorClass(Number(stat.winRate || 0)))}>
                              {Number(stat.winRate || 0).toFixed(0)}%
                            </p>
                            {Number(stat.winRate) >= 60 && <span className="text-[8px] sm:text-[10px] text-amber-500 max-w-[12px]">🔥</span>}
                        </div>
                        <p className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Winrate</p>
                      </div>
                      <div className="w-12 sm:w-16">
                        <p className={`font-bold text-xs sm:text-sm ${getKdaColorClass(Number(stat.kda || 0))}`}>
                          {Number(stat.kda) === Infinity ? 'Perf' : Number(stat.kda || 0).toFixed(2)}
                        </p>
                        <p className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-wide font-semibold">KDA</p>
                      </div>
                      <div className="w-10 sm:w-16">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-200">
                          {Number(stat.averageCsPerMinute || 0).toFixed(1)}
                        </p>
                        <p className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-wide font-semibold">CS/M</p>
                      </div>
                      <div className="w-16 hidden sm:block">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-200">
                          {Number(stat.averageSoloKills || 0).toFixed(1)}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Avg Solo</p>
                      </div>
                      <div className="w-16 hidden sm:block">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-200">
                          {Number(stat.averageTurretPlates || 0).toFixed(1)}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Avg Plates</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {!isExpanded && championStats.length > 5 && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-100 via-slate-100/90 to-transparent dark:from-[#0b101d] dark:via-[#0b101d]/90 dark:to-transparent flex items-end justify-center pb-4 rounded-b-lg">
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className="px-4 py-1.5 text-xs font-extrabold text-white dark:text-slate-950 bg-sky-600 hover:bg-sky-500 dark:bg-cyan-400 dark:hover:bg-cyan-300 rounded-md shadow-sm transition-colors flex items-center"
                    >
                        Show All Champions
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
              )}
            </div>
        </div>

        {/* Right Column: Rank & Overall Stats */}
        <div className="lg:col-span-5 space-y-4">
            {/* Rank Card */}
            <div className="bg-slate-50 dark:bg-[#0b101d] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-center space-x-4">
                    {soloQueueRank?.tier ? (
                    <img
                        src={`${communityDragonUrl}/rcp-fe-lol-shared-components/global/default/images/${soloQueueRank.tier.toLowerCase()}.png`}
                        alt={`${soloQueueRank.tier} Rank Icon`}
                        className="w-16 h-16 object-contain"
                    />
                    ) : (
                        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs font-bold">
                            Unranked
                        </div>
                    )}
                    <div>
                        <p className="text-xl font-extrabold capitalize text-slate-900 dark:text-white tracking-tight">
                            {soloQueueRank?.tier?.toLowerCase() || 'Unranked'} {soloQueueRank?.rank}
                        </p>
                        <div className="flex items-center text-slate-600 dark:text-slate-300 space-x-2 mt-0.5">
                            <span className="font-bold text-sm text-sky-600 dark:text-cyan-400">{soloQueueRank?.leaguePoints || 0} LP</span>
                            <span className="text-slate-300 dark:text-slate-700 text-xs">|</span>
                            <span className={`${getWinRateColorClass(parseFloat(winRate))} font-bold text-sm`}>
                                {winRate}% WR
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                            {overallStats.wins} Wins  &bull;  {overallStats.losses} Losses
                        </p>
                    </div>
                </div>
            </div>

             {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2.5">
                 <div className={statBoxClass}>
                    <p className={statTitleClass}>KDA Ratio</p>
                    <p className={cn(statValueClass, getKdaColorClass(Number(overallStats.kda || 0)))}>
                        {Number(overallStats.kda) === Infinity ? 'Perfect' : Number(overallStats.kda || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                        {Number(overallStats.avgKills || 0).toFixed(1)} / {Number(overallStats.avgDeaths || 0).toFixed(1)} / {Number(overallStats.avgAssists || 0).toFixed(1)}
                    </p>
                 </div>
                 <div className={statBoxClass}>
                    <p className={statTitleClass}>CS / Min</p>
                    <p className={statValueClass}>{Number(overallStats.avgCsPerMinute || 0).toFixed(1)}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Creep Score</p>
                 </div>
                 <div className={statBoxClass}>
                    <p className={statTitleClass}>Kill Part.</p>
                    <p className={statValueClass}>{Number(overallStats.avgKillParticipation || 0).toFixed(0)}%</p>
                 </div>
                 <div className={statBoxClass}>
                    <p className={statTitleClass}>Vision</p>
                    <p className={statValueClass}>{Number(overallStats.avgVisionScore || 0).toFixed(1)}</p>
                 </div>
                 <div className={statBoxClass}>
                    <p className={statTitleClass}>Avg Plates</p>
                    <p className={statValueClass}>{Number(overallStats.avgTurretPlates || 0).toFixed(1)}</p>
                 </div>
                 <div className={statBoxClass}>
                    <p className={statTitleClass}>Avg Solo Kills</p>
                    <p className={statValueClass}>{Number(overallStats.avgSoloKills || 0).toFixed(1)}</p>
                 </div>
            </div>

            {/* Side Winrates */}
            <div className="grid grid-cols-2 gap-2.5">
                 <div className="bg-sky-50/60 dark:bg-sky-950/20 p-3 rounded-lg border border-sky-200/80 dark:border-sky-800/40 flex items-center justify-between">
                    <div>
                        <span className="text-sky-700 dark:text-sky-400 font-extrabold uppercase text-[10px] tracking-wider block">Blue Side</span>
                        <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded mt-1 inline-block">{overallStats.blueSide.games} G</span>
                    </div>
                    <div className={cn("text-xl font-black", getWinRateColorClass(Number(overallStats.blueSide.winRate || 0)))}>
                        {Number(overallStats.blueSide.winRate || 0).toFixed(0)}%
                    </div>
                 </div>
                 <div className="bg-rose-50/60 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200/80 dark:border-rose-800/40 flex items-center justify-between">
                    <div>
                        <span className="text-rose-700 dark:text-rose-400 font-extrabold uppercase text-[10px] tracking-wider block">Red Side</span>
                        <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded mt-1 inline-block">{overallStats.redSide.games} G</span>
                    </div>
                    <div className={cn("text-xl font-black", getWinRateColorClass(Number(overallStats.redSide.winRate || 0)))}>
                        {Number(overallStats.redSide.winRate || 0).toFixed(0)}%
                    </div>
                 </div>
            </div>
        </div>

      </div>
    </motion.div>
  );
};

export default PlayerProfile;
