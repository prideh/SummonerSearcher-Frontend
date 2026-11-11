import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import SummonerInfo from '../components/SummonerInfo';
import { useDataDragonStore } from '../store/dataDragonStore';
import { useAuthStore } from '../store/authStore';
import { useErrorStore } from '../store/errorStore';
import type { ImprovementStatsDto } from '../types/improvementStats';
import type { MatchDto } from '../types/match';
import type { SummonerData } from '../types/summoner';
import backend18ContractJson from '../test/fixtures/improvement-stats-contract.json';

// Only mock non-timeline presentational leaf helpers; SummonerInfo, AiAnalysisModal,
// ImprovementStatsSection, apiClient, prepareCoachTimelines, normalizeCoachTimelinePreparationResultDto,
// resolveImprovementStats, buildAiContext, and chatWithAi execute unmocked over real HTTP.
vi.mock('../components/RankedInfo', () => ({
  default: () => <div data-testid="ranked-info">Ranked Info</div>,
}));

vi.mock('../hooks/useTimeAgo', () => ({
  useTimeAgo: () => ['just now', { current: null }],
}));

const envRecord = import.meta.env as Record<string, string | undefined>;
const BASE_URL = (envRecord.VITE_COACH_HTTP_INTEGRATION_BASE_URL || '').trim();
const describeHttp = BASE_URL ? describe : describe.skip;

interface HarnessPrepareCall {
  method: string;
  uri: string;
  region: string;
  puuid: string;
  requestedMatchIds: string[];
  status: number;
  origin: string | null;
}

interface HarnessRiotFetch {
  matchId: string;
  region: string;
}

interface HarnessChatCapture {
  userMessage: string;
  sessionId: string | null;
  summonerName: string | null;
  timelineStatus: string | null;
  timelineCoverage: {
    status?: string;
    covered?: number;
    requested?: number;
    missing?: number;
    stopReason?: string | null;
  } | null;
  gamesAnalyzed: number | null;
  hasTimelineAnalysis: boolean | null;
  context: Record<string, unknown>;
  constructedPrompt: string;
}

interface HarnessStateResponse {
  prepareHttpCalls: HarnessPrepareCall[];
  riotTimelineFetches: HarnessRiotFetch[];
  chatCaptures: HarnessChatCapture[];
  redisKeysCount: number;
  refreshProfileAdvanced: boolean;
}

const makePreTimelineStats = (totalGames: number): ImprovementStatsDto => {
  const cloned = JSON.parse(JSON.stringify(backend18ContractJson)) as ImprovementStatsDto;
  return {
    ...cloned,
    totalGamesConsidered: totalGames,
    excludedMissingTimelineGames: totalGames,
    phaseFarming: {
      ...cloned.phaseFarming,
      excludedMissingTimelineGames: totalGames,
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
      excludedMissingTimelineGames: totalGames,
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
        excludedMissingTimelineGames: totalGames,
        totalRecordedDeaths: null,
        totalBaseKillBountyGold: null,
        totalShutdownBountyGold: null,
        totalCombinedBountyGold: null,
      },
    },
    unspentGold: {
      ...cloned.unspentGold,
      eligibleGames: 0,
      excludedMissingTimelineGames: totalGames,
      sampleCount: 0,
      medianCurrentGold: null,
      maxCurrentGold: null,
      avgCurrentGold: null,
      highBalanceSampleCount: null,
      highBalanceBeforePurchaseSampleCount: null,
    },
  };
};

