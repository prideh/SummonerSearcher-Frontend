import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SummonerInfo from './SummonerInfo';
import { useDataDragonStore } from '../store/dataDragonStore';

// Mock child components and hooks
vi.mock('./RankedInfo', () => ({
  default: () => <div data-testid="ranked-info">Ranked Info</div>,
}));

vi.mock('../hooks/useTimeAgo', () => ({
  useTimeAgo: () => ['2 hours ago', { current: null }],
}));

// Mock store
vi.mock('../store/dataDragonStore', () => ({
  useDataDragonStore: vi.fn(),
}));

describe('SummonerInfo', () => {
  const mockSummonerData = {
    id: 'summoner-id',
    puuid: '123',
    gameName: 'TestUser',
    tagLine: 'EUW',
    summonerLevel: 100,
    profileIconId: 1,
    lastUpdated: new Date().toISOString(),
    region: 'EUW1',
    recentMatches: [],
    soloQueueRank: {
      leagueId: 'league-id',
      queueType: 'RANKED_SOLO_5x5',
      tier: 'GOLD',
      rank: 'IV',
      leaguePoints: 50,
      wins: 10,
      losses: 10,
      hotStreak: false,
      veteran: false,
      freshBlood: false,
      inactive: false,
    },
  };

  const defaultProps = {
    summonerData: mockSummonerData,
    handleRefresh: vi.fn(),
    loading: false,
    refreshing: false,
    visibleMatches: [],
    onPlayerClick: vi.fn(),
  };

  beforeEach(() => {
    (useDataDragonStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue('https://ddragon.leagueoflegends.com/cdn/13.1.1');
  });

  it('renders summoner details correctly', () => {
    render(<SummonerInfo {...defaultProps} />);
    
    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('#EUW')).toBeInTheDocument();
    expect(screen.getByText('Level 100')).toBeInTheDocument();
    expect(screen.getByText('Last updated: 2 hours ago')).toBeInTheDocument();
    expect(screen.getByAltText('Profile Icon')).toHaveAttribute('src', 'https://ddragon.leagueoflegends.com/cdn/13.1.1/img/profileicon/1.png');
  });

  it('renders RankedInfo when ranked data is available', () => {
    render(<SummonerInfo {...defaultProps} />);
    expect(screen.getByTestId('ranked-info')).toBeInTheDocument();
  });

  it('renders "No ranked data" when soloQueueRank is null', () => {
    const props = {
      ...defaultProps,
      summonerData: { ...mockSummonerData, soloQueueRank: null },
    };
    render(<SummonerInfo {...props} />);
    expect(screen.getByText('No ranked data available for this summoner.')).toBeInTheDocument();
  });

  it('calls handleRefresh when refresh button is clicked', () => {
    const handleRefresh = vi.fn();
    render(<SummonerInfo {...defaultProps} handleRefresh={handleRefresh} />);
    
    fireEvent.click(screen.getByText('Refresh'));
    expect(handleRefresh).toHaveBeenCalled();
  });

  it('disables refresh button when refreshing', () => {
    render(<SummonerInfo {...defaultProps} refreshing={true} />);
    expect(screen.getByText('Refresh').closest('button')).toBeDisabled();
  });
});
