import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RankedInfo from './RankedInfo';
import { useDataDragonStore } from '../store/dataDragonStore';

// Mock child components
vi.mock('./RecentChampionStats', () => ({
  default: () => <div data-testid="recent-champion-stats">Recent Champion Stats</div>,
}));

vi.mock('./ConsistencyStats', () => ({
  default: () => <div data-testid="consistency-stats">Consistency Stats</div>,
}));

// Mock store
vi.mock('../store/dataDragonStore', () => ({
  useDataDragonStore: vi.fn(),
}));

describe('RankedInfo', () => {
  const mockSummonerData = {
    puuid: '123',
    id: 'test-id',
    gameName: 'TestUser',
    tagLine: 'EUW',
    region: 'EUW1',
    summonerLevel: 100,
    profileIconId: 1,
    lastUpdated: new Date().toISOString(),
    recentMatches: [],
    soloQueueRank: {
      leagueId: 'test-league-id',
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

  const mockMatches = [
    {
      info: {
        participants: [
          { puuid: '123', teamPosition: 'MIDDLE' },
        ],
      },
    },
    {
      info: {
        participants: [
          { puuid: '123', teamPosition: 'MIDDLE' },
        ],
      },
    },
    {
      info: {
        participants: [
          { puuid: '123', teamPosition: 'TOP' },
        ],
      },
    },
  ];

  const defaultProps = {
    rankedData: mockSummonerData.soloQueueRank,
    summonerData: mockSummonerData,
    matches: mockMatches as any[],  
  };

  beforeEach(() => {
    (useDataDragonStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default');
  });

  it('renders ranked details correctly', () => {
    render(<RankedInfo {...defaultProps} />);
    
    expect(screen.getByText('gold IV')).toBeInTheDocument();
    expect(screen.getByText('50 LP')).toBeInTheDocument();
    expect(screen.getByText(/10W \/ 10L/)).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByAltText('GOLD')).toHaveAttribute('src', 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/rcp-fe-lol-shared-components/global/default/images/gold.png');
  });

  it('renders "Mid Main" when mostly playing mid', () => {
    render(<RankedInfo {...defaultProps} />);
    expect(screen.getByText('Mid Main')).toBeInTheDocument();
  });

  it('renders "Multirole" when there is a tie in role frequency', () => {
    const tiedMatches = [
        { info: { participants: [{ puuid: '123', teamPosition: 'MIDDLE' }] } },
        { info: { participants: [{ puuid: '123', teamPosition: 'TOP' }] } },
    ] as any[];

    render(<RankedInfo {...defaultProps} matches={tiedMatches} />);
    expect(screen.getByText('Multirole')).toBeInTheDocument();
  });

  it('renders role even if percentage is below 60%', () => {
    // 2 Mid, 1 Top, 1 Jungle = 50% Mid. Should still show Mid Main.
    const mixedMatches = [
        { info: { participants: [{ puuid: '123', teamPosition: 'MIDDLE' }] } },
        { info: { participants: [{ puuid: '123', teamPosition: 'MIDDLE' }] } },
        { info: { participants: [{ puuid: '123', teamPosition: 'TOP' }] } },
        { info: { participants: [{ puuid: '123', teamPosition: 'JUNGLE' }] } },
    ] as any[];

    render(<RankedInfo {...defaultProps} matches={mixedMatches} />);
    expect(screen.getByText('Mid Main')).toBeInTheDocument();
  });

  it('renders child components', () => {
    render(<RankedInfo {...defaultProps} />);
    expect(screen.getByTestId('recent-champion-stats')).toBeInTheDocument();
    expect(screen.getByTestId('consistency-stats')).toBeInTheDocument();
  });
});
