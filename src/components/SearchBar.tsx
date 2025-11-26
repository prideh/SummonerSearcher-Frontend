import React from 'react';
import type { RecentSearch } from '../api/user';
import { Search } from 'lucide-react';
import { toApiRegion, toUrlRegion } from '../utils/regionUtils';

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
  // Filter recent searches by the currently selected region (API format)
  // Ensure we are comparing API regions (e.g. EUW1)
  const apiRegion = toApiRegion(toUrlRegion(region)); 
  const filteredRecentSearches = recentSearches.filter(search => search.server === apiRegion && search.query.toLowerCase().includes(searchInput.toLowerCase()));

  const inputRef = React.useRef<HTMLInputElement>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      {/* Main Glass Container */}
      <div 
        className="flex flex-col sm:flex-row items-stretch bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50"
      >
        
        {/* Input Section */}
        <div 
          className="relative flex-grow"
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
              // Delay hiding to allow clicks on dropdown items to register if needed,
              // though onMouseDown prevention usually handles this.
              // We check if we are still hovering to avoid flickering if moving between items?
              // Actually, if we blur, we usually want to hide, UNLESS we clicked the dropdown.
              // The onMouseDown preventDefault on the dropdown handles the click case.
              // So here we just hide.
              setShowRecent(false);
            }}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent border-none p-4 text-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 focus:outline-none rounded-l-2xl"
          />

          {/* Recent Searches Dropdown */}
          {showRecent && filteredRecentSearches.length > 0 && (
            <div 
              className="absolute top-full left-0 w-full min-w-[300px] mt-2 bg-white/90 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in-down"
              onMouseDown={(e) => e.preventDefault()} // Prevent focus loss when clicking dropdown
            >
              <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Recent Searches</span>
                <button 
                  onClick={handleClearRecentSearches} 
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors focus:outline-none"
                >
                  Clear History
                </button>
              </div>
              <ul className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
                {filteredRecentSearches.map((search, index) => (
                  <li
                    key={index}
                    className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors flex items-center justify-between group"
                    onClick={() => {
                      setSearchInput(search.query);
                      const [name, tag] = search.query.split('#');
                      startSearch(name, tag, apiRegion);
                      setShowRecent(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="font-medium">{search.query}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 uppercase">{search.server}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px sm:h-auto sm:w-px bg-gray-200 dark:bg-white/10" />

        {/* Region Selector */}
        <div className="relative min-w-[100px]">
          <select 
            value={region} 
            onChange={(e) => setRegion(e.target.value)} 
            aria-label="Select Region" 
            className="w-full h-full appearance-none bg-transparent border-none py-4 pl-6 pr-10 text-gray-700 dark:text-gray-300 font-medium focus:ring-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-center sm:text-left"
          >
            <option value="EUW1" className="bg-white dark:bg-gray-800">EUW</option>
            <option value="NA1" className="bg-white dark:bg-gray-800">NA</option>
            <option value="KR" className="bg-white dark:bg-gray-800">KR</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        {/* Search Button */}
        <button 
          onClick={handleSearchClick} 
          disabled={loading} 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-8 sm:rounded-r-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <span>Search</span>
              <Search className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