const makeFrontendMatchDto = (matchId: string, puuid: string, win = true): MatchDto => ({
  metadata: {
    matchId,
    participants: [puuid, 'puuid-opp-top'],
  },
  info: {
    gameId: 1001,
    gameCreation: 1_760_000_000_000,
    gameEndTimestamp: 1_760_001_800_000,
    gameDuration: 1800,
    gameMode: 'CLASSIC',
    gameVersion: '26.1.1',
    queueId: 420,
    teams: [
      {
        teamId: 100,
        win,
        bans: [],
        objectives: {
          baron: { first: false, kills: 1 },
          champion: { first: true, kills: 22 },
          dragon: { first: true, kills: 3 },
          horde: { first: true, kills: 4 },
          inhibitor: { first: true, kills: 1 },
          riftHerald: { first: true, kills: 1 },
          tower: { first: true, kills: 8 },
        },
      },
      {
        teamId: 200,
        win: !win,
        bans: [],
        objectives: {
          baron: { first: false, kills: 0 },
          champion: { first: false, kills: 15 },
          dragon: { first: false, kills: 1 },
          horde: { first: false, kills: 2 },
          inhibitor: { first: false, kills: 0 },
          riftHerald: { first: false, kills: 0 },
          tower: { first: false, kills: 3 },
        },
      },
    ],
    participants: [
      {
        puuid,
        participantId: 1,
        teamId: 100,
        teamPosition: 'TOP',
        individualPosition: 'TOP',
        championName: 'Pantheon',
        win,
        kills: 8,
        deaths: 2,
        assists: 7,
        totalMinionsKilled: 190,
        neutralMinionsKilled: 12,
        visionScore: 28,
        goldEarned: 13500,
        totalDamageDealtToChampions: 26000,
        totalTimeSpentDead: 42,
        turretKills: 2,
        turretTakedowns: 3,
        dragonKills: 0,
        baronKills: 0,
        challenges: {
          turretPlatesTaken: 6,
          dragonTakedowns: 2,
          voidMonsterKill: 3,
          laneMinionsFirst10Minutes: 78,
        },
      },
      {
        puuid: 'puuid-opp-top',
        participantId: 6,
        teamId: 200,
        teamPosition: 'TOP',
        individualPosition: 'TOP',
        championName: 'Aatrox',
        win: !win,
        kills: 3,
        deaths: 5,
        assists: 4,
        totalMinionsKilled: 165,
        neutralMinionsKilled: 4,
        visionScore: 19,
        goldEarned: 11200,
        totalDamageDealtToChampions: 21000,
        totalTimeSpentDead: 68,
      },
    ],
  },
});

const makeSummonerData = (params: {
  puuid: string;
  region: string;
  gameName: string;
  tagLine: string;
  matchIds: string[];
  lastUpdated?: string;
}): SummonerData => {
  const matches = params.matchIds.map((id, idx) =>
    makeFrontendMatchDto(id, params.puuid, idx % 2 === 0)
  );
  const wins = params.matchIds.filter((_, idx) => idx % 2 === 0).length;
  const losses = params.matchIds.length - wins;
  const winRate = params.matchIds.length > 0 ? Math.round((wins / params.matchIds.length) * 100) : 0;

  return {
    id: `id-${params.puuid}`,
    puuid: params.puuid,
    gameName: params.gameName,
    tagLine: params.tagLine,
    summonerLevel: 420,
    profileIconId: 29,
    lastUpdated: params.lastUpdated ?? '2026-11-11T10:00:00.000Z',
    region: params.region,
    recentMatches: matches,
    championStats: [
      {
        championName: 'Pantheon',
        games: matches.length,
        wins,
        losses,
        kills: 8 * matches.length,
        deaths: 2 * matches.length,
        assists: 7 * matches.length,
        soloKills: matches.length,
        winRate,
        kda: 7.5,
        averageKills: 8,
        averageDeaths: 2,
        averageAssists: 7,
        averageCsPerMinute: 6.7,
        averageSoloKills: 1,
        averageTurretPlates: 6,
      },
    ],
    overallStats: {
      winRate,
      kda: 7.5,
      wins,
      losses,
      avgCsPerMinute: 6.7,
      avgKillParticipation: 68,
      avgSoloKills: 1,
      avgTurretPlates: 6,
      avgKills: 8,
      avgDeaths: 2,
      avgAssists: 7,
      oppAvgKda: 1.4,
      oppAvgCsPerMinute: 5.6,
      oppAvgKillParticipation: 46,
      oppAvgSoloKills: 0,
      oppAvgTurretPlates: 2,
      avgVisionScore: 28,
      oppAvgVisionScore: 19,
      blueSide: { games: matches.length, wins, winRate },
      redSide: { games: 0, wins: 0, winRate: 0 },
    },
    totalMatches: matches.length,
    improvementStats: makePreTimelineStats(matches.length),
    soloQueueRank: {
      leagueId: 'league-1',
      queueType: 'RANKED_SOLO_5x5',
      tier: 'DIAMOND',
      rank: 'II',
      leaguePoints: 64,
      wins: 48,
      losses: 36,
    },
  };
};

