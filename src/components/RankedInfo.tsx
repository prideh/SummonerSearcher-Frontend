import React from 'react';
import type { LeagueEntryDto, SummonerData } from '../types/summoner';
import type { MatchDto } from '../types/match';
import ConsistencyStats from './ConsistencyStats';
import RecentChampionStats from './RecentChampionStats';
import { useDataDragonStore } from '../store/dataDragonStore';

/**
 * Props for the RankedInfo component.
 */
interface RankedInfoProps {
  /** The ranked data for the summoner (tier, rank, LP, etc.). */
  rankedData: LeagueEntryDto;
  /** The full summoner data object. */
  summonerData: SummonerData;
  /** The subset of matches currently visible in the match history. */
  matches: MatchDto[];
}

/**
 * Displays a summoner's ranked information, including their tier emblem, rank, LP, and win/loss record.
 * It also includes the `RecentChampionStats` component to show performance on recently played champions.
 */
const RankedInfo: React.FC<RankedInfoProps> = ({ rankedData, summonerData, matches }) => {
  const communityDragonUrl = useDataDragonStore(state => state.communityDragonUrl);
  // Calculate the win rate, handling the case of zero total games.
  const winRate = rankedData.wins + rankedData.losses > 0
    ? ((rankedData.wins / (rankedData.wins + rankedData.losses)) * 100).toFixed(1)
    : 'N/A';

  return (
    <div className="bg-transparent dark:bg-transparent rounded-xl mt-4 border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-700">
        <div className="p-4 flex flex-col justify-center">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Ranked Solo/Duo</h3>
          <div className="flex items-center space-x-3">
            {rankedData.tier && (
              <img
                src={`${communityDragonUrl}/rcp-fe-lol-shared-components/global/default/images/${rankedData.tier.toLowerCase()}.png`}
                alt={rankedData.tier}
                className="w-14 h-14"
              />
            )}
            <div>
              <p className="text-lg font-bold capitalize text-gray-900 dark:text-white leading-tight">
                {rankedData.tier?.toLowerCase() || 'Unranked'} {rankedData.rank}
              </p>
              {(() => {
                if (!matches || matches.length === 0) return null;
                
                const roleCounts: Record<string, number> = {};
                let totalGames = 0;

                matches.forEach(match => {
                  const participant = match.info?.participants.find(p => p.puuid === summonerData.puuid);
                  if (participant && participant.teamPosition && participant.teamPosition !== 'NONE') {
                    roleCounts[participant.teamPosition] = (roleCounts[participant.teamPosition] || 0) + 1;
                    totalGames++;
                  }
                });

                if (totalGames === 0) return null;

                const sortedRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
                if (sortedRoles.length === 0) return null;

                const [bestRole, count] = sortedRoles[0];
                
                // Check for tie
                if (sortedRoles.length > 1 && sortedRoles[1][1] === count) {
                    return <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Multirole</p>;
                }

                const roleName = bestRole === 'UTILITY' ? 'Support' : 
                                 bestRole === 'BOTTOM' ? 'ADC' : 
                                 bestRole === 'MIDDLE' ? 'Mid' : 
                                 bestRole.charAt(0) + bestRole.slice(1).toLowerCase();
                return <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{roleName} Main</p>;
              })()}
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 space-x-2">
                <span>{rankedData.leaguePoints} LP</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {rankedData.wins}W / {rankedData.losses}L (<span className={`${parseFloat(winRate) > 50 ? 'text-green-600 dark:text-green-400 font-semibold' : parseFloat(winRate) < 50 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{winRate}%</span>)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          {/* Display stats for recently played champions. */}
          {summonerData && <RecentChampionStats matches={matches} puuid={summonerData.puuid} />}
        </div>
        
        <div className="p-4">
          {/* Display consistent stats (best and worst). */}
          {summonerData && <ConsistencyStats matches={matches} puuid={summonerData.puuid} />}
        </div>
      </div>
    </div>
  );
};

export default RankedInfo;
