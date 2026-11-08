import { render, screen, waitFor } from '@testing-library/react';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SearchPage from './SearchPage';
import { isCoachEvidenceFixtureEnabled } from '../utils/coachEvidenceReviewFixture';
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
  default: ({ onLoadMore, hasMore }: any) => (
    <div data-testid="match-history">
      Match History
      {hasMore && <button onClick={onLoadMore}>Load More</button>}
    </div>
  )
}));

// Mock API calls
vi.mock('../api/riot', () => ({
  getSummonerByName: vi.fn(),
  getMatches: vi.fn(),
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

let mockStoreState: any = {
  searchInput: '',
  region: 'EUW1',
  lastSearchedSummoner: null,
  starredProfile: null,
  isLoggedIn: true,
  recentSearches: [],
  setSearchInput: mockSetSearchInput,
  setRegion: mockSetRegion,
  setLastSearchedSummoner: mockSetLastSearchedSummoner,
  addRecentSearch: mockAddRecentSearch,
  clearRecentSearches: mockClearRecentSearches,
};

vi.mock('../store/authStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/authStore')>();
  return {
    ...actual,
    useAuthStore: Object.assign(
      (selector: any) => selector(mockStoreState),
      { getState: () => mockStoreState }
    ),
  };
});

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (userApi.getRecentSearches as any).mockResolvedValue([]);
    // Reset store state
    mockStoreState = {
      searchInput: '',
      region: 'EUW1',
      lastSearchedSummoner: null,
      starredProfile: null,
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
          <Route path="/profile/:region/:riotId" element={<SearchPage />} />
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
          <Route path="/profile/:region/:riotId" element={<SearchPage />} />
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
            <Route path="/profile/:region/:riotId" element={<SearchPage />} />
          </Routes>
        </MemoryRouter>
      );
  
      await waitFor(() => {
        expect(riotApi.getSummonerByName).toHaveBeenCalledWith('NA1', 'Test', '123', expect.anything());
      });
      
      // Check if setRegion was called with 'NA1'
      expect(mockSetRegion).toHaveBeenCalledWith('NA1');
  });

  it('loads more matches when "Load More" is clicked', async () => {
    const mockSummonerData = {
      puuid: '123',
      gameName: 'Test',
      tagLine: '123',
      region: 'EUW1',
      recentMatches: Array(20).fill({ info: { gameId: 1 } }), // 20 matches to enable load more
      lastUpdated: new Date().toISOString(),
    };
    (riotApi.getSummonerByName as any).mockResolvedValue(mockSummonerData);
    (riotApi.getMatches as any).mockResolvedValue([{ info: { gameId: 2 } }]); // Next page matches

    render(
      <MemoryRouter initialEntries={['/search?gameName=Test&tagLine=123&region=eu']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/profile/:region/:riotId" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Load More')).toBeInTheDocument();
    });

    const loadMoreBtn = screen.getByText('Load More');
    loadMoreBtn.click();

    await waitFor(() => {
      expect(riotApi.getMatches).toHaveBeenCalledWith('EUW1', '123', 2);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks ?fixture=coach-evidence in production (DEV=false) while keeping local DEV review functional', async () => {
    expect(isCoachEvidenceFixtureEnabled('coach-evidence', false)).toBe(false);
    expect(isCoachEvidenceFixtureEnabled('coach-evidence', true)).toBe(true);
    expect(isCoachEvidenceFixtureEnabled(null, true)).toBe(false);

    vi.stubEnv('DEV', false);

    const { unmount } = render(
      <MemoryRouter initialEntries={['/search?fixture=coach-evidence']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('coach-evidence-fixture-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summoner-info')).not.toBeInTheDocument();
    unmount();

    vi.stubEnv('DEV', true);

    render(
      <MemoryRouter initialEntries={['/search?fixture=coach-evidence']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('coach-evidence-fixture-banner')).toBeInTheDocument();
      expect(screen.getByTestId('summoner-info')).toHaveTextContent('CoachContractFixture');
    });
  });

  it('immediately shows "Welcome back Lagily" and loads the starred profile when a star is in cache on /search', async () => {
    mockStoreState.starredProfile = {
      puuid: 'lagily-puuid',
      gameName: 'Lagily',
      tagLine: 'lol',
      region: 'EUW1',
      profileIconId: 29,
      summonerLevel: 450,
    };

    const mockSummonerData = {
      puuid: 'lagily-puuid',
      gameName: 'Lagily',
      tagLine: 'lol',
      region: 'EUW1',
      recentMatches: [],
      lastUpdated: new Date().toISOString(),
    };
    (riotApi.getSummonerByName as any).mockResolvedValue(mockSummonerData);

    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Welcome back Lagily' })).toBeInTheDocument();
    expect(screen.getByTestId('starred-landing-badge')).toHaveTextContent('Lagily#lol (EUW)');
    expect(screen.queryByText(/Don't know who to search for/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(riotApi.getSummonerByName).toHaveBeenCalledWith('EUW1', 'Lagily', 'lol', expect.anything());
      expect(screen.getByTestId('summoner-info')).toHaveTextContent('Lagily');
    });
  });

  it('stays as default Summoner Search landing page when no star is in cache', () => {
    mockStoreState.starredProfile = null;
    mockStoreState.lastSearchedSummoner = null;

    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Summoner Search' })).toBeInTheDocument();
    expect(screen.queryByTestId('starred-landing-badge')).not.toBeInTheDocument();
    expect(screen.getByText(/Don't know who to search for/i)).toBeInTheDocument();
    expect(riotApi.getSummonerByName).not.toHaveBeenCalled();
  });
});
