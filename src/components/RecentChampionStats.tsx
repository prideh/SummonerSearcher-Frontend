import React, { useMemo } from 'react';
import type { MatchDto } from '../types/match';
import { getCorrectChampionName } from '../utils/championNameHelper';
import { useDataDragonStore } from '../store/dataDragonStore';

interface RecentChampionStatsProps {
  matches: MatchDto[];
  puuid: string;
}

interface ChampionStat {
  championName: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  soloKills: number;
}

const RecentChampionStats: React.FC<RecentChampionStatsProps> = ({ matches, puuid }) => {
  const { championStats, overallStats } = useMemo(() => {
    const stats: Record<string, ChampionStat> = {};

    const recentMatches = matches.slice(0, 20);
    let totalGames = 0;
    let totalWins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;

    let totalCs = 0;
    let totalDurationInMinutes = 0;
    let totalKillParticipation = 0;

    // Process the last 20 games
    recentMatches.forEach(match => {
      const player = match.info?.participants.find(p => p.puuid === puuid);
      if (!player || !player.championName || !match.info?.gameDuration) return;

      totalGames++;
      if (player.win) {
        totalWins++;
      }

      const teamKills = match.info.participants
        .filter(p => p.teamId === player.teamId)
        .reduce((acc, p) => acc + (p.kills ?? 0), 0);

      totalKills += player.kills ?? 0;
      totalDeaths += player.deaths ?? 0;
      totalAssists += player.assists ?? 0;

      totalCs += (player.totalMinionsKilled ?? 0) + (player.neutralMinionsKilled ?? 0);
      totalDurationInMinutes += match.info.gameDuration / 60;
      if (teamKills > 0) {
        totalKillParticipation += ((player.kills ?? 0) + (player.assists ?? 0)) / teamKills;
      }

      const championKey = player.championName; // The name from API is the key, e.g., 'Fiddlesticks'

      if (!stats[championKey]) {
        stats[championKey] = {
          championName: player.championName,
          games: 0,
          wins: 0,
          losses: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          soloKills: 0,
        };
      }

      const champ = stats[championKey];
      champ.games++;
      if (player.win) {
        champ.wins++;
      } else {
        champ.losses++;
      }
      champ.kills += player.kills ?? 0;
      champ.deaths += player.deaths ?? 0;
      champ.assists += player.assists ?? 0;
      champ.soloKills += player.challenges?.soloKills ?? 0;
    });
    
    const overallWinRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
    const overallKda = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : Infinity;
    const avgCsPerMinute = totalDurationInMinutes > 0 ? totalCs / totalDurationInMinutes : 0;
    const avgKillParticipation = totalGames > 0 ? (totalKillParticipation / totalGames) * 100 : 0;

    return {
      championStats: Object.values(stats).sort((a, b) => b.games - a.games),
      overallStats: {
        winRate: overallWinRate,
        kda: overallKda,
        wins: totalWins,
        losses: totalGames - totalWins,
        avgCsPerMinute: avgCsPerMinute,
        avgKillParticipation: avgKillParticipation,
        avgKills: totalGames > 0 ? totalKills / totalGames : 0,
        avgDeaths: totalGames > 0 ? totalDeaths / totalGames : 0,
        avgAssists: totalGames > 0 ? totalAssists / totalGames : 0,
      }
    };
  }, [matches, puuid]);

  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  if (championStats.length === 0 && overallStats.wins + overallStats.losses === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">Not enough recent games to show champion stats.</p>;
  }

  return (
    <div className="mt-4 md:mt-0 text-center md:text-left">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last 20 Games</h3>
        <div className="text-xs text-right space-y-0.5">
          <p className="font-semibold text-gray-700 dark:text-gray-300">{overallStats.wins}W {overallStats.losses}L ({overallStats.winRate.toFixed(0)}%)</p>
          <p className="text-gray-500 dark:text-gray-400">{overallStats.kda === Infinity ? 'Infinite' : overallStats.kda.toFixed(2)} KDA</p>
          <p className="text-gray-500 dark:text-gray-400">
            <span>KP {overallStats.avgKillParticipation.toFixed(0)}%</span>
            <span className="text-gray-400 dark:text-gray-600 mx-1">|</span>
            <span>{overallStats.avgCsPerMinute.toFixed(1)} CS/min</span>
          </p>
        </div>
      </div>
      <div className="flex space-x-2 justify-center md:justify-start mt-1">
        {championStats.slice(0, 5).map(stat => {
          const winRate = stat.games > 0 ? ((stat.wins / stat.games) * 100).toFixed(0) : 0;
          const kda = stat.deaths > 0 ? ((stat.kills + stat.assists) / stat.deaths) : Infinity;
          const avgKda = `${((stat.kills) / stat.games).toFixed(1)} / ${((stat.deaths) / stat.games).toFixed(1)} / ${((stat.assists) / stat.games).toFixed(1)}`;

          const tooltipContent = `
            <div class="text-center">
              <div class="font-bold text-gray-100">${stat.championName}</div>
              <div class="text-sm font-semibold ${parseInt(winRate as string) >= 60 ? 'text-red-400' : parseInt(winRate as string) >= 50 ? 'text-green-400' : 'text-gray-400'}">${winRate}% WR <span class="text-gray-500">(${stat.games} G)</span></div>
              <div class="text-sm text-gray-100 mt-1">${kda === Infinity ? 'Infinite' : kda.toFixed(2)} KDA</div>
              <div class="text-xs text-gray-500">${avgKda}</div>
              ${stat.soloKills > 0 ? `<div class="text-xs text-yellow-400 mt-1">Solo Kills: ${stat.soloKills}</div>` : ''}
            </div>
          `;

          return (
            <img 
              key={stat.championName}
              src={`${CDN_URL}/img/champion/${getCorrectChampionName(stat.championName)}.png`} 
              alt={stat.championName} 
              className="w-10 h-10 rounded-md"
              data-tooltip-id="item-tooltip"
              data-tooltip-html={tooltipContent}
            />
          );
        })}
      </div>
    </div>
  );
};

export default RecentChampionStats;