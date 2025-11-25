import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { getSummonerByName } from '../api/riot';
import { useSearchParams } from 'react-router-dom';
import type { SummonerData } from '../types/summoner';
import MatchHistory from '../components/MatchHistory';
import { getRecentSearches, clearRecentSearches, type RecentSearch } from '../api/user';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

import SearchBar from '../components/SearchBar';

import SummonerInfo from '../components/SummonerInfo';

/**
 * The main page for searching for summoners and viewing their profile and match history.
 */
const SearchPage: React.FC = () => {
  const [summonerData, setSummonerData] = useState<SummonerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // Zustand store for managing global state like search input, region, and last search results.
  const searchInput = useAuthStore((state) => state.searchInput);
  const setSearchInput = useAuthStore((state) => state.setSearchInput);
  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const lastSearchedSummoner = useAuthStore((state) => state.lastSearchedSummoner);
  const setLastSearchedSummoner = useAuthStore((state) => state.setLastSearchedSummoner);

  /**
   * Fetches the list of recent searches for the logged-in user.
   */
  const fetchRecentSearches = useCallback(async () => {
    try {
      const searches: RecentSearch[] = await getRecentSearches();
      if (Array.isArray(searches)) {
        setRecentSearches(searches);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch recent searches:', err);
      }
    }
  }, []);

  /**
   * Core function to perform a summoner search via the API.
   * @param name - The summoner's game name.
   * @param tag - The summoner's tag line.
   * @param searchRegion - The region to search in.
   * @param isRefresh - Whether this is a refresh operation (doesn't clear input)
   */
  const performSearch = useCallback(async (name: string, tag: string, searchRegion: string, isRefresh = false) => {
    try {
      const apiData: Omit<SummonerData, 'region' | 'lastUpdated'> = await getSummonerByName(searchRegion, name, tag);
      const updatedTimestamp = new Date().toISOString();
      const fullData: SummonerData = { ...apiData, region: searchRegion, lastUpdated: updatedTimestamp };
      setSummonerData(fullData);
      setLastSearchedSummoner(fullData);
      // Re-fetch recent searches to include the new one.
      fetchRecentSearches();
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setLastSearchedSummoner('NOT_FOUND');
        setError('NOT_FOUND');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      // Clear the search input after search completes (but not on refresh)
      if (!isRefresh) {
        setSearchInput('');
      }
    }
  }, [fetchRecentSearches, setLastSearchedSummoner, setSearchInput]);

  /**
   * Initiates a search, setting loading states and resetting previous results.
   * @param name - The summoner's game name.
   * @param tag - The summoner's tag line.
   * @param searchRegion - The region to search in.
   */
  const startSearch = useCallback(async (name: string, tag: string, searchRegion: string) => {
    if (!name || !tag) {
      setError('Please enter both a summoner name and a tagline.');
      return;
    }
    setLoading(true);
    setError(null);
    setSummonerData(null);
    await performSearch(name, tag, searchRegion);
  }, [performSearch]);

  /**
   * Handles the click event of the main search button.
   */
  const handleSearchClick = () => {
    const parts = searchInput.split('#');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      setError('Please use the format "SummonerName#TagLine". Both parts are required.');
      return;
    }
    const [name, tag] = parts.map(p => p.trim());
    startSearch(name, tag, region);
  };

  /**
   * Handles the refresh button on the summoner info card, re-fetching their data.
   * Uses refreshing state instead of loading to avoid layout shift.
   */
  const handleRefresh = async () => {
    if (summonerData && !refreshing) {
      setRefreshing(true);
      setError(null);
      // Don't clear summonerData - keep it visible during refresh
      await performSearch(summonerData.gameName, summonerData.tagLine, summonerData.region, true);
    }
  };

  /**
   * Handles clicks on player names within the match history,
   * triggering a new search for that player.
   */
  const handlePlayerClick = (name: string, tag: string) => {
    const combined = `${name}#${tag}`;
    setSearchInput(combined);
    startSearch(name, tag, region); // A click on a player in match history should use the current region
    window.scrollTo(0, 0); // Scroll to top for the new search
  };

  /**
   * Allows users to press 'Enter' in the search input to trigger a search.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearchClick();
    }
  };

  const initialSearchPerformed = useRef(false);

  /**
   * Effect to handle initial page load. It checks for search parameters in the URL
   * (e.g., from a shared link) or loads the last searched summoner from the store.
   */
  useEffect(() => {
    if (initialSearchPerformed.current) return;

    const gameNameFromUrl = searchParams.get('gameName');
    const tagLineFromUrl = searchParams.get('tagLine');

    initialSearchPerformed.current = true;

    if (gameNameFromUrl && tagLineFromUrl) {
      const combinedInput = `${gameNameFromUrl}#${tagLineFromUrl}`;
      setSearchInput(combinedInput);
      startSearch(gameNameFromUrl, tagLineFromUrl, region);
    }
    // If no search from URL, load the last searched summoner from the store
    else if (lastSearchedSummoner) {
      if (lastSearchedSummoner === 'NOT_FOUND') {
        setError('NOT_FOUND');
      } else {
        setSummonerData(lastSearchedSummoner);
      }
    }
  }, [searchParams, lastSearchedSummoner, setSearchInput, region, startSearch]);
  
  /**
   * Effect to fetch the user's recent searches on component mount.
   */
  useEffect(() => {
    fetchRecentSearches();
  }, [fetchRecentSearches]);

  /**
   * Handles the action to clear the user's recent search history.
   */
  const handleClearRecentSearches = async () => {
    try {
      setError(null); // Clear previous errors
      await clearRecentSearches();
      setRecentSearches([]); // Clear from state
      setShowRecent(false); // Hide dropdown
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to clear recent searches:', err);
      }
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while clearing recent searches.');
      }
    }
  };

  /**
   * Renders a skeleton loading state for the summoner info card while data is being fetched.
   */
  const renderSkeleton = () => (
    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow-lg animate-pulse">
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 rounded-full bg-gray-300 dark:bg-gray-700"></div>
        <div>
          <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
        </div>
      </div>
      <div className="bg-transparent dark:bg-transparent p-4 rounded-lg mt-4 border border-gray-200 dark:border-gray-800">
        <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="flex items-center space-x-4 mt-2">
          <div className="w-20 h-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div>
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-36 mb-2"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
          </div>
          <div className="text-sm space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * Renders an appropriate error message based on the error state.
   */
  const renderError = () => {
    if (!error) return null;

    if (error === 'NOT_FOUND') {
      return (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700/30 text-yellow-800 dark:text-yellow-200 p-6 rounded-lg text-center" role="alert">
          <h3 className="font-bold text-xl mb-2">Summoner Not Found</h3>
          <p className="text-yellow-700 dark:text-yellow-300">Please double-check the Summoner Name, Tagline, and selected Region, then try again.</p>
        </div>
      );
    }

    return (
      <div className="bg-red-100 dark:bg-red-500/10 border border-red-400 dark:border-red-500/30 text-red-700 dark:text-red-300 p-4 rounded-lg flex items-center space-x-3" role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  };

  return (
    <div className="flex-1 h-full overflow-y-auto w-full">
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
        <Tooltip 
          id="item-tooltip" 
          place="top"
          style={{ backgroundColor: 'rgb(17 24 39 / var(--tw-bg-opacity, 1))', borderRadius: '6px', padding: '8px 12px', border: '1px solid rgb(31 41 55)', zIndex: 50 }}
          noArrow
          offset={10}
          render={({ content }) => <div dangerouslySetInnerHTML={{ __html: content ?? '' }} />}
          opacity={1}
        />
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-800 dark:text-gray-100 tracking-wider">Summoner Search</h1>
        <SearchBar
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          region={region}
          setRegion={setRegion}
          handleSearchClick={handleSearchClick}
          handleKeyDown={handleKeyDown}
          loading={loading}
          recentSearches={recentSearches}
          showRecent={showRecent}
          setShowRecent={setShowRecent}
          handleClearRecentSearches={handleClearRecentSearches}
          startSearch={startSearch}
        />

        <div className="mt-8 w-full max-w-7xl">
          {renderError()}
          {!loading && !summonerData && !error && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>
                Don't know who to search for? Try an example:
                <button
                  onClick={() => {
                    setRegion('euw1');
                    startSearch('pride', 'persi', 'euw1');
                  }}
                  className="ml-1 font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                >
                  pride#persi on EUW
                </button>
              </p>
            </div>
          )}
          {loading && renderSkeleton()}
          {summonerData && (
            <SummonerInfo
              summonerData={summonerData}
              handleRefresh={handleRefresh}
              loading={loading}
              refreshing={refreshing}
            />
          )}
          {summonerData && (
            <MatchHistory puuid={summonerData.puuid} matches={summonerData.recentMatches} onPlayerClick={handlePlayerClick} />
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
