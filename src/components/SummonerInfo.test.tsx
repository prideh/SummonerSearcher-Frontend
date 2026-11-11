import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SummonerInfo from './SummonerInfo';
import { useDataDragonStore } from '../store/dataDragonStore';
import { useAuthStore } from '../store/authStore';
import { analyzeTimelines, prepareCoachTimelines } from '../api/timeline';
import { chatWithAi } from '../api/ai';
import type { ImprovementStatsDto } from '../types/improvementStats';
import type { MatchDto } from '../types/match';
import type { TimelineAnalysisDto } from '../types/timeline';

// Mock child components and hooks
vi.mock('./RankedInfo', () => ({
  default: () => <div data-testid="ranked-info">Ranked Info</div>,
}));

vi.mock('./TimelineAnalysisModal', () => ({
  default: ({
    isOpen,
    onOpenAiCoach,
  }: {
    isOpen: boolean;
    onOpenAiCoach?: (suggestion?: string) => void;
  }) =>
    isOpen ? (
      <div data-testid="timeline-modal">
        Timeline Modal
        <button
          type="button"
          data-testid="timeline-modal-open-coach"
          onClick={() => onOpenAiCoach?.('Review my 10m lead')}
        >
          Ask Coach
        </button>
      </div>
    ) : null,
}));

