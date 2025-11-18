import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { getSummonerByName } from '../api/riot';
import { useSearchParams } from 'react-router-dom';
import type { SummonerData, LeagueEntryDto } from '../types/summoner';
import MatchHistory from '../components/MatchHistory';
import { getRecentSearches, clearRecentSearches } from '../api/user';
import RecentChampionStats from '../components/RecentChampionStats';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

import axios from 'axios';

const SearchPage = () => {
  const [searchInput, setSearchInput] = useState('');
  const [summonerData, setSummonerData] = useState<SummonerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const lastSearchedSummoner = useAuthStore((state) => state.lastSearchedSummoner);
  const setLastSearchedSummoner = useAuthStore((state) => state.setLastSearchedSummoner);

  const fetchRecentSearches = useCallback(async () => {
    try {
      const searches: string[] = await getRecentSearches();
      if (Array.isArray(searches)) {
        setRecentSearches(searches);
      }
    } catch (err) {
      console.error('Failed to fetch recent searches:', err);
    }
  }, []);

  const performSearch = useCallback(async (name: string, tag: string) => {
    if (!name || !tag) {
      setError('Please enter both a summoner name and a tagline.');
      return;
    }
    setLoading(true);
    setError(null);
    setSummonerData(null);

    try {
      const data: SummonerData = await getSummonerByName(region, name, tag);
      setSummonerData(data);
      setLastSearchedSummoner(data);
      // Re-fetch recent searches after a successful search
      fetchRecentSearches();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          setError('NOT_FOUND'); // Use a special key for "not found" errors
        } else {
          setError(err.response?.data.message || 'An error occurred while searching.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [region, fetchRecentSearches, setLastSearchedSummoner]);

  const handleSearchClick = () => {
    const parts = searchInput.split('#');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      setError('Please use the format "SummonerName#TagLine". Both parts are required.');
      return;
    }
    const [name, tag] = parts.map(p => p.trim());
    performSearch(name, tag);
  };

  const handlePlayerClick = (name: string, tag: string) => {
    const combined = `${name}#${tag}`;
    setSearchInput(combined);
    performSearch(name, tag);
    window.scrollTo(0, 0); // Scroll to top for the new search
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearchClick();
    }
  };

  const initialSearchPerformed = useRef(false);

  // This effect will run only once when the component mounts.
  // It checks for search params from the URL and triggers a search if they exist.
  useEffect(() => {
    if (initialSearchPerformed.current) return;

    const gameNameFromUrl = searchParams.get('gameName');
    const tagLineFromUrl = searchParams.get('tagLine');

    if (gameNameFromUrl && tagLineFromUrl) {
      initialSearchPerformed.current = true;
      const combinedInput = `${gameNameFromUrl}#${tagLineFromUrl}`;
      setSearchInput(combinedInput);
      performSearch(gameNameFromUrl, tagLineFromUrl);
    }
    // If no search from URL, load the last searched summoner from the store
    else if (lastSearchedSummoner) {
      setSummonerData(lastSearchedSummoner);
    }
  }, [searchParams, performSearch, lastSearchedSummoner]);

  // This effect will run once when the component mounts to fetch recent searches.
  useEffect(() => {
    fetchRecentSearches();
  }, [fetchRecentSearches]);

  const handleClearRecentSearches = async () => {
    try {
      setError(null); // Clear previous errors
      await clearRecentSearches();
      setRecentSearches([]); // Clear from state
      setShowRecent(false); // Hide dropdown
    } catch (err) {
      console.error('Failed to clear recent searches:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data.message || 'Failed to clear recent searches.');
      } else {
        setError('An unexpected error occurred while clearing recent searches.');
      }
    }
  };
  const renderRankedInfo = (rankedData: LeagueEntryDto) => {
    const winRate = rankedData.wins + rankedData.losses > 0 
      ? ((rankedData.wins / (rankedData.wins + rankedData.losses)) * 100).toFixed(1) 
      : 'N/A';

    return (
      <div className="bg-gray-900/50 p-4 rounded-lg mt-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-blue-300">Ranked Solo/Duo</h3>
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
              <p className="text-gray-300">{rankedData.leaguePoints} LP</p>
              <p className="text-sm text-gray-400 mt-1">{rankedData.wins}W / {rankedData.losses}L ({winRate}%)</p>
            </div>
          </div>
          {summonerData && <RecentChampionStats matches={summonerData.recentMatches} puuid={summonerData.puuid} />}
        </div>
      </div>
    );
  }

  const renderSkeleton = () => (
    <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-lg shadow-lg animate-pulse">
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 rounded-full bg-gray-700"></div>
        <div>
          <div className="h-7 bg-gray-700 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-24"></div>
        </div>
      </div>
      <div className="bg-gray-900/50 p-4 rounded-lg mt-4 border border-gray-700">
        <div className="h-5 bg-gray-600 rounded w-32 mb-4"></div>
        <div className="flex items-center space-x-4 mt-2">
          <div className="w-20 h-20 bg-gray-600 rounded"></div>
          <div>
            <div className="h-6 bg-gray-600 rounded w-36 mb-2"></div>
            <div className="h-4 bg-gray-600 rounded w-20"></div>
          </div>
          <div className="text-sm space-y-2">
            <div className="h-4 bg-gray-600 rounded w-20"></div>
            <div className="h-4 bg-gray-600 rounded w-20"></div>
            <div className="h-4 bg-gray-600 rounded w-24"></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderError = () => {
    if (!error) return null;

    if (error === 'NOT_FOUND') {
      return (
        <div className="bg-yellow-900/20 border border-yellow-700/30 text-yellow-200 p-6 rounded-lg text-center" role="alert">
          <h3 className="font-bold text-xl mb-2">Summoner Not Found</h3>
          <p className="text-yellow-300">Please double-check the Summoner Name, Tagline, and selected Region, then try again.</p>
        </div>
      );
    }

    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-lg flex items-center space-x-3" role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
      <Tooltip 
        id="item-tooltip" 
        place="top"
        style={{ backgroundColor: 'rgb(31 41 55)', borderRadius: '6px', padding: '8px 12px', border: '1px solid #4B5563', zIndex: 50 }}
        noArrow
        offset={10}
        opacity={1}
      />
      <h1 className="text-4xl font-bold mb-8 text-center text-gray-100 tracking-wider">Summoner Search</h1>
      <div className="flex items-start space-x-2">
        <div className="relative" onMouseEnter={() => setShowRecent(true)} onMouseLeave={() => setShowRecent(false)}>
          <input
            type="text" 
            placeholder="SummonerName#TagLine"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="p-3 border border-gray-700 rounded-l-md bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80 transition-all"
          />
          {showRecent && recentSearches.length > 0 && ( // Removed mt-1, added top-full
            <div className="absolute z-10 w-72 top-full bg-gray-700 border border-gray-600 rounded-md shadow-lg">
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-xs text-gray-400 font-semibold uppercase">Recent Searches</span>
                <button onClick={handleClearRecentSearches} className="text-xs text-blue-400 hover:text-blue-300 hover:underline focus:outline-none">
                  Clear
                </button>
              </div>
              <ul className="py-1 max-h-60 overflow-y-auto">
                {recentSearches.map((search, index) => (
                  <li 
                    key={index} 
                    className="px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 cursor-pointer"
                    onClick={() => {
                      setSearchInput(search);
                      const [name, tag] = search.split('#');
                      performSearch(name, tag);
                      setShowRecent(false);
                    }}
                  >{search}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="p-3 border-y border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
          <option value="EUW1">EUW</option>
          <option value="NA1">NA</option>
          <option value="KR">KR</option>
        </select>
        <button onClick={handleSearchClick} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-r-md disabled:bg-blue-400/50 disabled:cursor-not-allowed transition-colors">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="mt-8 w-full max-w-7xl">
        {renderError()}
        {loading && renderSkeleton()}
        {summonerData && (
          <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-lg shadow-lg">
            <div className="flex items-center space-x-4">
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/15.21.1/img/profileicon/${summonerData.profileIconId}.png`}
                alt="Profile Icon"
                className="w-20 h-20 rounded-full border-2 border-blue-400"
              />
              <div>
                <h2 className="text-2xl font-bold">{summonerData.gameName} <span className="text-gray-500">#{summonerData.tagLine}</span></h2>
                <p className="text-gray-400">Level {summonerData.summonerLevel}</p>
              </div>
            </div>
            {summonerData.soloQueueRank ? (
              renderRankedInfo(summonerData.soloQueueRank)
            ) : (
              <p className="text-center text-gray-400 mt-4">No ranked data available for this summoner.</p>
            )}
          </div>
        )}
        {summonerData && (
          <MatchHistory puuid={summonerData.puuid} matches={summonerData.recentMatches} onPlayerClick={handlePlayerClick} />
        )}
      </div>
    </div>
  );
};

export default SearchPage;
