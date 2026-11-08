import React, { useState, useEffect } from 'react';
import type { RecentSearch } from '../api/user';
import { Search } from 'lucide-react';
import { fetchAutocompleteSuggestions, type AutocompletePlayerDto } from '../api/search';

/**
 * Props for the SearchBar component.
 */
interface SearchBarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  region: string;
  setRegion: (value: string) => void;
  handleSearchClick: () => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  loading: boolean;
  recentSearches: RecentSearch[];
  showRecent: boolean;
  setShowRecent: (value: boolean) => void;
  handleClearRecentSearches: () => void;
  startSearch: (name: string, tag: string, region: string) => void;
}

/**
 * A comprehensive search bar component that includes the main text input for the Riot ID,
 * a region selector dropdown, and a search button. It features a modern glassmorphic design
 * with a "Midnight Purple" aesthetic.
 */
const SearchBar: React.FC<SearchBarProps> = ({
  searchInput,
  setSearchInput,
  region,
  setRegion,
  handleSearchClick,
  handleKeyDown,
  loading,
  recentSearches,
  showRecent,
  setShowRecent,
  handleClearRecentSearches,
  startSearch,
}) => {
  // Filter recent searches across all regions by the current search input
  const filteredRecentSearches = recentSearches.filter(search =>
    search.query.toLowerCase().includes(searchInput.toLowerCase())
  );

  const [suggestions, setSuggestions] = useState<AutocompletePlayerDto[]>([]);
  const [isSearchingAutocomplete, setIsSearchingAutocomplete] = useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce autocomplete search
  useEffect(() => {
    if (searchInput.length < 2) {
      setSuggestions([]);
      setIsSearchingAutocomplete(false);
      return;
    }

    setIsSearchingAutocomplete(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const results = await fetchAutocompleteSuggestions(searchInput);
        
        // Ensure we don't overwrite current results if user typed more while fetching
        if (inputRef.current?.value === searchInput) {
           setSuggestions(results);
        }
      } catch (error) {
        console.error('Error fetching autocomplete:', error);
        setSuggestions([]);
      } finally {
        setIsSearchingAutocomplete(false);
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowRecent(true);
  };

  const handleMouseLeave = () => {
    // Only hide if the input is not currently focused
    if (document.activeElement !== inputRef.current) {
      timeoutRef.current = setTimeout(() => {
        setShowRecent(false);
      }, 200); // 200ms delay to bridge the gap
    }
  };

  return (
    <div className="w-full max-w-2xl relative z-20">
      {/* Crisp Esports Telemetry Search Container */}
      <div 
        className="flex flex-col sm:flex-row items-stretch bg-white dark:bg-[#111827] border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs transition-all duration-200 focus-within:ring-2 focus-within:ring-sky-500/40 dark:focus-within:ring-cyan-400/40 focus-within:border-sky-500 dark:focus-within:border-cyan-400"
      >
        
        {/* Input Section */}
        <div 
          className="relative flex-grow flex items-center"
          onMouseEnter={handleMouseEnter} 
          onMouseLeave={handleMouseLeave}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="SummonerName#TagLine"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowRecent(true);
            }}
            onFocus={() => setShowRecent(true)}
            onBlur={() => {
              setShowRecent(false);
            }}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent border-none pl-4 pr-16 py-3.5 text-base font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:outline-none rounded-l-lg"
          />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            title="Open Command Palette (⌘K)"
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 mr-3 rounded bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-400 dark:text-slate-400 hover:text-sky-600 dark:hover:text-cyan-400 transition-colors telemetry-nums shrink-0"
          >
            ⌘K
          </button>

          {/* Dropdown Container */}
          {showRecent && (suggestions.length > 0 || searchInput.length >= 2 || filteredRecentSearches.length > 0) && (
            <div 
              className="absolute top-full left-0 w-full min-w-[300px] mt-1.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in-down"
              onMouseDown={(e) => e.preventDefault()} // Prevent focus loss when clicking dropdown
            >
              
              {/* Recent Searches Section - Always shows when there are matching local searches */}
              {filteredRecentSearches.length > 0 && (
                <>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Recent Searches</span>
                    <button 
                      onClick={handleClearRecentSearches} 
                      className="text-xs font-semibold text-sky-600 dark:text-cyan-400 hover:text-sky-500 dark:hover:text-cyan-300 transition-colors focus:outline-none"
                    >
                      Clear History
                    </button>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredRecentSearches.map((search, index) => (
                      <li
                        key={`recent-${index}`}
                        className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-sky-50/80 dark:hover:bg-slate-800/70 cursor-pointer transition-colors flex items-center justify-between group"
                        onClick={() => {
                          setSearchInput(search.query);
                          const [name, tag] = search.query.split('#');
                          setRegion(search.server);
                          startSearch(name, tag, search.server);
                          setShowRecent(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:border-sky-300 dark:group-hover:border-cyan-500/40 group-hover:text-sky-600 dark:group-hover:text-cyan-400 transition-colors">
                            <Search className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold">{search.query}</span>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded uppercase tracking-wider telemetry-nums">
                          {search.server.replace(/[0-9]/g, '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Autocomplete Section - Shows below if user is typing at least 2 characters */}
              {searchInput.length >= 2 && (
                <>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Players</span>
                    {isSearchingAutocomplete && <span className="text-xs text-sky-600 dark:text-cyan-400 font-semibold animate-pulse">Searching...</span>}
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {suggestions.length === 0 && !isSearchingAutocomplete ? (
                      <li className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                        No players found. Press enter to search Riot directly.
                      </li>
                    ) : (
                      suggestions.map((player) => (
                        <li
                          key={`auto-${player.puuid}`}
                          className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-sky-50/80 dark:hover:bg-slate-800/70 cursor-pointer transition-colors flex items-center justify-between group"
                          onClick={() => {
                            setSearchInput(`${player.gameName}#${player.tagLine}`);
                            setRegion(player.region);
                            startSearch(player.gameName, player.tagLine, player.region);
                            setShowRecent(false);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${player.profileIconId}.jpg`}
                              alt="Profile"
                              className="w-9 h-9 rounded-md border border-slate-200 dark:border-slate-700 object-cover"
                              onError={(e) => {
                                // Fallback icon if communitydragon fails
                                (e.target as HTMLImageElement).src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg';
                              }}
                            />
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-cyan-400 transition-colors">
                                {player.gameName}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 telemetry-nums">
                                #{player.tagLine} • Lvl {player.summonerLevel}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-sky-600 dark:bg-cyan-600 rounded uppercase tracking-wider hidden sm:block">
                            {player.region.replace(/[0-9]/g, '')}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px sm:h-auto sm:w-px bg-slate-200 dark:bg-slate-700" />

        {/* Region Selector */}
        <div className="relative min-w-[96px]">
          <select 
            value={region} 
            onChange={(e) => setRegion(e.target.value)} 
            aria-label="Select Region" 
            className="w-full h-full appearance-none bg-slate-50/70 dark:bg-slate-800/50 border-none py-3.5 pl-4 pr-9 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center sm:text-left"
          >
            <option value="EUW1" className="bg-white dark:bg-slate-900">EUW</option>
            <option value="NA1" className="bg-white dark:bg-slate-900">NA</option>
            <option value="KR" className="bg-white dark:bg-slate-900">KR</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-slate-400">
            <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        {/* Search Button */}
        <button 
          onClick={handleSearchClick} 
          disabled={loading} 
          className="bg-sky-600 hover:bg-sky-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-extrabold text-sm uppercase tracking-wider py-3.5 px-6 sm:rounded-r-[7px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 group"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <span>Search</span>
              <Search className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
