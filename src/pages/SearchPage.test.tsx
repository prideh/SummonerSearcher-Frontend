import { render, screen, waitFor } from '@testing-library/react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchPage from './SearchPage';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as riotApi from '../api/riot';
import * as userApi from '../api/user';

// Mock child components
vi.mock('../components/SearchBar', () => ({
  default: ({ startSearch, searchInput, setSearchInput, region, setRegion }: any) => (
    <div data-testid="search-bar">
      <input 
        data-testid="search-input"
        value={searchInput} 
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <select data-testid="region-select" value={region} onChange={(e) => setRegion(e.target.value)}>
        <option value="EUW1">EUW</option>
        <option value="NA1">NA</option>
      </select>
      <button onClick={() => startSearch('Test', '123', region)}>Search</button>
    </div>
  )
}));

vi.mock('../components/SummonerInfo', () => ({
  default: ({ summonerData }: any) => <div data-testid="summoner-info">{summonerData.gameName}</div>
}));

vi.mock('../components/MatchHistory', () => ({
  default: () => <div data-testid="match-history">Match History</div>
}));

// Mock API calls
vi.mock('../api/riot', () => ({
  getSummonerByName: vi.fn(),
}));

vi.mock('../api/user', () => ({
  getRecentSearches: vi.fn(),
  clearRecentSearches: vi.fn(),
}));

// Mock Store
const mockSetSearchInput = vi.fn();
const mockSetRegion = vi.fn();
const mockSetLastSearchedSummoner = vi.fn();

const mockAddRecentSearch = vi.fn();
const mockClearRecentSearches = vi.fn();

let mockStoreState = {
  searchInput: '',
  region: 'EUW1',
  lastSearchedSummoner: null,
  isLoggedIn: true,
  recentSearches: [],
  setSearchInput: mockSetSearchInput,
  setRegion: mockSetRegion,
  setLastSearchedSummoner: mockSetLastSearchedSummoner,
  addRecentSearch: mockAddRecentSearch,
  clearRecentSearches: mockClearRecentSearches,
};

vi.mock('../store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: any) => selector(mockStoreState),
    { getState: () => mockStoreState }
  ),
}));

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (userApi.getRecentSearches as any).mockResolvedValue([]);
    // Reset store state
    mockStoreState = {
      searchInput: '',
      region: 'EUW1',
      lastSearchedSummoner: null,
      isLoggedIn: true,
      recentSearches: [],
      setSearchInput: mockSetSearchInput,
      setRegion: mockSetRegion,
      setLastSearchedSummoner: mockSetLastSearchedSummoner,
      addRecentSearch: mockAddRecentSearch,
      clearRecentSearches: mockClearRecentSearches,
    };
  });

  it('triggers search when URL parameters are present', async () => {
    const mockSummonerData = {
      puuid: '123',
      gameName: 'Test',
      tagLine: '123',
      region: 'EUW1',
      recentMatches: [],
      lastUpdated: new Date().toISOString(),
    };
    (riotApi.getSummonerByName as any).mockResolvedValue(mockSummonerData);

    render(
      <MemoryRouter initialEntries={['/search?gameName=Test&tagLine=123&region=eu']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(riotApi.getSummonerByName).toHaveBeenCalledWith('EUW1', 'Test', '123', expect.anything());
    });
    expect(screen.getByTestId('summoner-info')).toHaveTextContent('Test');
  });

  it('updates URL when search is initiated from SearchBar', async () => {
    // Ensure lastSearchedSummoner is null so it doesn't short-circuit the effect
    mockStoreState.lastSearchedSummoner = null;

    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    const button = screen.getByText('Search');
    button.click();

    // The effect should pick up the change and call the API
    await waitFor(() => {
      expect(riotApi.getSummonerByName).toHaveBeenCalled();
    });
  });

  it('syncs region from URL to store', async () => {
    const mockSummonerData = {
        puuid: '123',
        gameName: 'Test',
        tagLine: '123',
        region: 'NA1',
        recentMatches: [],
        lastUpdated: new Date().toISOString(),
      };
      (riotApi.getSummonerByName as any).mockResolvedValue(mockSummonerData);
  
      render(
        <MemoryRouter initialEntries={['/search?gameName=Test&tagLine=123&region=na']}>
          <Routes>
            <Route path="/search" element={<SearchPage />} />
          </Routes>
        </MemoryRouter>
      );
  
      await waitFor(() => {
        expect(riotApi.getSummonerByName).toHaveBeenCalledWith('NA1', 'Test', '123', expect.anything());
      });
      
      // Check if setRegion was called with 'NA1'
      expect(mockSetRegion).toHaveBeenCalledWith('NA1');
  });
});
