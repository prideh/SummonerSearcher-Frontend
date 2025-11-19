import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../api/riot';
import axios from 'axios';

interface LeaderboardEntry {
  gameName: string;
  tagLine: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  rank: string;
}

const DashboardPage = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getLeaderboard(region);
        const leaderboardData = response.entries;
        if (!Array.isArray(leaderboardData)) {
          throw new TypeError('Leaderboard data is not an array. Check the backend response.');
        }
        leaderboardData.sort((a, b) => b.leaguePoints - a.leaguePoints);
        setLeaderboard(leaderboardData);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message || 'Failed to fetch leaderboard data.');
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [region]);

  const handleRowClick = useCallback((gameName: string, tagLine: string) => {
    if (gameName && tagLine) {
      navigate(`/search?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
    }
  }, [navigate]);

  const renderLeaderboard = () => {
    if (loading) {
      return (
        <div className="mt-6 w-full max-w-4xl bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="h-144 overflow-y-auto">
            <table className="w-full text-sm text-left text-gray-300 table-fixed">
              <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                <tr>
                  <th scope="col" className="px-4 py-3 text-center w-16">#</th>
                  <th scope="col" className="px-6 py-3 w-1/2">Summoner</th>
                  <th scope="col" className="px-6 py-3 text-right w-32">LP</th>
                  <th scope="col" className="px-6 py-3 text-right w-48">Win / Loss</th>
                </tr>
              </thead>
              <tbody className="animate-pulse">
                {Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-700">
                    <td className="px-4 py-5 text-center"><div className="h-4 bg-gray-700 rounded w-4 mx-auto"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-700 rounded w-3/5"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-700 rounded w-1/2 ml-auto"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-700 rounded w-2/3 ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (error) {
      return <p className="text-red-500 text-center mt-8">{error}</p>;
    }

    return (
      <div className="mt-6 w-full max-w-4xl bg-gray-800 rounded-lg shadow-lg overflow-hidden md:overflow-visible">
        {/* On mobile, the h-144 and overflow-y-auto are removed to allow natural page scroll.
            On desktop (md:), they are re-applied to contain the table in a scrollable view. */}
        <div className="md:h-144 md:overflow-y-auto">
          {/* On mobile (<md), the table loses its table layout to allow for a card-based view.
              The `md:table` and `md:table-fixed` classes restore the default table behavior on larger screens. */}
          <table className="w-full text-sm text-left text-gray-300 border-collapse md:table md:table-fixed">
            {/* The table head is hidden on mobile and shown as a table-header-group on desktop. */}
            <thead className="hidden md:table-header-group text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
              <tr>
                <th scope="col" className="px-4 py-3 text-center w-16">#</th>
                <th scope="col" className="px-6 py-3 w-1/2">Summoner</th>
                <th scope="col" className="px-6 py-3 text-right w-32">LP</th>
                <th scope="col" className="px-6 py-3 text-right w-48">Win / Loss</th>
              </tr>
            </thead>
            {/* On mobile, the tbody becomes a block container for the card-like rows. */}
            <tbody className="block md:table-row-group">
              {leaderboard.map((player, index) => {
                const winRate = player.wins + player.losses > 0 ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1) : 'N/A';
                return (
                  // Each row becomes a block-level card on mobile with spacing, and a table-row on desktop.
                  <tr
                    key={`${player.gameName}-${index}`}
                    className="block p-4 mb-3 bg-gray-800 rounded-lg shadow-lg md:table-row md:p-0 md:mb-0 md:shadow-none md:bg-transparent md:border-b md:border-gray-700 hover:bg-gray-600 cursor-pointer"
                    onClick={() => handleRowClick(player.gameName, player.tagLine)}
                  >
                    {/* Each cell becomes a block with its own label on mobile, and a normal table-cell on desktop. */}
                    {/* The `before:` pseudo-element is used to add labels, which are hidden on desktop. */}
                    <td className="block text-right py-1 md:table-cell md:px-4 md:py-3 md:font-medium md:text-center">
                      <span className="float-left font-bold md:hidden text-gray-400 uppercase">Rank</span>
                      {index + 1}
                    </td>
                    <td className="block text-right py-1 text-lg font-semibold text-white truncate md:table-cell md:px-6 md:py-3 md:text-base">
                      <span className="float-left font-bold md:hidden text-gray-400 uppercase">Summoner</span>
                      <div className="md:inline"><span className="truncate">{player.gameName}</span> <span className="text-gray-400 font-normal">#{player.tagLine}</span></div>
                    </td>
                    <td className="block text-right py-1 font-bold text-blue-300 md:table-cell md:px-6 md:py-3">
                      <span className="float-left font-bold md:hidden text-gray-400 uppercase">LP</span>
                      {player.leaguePoints} LP
                    </td>
                    <td className="block text-right py-1 md:table-cell md:px-6 md:py-3">
                      <span className="float-left font-bold md:hidden text-gray-400 uppercase">Win/Loss</span>
                      <div><span className="text-green-400">{player.wins}W</span> / <span className="text-red-400">{player.losses}L</span> <span className="text-gray-400 ml-2">({winRate}%)</span></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4 text-center">Challenger Leaderboard</h1>
      <div className="flex items-center space-x-4 mb-4">
        <label htmlFor="region-select" className="font-semibold">Region:</label>
        <select id="region-select" value={region} onChange={(e) => setRegion(e.target.value)} className="p-2 border border-gray-700 rounded-md bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="EUW1">EUW</option>
          <option value="NA1">NA</option>
          <option value="KR">KR</option>
        </select>
      </div>
      {renderLeaderboard()}
    </div>
  );
};

export default DashboardPage;