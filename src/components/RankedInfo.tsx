import React from 'react';
import type { LeagueEntryDto, SummonerData } from '../types/summoner';
import RecentChampionStats from './RecentChampionStats';
import { useDataDragonStore } from '../store/dataDragonStore';

/**
 * Props for the RankedInfo component.
 */
interface RankedInfoProps {
  /** The ranked data for the summoner (tier, rank, LP, etc.). */
  rankedData: LeagueEntryDto;
  /** The full summoner data object, passed down to RecentChampionStats. */
  summonerData: SummonerData;
}

/**
 * Displays a summoner's ranked information, including their tier emblem, rank, LP, and win/loss record.
 * It also includes the `RecentChampionStats` component to show performance on recently played champions.
 */
const RankedInfo: React.FC<RankedInfoProps> = ({ rankedData, summonerData }) => {
  const communityDragonUrl = useDataDragonStore(state => state.communityDragonUrl);
  // Calculate the win rate, handling the case of zero total games.
  const winRate = rankedData.wins + rankedData.losses > 0
    ? ((rankedData.wins / (rankedData.wins + rankedData.losses)) * 100).toFixed(1)
    : 'N/A';

  return (
    <div className="bg-transparent dark:bg-transparent p-4 rounded-lg mt-4 border border-gray-200 dark:border-gray-800">
      <h3 className="text-lg font-semibold text-cyan-600 dark:text-cyan-400 mb-2">Ranked Solo/Duo</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-2">
        <div className="flex items-center space-x-4">
          {rankedData.tier && (
            <img
              src={`${communityDragonUrl}/rcp-fe-lol-shared-components/global/default/images/${rankedData.tier.toLowerCase()}.png`}
              alt={rankedData.tier}
              className="w-24 h-24"
            />
          )}
          <div>
            <p className="text-xl font-bold capitalize">{rankedData.tier?.toLowerCase() || 'Unranked'} {rankedData.rank}</p>
            <p className="text-gray-700 dark:text-gray-300">{rankedData.leaguePoints} LP</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rankedData.wins}W / {rankedData.losses}L ({winRate}%)</p>
          </div>
        </div>
        {/* Display stats for recently played champions. */}
        {summonerData && <RecentChampionStats matches={summonerData.recentMatches} puuid={summonerData.puuid} />}
      </div>
    </div>
  );
};

export default RankedInfo;
