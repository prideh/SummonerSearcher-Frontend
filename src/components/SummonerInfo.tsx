import React, { useState } from 'react';
import type { SummonerData } from '../types/summoner';
import type { MatchDto } from '../types/match';
import RankedInfo from './RankedInfo';
import { useTimeAgo } from '../hooks/useTimeAgo';
import { useDataDragonStore } from '../store/dataDragonStore';
import AiAnalysisModal from './AiAnalysisModal';
import { buildAiContext } from '../utils/aiContextBuilder';

/**
 * Props for the SummonerInfo component.
 */
interface SummonerInfoProps {
  /** The data object for the searched summoner. */
  summonerData: SummonerData;
  /** Callback function to handle the refresh action. */
  handleRefresh: () => void;
  /** Boolean indicating if a refresh is currently in progress. */
  loading: boolean;
  /** Boolean indicating if a refresh operation is in progress (keeps data visible). */
  refreshing: boolean;
  /** The subset of matches currently visible in the match history. */
  visibleMatches: MatchDto[];
}

/**
 * Displays the main profile card for a searched summoner.
 * It includes their profile icon, Riot ID, level, and a "Refresh" button.
 * It also contains the `RankedInfo` component to show ranked statistics.
 */
const SummonerInfo: React.FC<SummonerInfoProps> = ({ summonerData, handleRefresh, loading, refreshing, visibleMatches }) => {
  const [timeAgo, ref] = useTimeAgo(new Date(summonerData.lastUpdated).getTime());
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const [showAiModal, setShowAiModal] = useState(false);

  // Build comprehensive AI context from ALL matches (not just visible ones)
  const aiContext = buildAiContext(
    summonerData.gameName,
    summonerData.tagLine,
    summonerData.recentMatches, // Use ALL matches, not just visible ones
    summonerData.puuid
  );

  return (
    <div ref={ref} className="bg-white dark:bg-transparent border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
      <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <img
          src={`${CDN_URL}/img/profileicon/${summonerData.profileIconId}.png`}
          alt="Profile Icon"
          className="w-20 h-20 rounded-full border-2 border-cyan-400"
        />
        <div className="flex-grow text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start sm:space-x-4">
            <h2 className="text-2xl font-bold">{summonerData.gameName} <span className="text-gray-500 dark:text-gray-500">#{summonerData.tagLine}</span></h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Level {summonerData.summonerLevel}</p>
          {summonerData.lastUpdated && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Last updated: {timeAgo}
            </p>
          )}
        </div>
        {!loading && (
          <div className="shrink-0 flex space-x-2">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
              <svg 
                className="w-5 h-5" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              <span>Analyze</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <svg 
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-4.991-2.691V5.25a8.25 8.25 0 0 0-11.667 0v3.183" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>
      {summonerData.soloQueueRank ? (
        <RankedInfo rankedData={summonerData.soloQueueRank} summonerData={summonerData} matches={visibleMatches} />
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-4">No ranked data available for this summoner.</p>
      )}
      
      <AiAnalysisModal 
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        summonerName={`${summonerData.gameName}#${summonerData.tagLine}`}
        context={aiContext}
      />
    </div>
  );
};

export default SummonerInfo;