const harnessPost = async (path: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/api/ai/__test_harness${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Harness POST ${path} failed with HTTP ${res.status}`);
  }
};

const harnessGetState = async (): Promise<HarnessStateResponse> => {
  const res = await fetch(`${BASE_URL}/api/ai/__test_harness/state`);
  if (!res.ok) {
    throw new Error(`Harness GET /state failed with HTTP ${res.status}`);
  }
  return (await res.json()) as HarnessStateResponse;
};

describeHttp('Real-HTTP FE18 <-> BE55 Coach Timeline Preparation & Context Integration', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(async () => {
    localStorage.clear();
    useAuthStore.setState({ token: null, username: null, starredProfile: null });
    useErrorStore.setState({ showRateLimitError: false });
    useDataDragonStore.setState({ cdnUrl: 'https://ddragon.leagueoflegends.com/cdn/16.1.1' });
    await harnessPost('/reset');
  });

  it('proves zero mount prefetch, single prepare POST on coach open, finite first-prompt await, COMPLETE 3/3 evidence, and Jackson player->isPlayer deathContext round-trip', async () => {
    const summoner = makeSummonerData({
      puuid: 'puuid-complete',
      region: 'EUW1',
      gameName: 'SpearShot',
      tagLine: 'EUW1',
      matchIds: ['EUW1_C1', 'EUW1_C2', 'EUW1_C3'],
    });

    render(
      <SummonerInfo
        summonerData={summoner}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={summoner.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    // 1. Mounting profile must NOT prefetch coach timelines
    await new Promise(r => setTimeout(r, 75));
    const afterMount = await harnessGetState();
    expect(afterMount.prepareHttpCalls).toHaveLength(0);

    // 2. Open AI Coach and immediately submit first manual prompt while BE55's 80ms timeline prep is in flight
    fireEvent.click(screen.getByRole('button', { name: /AI Coach/i }));
    fireEvent.click(screen.getByTestId('ai-coach-evidence-toggle'));

    const input = screen.getByTestId('ai-coach-input');
    fireEvent.change(input, {
      target: { value: 'How was my early laning and death timing?' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(
      () => {
        expect(
          screen.getByText(/Verified offline coach reply \[timelineStatus=ANALYZED\]/i)
        ).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    expect(
      screen.getByText(/Observed: 3 matches · 10m\/20m timelines loaded$/i)
    ).toBeInTheDocument();

    const state = await harnessGetState();
    expect(state.prepareHttpCalls).toHaveLength(1);
    expect(state.prepareHttpCalls[0]).toMatchObject({
      method: 'POST',
      region: 'euw1',
      puuid: 'puuid-complete',
      requestedMatchIds: ['EUW1_C1', 'EUW1_C2', 'EUW1_C3'],
      status: 200,
    });

    expect(state.chatCaptures).toHaveLength(1);
    const chat = state.chatCaptures[0];
    expect(chat.timelineStatus).toBe('ANALYZED');
    expect(chat.gamesAnalyzed).toBe(3);
    expect(chat.hasTimelineAnalysis).toBe(true);
    expect(chat.timelineCoverage).toMatchObject({
      status: 'COMPLETE',
      covered: 3,
      requested: 3,
    });

    // Verify per-match timelineAt10 and Jackson "player":true -> isPlayer:true deathContext round-tripped into BE55
    const recentSummary = chat.context.recentMatches as Array<Record<string, unknown>>;
    expect(recentSummary).toHaveLength(3);
    expect(recentSummary[0].timelineAt10).toBeTruthy();
    expect(recentSummary[0].deathContext).toMatchObject({
      totalDeaths: 1,
      deathsBefore10: 1,
      unassistedDeaths: 0,
      assistedDeaths: 1,
      firstDeathMinute: 8.3,
      earlyDeaths: [
        expect.objectContaining({
          time: '08:18',
          minute: 8.3,
          killer: 'Aatrox',
          assistants: ['Champ7'],
          assisted: true,
          approxZone: 'Top River',
        }),
      ],
    });

    expect(chat.constructedPrompt).toContain('Timeline (timeline analyzed)');
    expect(chat.constructedPrompt).toContain('Timeline coverage: status=complete, covered=3/3 games');
    expect(chat.constructedPrompt).toContain('TIMELINE ANALYSIS (last 3 ranked games)');
  });

  it('proves natural PARTIAL (2/3 DEADLINE_EXCEEDED from real TimelineService) flows truthfully into FE18 UI and BE55 prompt construction', async () => {
    const summoner = makeSummonerData({
      puuid: 'puuid-partial',
      region: 'EUW1',
      gameName: 'PartialTop',
      tagLine: 'EUW1',
      matchIds: ['EUW1_P1', 'EUW1_P2', 'EUW1_P3'],
    });

    render(
      <SummonerInfo
        summonerData={summoner}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={summoner.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /AI Coach/i }));
    fireEvent.click(screen.getByTestId('ai-coach-evidence-toggle'));

    const input = screen.getByTestId('ai-coach-input');
    fireEvent.change(input, {
      target: { value: 'Summarize my lane leads across covered games' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(
      () => {
        expect(
          screen.getByText(/Verified offline coach reply \[timelineStatus=PARTIAL\]/i)
        ).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    expect(
      screen.getByText(/Observed: 3 matches · 10m\/20m timelines loaded \(2\/3G partial\)/i)
    ).toBeInTheDocument();

    const state = await harnessGetState();
    expect(state.prepareHttpCalls).toHaveLength(1);
    expect(state.riotTimelineFetches.map(f => f.matchId)).toEqual(['EUW1_P1', 'EUW1_P2']);

    expect(state.chatCaptures).toHaveLength(1);
    const chat = state.chatCaptures[0];
    expect(chat.timelineStatus).toBe('PARTIAL');
    expect(chat.gamesAnalyzed).toBe(2);
    expect(chat.hasTimelineAnalysis).toBe(true);
    expect(chat.timelineCoverage).toMatchObject({
      status: 'PARTIAL',
      covered: 2,
      requested: 3,
      stopReason: 'DEADLINE_EXCEEDED',
    });

    const recentSummary = chat.context.recentMatches as Array<Record<string, unknown>>;
    expect(recentSummary).toHaveLength(3);
    expect(recentSummary[0].timelineAt10).toBeTruthy();
    expect(recentSummary[1].timelineAt10).toBeTruthy();
    expect(recentSummary[2].timelineAt10).toBeUndefined();

    expect(chat.constructedPrompt).toContain('Timeline (partial timeline analyzed)');
    expect(chat.constructedPrompt).toContain(
      'Timeline coverage: status=partial, covered=2/3 games, stop reason=deadline exceeded'
    );
  });

  it('proves BLOCKED (0/2 RATE_LIMIT_429) settles with zero retry loops and delivers truthful 0/2 blocked boundary into BE55', async () => {
    const summoner = makeSummonerData({
      puuid: 'puuid-blocked',
      region: 'EUW1',
      gameName: 'BlockedTop',
      tagLine: 'EUW1',
      matchIds: ['EUW1_B1', 'EUW1_B2'],
    });

    render(
      <SummonerInfo
        summonerData={summoner}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={summoner.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /AI Coach/i }));
    fireEvent.click(screen.getByTestId('ai-coach-evidence-toggle'));

    const input = screen.getByTestId('ai-coach-input');
    fireEvent.change(input, {
      target: { value: 'What can you tell from match summaries?' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(
      () => {
        expect(
          screen.getByText(/Verified offline coach reply \[timelineStatus=BLOCKED\]/i)
        ).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    expect(
      screen.getByText(/Observed: 2 matches · Match summaries only \(timeline unavailable\)/i)
    ).toBeInTheDocument();

    // Confirm zero background retry loop after settling
    await new Promise(r => setTimeout(r, 150));
    const state = await harnessGetState();
    expect(state.prepareHttpCalls).toHaveLength(1);
    expect(state.riotTimelineFetches.map(f => f.matchId)).toEqual(['EUW1_B1']);

    expect(state.chatCaptures).toHaveLength(1);
    const chat = state.chatCaptures[0];
    expect(chat.timelineStatus).toBe('BLOCKED');
    expect(chat.gamesAnalyzed).toBeNull();
    expect(chat.hasTimelineAnalysis).toBe(false);
    expect(chat.timelineCoverage).toMatchObject({
      status: 'BLOCKED',
      covered: 0,
      requested: 2,
      stopReason: 'RATE_LIMIT_429',
    });
    expect(chat.constructedPrompt).toContain('Timeline (timeline temporarily unavailable)');
    expect(chat.constructedPrompt).toContain(
      'Timeline coverage: status=blocked, covered=0/2 games, stop reason=rate limit 429'
    );
  });

  it('proves player switch cancels/ignores stale Player A HTTP preparation and never pollutes Player B chat context', async () => {
    const playerA = makeSummonerData({
      puuid: 'puuid-stale-a',
      region: 'EUW1',
      gameName: 'StalePlayerA',
      tagLine: 'EUW1',
      matchIds: ['EUW1_SA1', 'EUW1_SA2'],
    });
    const playerB = makeSummonerData({
      puuid: 'puuid-fresh-b',
      region: 'NA1',
      gameName: 'FreshPlayerB',
      tagLine: 'NA1',
      matchIds: ['NA1_FB1', 'NA1_FB2'],
    });

    const { rerender } = render(
      <SummonerInfo
        summonerData={playerA}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={playerA.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    // Trigger in-flight slow (260ms) HTTP preparation for Player A
    fireEvent.click(screen.getByRole('button', { name: /AI Coach/i }));
    await act(async () => {
      await new Promise(r => setTimeout(r, 30));
    });

    // Switch profile to Player B while Player A's HTTP POST is still in flight
    rerender(
      <SummonerInfo
        summonerData={playerB}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={playerB.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    expect(screen.queryByTestId('ai-coach-modal-dialog')).not.toBeInTheDocument();

    // Allow enough wall-clock time for any server-side work from Player A to settle
    await act(async () => {
      await new Promise(r => setTimeout(r, 320));
    });

    // Open AI Coach for Player B and send first prompt
    fireEvent.click(screen.getByRole('button', { name: /AI Coach/i }));
    const input = screen.getByTestId('ai-coach-input');
    fireEvent.change(input, { target: { value: 'Check my NA1 top games' } });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(
      () => {
        expect(
          screen.getByText(
            /Verified offline coach reply \[timelineStatus=ANALYZED\] for FreshPlayerB#NA1/i
          )
        ).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    const state = await harnessGetState();
    expect(state.chatCaptures).toHaveLength(1);
    const chat = state.chatCaptures[0];
    expect(chat.summonerName).toBe('FreshPlayerB#NA1');
    expect(chat.timelineStatus).toBe('ANALYZED');
    expect(chat.gamesAnalyzed).toBe(2);
    expect(chat.timelineCoverage).toMatchObject({
      status: 'COMPLETE',
      covered: 2,
      requested: 2,
    });
    expect(JSON.stringify(chat.context)).not.toContain('EUW1_SA');
    expect(JSON.stringify(chat.context)).not.toContain('StalePlayerA');
  });

  it('proves open-drawer profile refresh resets stale timeline state, re-prepares bounded once, and awaits fresh 2/2 evidence on first post-refresh prompt', async () => {
    const initialSummoner = makeSummonerData({
      puuid: 'puuid-refresh',
      region: 'EUW1',
      gameName: 'RefreshTop',
      tagLine: 'EUW1',
      matchIds: ['EUW1_R1'],
      lastUpdated: '2026-11-11T10:00:00.000Z',
    });

    const { rerender } = render(
      <SummonerInfo
        summonerData={initialSummoner}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={initialSummoner.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /AI Coach/i }));
    fireEvent.click(screen.getByTestId('ai-coach-evidence-toggle'));

    await waitFor(
      () => {
        expect(
          screen.getByText(/Observed: 1 matches · 10m\/20m timelines loaded$/i)
        ).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    // Advance backend cached profile to 2 games (EUW1_R2 + EUW1_R1) and start frontend refresh while modal stays open
    await harnessPost('/advance-refresh-profile');
    rerender(
      <SummonerInfo
        summonerData={initialSummoner}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={true}
        visibleMatches={initialSummoner.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    expect(
      screen.getByText(/Match summaries only \(timeline not run\)/i)
    ).toBeInTheDocument();

    const refreshedSummoner = makeSummonerData({
      puuid: 'puuid-refresh',
      region: 'EUW1',
      gameName: 'RefreshTop',
      tagLine: 'EUW1',
      matchIds: ['EUW1_R2', 'EUW1_R1'],
      lastUpdated: '2026-11-11T10:05:00.000Z',
    });

    rerender(
      <SummonerInfo
        summonerData={refreshedSummoner}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={refreshedSummoner.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
      />
    );

    // Immediately submit first post-refresh prompt while EUW1_R2's 90ms timeline prep is in flight
    const input = screen.getByTestId('ai-coach-input');
    fireEvent.change(input, { target: { value: 'Check my refreshed 2-game set' } });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(
      () => {
        expect(
          screen.getByText(/Verified offline coach reply \[timelineStatus=ANALYZED\]/i)
        ).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    expect(
      screen.getByText(/Observed: 2 matches · 10m\/20m timelines loaded$/i)
    ).toBeInTheDocument();

    const state = await harnessGetState();
    expect(state.prepareHttpCalls).toHaveLength(2);
    expect(state.prepareHttpCalls[0].requestedMatchIds).toEqual(['EUW1_R1']);
    expect(state.prepareHttpCalls[1].requestedMatchIds).toEqual(['EUW1_R2', 'EUW1_R1']);

    expect(state.chatCaptures).toHaveLength(1);
    const chat = state.chatCaptures[0];
    expect(chat.timelineStatus).toBe('ANALYZED');
    expect(chat.gamesAnalyzed).toBe(2);
    expect(chat.timelineCoverage).toMatchObject({
      status: 'COMPLETE',
      covered: 2,
      requested: 2,
    });
    expect(chat.constructedPrompt).toContain('Timeline coverage: status=complete, covered=2/2 games');
  });

  it('proves starred summary suggestion pill entrypoint deduplicates prepare to 1 POST and awaits COMPLETE evidence before auto-sending initialMessage', async () => {
    const summoner = makeSummonerData({
      puuid: 'puuid-complete',
      region: 'EUW1',
      gameName: 'SpearShot',
      tagLine: 'EUW1',
      matchIds: ['EUW1_C1', 'EUW1_C2', 'EUW1_C3'],
    });

    // Seed recent summary history so starred card renders suggestion pills without extra mount chat
    localStorage.setItem(
      'chat_history_SpearShot#EUW1',
      JSON.stringify({
        timestamp: Date.now(),
        messages: [
          { role: 'model', content: "Hi! I'm your AI Coach." },
          {
            role: 'user',
            content:
              'Give me a concise 2-3 sentence executive summary of my recent performance, key strength, and #1 focus area.',
          },
          {
            role: 'model',
            content: 'Strong Pantheon top pressure; watch early river gank timings.',
            interactionId: 'seeded-summary-1',
            timestamp: Date.now(),
          },
        ],
        suggestions: ['Audit my 8m river death'],
      })
    );

    render(
      <SummonerInfo
        summonerData={summoner}
        handleRefresh={vi.fn()}
        loading={false}
        refreshing={false}
        visibleMatches={summoner.recentMatches}
        onPlayerClick={vi.fn()}
        onViewProfile={vi.fn()}
        showFullProfile={false}
        isStarred={true}
      />
    );

    // Starred mount must still NOT prefetch timelines
    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });
    expect((await harnessGetState()).prepareHttpCalls).toHaveLength(0);

    // Rapidly double-click starred suggestion pill to exercise singleflight deduplication + initialMessage auto-send
    const pillBtn = await screen.findByRole('button', { name: 'Audit my 8m river death' });
    fireEvent.click(pillBtn);
    fireEvent.click(pillBtn);

    await waitFor(
      () => {
        expect(
          screen.getByText(/Verified offline coach reply \[timelineStatus=ANALYZED\]/i)
        ).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    const state = await harnessGetState();
    expect(state.prepareHttpCalls).toHaveLength(1);
    expect(state.chatCaptures).toHaveLength(1);
    expect(state.chatCaptures[0].userMessage).toBe('Audit my 8m river death');
    expect(state.chatCaptures[0].timelineStatus).toBe('ANALYZED');
    expect(state.chatCaptures[0].gamesAnalyzed).toBe(3);
  });
});
