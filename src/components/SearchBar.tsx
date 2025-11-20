import React from 'react';

interface SearchBarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  region: string;
  setRegion: (value: string) => void;
  handleSearchClick: () => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  loading: boolean;
  recentSearches: string[];
  showRecent: boolean;
  setShowRecent: (value: boolean) => void;
  handleClearRecentSearches: () => void;
  startSearch: (name: string, tag: string, region: string) => void;
}

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
  return (
    <div className="w-full max-w-lg flex flex-col sm:flex-row items-stretch sm:items-start space-y-2 sm:space-y-0 sm:space-x-0">
      <div className="relative flex-grow" onMouseEnter={() => setShowRecent(true)} onMouseLeave={() => setShowRecent(false)}>
        <input
          type="text"
          placeholder="SummonerName#TagLine"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="p-3 border border-gray-700 rounded-md sm:rounded-l-md sm:rounded-r-none bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full transition-all"
        />
        {showRecent && recentSearches.length > 0 && (
          <div className="absolute z-10 w-full md:w-72 top-full bg-gray-800 border border-gray-700 rounded-md shadow-lg">
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-xs text-gray-400 font-semibold uppercase">Recent Searches</span>
              <button onClick={handleClearRecentSearches} className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline focus:outline-none">
                Clear
              </button>
            </div>
            <ul className="py-1 max-h-60 overflow-y-auto rounded-b-md">
              {recentSearches.map((search, index) => (
                <li
                  key={index}
                  className="px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer truncate"
                  onClick={() => {
                    setSearchInput(search);
                    const [name, tag] = search.split('#');
                    startSearch(name, tag, region);
                    setShowRecent(false);
                  }}
                >
                  {search}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <select value={region} onChange={(e) => setRegion(e.target.value)} className="p-3 border border-gray-700 sm:border-y sm:border-l-0 bg-gray-900 text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all rounded-md sm:rounded-none">
        <option value="EUW1">EUW</option>
        <option value="NA1">NA</option>
        <option value="KR">KR</option>
      </select>
      <button onClick={handleSearchClick} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-md sm:rounded-r-md sm:rounded-l-none disabled:bg-cyan-400/50 disabled:cursor-not-allowed transition-colors">
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>
  );
};

export default SearchBar;
