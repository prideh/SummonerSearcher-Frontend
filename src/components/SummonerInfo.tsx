import React from 'react';
import type { SummonerData } from '../types/summoner';
import RankedInfo from './RankedInfo';
import { useTimeAgo } from '../hooks/useTimeAgo';
import { useDataDragonStore } from '../store/dataDragonStore';

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
}

/**
 * Displays the main profile card for a searched summoner.
 * It includes their profile icon, Riot ID, level, and a "Refresh" button.
 * It also contains the `RankedInfo` component to show ranked statistics.
 */
const SummonerInfo: React.FC<SummonerInfoProps> = ({ summonerData, handleRefresh, loading }) => {
  const [timeAgo, ref] = useTimeAgo(new Date(summonerData.lastUpdated).getTime());
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

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
          <div className="shrink-0">
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-4.991-2.691V5.25a8.25 8.25 0 0 0-11.667 0v3.183" /></svg>
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>
      {summonerData.soloQueueRank ? (
        <RankedInfo rankedData={summonerData.soloQueueRank} summonerData={summonerData} />
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-4">No ranked data available for this summoner.</p>
      )}
    </div>
  );
};

export default SummonerInfo;
