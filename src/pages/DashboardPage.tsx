import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../api/riot';
import axios from 'axios';

/**
 * Defines the structure of a single entry in the Challenger leaderboard.
 */
interface LeaderboardEntry {
  gameName: string;
  tagLine: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  rank: string;
}

/**
 * The DashboardPage displays the Challenger leaderboard for a selected region.
 * It features a "Midnight Purple" aesthetic with glassmorphism and responsive design.
 * Optimized with progressive loading for better performance.
 */
const DashboardPage = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Performance optimization: Progressive loading
  const [visibleCount, setVisibleCount] = useState(25);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);

  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const navigate = useNavigate();

  /**
   * Effect to fetch the leaderboard data whenever the selected region changes.
   */
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      setVisibleCount(50); // Reset visible count on new fetch
      try {
        const response = await getLeaderboard(region);
        const leaderboardData = response.entries;
        if (!Array.isArray(leaderboardData)) {
          throw new TypeError('Invalid leaderboard data format.');
        }
        leaderboardData.sort((a, b) => b.leaguePoints - a.leaguePoints);
        setLeaderboard(leaderboardData);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError('Failed to fetch leaderboard data.');
        } else if (err instanceof TypeError) {
          setError('Failed to process leaderboard data.');
        } else if (err instanceof Error) {
          setError('An unexpected error occurred.');
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [region]);

  /**
   * Handles infinite scroll behavior
   */
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Load more when user is near the bottom (within 200px)
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setVisibleCount(prev => Math.min(prev + 50, leaderboard.length));
    }
  }, [leaderboard.length]);

  /**
   * Handles clicks on a leaderboard row/card, navigating to the search page for that player.
   */
  const handleRowClick = useCallback((gameName: string, tagLine: string) => {
    if (gameName && tagLine) {
      navigate(`/search?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
    }
  }, [navigate]);

  /**
   * Helper to determine rank color styling
   */
  const getRankStyle = (index: number) => {
    switch (index) {
      case 0: return "text-yellow-500 dark:text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)] dark:drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"; // Gold
      case 1: return "text-slate-500 dark:text-slate-300 drop-shadow-[0_0_8px_rgba(148,163,184,0.5)] dark:drop-shadow-[0_0_8px_rgba(203,213,225,0.5)]"; // Silver
      case 2: return "text-amber-700 dark:text-amber-600 drop-shadow-[0_0_8px_rgba(180,83,9,0.5)] dark:drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]"; // Bronze
      default: return "text-slate-600 dark:text-slate-400";
    }
  };

  /**
   * Renders the leaderboard content
   */
  const renderLeaderboard = () => {
    if (loading) {
      return (
        <div className="w-full max-w-5xl mt-4 space-y-4 flex-1 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 w-full bg-blue-50 dark:bg-blue-950/30 rounded-xl animate-pulse" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-12 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 rounded-xl backdrop-blur-sm">
          <p className="text-red-600 dark:text-red-400 text-center font-medium">{error}</p>
        </div>
      );
    }

    const visibleLeaderboard = leaderboard.slice(0, visibleCount);

    return (
      <div className="w-full max-w-5xl mt-4 flex-1 min-h-0 flex flex-col">
        {/* Mobile View: Scrollable Cards */}
        <div 
          ref={mobileScrollContainerRef}
          onScroll={handleScroll}
          className="md:hidden space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-blue-900/50 scrollbar-track-transparent flex-1"
        >
          {visibleLeaderboard.map((player, index) => {
            const totalGames = player.wins + player.losses;
            const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(1) : '0.0';
            
            return (
              <div
                key={`${player.gameName}-${player.tagLine}-${index}`}
                onClick={() => handleRowClick(player.gameName, player.tagLine)}
                className="relative overflow-hidden bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-blue-900/30 rounded-xl p-4 active:scale-98 transition-transform cursor-pointer shadow-sm dark:shadow-md"
              >
                {/* Simplified rank strip for top 3 */}
                {index < 3 && (
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    index === 0 ? 'bg-yellow-400 dark:bg-yellow-500' : 
                    index === 1 ? 'bg-slate-300 dark:bg-slate-400' : 
                    'bg-amber-600 dark:bg-amber-700'
                  }`} />
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className={`text-2xl font-bold w-8 text-center ${getRankStyle(index)}`}>
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-gray-900 dark:text-gray-100 font-bold text-lg truncate max-w-[150px]">
                        {player.gameName}
                        <span className="text-blue-600 dark:text-blue-400/80 font-normal text-sm ml-1">#{player.tagLine}</span>
                      </h3>
                      <p className="text-blue-700 dark:text-cyan-500 font-medium text-sm">{player.leaguePoints} LP</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-500 dark:text-slate-500 mb-1">Win Rate</div>
                    <div className="font-bold text-gray-800 dark:text-gray-200">{winRate}%</div>
                    <div className="text-xs text-gray-500 dark:text-slate-500">{player.wins}W / {player.losses}L</div>
                  </div>
                </div>
              </div>
            );
          })}
          {visibleCount < leaderboard.length && (
            <div className="py-4 text-center text-gray-500 dark:text-slate-500 text-sm animate-pulse">
              Loading more...
            </div>
          )}
        </div>

        {/* Desktop View: Scrollable Table */}
        <div className="hidden md:flex flex-col flex-1 overflow-hidden rounded-2xl border border-gray-200 dark:border-blue-900/30 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl shadow-xl dark:shadow-black/50">
          <div className="overflow-x-auto flex-shrink-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-blue-50/50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300/80 text-xs uppercase tracking-wider font-medium sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 text-center w-20">Rank</th>
                  <th className="px-6 py-4">Summoner</th>
                  <th className="px-6 py-4 text-right">LP</th>
                  <th className="px-6 py-4 text-center">Win Rate</th>
                  <th className="px-6 py-4 text-right">Games</th>
                </tr>
              </thead>
            </table>
          </div>
          
          {/* Scrollable Body */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-blue-900/50 scrollbar-track-transparent"
          >
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-gray-200 dark:divide-blue-900/20">
                {visibleLeaderboard.map((player, index) => {
                  const totalGames = player.wins + player.losses;
                  const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(1) : '0.0';
                  
                  return (
                    <tr 
                      key={`${player.gameName}-${player.tagLine}-${index}`}
                      onClick={() => handleRowClick(player.gameName, player.tagLine)}
                      className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 text-center w-20">
                        <span className={`font-bold text-lg ${getRankStyle(index)}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="text-gray-900 dark:text-gray-200 font-semibold text-base group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                            {player.gameName}
                          </span>
                          <span className="text-gray-500 dark:text-slate-500 ml-1">#{player.tagLine}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-blue-700 dark:text-cyan-500">
                        {player.leaguePoints.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`font-bold ${Number(winRate) >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {winRate}%
                          </span>
                          {/* Mini progress bar */}
                          <div className="w-16 h-1 bg-gray-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${Number(winRate) >= 50 ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} 
                              style={{ width: `${winRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 dark:text-slate-500">
                        <span className="text-emerald-600 dark:text-emerald-400/80">{player.wins}W</span>
                        <span className="mx-1">-</span>
                        <span className="text-red-500 dark:text-red-400/80">{player.losses}L</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleCount < leaderboard.length && (
              <div className="py-4 text-center text-gray-500 dark:text-slate-500 text-sm animate-pulse">
                Loading more...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    // Main container - Fixed height to prevent body scrollbar
    <div className="flex-1 h-full overflow-hidden w-full text-gray-800 dark:text-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col items-center h-full">
        
        {/* Header Section - Toned down & Reduced spacing */}
        <div className="text-center mb-2 space-y-1 flex-shrink-0">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Challenger Leaderboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
            Top performing summoners in your region
          </p>
        </div>

        {/* Region Selector - Separated & Reduced spacing */}
        <div className="flex items-center justify-center space-x-3 mb-2 flex-shrink-0">
          <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">
            Region:
          </span>
          <div className="relative">
            <select 
              id="region-select" 
              value={region} 
              onChange={(e) => setRegion(e.target.value)} 
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-semibold py-2 pl-4 pr-10 rounded-lg shadow-sm hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
              style={{ backgroundImage: 'none' }}
            >
              <option value="EUW1" className="bg-white dark:bg-gray-800">EUW</option>
              <option value="NA1" className="bg-white dark:bg-gray-800">NA</option>
              <option value="KR" className="bg-white dark:bg-gray-800">KR</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>

        {renderLeaderboard()}
      </div>
    </div>
  );
};

export default DashboardPage;