vi.mock('../api/timeline', () => ({
  analyzeTimelines: vi.fn(),
  prepareCoachTimelines: vi.fn(),
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

  const makeAnalyzedTimelineDto = (
    stats: ImprovementStatsDto = BACKEND_18_CONTRACT,
    gamesAnalyzed = 3,
    avgGoldLeadAt10 = 216.7
  ): TimelineAnalysisDto => ({
    heatmapPositions: [],
    killPositions: [],
    deathPositions: [],
    wardPositions: [],
    assistPositions: [],
    powerSpikeTimelines: [],
    buildOrders: [],
    skillOrders: [],
    eventTimelines: [],
    aggregateSummary: {
      gamesAnalyzed,
      avgFirstDeathMinute: 0,
      mostDangerousZone: 'None',
      avgGoldLeadAt10,
      avgGoldLeadAt15: 250,
      wardsPlacedTotal: 10,
      killsTotal: 5,
      deathsTotal: 3,
      assistsTotal: 8,
    },
    improvementStats: stats,
  });

  const makeMatch = (matchId: string, puuid = '123', championName = 'Ahri'): MatchDto => ({
    metadata: { matchId },
    info: {
      gameId: Number(matchId.replace(/\D/g, '') || 1),
      gameDuration: 1800,
      gameVersion: '16.2.1',
      participants: [
        {
          puuid,
          championName,
          teamId: 100,
          teamPosition: 'MIDDLE',
          win: true,
          kills: 6,
          deaths: 2,
          assists: 7,
          totalMinionsKilled: 190,
          neutralMinionsKilled: 12,
          visionScore: 24,
          wardsPlaced: 9,
          wardsKilled: 3,
          detectorWardsPlaced: 2,
          damageDealtToObjectives: 9000,
          damageDealtToTurrets: 4100,
          totalDamageDealtToChampions: 22000,
          physicalDamageDealtToChampions: 2000,
          magicDamageDealtToChampions: 18000,
          trueDamageDealtToChampions: 2000,
          goldEarned: 13200,
          summoner1Id: 4,
          summoner2Id: 14,
          item0: 1056,
          item1: 6655,
          item2: 3089,
          item3: 3020,
          item4: 0,
          item5: 0,
          item6: 3340,
          challenges: {
            laneMinionsFirst10Minutes: 84,
            turretPlatesTaken: 2,
            controlWardsPlaced: 2,
            soloKills: 1,
          },
        },
        {
          puuid: `opp-${matchId}`,
          championName: 'Syndra',
          teamId: 200,
          teamPosition: 'MIDDLE',
          win: false,
          kills: 2,
          deaths: 6,
          assists: 3,
          totalMinionsKilled: 165,
          neutralMinionsKilled: 4,
          visionScore: 18,
          wardsPlaced: 7,
          wardsKilled: 2,
          detectorWardsPlaced: 1,
          damageDealtToObjectives: 3200,
          damageDealtToTurrets: 1200,
          totalDamageDealtToChampions: 16500,
          physicalDamageDealtToChampions: 1500,
          magicDamageDealtToChampions: 14000,
          trueDamageDealtToChampions: 1000,
          goldEarned: 10800,
          summoner1Id: 4,
          summoner2Id: 12,
          item0: 6653,
          item1: 3157,
          item2: 0,
          item3: 0,
          item4: 0,
          item5: 0,
          item6: 3363,
        },
      ],
    },
  });

  it('does not prefetch timelines on mount, prepares on AI Coach open without popping TimelineAnalysisModal, and supports in-drawer retry when initially BLOCKED', async () => {
    const preTimelineStats = makePreTimelineFromSerializedContract();
    const analyzedStats = BACKEND_18_CONTRACT;

    (prepareCoachTimelines as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        status: 'BLOCKED',
        region: 'euw1',
        puuid: '123',
        analyzerVersion: 'v2',
        requestedMatchIds: ['EUW1_1', 'EUW1_2', 'EUW1_3', 'EUW1_4'],
        coveredMatchIds: [],
        missingMatches: [{ matchId: 'EUW1_1', reason: 'RIOT_RATE_LIMITED' }],
        stopReason: 'RIOT_RATE_LIMITED',
        analysis: null,
      })
      .mockResolvedValueOnce({
        status: 'COMPLETE',
        region: 'euw1',
        puuid: '123',
        analyzerVersion: 'v2',
        requestedMatchIds: ['EUW1_1', 'EUW1_2', 'EUW1_3', 'EUW1_4'],
        coveredMatchIds: ['EUW1_1', 'EUW1_2', 'EUW1_3', 'EUW1_4'],
        missingMatches: [],
        stopReason: null,
        analysis: makeAnalyzedTimelineDto(analyzedStats, 3),
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

    // Must not auto-call timeline endpoints on mount or render standalone stats on the profile page
    expect(analyzeTimelines).not.toHaveBeenCalled();
    expect(prepareCoachTimelines).not.toHaveBeenCalled();
    expect(screen.queryByTestId('improvement-stats-section')).not.toBeInTheDocument();

    // Opening AI Coach triggers bounded prepareCoachTimelines (never analyzeTimelines or TimelineAnalysisModal)
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
    expect(analyzeTimelines).not.toHaveBeenCalled();
    expect(screen.queryByTestId('timeline-modal')).not.toBeInTheDocument();
    expect(screen.queryByText(/I've analyzed/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/minute-by-minute timeline checkpoints are temporarily unavailable/i)
      ).toBeInTheDocument();
    });

    const evidenceToggle = screen.getByTestId('ai-coach-evidence-toggle');
    expect(evidenceToggle).toHaveTextContent('Show Evidence');
    expect(evidenceToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('ai-coach-evidence-drawer')).not.toBeInTheDocument();

    // Toggling Show Evidence inside AI Coach reveals truthful BLOCKED fallback state (no retry loop)
    fireEvent.click(evidenceToggle);
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
    const preDrawer = screen.getByTestId('ai-coach-evidence-drawer');
    expect(preDrawer).toHaveTextContent('What Your Coach Sees (Observed Stats & Guardrails)');
    expect(preDrawer).toHaveTextContent('Match summaries only (timeline unavailable)');
    expect(preDrawer.textContent).not.toContain('NOT_ANALYZED');
    expect(preDrawer.textContent).not.toContain('BLOCKED');
    expect(preDrawer.textContent).not.toContain('Structured Coach Evidence Sent in Context');
    expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
      'Match-Level Only (Timeline Not Analyzed · 4G)'
    );
    expect(screen.getByTestId('card-death-cost')).toHaveTextContent('34.0s');
    expect(screen.getByTestId('card-phase-farming')).toHaveTextContent(
      'Unavailable (Analyze Timeline required)'
    );

    // Clicking the in-drawer retry CTA retries prepareCoachTimelines in-place without popping TimelineAnalysisModal
    fireEvent.click(screen.getByTestId('improvement-stats-analyze-cta'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(2);
    expect(analyzeTimelines).not.toHaveBeenCalled();
    expect(screen.queryByTestId('timeline-modal')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
        'Timeline Analyzed (3/4G)'
      );
    });
    expect(screen.getByTestId('phase-window-10-20m')).toHaveTextContent('9.15/m');
    expect(screen.getByTestId('card-death-cost')).toHaveTextContent('750g');

    const drawer = screen.getByTestId('ai-coach-evidence-drawer');
    expect(drawer).toHaveTextContent('Observed: 4 matches · 10m/20m timelines loaded');
    expect(drawer).toHaveTextContent('Guardrails: Target ≠ missed CS · No guessed wave states');
    expect(drawer).toHaveTextContent('9.15/m (2G)');
    expect(drawer).toHaveTextContent('750g (3D)');
    expect(drawer).toHaveTextContent('800.0g / 854.5g');
    expect(screen.queryByTestId('timeline-modal')).not.toBeInTheDocument();

    // Verify dynamic viewport dialog bounds, independent scroll containers, input typing without paid AI call, and warm reopen reuse
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

    // Closing and reopening warm AI Coach reuses COMPLETE prepared timeline with 0 extra network calls
    fireEvent.click(screen.getByTestId('ai-coach-close-button'));
    expect(screen.queryByTestId('ai-coach-modal-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText(/10m\/20m timeline checkpoints from 4 recent games are ready/i)
    ).toBeInTheDocument();
  });

  it('awaits in-flight timeline preparation finitely before sending the first manual prompt so chatWithAi receives fresh timeline context', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const matches = [makeMatch('EUW1_101'), makeMatch('EUW1_102'), makeMatch('EUW1_101')];

    let resolvePrep!: (val: unknown) => void;
    (prepareCoachTimelines as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrep = resolve;
        })
    );

    render(
      <SummonerInfo
        {...defaultProps}
        summonerData={{
          ...mockSummonerData,
          totalMatches: 2,
          improvementStats: makePreTimelineFromSerializedContract(),
        }}
        visibleMatches={matches}
      />
    );

    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
    expect(prepareCoachTimelines).toHaveBeenCalledWith(
      'euw1',
      '123',
      expect.objectContaining({
        matchIds: ['EUW1_101', 'EUW1_102'],
        signal: expect.any(AbortSignal),
      })
    );
    expect(
      screen.getByText(/preparing 10m\/20m timeline checkpoints in the background/i)
    ).toBeInTheDocument();

    // Immediately send first manual prompt while timeline preparation is still in flight
    const input = screen.getByTestId('ai-coach-input');
    fireEvent.change(input, { target: { value: 'How were my 10m lane leads?' } });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    // Must wait for preparation before calling chatWithAi
    expect(chatWithAi).not.toHaveBeenCalled();

    resolvePrep({
      status: 'PARTIAL',
      region: 'euw1',
      puuid: '123',
      analyzerVersion: 'v2',
      requestedMatchIds: ['EUW1_101', 'EUW1_102'],
      coveredMatchIds: ['EUW1_101'],
      missingMatches: [{ matchId: 'EUW1_102', reason: 'RIOT_BUDGET_EXHAUSTED' }],
      stopReason: 'RIOT_BUDGET_EXHAUSTED',
      analysis: makeAnalyzedTimelineDto(BACKEND_18_CONTRACT, 1, 325),
    });

    await waitFor(() => {
      expect(chatWithAi).toHaveBeenCalledTimes(1);
    });

    const [sentContext, , sentPrompt] = (chatWithAi as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sentPrompt).toBe('How were my 10m lane leads?');
    expect(sentContext.timelineStatus).toBe('PARTIAL');
    expect(sentContext.timelineCoverage).toEqual({
      status: 'PARTIAL',
      covered: 1,
      requested: 2,
      stopReason: 'RIOT_BUDGET_EXHAUSTED',
    });
    expect(sentContext.improvementStats.hasTimelineAnalysis).toBe(true);
    expect(screen.queryByTestId('timeline-modal')).not.toBeInTheDocument();

    // Open drawer and verify truthful PARTIAL badge without internal enum tokens
    fireEvent.click(screen.getByTestId('ai-coach-evidence-toggle'));
    expect(screen.getByTestId('ai-coach-evidence-drawer')).toHaveTextContent(
      '10m/20m timelines loaded (1/2G partial)'
    );
  });

  it('bounds first-prompt wait by coachPrepAwaitTimeoutMs, aborts hung prep, and falls back truthfully to BLOCKED match-summary context without retry loops', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    let capturedSignal: AbortSignal | undefined;
    (prepareCoachTimelines as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_region: string, _puuid: string, opts?: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal;
        return new Promise(() => {
          // Intentionally never settles to verify finite await bound
        });
      }
    );

    render(
      <SummonerInfo
        {...defaultProps}
        coachPrepAwaitTimeoutMs={35}
        summonerData={{
          ...mockSummonerData,
          totalMatches: 1,
        }}
        visibleMatches={[makeMatch('EUW1_501')]}
      />
    );

    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
    expect(capturedSignal?.aborted).toBe(false);

    fireEvent.change(screen.getByTestId('ai-coach-input'), {
      target: { value: 'Give me macro advice' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(() => {
      expect(chatWithAi).toHaveBeenCalledTimes(1);
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1); // No retry loop!
    const [sentContext] = (chatWithAi as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sentContext.timelineStatus).toBe('BLOCKED');
    expect(sentContext.timelineCoverage).toEqual({
      status: 'BLOCKED',
      covered: 0,
      requested: 1,
      stopReason: 'AWAIT_TIMEOUT',
    });
  });

  it('handles HTTP error and ECONNABORTED timeout states truthfully with zero retry loops', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const timeoutErr = Object.assign(new Error('timeout of 20000ms exceeded'), {
      code: 'ECONNABORTED',
    });
    (prepareCoachTimelines as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(timeoutErr)
      .mockRejectedValueOnce(new Error('Request failed with status code 503'));

    render(
      <SummonerInfo
        {...defaultProps}
        summonerData={{ ...mockSummonerData, totalMatches: 1 }}
        visibleMatches={[makeMatch('EUW1_700')]}
      />
    );

    // 1. Timeout failure on first open
    fireEvent.click(screen.getByText('AI Coach'));
    await waitFor(() => {
      expect(
        screen.getByText(/minute-by-minute timeline checkpoints are temporarily unavailable/i)
      ).toBeInTheDocument();
    });
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);

    // 2. Close and explicitly reopen -> single fresh attempt, HTTP 503 -> truthful unavailable state, no retry loop
    fireEvent.click(screen.getByTestId('ai-coach-close-button'));
    fireEvent.click(screen.getByText('AI Coach'));
    await waitFor(() => {
      expect(prepareCoachTimelines).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText(/minute-by-minute timeline checkpoints are temporarily unavailable/i)
      ).toBeInTheDocument();
    });
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(2);
  });

  it('triggers timeline preparation from starred summary card and suggestion pills (awaiting fresh context on initialMessage), and reuses manual TimelineAnalysisModal result', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    useAuthStore.setState({
      starredProfile: {
        puuid: '123',
        gameName: 'TestUser',
        tagLine: 'EUW',
        region: 'EUW1',
      },
    });

    (prepareCoachTimelines as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'COMPLETE',
      region: 'euw1',
      puuid: '123',
      analyzerVersion: 'v2',
      requestedMatchIds: ['EUW1_801'],
      coveredMatchIds: ['EUW1_801'],
      missingMatches: [],
      stopReason: null,
      analysis: makeAnalyzedTimelineDto(BACKEND_18_CONTRACT, 1, 410),
    });

    render(
      <SummonerInfo
        {...defaultProps}
        summonerData={{ ...mockSummonerData, totalMatches: 1 }}
        visibleMatches={[makeMatch('EUW1_801')]}
      />
    );

    // Wait for starred summary mount call — must NOT call prepareCoachTimelines on mount
    await waitFor(() => {
      expect(screen.getByTestId('starred-ai-summary-content')).toHaveTextContent(
        'Strong mid-game objective control on Ahri'
      );
    });
    expect(prepareCoachTimelines).not.toHaveBeenCalled();
    expect(chatWithAi).toHaveBeenCalledTimes(1); // Only the summary generation call

    // Clicking a starred suggestion pill opens AI Coach, prepares timeline, and sends initialMessage with fresh ANALYZED context
    fireEvent.click(screen.getByRole('button', { name: 'When should I roam?' }));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('timeline-modal')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(chatWithAi).toHaveBeenCalledTimes(2);
    });
    const [pillContext, , pillPrompt] = (chatWithAi as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(pillPrompt).toBe('When should I roam?');
    expect(pillContext.timelineStatus).toBe('ANALYZED');

    // Manual "Analyze Timeline" button opens TimelineAnalysisModal using already-prepared COMPLETE analysis without extra analyzeTimelines call
    fireEvent.click(screen.getByTestId('ai-coach-close-button'));
    fireEvent.click(screen.getByText('Analyze Timeline'));
    expect(screen.getByTestId('timeline-modal')).toBeInTheDocument();
    expect(analyzeTimelines).not.toHaveBeenCalled();

    // Handoff from TimelineAnalysisModal back to AI Coach reuses COMPLETE state without extra prepareCoachTimelines call
    fireEvent.click(screen.getByTestId('timeline-modal-open-coach'));
    expect(screen.getByTestId('ai-coach-modal-dialog')).toBeInTheDocument();
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
  });

  it('cancels in-flight preparation on close, invalidates cache on profile refresh, and prevents stale Player A responses from updating Player B', async () => {
    Element.prototype.scrollIntoView = vi.fn();

    let capturedSignalA1: AbortSignal | undefined;
    let resolveStalePlayerA!: (val: unknown) => void;

    (prepareCoachTimelines as unknown as ReturnType<typeof vi.fn>)
      // Open 1 (Player A): aborted on modal close
      .mockImplementationOnce(
        (_r: string, _p: string, opts?: { signal?: AbortSignal }) => {
          capturedSignalA1 = opts?.signal;
          return new Promise((_, reject) => {
            opts?.signal?.addEventListener('abort', () => {
              const abortErr = new Error('Canceled');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          });
        }
      )
      // Open 2 (Player A): ignores AbortSignal on purpose to simulate late network race across player switch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStalePlayerA = resolve;
          })
      )
      // Open 3 (Player B): resolves BLOCKED for Player B
      .mockResolvedValueOnce({
        status: 'BLOCKED',
        region: 'na1',
        puuid: '999',
        analyzerVersion: 'v2',
        requestedMatchIds: ['NA1_901'],
        coveredMatchIds: [],
        missingMatches: [{ matchId: 'NA1_901', reason: 'RIOT_RATE_LIMITED' }],
        stopReason: 'RIOT_RATE_LIMITED',
        analysis: null,
      })
      // Open 4 (Player B after profile refresh): resolves COMPLETE
      .mockResolvedValueOnce({
        status: 'COMPLETE',
        region: 'na1',
        puuid: '999',
        analyzerVersion: 'v2',
        requestedMatchIds: ['NA1_901', 'NA1_902'],
        coveredMatchIds: ['NA1_901', 'NA1_902'],
        missingMatches: [],
        stopReason: null,
        analysis: makeAnalyzedTimelineDto(BACKEND_18_CONTRACT, 2, 500),
      });

    const { rerender } = render(
      <SummonerInfo
        {...defaultProps}
        summonerData={{
          ...mockSummonerData,
          lastUpdated: '2026-04-01T00:00:00.000Z',
          totalMatches: 1,
        }}
        visibleMatches={[makeMatch('EUW1_1', '123')]}
      />
    );

    // 1. Open Player A coach, enqueue prompt, then close before prep finishes -> aborts signal & never calls chatWithAi
    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByTestId('ai-coach-input'), {
      target: { value: 'Should be cancelled on close' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));
    fireEvent.click(screen.getByTestId('ai-coach-close-button'));

    expect(capturedSignalA1?.aborted).toBe(true);
    expect(chatWithAi).not.toHaveBeenCalled();

    // 2. Reopen Player A coach -> starts clean 2nd request
    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(2);

    // 3. Switch to Player B while Player A's 2nd request is still pending
    const playerBData = {
      ...mockSummonerData,
      puuid: '999',
      gameName: 'OtherSummoner',
      tagLine: 'NA1',
      region: 'NA1',
      lastUpdated: '2026-04-01T01:00:00.000Z',
      totalMatches: 1,
    };
    rerender(
      <SummonerInfo
        {...defaultProps}
        summonerData={playerBData}
        visibleMatches={[makeMatch('NA1_901', '999', 'Orianna')]}
      />
    );

    // Modal closes automatically on player switch; now resolve Player A's stale COMPLETE response!
    expect(screen.queryByTestId('ai-coach-modal-dialog')).not.toBeInTheDocument();
    resolveStalePlayerA({
      status: 'COMPLETE',
      region: 'euw1',
      puuid: '123',
      analyzerVersion: 'v2',
      requestedMatchIds: ['EUW1_1'],
      coveredMatchIds: ['EUW1_1'],
      missingMatches: [],
      stopReason: null,
      analysis: makeAnalyzedTimelineDto(BACKEND_18_CONTRACT, 1, 999),
    });

    // Open Player B's AI Coach -> must call prepareCoachTimelines for Player B ('na1', '999') and NOT show Player A's COMPLETE data!
    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(3);
    expect(prepareCoachTimelines).toHaveBeenNthCalledWith(
      3,
      'na1',
      '999',
      expect.objectContaining({ matchIds: ['NA1_901'] })
    );
    await waitFor(() => {
      expect(
        screen.getByText(/minute-by-minute timeline checkpoints are temporarily unavailable/i)
      ).toBeInTheDocument();
    });

    // 4. Refresh Player B profile (new lastUpdated + new match) -> invalidates prior state and prepares fresh timelines on open
    fireEvent.click(screen.getByTestId('ai-coach-close-button'));
    rerender(
      <SummonerInfo
        {...defaultProps}
        summonerData={{
          ...playerBData,
          lastUpdated: '2026-04-01T02:00:00.000Z',
          totalMatches: 2,
        }}
        visibleMatches={[
          makeMatch('NA1_901', '999', 'Orianna'),
          makeMatch('NA1_902', '999', 'Orianna'),
        ]}
      />
    );

    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).toHaveBeenCalledTimes(4);
    expect(prepareCoachTimelines).toHaveBeenNthCalledWith(
      4,
      'na1',
      '999',
      expect.objectContaining({ matchIds: ['NA1_901', 'NA1_902'] })
    );
    await waitFor(() => {
      expect(
        screen.getByText(/10m\/20m timeline checkpoints from 2 recent games are ready/i)
      ).toBeInTheDocument();
    });
  });

  it('skips prepareCoachTimelines for 0-match profiles and synthetic review fixtures', () => {
    Element.prototype.scrollIntoView = vi.fn();

    const { rerender } = render(
      <SummonerInfo
        {...defaultProps}
        summonerData={{
          ...mockSummonerData,
          totalMatches: 0,
          recentMatches: [],
          improvementStats: undefined,
        }}
        visibleMatches={[]}
      />
    );

    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).not.toHaveBeenCalled();
    expect(
      screen.getByText(/No recent matches are loaded yet for this summoner/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-coach-close-button'));

    // Synthetic DEV coach evidence fixture already carries full timeline stats -> must not hit backend
    rerender(
      <SummonerInfo
        {...defaultProps}
        summonerData={{
          ...mockSummonerData,
          puuid: 'fixture-puuid-coach-evidence',
          totalMatches: 4,
          improvementStats: BACKEND_18_CONTRACT,
        }}
        visibleMatches={[makeMatch('EUW1_FIX_1', 'fixture-puuid-coach-evidence')]}
      />
    );
    fireEvent.click(screen.getByText('AI Coach'));
    expect(prepareCoachTimelines).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent coach-open triggers via singleflight and aborts in-flight preparation when refreshing starts', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    let capturedSignal: AbortSignal | undefined;
    (prepareCoachTimelines as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_region: string, _puuid: string, opts?: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal;
        return new Promise(() => {
          // Remains in-flight during singleflight + refresh assertions
        });
      }
    );

    const { rerender } = render(
      <SummonerInfo
        {...defaultProps}
        isStarred={true}
        summonerData={{ ...mockSummonerData, totalMatches: 1 }}
        visibleMatches={[makeMatch('EUW1_990')]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('starred-ai-summary-content')).toHaveTextContent(
        'Strong mid-game objective control on Ahri'
      );
    });

    // Click primary AI Coach button AND starred summary card while preparation is already in-flight
    fireEvent.click(screen.getByText('AI Coach'));
    fireEvent.click(screen.getByTestId('starred-ai-summary-card'));
    fireEvent.click(screen.getByText('AI Coach'));

    expect(prepareCoachTimelines).toHaveBeenCalledTimes(1);
    expect(capturedSignal?.aborted).toBe(false);

    // Starting a profile refresh aborts the active preparation request
    rerender(
      <SummonerInfo
        {...defaultProps}
        isStarred={true}
        refreshing={true}
        summonerData={{ ...mockSummonerData, totalMatches: 1 }}
        visibleMatches={[makeMatch('EUW1_990')]}
      />
    );
    expect(capturedSignal?.aborted).toBe(true);
  });
});

