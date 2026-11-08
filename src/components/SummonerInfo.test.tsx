import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SummonerInfo from './SummonerInfo';
import { useDataDragonStore } from '../store/dataDragonStore';
import { useAuthStore } from '../store/authStore';
import { analyzeTimelines } from '../api/timeline';
import { chatWithAi } from '../api/ai';
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

vi.mock('../api/ai', () => ({
  chatWithAi: vi.fn(),
  submitFeedback: vi.fn(),
}));

vi.mock('../hooks/useTimeAgo', () => ({
  useTimeAgo: () => ['2 hours ago', { current: null }],
}));

// Mock store
vi.mock('../store/dataDragonStore', () => ({
  useDataDragonStore: vi.fn(),
}));

import backend18ContractJson from '../test/fixtures/improvement-stats-contract.json';

const BACKEND_18_CONTRACT = backend18ContractJson as unknown as ImprovementStatsDto;

const makePreTimelineFromSerializedContract = (): ImprovementStatsDto => {
  const cloned = JSON.parse(JSON.stringify(BACKEND_18_CONTRACT)) as ImprovementStatsDto;
  return {
    ...cloned,
    excludedMissingTimelineGames: cloned.totalGamesConsidered,
    phaseFarming: {
      ...cloned.phaseFarming,
      excludedMissingTimelineGames: cloned.totalGamesConsidered,
      min10To20: {
        ...cloned.phaseFarming.min10To20,
        eligibleGames: 0,
        avgLaneCsGained: null,
        avgJungleCsGained: null,
        avgTotalCsGained: null,
        avgWindowMinutes: null,
        avgLaneCsPerMin: null,
        avgJungleCsPerMin: null,
        avgTotalCsPerMin: null,
      },
      min20ToEnd: {
        ...cloned.phaseFarming.min20ToEnd,
        eligibleGames: 0,
        avgLaneCsGained: null,
        avgJungleCsGained: null,
        avgTotalCsGained: null,
        avgWindowMinutes: null,
        avgLaneCsPerMin: null,
        avgJungleCsPerMin: null,
        avgTotalCsPerMin: null,
      },
    },
    leadRetention: {
      ...cloned.leadRetention,
      excludedMissingTimelineGames: cloned.totalGamesConsidered,
      eligibleGamesAt10: 0,
      eligibleGamesAt20: 0,
      avgGoldLeadAt10: null,
      avgXpLeadAt10: null,
      avgGoldLeadAt20: null,
      avgXpLeadAt20: null,
      goldLeadRetentionRate: null,
      xpLeadRetentionRate: null,
    },
    deathCost: {
      ...cloned.deathCost,
      bountyOnPlayerDeaths: {
        ...cloned.deathCost.bountyOnPlayerDeaths,
        eligibleTimelineGames: 0,
        excludedMissingTimelineGames: cloned.totalGamesConsidered,
        totalRecordedDeaths: null,
        totalBaseKillBountyGold: null,
        totalShutdownBountyGold: null,
        totalCombinedBountyGold: null,
      },
    },
    unspentGold: {
      ...cloned.unspentGold,
      eligibleGames: 0,
      excludedMissingTimelineGames: cloned.totalGamesConsidered,
      sampleCount: 0,
      medianCurrentGold: null,
      maxCurrentGold: null,
      avgCurrentGold: null,
      highBalanceSampleCount: null,
      highBalanceBeforePurchaseSampleCount: null,
    },
  };
};

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
    localStorage.clear();
    useAuthStore.setState({ starredProfile: null });
    (useDataDragonStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue('https://ddragon.leagueoflegends.com/cdn/13.1.1');
    (chatWithAi as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      response: 'Strong mid-game objective control on Ahri, focus on 10m lane CS consistency.\n---SUGGESTIONS---\n["How do I fix my 10m CS?", "When should I roam?"]',
      interactionId: 'summary-interaction-1',
    });
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

  it('toggles starred landing profile state when Star button is clicked', () => {
    render(<SummonerInfo {...defaultProps} />);

    const starBtn = screen.getByTestId('star-profile-button');
    expect(starBtn).toHaveAttribute('aria-pressed', 'false');
    expect(starBtn).toHaveTextContent('Star');

    fireEvent.click(starBtn);
    expect(starBtn).toHaveAttribute('aria-pressed', 'true');
    expect(starBtn).toHaveTextContent('Starred');

    fireEvent.click(starBtn);
    expect(starBtn).toHaveAttribute('aria-pressed', 'false');
    expect(starBtn).toHaveTextContent('Star');
  });

  it('renders AI Coach Summary on top of a starred profile and continues that conversation in AI Coach when clicked', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    useAuthStore.setState({
      starredProfile: {
        puuid: '123',
        gameName: 'TestUser',
        tagLine: 'EUW',
        region: 'EUW1',
      },
    });

    render(<SummonerInfo {...defaultProps} />);

    const summaryCard = await screen.findByTestId('starred-ai-summary-card');
    expect(summaryCard).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('starred-ai-summary-content')).toHaveTextContent(
        'Strong mid-game objective control on Ahri, focus on 10m lane CS consistency.'
      );
    });

    // Clicking the AI summary card opens AI Coach with the summary message already in the conversation
    fireEvent.click(summaryCard);

    const dialog = screen.getByTestId('ai-coach-modal-dialog');
    expect(dialog).toBeInTheDocument();
    const chatScroll = screen.getByTestId('ai-coach-chat-scroll');
    expect(chatScroll).toHaveTextContent(
      'Strong mid-game objective control on Ahri, focus on 10m lane CS consistency.'
    );
    expect(dialog).toHaveTextContent('How do I fix my 10m CS?');
  });

  it('renders SummonerProfileDto.improvementStats on mount without auto-calling analyzeTimelines, then upgrades to TimelineAnalysisDto.improvementStats on manual click', async () => {
    const preTimelineStats = makePreTimelineFromSerializedContract();
    const analyzedStats = BACKEND_18_CONTRACT;

    (analyzeTimelines as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      puuid: '123',
      gamesAnalyzed: 3,
      heatmapPositions: [],
      killPositions: [],
      deathPositions: [],
      wardPositions: [],
      assistPositions: [],
      powerSpikeTimelines: [],
      aggregateSummary: {
        gamesAnalyzed: 3,
        avgFirstDeathMinute: 0,
        mostDangerousZone: 'None',
        avgGoldLeadAt10: 216.7,
        avgGoldLeadAt15: 250,
        wardsPlacedTotal: 10,
        killsTotal: 5,
        deathsTotal: 3,
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

    // Must not auto-call analyzeTimelines on mount or render standalone stats on the profile page
    expect(analyzeTimelines).not.toHaveBeenCalled();
    expect(screen.queryByTestId('improvement-stats-section')).not.toBeInTheDocument();

    // Opening AI Coach modal shows plain-language greeting; evidence stays hidden until Show Evidence is toggled
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByText('AI Coach'));
    expect(screen.queryByText(/I've analyzed/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Match summaries from .* recent game.* are loaded \(deep timeline analysis not run yet\)/i)
    ).toBeInTheDocument();
    const evidenceToggle = screen.getByTestId('ai-coach-evidence-toggle');
    expect(evidenceToggle).toHaveTextContent('Show Evidence');
    expect(evidenceToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('ai-coach-evidence-drawer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('improvement-stats-section')).not.toBeInTheDocument();

    // Toggling Show Evidence inside AI Coach reveals the in-coach evidence surface
    fireEvent.click(evidenceToggle);
    expect(evidenceToggle).toHaveTextContent('Hide Evidence');
    expect(evidenceToggle).toHaveAttribute('aria-expanded', 'true');
    const preDrawer = screen.getByTestId('ai-coach-evidence-drawer');
    expect(preDrawer).toHaveTextContent('What Your Coach Sees (Observed Stats & Guardrails)');
    expect(preDrawer).toHaveTextContent('Match summaries only (timeline not run)');
    expect(preDrawer.textContent).not.toContain('NOT_ANALYZED');
    expect(preDrawer.textContent).not.toContain('Structured Coach Evidence Sent in Context');
    expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
      'Match-Level Only (Timeline Not Analyzed · 4G)'
    );
    expect(screen.getByTestId('card-death-cost')).toHaveTextContent('34.0s');
    expect(screen.getByTestId('card-phase-farming')).toHaveTextContent(
      'Unavailable (Analyze Timeline required)'
    );

    // Manual click inside AI Coach evidence drawer triggers analyzeTimelines and upgrades to TimelineAnalysisDto.improvementStats
    fireEvent.click(screen.getByTestId('improvement-stats-analyze-cta'));
    expect(analyzeTimelines).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
        'Timeline Analyzed (3/4G)'
      );
    });
    expect(screen.getByTestId('phase-window-10-20m')).toHaveTextContent('9.15/m');
    expect(screen.getByTestId('card-death-cost')).toHaveTextContent('750g');

    const drawer = screen.getByTestId('ai-coach-evidence-drawer');
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveTextContent('What Your Coach Sees (Observed Stats & Guardrails)');
    expect(drawer).toHaveTextContent('Observed: 4 matches · 10m/20m timelines loaded');
    expect(drawer).toHaveTextContent('Guardrails: Target ≠ missed CS · No guessed wave states');
    expect(drawer).toHaveTextContent('9.15/m (2G)');
    expect(drawer).toHaveTextContent('750g (3D)');
    expect(drawer).toHaveTextContent('800.0g / 854.5g');

    // Verify dynamic viewport dialog bounds, independent scroll containers, input typing without paid AI call, and close/reopen
    const dialog = screen.getByTestId('ai-coach-modal-dialog');
    expect(dialog.className).toContain('100dvh');
    expect(drawer.className).toContain('overflow-y-auto');
    const chatScroll = screen.getByTestId('ai-coach-chat-scroll');
    expect(chatScroll.className).toContain('overflow-y-auto');
    expect(chatScroll.className).toContain('min-h-[5.5rem]');

    const coachInput = screen.getByTestId('ai-coach-input') as HTMLInputElement;
    expect(coachInput.className).toContain('min-w-0');
    fireEvent.focus(coachInput);
    fireEvent.change(coachInput, { target: { value: 'Check my 10m lane CS vs target' } });
    expect(coachInput.value).toBe('Check my 10m lane CS vs target');
    expect(screen.getByTestId('ai-coach-send-button')).not.toBeDisabled();

    // Close and reopen AI Coach modal
    fireEvent.click(screen.getByTestId('ai-coach-close-button'));
    expect(screen.queryByTestId('ai-coach-modal-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('AI Coach'));
    expect(screen.getByTestId('ai-coach-modal-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('ai-coach-input')).toBeInTheDocument();
  });
});

