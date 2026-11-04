import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SummonerInfo from './SummonerInfo';
import { useDataDragonStore } from '../store/dataDragonStore';
import { analyzeTimelines } from '../api/timeline';
import type { ImprovementStatsDto } from '../types/improvementStats';

// Mock child components and hooks
vi.mock('./RankedInfo', () => ({
  default: () => <div data-testid="ranked-info">Ranked Info</div>,
}));

vi.mock('./TimelineAnalysisModal', () => ({
  default: () => <div data-testid="timeline-modal">Timeline Modal</div>,
}));

vi.mock('../api/timeline', () => ({
  analyzeTimelines: vi.fn(),
}));

vi.mock('../hooks/useTimeAgo', () => ({
  useTimeAgo: () => ['2 hours ago', { current: null }],
}));

// Mock store
vi.mock('../store/dataDragonStore', () => ({
  useDataDragonStore: vi.fn(),
}));

const makeImprovementStats = (withTimeline: boolean): ImprovementStatsDto => ({
  totalGamesConsidered: 2,
  excludedInvalidDurationGames: 0,
  excludedMissingTimelineGames: withTimeline ? 0 : 2,
  phaseFarming: {
    totalGamesConsidered: 2,
    excludedMissingTimelineGames: withTimeline ? 0 : 2,
    min10To20: {
      windowLabel: '10-20m',
      eligibleGames: withTimeline ? 2 : 0,
      excludedShortGames: 0,
      excludedMissingFrameCounters: 0,
      avgLaneCsGained: withTimeline ? 80 : null,
      avgJungleCsGained: withTimeline ? 8 : null,
      avgTotalCsGained: withTimeline ? 88 : null,
      avgWindowMinutes: withTimeline ? 10 : null,
      avgLaneCsPerMin: withTimeline ? 8.0 : null,
      avgJungleCsPerMin: withTimeline ? 0.8 : null,
      avgTotalCsPerMin: withTimeline ? 8.8 : null,
    },
    min20ToEnd: {
      windowLabel: '20m-end',
      eligibleGames: withTimeline ? 2 : 0,
      excludedShortGames: 0,
      excludedMissingFrameCounters: 0,
      avgLaneCsGained: withTimeline ? 70 : null,
      avgJungleCsGained: withTimeline ? 10 : null,
      avgTotalCsGained: withTimeline ? 80 : null,
      avgWindowMinutes: withTimeline ? 10 : null,
      avgLaneCsPerMin: withTimeline ? 7.0 : null,
      avgJungleCsPerMin: withTimeline ? 1.0 : null,
      avgTotalCsPerMin: withTimeline ? 8.0 : null,
    },
    perMatch: [],
    methodologyNote: 'Phase farming checkpoint note.',
  },
  leadRetention: {
    totalGamesConsidered: 2,
    excludedMissingTimelineGames: withTimeline ? 0 : 2,
    excludedMissingOpponentGames: 0,
    excludedShortGamesBefore10: 0,
    excludedShortGamesBefore20: 0,
    eligibleGamesAt10: withTimeline ? 2 : 0,
    eligibleGamesAt20: withTimeline ? 2 : 0,
    avgGoldLeadAt10: withTimeline ? 350 : null,
    avgXpLeadAt10: withTimeline ? 200 : null,
    avgGoldLeadAt20: withTimeline ? 600 : null,
    avgXpLeadAt20: withTimeline ? 400 : null,
    gamesAheadInGoldAt10: withTimeline ? 2 : 0,
    gamesAheadInGoldAt10Reaching20: withTimeline ? 2 : 0,
    gamesRetainedGoldLeadAt20: withTimeline ? 2 : 0,
    goldLeadRetentionRate: withTimeline ? 1.0 : null,
    gamesAheadInXpAt10: withTimeline ? 2 : 0,
    gamesAheadInXpAt10Reaching20: withTimeline ? 2 : 0,
    gamesRetainedXpLeadAt20: withTimeline ? 2 : 0,
    xpLeadRetentionRate: withTimeline ? 1.0 : null,
    allyObjectiveEvents10To20: 0,
    enemyObjectiveEvents10To20: 0,
    allyTowerEvents10To20: 0,
    enemyTowerEvents10To20: 0,
    perMatch: [],
    associationNote: 'Temporal association only.',
  },
  deathCost: {
    totalGamesConsidered: 2,
    eligibleTimeDeadGames: 2,
    excludedMissingTimeSpentDeadGames: 0,
    totalTimeSpentDeadSeconds: 90,
    avgTimeSpentDeadSeconds: 45.0,
    avgDeadTimeGameShare: 0.025,
    avgDeadTimeGameSharePct: 2.5,
    overallDeadTimeGameShare: 0.025,
    overallDeadTimeGameSharePct: 2.5,
    bountyOnPlayerDeaths: {
      eligibleTimelineGames: withTimeline ? 2 : 0,
      excludedMissingTimelineGames: withTimeline ? 0 : 2,
      totalRecordedDeaths: withTimeline ? 2 : null,
      deathsWithBaseBountyData: withTimeline ? 2 : 0,
      deathsWithShutdownBountyData: withTimeline ? 2 : 0,
      deathsWithAnyBountyData: withTimeline ? 2 : 0,
      deathsMissingBountyData: 0,
      totalBaseKillBountyGold: withTimeline ? 600 : null,
      totalShutdownBountyGold: withTimeline ? 150 : null,
      totalCombinedBountyGold: withTimeline ? 750 : null,
      avgBaseKillBountyPerDeath: withTimeline ? 300 : null,
      avgShutdownBountyPerDeath: withTimeline ? 75 : null,
      avgCombinedBountyPerDeath: withTimeline ? 375 : null,
    },
    perMatch: [],
    goldComponentDefinition: 'Disjoint components.',
  },
  unspentGold: {
    totalGamesConsidered: 2,
    eligibleGames: withTimeline ? 2 : 0,
    excludedMissingTimelineGames: withTimeline ? 0 : 2,
    excludedNoCurrentGoldSamplesGames: 0,
    sampleCount: withTimeline ? 20 : 0,
    medianCurrentGold: withTimeline ? 750 : null,
    maxCurrentGold: withTimeline ? 1550 : null,
    avgCurrentGold: withTimeline ? 810 : null,
    highBalanceThresholdGold: 1300,
    highBalanceSampleCount: withTimeline ? 2 : null,
    highBalanceBeforePurchaseSampleCount: withTimeline ? 1 : null,
    highBalanceBeforePurchaseSamples: [],
    perMatch: [],
    samplingSemanticsNote: '1-minute snapshots.',
  },
  teamObjectives: {
    totalGamesConsidered: 2,
    eligibleTeamObjectiveGames: 2,
    excludedMissingTeamsDataGames: 0,
    tower: {
      objectiveKey: 'tower',
      eligibleGamesWithKills: 2,
      eligibleGamesWithFirstFlag: 2,
      excludedMissingObjectiveGames: 0,
      teamFirstCount: 2,
      teamFirstRate: 1.0,
      teamTotalKills: 16,
      teamAvgKills: 8.0,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 4,
      enemyTeamAvgKills: 2.0,
      personalLastHitEligibleGames: 2,
      personalTotalLastHits: 3,
      personalAvgLastHits: 1.5,
      personalTakedownEligibleGames: 2,
      personalTotalTakedowns: 5,
      personalAvgTakedowns: 2.5,
      timelineEligibleGames: withTimeline ? 2 : 0,
      timelinePersonalInvolvements: 0,
    },
    dragon: {
      objectiveKey: 'dragon',
      eligibleGamesWithKills: 2,
      eligibleGamesWithFirstFlag: 2,
      excludedMissingObjectiveGames: 0,
      teamFirstCount: 1,
      teamFirstRate: 0.5,
      teamTotalKills: 5,
      teamAvgKills: 2.5,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 2,
      enemyTeamAvgKills: 1.0,
      personalLastHitEligibleGames: 2,
      personalTotalLastHits: 1,
      personalAvgLastHits: 0.5,
      personalTakedownEligibleGames: 2,
      personalTotalTakedowns: 4,
      personalAvgTakedowns: 2.0,
      timelineEligibleGames: withTimeline ? 2 : 0,
      timelinePersonalInvolvements: 0,
    },
    baron: {
      objectiveKey: 'baron',
      eligibleGamesWithKills: 2,
      eligibleGamesWithFirstFlag: 2,
      excludedMissingObjectiveGames: 0,
      teamFirstCount: 1,
      teamFirstRate: 0.5,
      teamTotalKills: 1,
      teamAvgKills: 0.5,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 0,
      enemyTeamAvgKills: 0.0,
      personalLastHitEligibleGames: 2,
      personalTotalLastHits: 0,
      personalAvgLastHits: 0.0,
      personalTakedownEligibleGames: 2,
      personalTotalTakedowns: 1,
      personalAvgTakedowns: 0.5,
      timelineEligibleGames: withTimeline ? 2 : 0,
      timelinePersonalInvolvements: 0,
    },
    riftHerald: {
      objectiveKey: 'riftHerald',
      eligibleGamesWithKills: 2,
      eligibleGamesWithFirstFlag: 2,
      excludedMissingObjectiveGames: 0,
      teamFirstCount: 1,
      teamFirstRate: 0.5,
      teamTotalKills: 1,
      teamAvgKills: 0.5,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 1,
      enemyTeamAvgKills: 0.5,
      personalLastHitEligibleGames: 0,
      personalTotalLastHits: null,
      personalAvgLastHits: null,
      personalTakedownEligibleGames: 0,
      personalTotalTakedowns: null,
      personalAvgTakedowns: null,
      timelineEligibleGames: withTimeline ? 2 : 0,
      timelinePersonalInvolvements: 0,
    },
    horde: {
      objectiveKey: 'horde',
      eligibleGamesWithKills: 2,
      eligibleGamesWithFirstFlag: 2,
      excludedMissingObjectiveGames: 0,
      teamFirstCount: 1,
      teamFirstRate: 0.5,
      teamTotalKills: 6,
      teamAvgKills: 3.0,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 2,
      enemyTeamAvgKills: 1.0,
      personalLastHitEligibleGames: 0,
      personalTotalLastHits: null,
      personalAvgLastHits: null,
      personalTakedownEligibleGames: 2,
      personalTotalTakedowns: 4,
      personalAvgTakedowns: 2.0,
      timelineEligibleGames: withTimeline ? 2 : 0,
      timelinePersonalInvolvements: 0,
    },
    perMatch: [],
    attributionNote: 'Team objectives vs personal takedowns.',
  },
  byChampion: {},
  byRole: {},
});

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
    championStats: [],
    overallStats: null,
    totalMatches: 0,
    matchIds: [],
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
    onViewProfile: vi.fn(),
    showFullProfile: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDataDragonStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue('https://ddragon.leagueoflegends.com/cdn/13.1.1');
  });

  it('renders summoner details correctly', () => {
    render(<SummonerInfo {...defaultProps} />);
    
    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('#EUW')).toBeInTheDocument();
    expect(screen.getByText('Level 100')).toBeInTheDocument();
    expect(screen.getByText('Last updated: 2 hours ago')).toBeInTheDocument();
    expect(screen.getByAltText("TestUser's Profile Icon")).toHaveAttribute('src', 'https://ddragon.leagueoflegends.com/cdn/13.1.1/img/profileicon/1.png');
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

  it('renders SummonerProfileDto.improvementStats on mount without auto-calling analyzeTimelines, then upgrades to TimelineAnalysisDto.improvementStats on manual click', async () => {
    const preTimelineStats = makeImprovementStats(false);
    const analyzedStats = makeImprovementStats(true);

    (analyzeTimelines as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      puuid: '123',
      gamesAnalyzed: 2,
      heatmapPositions: [],
      killPositions: [],
      deathPositions: [],
      wardPositions: [],
      assistPositions: [],
      powerSpikeTimelines: [],
      aggregateSummary: {
        gamesAnalyzed: 2,
        avgFirstDeathMinute: 0,
        mostDangerousZone: 'None',
        avgGoldLeadAt10: 350,
        avgGoldLeadAt15: 450,
        wardsPlacedTotal: 10,
        killsTotal: 5,
        deathsTotal: 2,
        assistsTotal: 8,
      },
      improvementStats: analyzedStats,
    });

    render(
      <SummonerInfo
        {...defaultProps}
        summonerData={{
          ...mockSummonerData,
          improvementStats: preTimelineStats,
        }}
      />
    );

    // Must not auto-call analyzeTimelines on mount
    expect(analyzeTimelines).not.toHaveBeenCalled();
    expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
      'Match-Level Only (Timeline Not Analyzed · 2G)'
    );
    expect(screen.getByTestId('card-death-cost')).toHaveTextContent('45.0s');
    expect(screen.getByTestId('card-phase-farming')).toHaveTextContent(
      'Unavailable (Analyze Timeline required)'
    );

    // Manual click triggers analyzeTimelines and upgrades ImprovementStatsSection to TimelineAnalysisDto.improvementStats
    fireEvent.click(screen.getByTestId('improvement-stats-analyze-cta'));
    expect(analyzeTimelines).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
        'Timeline Analyzed (2/2G)'
      );
    });
    expect(screen.getByTestId('phase-window-10-20m')).toHaveTextContent('8.80/m');
    expect(screen.getByTestId('card-death-cost')).toHaveTextContent('750g');
  });
});
