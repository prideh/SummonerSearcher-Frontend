import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { getSummonerByName, getMatchesBatch } from '../api/riot';
import { useSearchParams } from 'react-router-dom';
import type { SummonerData } from '../types/summoner';
import type { MatchDto } from '../types/match';
import MatchHistory from '../components/MatchHistory';
import axios from 'axios';
import { getRecentSearches, clearRecentSearches, type RecentSearch } from '../api/user';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

import SearchBar from '../components/SearchBar';

import SummonerInfo from '../components/SummonerInfo';
import PlayerProfile from '../components/PlayerProfile';
import { toApiRegion, toUrlRegion } from '../utils/regionUtils';

/**
 * The main page for searching for summoners and viewing their profile and match history.
 */
const SearchPage: React.FC = () => {
  const [summonerData, setSummonerData] = useState<SummonerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [showLongSearchMessage, setShowLongSearchMessage] = useState(false);
  
  // Pagination State
  const [matches, setMatches] = useState<MatchDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Zustand store for managing global state like search input, region, and last search results.
  const searchInput = useAuthStore((state) => state.searchInput);
  const setSearchInput = useAuthStore((state) => state.setSearchInput);
  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const lastSearchedSummoner = useAuthStore((state) => state.lastSearchedSummoner);
  const setLastSearchedSummoner = useAuthStore((state) => state.setLastSearchedSummoner);

  const addRecentSearch = useAuthStore((state) => state.addRecentSearch);

  /**
   * Fetches the list of recent searches for the logged-in user.
   */
  const fetchRecentSearches = useCallback(async (signal?: AbortSignal) => {
    try {
      const searches: RecentSearch[] = await getRecentSearches(signal);
      if (Array.isArray(searches)) {
        setRecentSearches(searches);
      }
    } catch (err) {
      if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
        return;
      }
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
  const performSearch = useCallback(async (name: string, tag: string, searchRegion: string, isRefresh = false, signal?: AbortSignal) => {
    let longSearchTimeout: ReturnType<typeof setTimeout>;
    
    // Check if logged in to decide how to save recent search
    const loggedIn = useAuthStore.getState().isLoggedIn;

    try {
      setShowLongSearchMessage(false);
      // Set a timeout to show the long search message if the request takes longer than 5 seconds
      longSearchTimeout = setTimeout(() => {
        setShowLongSearchMessage(true);
      }, 5000);

      const apiData: Omit<SummonerData, 'region' | 'lastUpdated'> = await getSummonerByName(searchRegion, name, tag, signal);
      const updatedTimestamp = new Date().toISOString();
      const fullData: SummonerData = { ...apiData, region: searchRegion, lastUpdated: updatedTimestamp };
      setSummonerData(fullData);
      setShowFullProfile(false); // Close profile on new search
      
      // Initialize matches and pagination
      setMatches(fullData.recentMatches);
      setPage(1);
      setHasMore(fullData.recentMatches.length >= 20); // Assuming page size is 20
      
      setLastSearchedSummoner(fullData);
      
      // Handle recent searches update
      if (loggedIn) {
          // Re-fetch recent searches from backend to include the new one.
          fetchRecentSearches();
      } else {
          // Update local store
          addRecentSearch({ query: `${name}#${tag}`, server: searchRegion });
          // Force a re-render of recent searches by updating the state directly
          setRecentSearches(useAuthStore.getState().recentSearches);
      }

    } catch (err) {
      // Ignore aborted requests
      if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === 'ERR_CANCELED') || (err instanceof Error && (err.name === 'CanceledError' || err.message === 'canceled'))) {
        return;
      }

      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setLastSearchedSummoner('NOT_FOUND');
        setError('NOT_FOUND');
      } else if (axios.isAxiosError(err)) {
        if (err.response?.status === 504) {
          setError('The Riot API is taking too long to respond. Please try again later.');
        } else if (err.response?.data && typeof err.response.data === 'string') {
             setError(err.response.data);
        } else {
            setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      clearTimeout(longSearchTimeout!); // Clear the timeout when the request completes or fails
      setShowLongSearchMessage(false); // Hide the message

      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
        // Clear the search input after search completes (but not on refresh)
        if (!isRefresh) {
          setSearchInput('');
        }
      }
    }
  }, [fetchRecentSearches, setLastSearchedSummoner, setSearchInput]);

  /**
   * Loads the next page of matches.
   */
  const loadMoreMatches = async () => {
    if (!summonerData || loadingMore) return;
    
    // Safety check: ensure we have match IDs
    if (!summonerData.matchIds || summonerData.matchIds.length === 0) {
        setHasMore(false);
        return;
    }

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const pageSize = 20; 
      // Calculate index range for next batch
      // Page 1: 0-20 (already loaded). Page 2: 20-40.
      const startIndex = (nextPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      // Get IDs for this batch
      const batchIds = summonerData.matchIds.slice(startIndex, endIndex);
      
      if (batchIds.length === 0) {
          setHasMore(false);
          setLoadingMore(false);
          return;
      }

      const newMatches = await getMatchesBatch(summonerData.region, batchIds);
      
      if (newMatches.length > 0) {
        setMatches(prev => [...prev, ...newMatches]);
        setPage(nextPage);
        // Check if there are still more IDs left
        setHasMore((summonerData.matchIds.length || 0) > matches.length + newMatches.length);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load more matches", err);
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Initiates a search, setting loading states and resetting previous results.
   * @param name - The summoner's game name.
   * @param tag - The summoner's tag line.
   * @param searchRegion - The region to search in.
   */
  const startSearch = useCallback((name: string, tag: string, searchRegion: string) => {
    if (!name || !tag) {
      setError('Please enter both a summoner name and a tagline.');
      return;
    }
    // Update the URL with the search parameters.
    // The useEffect hook will detect this change and trigger the actual search.
    setSearchParams({ gameName: name, tagLine: tag, region: toUrlRegion(searchRegion) });
  }, [setSearchParams]);

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

  /**
   * Effect to handle search based on URL parameters.
   * This acts as the source of truth for the current search state.
   */
  useEffect(() => {
    const gameNameFromUrl = searchParams.get('gameName');
    const tagLineFromUrl = searchParams.get('tagLine');
    const regionFromUrl = searchParams.get('region');

    if (gameNameFromUrl && tagLineFromUrl && regionFromUrl) {
      const apiRegion = toApiRegion(regionFromUrl);
      
      // Sync region from URL to store if different
      if (apiRegion !== region) {
        setRegion(apiRegion);
      }

      // Avoid re-fetching if the data is already displayed for the current URL params and region
      if (
        summonerData &&
        summonerData.gameName.toLowerCase() === gameNameFromUrl.toLowerCase() &&
        summonerData.tagLine.toLowerCase() === tagLineFromUrl.toLowerCase() &&
        summonerData.region === apiRegion
      ) {
        return;
      }

      setSearchInput(`${gameNameFromUrl}#${tagLineFromUrl}`);
      setLoading(true);
      setError(null);
      // Only clear data if we are actually searching for a different person/region
      if (!summonerData || summonerData.gameName !== gameNameFromUrl || summonerData.tagLine !== tagLineFromUrl || summonerData.region !== apiRegion) {
          setSummonerData(null);
          setMatches([]);
      }

      const controller = new AbortController();
      performSearch(gameNameFromUrl, tagLineFromUrl, apiRegion, false, controller.signal);

      return () => {
        controller.abort();
      };
    }
    // If no search from URL, load the last searched summoner from the store
    else if (lastSearchedSummoner && !gameNameFromUrl && !tagLineFromUrl) {
      if (lastSearchedSummoner === 'NOT_FOUND') {
        setError('NOT_FOUND');
      } else {
        setSummonerData(lastSearchedSummoner);
        if (typeof lastSearchedSummoner !== 'string') {
            setMatches(lastSearchedSummoner.recentMatches);
            setPage(1);
            setHasMore(lastSearchedSummoner.recentMatches.length >= 20);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, performSearch, lastSearchedSummoner, setSearchInput, summonerData, setRegion]);
  
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const localRecentSearches = useAuthStore((state) => state.recentSearches);

  /**
   * Effect to fetch the user's recent searches on component mount.
   */
  useEffect(() => {
    // If we are performing a search (URL params present), skip the initial fetch/sync.
    // The search operation itself will update the recent searches list.
    const gameName = searchParams.get('gameName');
    const tagLine = searchParams.get('tagLine');
    
    if (gameName && tagLine) {
      return;
    }

    if (!isLoggedIn) {
        setRecentSearches(localRecentSearches);
        return;
    }

    const controller = new AbortController();
    fetchRecentSearches(controller.signal);
    return () => controller.abort();
    // We only want this to run on mount or login change, not on localRecentSearches change if we are searching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRecentSearches, searchParams, isLoggedIn]);

  // Keep local recent searches in sync even if params change, but ONLY if not logged in
  useEffect(() => {
      if (!isLoggedIn) {
          setRecentSearches(localRecentSearches);
      }
  }, [localRecentSearches, isLoggedIn]);

  const clearLocalRecentSearches = useAuthStore((state) => state.clearRecentSearches);

  /**
   * Handles the action to clear the user's recent search history.
   */
  const handleClearRecentSearches = async () => {
    try {
      setError(null); // Clear previous errors
      
      if (isLoggedIn) {
          await clearRecentSearches();
      } else {
          clearLocalRecentSearches();
      }
      
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
          style={{ backgroundColor: 'rgb(17 24 39 / var(--tw-bg-opacity, 1))', borderRadius: '6px', padding: '8px 12px', zIndex: 50 }}
          border="1px solid rgb(31 41 55)"
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
          {loading && showLongSearchMessage && (
            <div className="text-center mt-4 text-cyan-600 dark:text-cyan-400 animate-pulse font-medium">
              Fetching full seasonal history... this might take a moment.
            </div>
          )}
          {summonerData && (
            <>
              {showFullProfile && (
                  <PlayerProfile 
                      summonerData={summonerData} 
                      onClose={() => setShowFullProfile(false)} 
                  />
              )}

              <SummonerInfo
                summonerData={summonerData}
                handleRefresh={handleRefresh}
                loading={loading}
                refreshing={refreshing}
                visibleMatches={matches}
                onPlayerClick={handlePlayerClick}
                onViewProfile={() => setShowFullProfile(true)}
              />
            </>
          )}
          {summonerData && (
            <MatchHistory 
              puuid={summonerData.puuid} 
              matches={matches} 
              onPlayerClick={handlePlayerClick}
              onLoadMore={loadMoreMatches}
              hasMore={hasMore}
              loadingMore={loadingMore}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
