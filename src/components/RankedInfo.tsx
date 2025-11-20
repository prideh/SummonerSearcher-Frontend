import React from 'react';
import type { LeagueEntryDto, SummonerData } from '../types/summoner';
import RecentChampionStats from './RecentChampionStats';

interface RankedInfoProps {
  rankedData: LeagueEntryDto;
  summonerData: SummonerData;
}

const RankedInfo: React.FC<RankedInfoProps> = ({ rankedData, summonerData }) => {
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
              src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/${rankedData.tier.toLowerCase()}.png`}
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
        {summonerData && <RecentChampionStats matches={summonerData.recentMatches} puuid={summonerData.puuid} />}
      </div>
    </div>
  );
};

export default RankedInfo;
