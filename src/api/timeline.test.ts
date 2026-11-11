import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient';
import {
  DEFAULT_PREPARE_COACH_TIMEOUT_MS,
  MAX_COACH_PREPARATION_MATCH_IDS,
  prepareCoachTimelines,
} from './timeline';
import {
  normalizeCoachTimelinePreparationResultDto,
  type CoachTimelinePreparationResultDto,
  type TimelineAnalysisDto,
} from '../types/timeline';

vi.mock('./apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const makeValidAnalysis = (
  gamesAnalyzed: number,
  coveredIds: string[] = []
): TimelineAnalysisDto => ({
  heatmapPositions: [],
  deathPositions: [],
  wardPositions: [],
  killPositions: [],
  assistPositions: [],
  powerSpikeTimelines: [],
  buildOrders: [],
  skillOrders: [],
  eventTimelines: coveredIds.slice(0, 1).map(matchId => ({
    matchId,
    playerChampion: 'Ahri',
    opponentChampion: 'Syndra',
    win: true,
    events: [
      {
        type: 'KILL',
        minuteMark: 6,
        secondMark: 15,
        actor: 'Ahri',
        target: 'Syndra',
        player: true,
        opponent: false,
        laneType: 'MID_LANE',
        monsterType: null,
        position: { x: 7000, y: 7200 },
      } as unknown as TimelineAnalysisDto['eventTimelines'][number]['events'][number],
    ],
  })),
  aggregateSummary: {
    avgFirstDeathMinute: 0,
    mostDangerousZone: 'None',
    avgGoldLeadAt10: 300,
    avgGoldLeadAt15: 450,
    wardsPlacedTotal: 8,
    deathsTotal: 1,
    killsTotal: 4,
    assistsTotal: 5,
    gamesAnalyzed,
  },
});

describe('prepareCoachTimelines & normalizeCoachTimelinePreparationResultDto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs deduplicated matchIds capped at 20 with AbortSignal and finite timeout, and normalizes valid COMPLETE payload', async () => {
    const controller = new AbortController();
    const rawMatchIds = [
      ' EUW1_1 ',
      'EUW1_1',
      '',
      '   ',
      ...Array.from({ length: 25 }, (_, idx) => `EUW1_${idx + 2}`),
    ];
    const expected20Ids = Array.from({ length: 20 }, (_, idx) => `EUW1_${idx + 1}`);

    (apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        status: 'COMPLETE',
        region: 'EUW1',
        puuid: 'puuid/abc',
        analyzerVersion: 'v2',
        requestedMatchIds: expected20Ids,
        coveredMatchIds: expected20Ids,
        missingMatches: [],
        stopReason: null,
        analysis: makeValidAnalysis(20, expected20Ids),
      },
    });

    const result = await prepareCoachTimelines(' EUW1 ', ' puuid/abc ', {
      matchIds: rawMatchIds,
      signal: controller.signal,
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = (apiClient.post as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/riot/timeline/prepare-coach/euw1/puuid%2Fabc');
    expect(body.matchIds).toEqual(expected20Ids);
    expect(body.matchIds).toHaveLength(MAX_COACH_PREPARATION_MATCH_IDS);
    expect(config).toEqual({
      signal: controller.signal,
      timeout: DEFAULT_PREPARE_COACH_TIMEOUT_MS,
    });

    expect(result.status).toBe('COMPLETE');
    expect(result.region).toBe('euw1');
    expect(result.puuid).toBe('puuid/abc');
    expect(result.requestedMatchIds).toEqual(expected20Ids);
    expect(result.coveredMatchIds).toEqual(expected20Ids);
    expect(result.missingMatches).toEqual([]);
    expect(result.analysis?.eventTimelines[0].events[0].isPlayer).toBe(true);
    expect(result.analysis?.eventTimelines[0].events[0].isOpponent).toBe(false);
  });

  it('preserves honest PARTIAL and missingMatches denominators for subset coverage, deadline partial, and 0-covered BLOCKED payloads', async () => {
    (apiClient.post as unknown as ReturnType<typeof vi.fn>)
      // 1. Server profile slice only knew 1 of the 3 client-requested matches and returned COMPLETE for its 1-match slice -> downgraded to honest PARTIAL (1/3)
      .mockResolvedValueOnce({
        data: {
          status: 'COMPLETE',
          region: 'na1',
          puuid: 'p1',
          analyzerVersion: 'v2',
          requestedMatchIds: ['NA1_1'],
          coveredMatchIds: ['NA1_1'],
          missingMatches: [],
          stopReason: null,
          analysis: makeValidAnalysis(1, ['NA1_1']),
        },
      })
      // 2. Empty body (matchIds omitted), server stopped at deadline with PARTIAL (1/2)
      .mockResolvedValueOnce({
        data: {
          status: 'PARTIAL',
          region: 'na1',
          puuid: 'p1',
          analyzerVersion: 'v2',
          requestedMatchIds: ['NA1_1', 'NA1_2'],
          coveredMatchIds: ['NA1_1'],
          missingMatches: [{ matchId: 'NA1_2', reason: 'DEADLINE_EXCEEDED' }],
          stopReason: 'DEADLINE_EXCEEDED',
          analysis: makeValidAnalysis(1, ['NA1_1']),
        },
      })
      // 3. PARTIAL with 0 covered matches -> downgraded to BLOCKED with null analysis
      .mockResolvedValueOnce({
        data: {
          status: 'PARTIAL',
          region: 'na1',
          puuid: 'p1',
          analyzerVersion: 'v2',
          requestedMatchIds: ['NA1_1'],
          coveredMatchIds: [],
          missingMatches: [{ matchId: 'NA1_1', reason: 'RIOT_RATE_LIMITED' }],
          stopReason: 'RIOT_RATE_LIMITED',
          analysis: null,
        },
      });

    const subsetPartial = await prepareCoachTimelines('NA1', 'p1', {
      matchIds: ['NA1_1', 'NA1_2', 'NA1_3'],
      timeoutMs: 5000,
    });
    expect(subsetPartial.status).toBe('PARTIAL');
    expect(subsetPartial.requestedMatchIds).toEqual(['NA1_1', 'NA1_2', 'NA1_3']);
    expect(subsetPartial.coveredMatchIds).toEqual(['NA1_1']);
    expect(subsetPartial.missingMatches).toEqual([
      { matchId: 'NA1_2', reason: 'NOT_IN_SERVER_PROFILE' },
      { matchId: 'NA1_3', reason: 'NOT_IN_SERVER_PROFILE' },
    ]);
    expect(subsetPartial.stopReason).toBe('PARTIAL_PROFILE_MATCH_COVERAGE');

    const deadlinePartial = await prepareCoachTimelines('NA1', 'p1', { timeoutMs: 5000 });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      '/riot/timeline/prepare-coach/na1/p1',
      {},
      { signal: undefined, timeout: 5000 }
    );
    expect(deadlinePartial.status).toBe('PARTIAL');
    expect(deadlinePartial.requestedMatchIds).toEqual(['NA1_1', 'NA1_2']);
    expect(deadlinePartial.coveredMatchIds).toEqual(['NA1_1']);
    expect(deadlinePartial.missingMatches).toEqual([
      { matchId: 'NA1_2', reason: 'DEADLINE_EXCEEDED' },
    ]);
    expect(deadlinePartial.stopReason).toBe('DEADLINE_EXCEEDED');

    const blocked = await prepareCoachTimelines('NA1', 'p1');
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.coveredMatchIds).toEqual([]);
    expect(blocked.analysis).toBeNull();
    expect(blocked.stopReason).toBe('RIOT_RATE_LIMITED');
  });

  it('fails closed to BLOCKED (analysis: null, coveredMatchIds: []) on identity mismatch, unknown status, non-subset IDs, or gamesAnalyzed mismatch', () => {
    const baseValid: CoachTimelinePreparationResultDto = {
      status: 'COMPLETE',
      region: 'euw1',
      puuid: 'puuid-expected',
      analyzerVersion: 'v2',
      requestedMatchIds: ['EUW1_1', 'EUW1_2'],
      coveredMatchIds: ['EUW1_1', 'EUW1_2'],
      missingMatches: [],
      stopReason: null,
      analysis: makeValidAnalysis(2, ['EUW1_1', 'EUW1_2']),
    };

    // 1. PUUID mismatch
    const wrongPuuid = normalizeCoachTimelinePreparationResultDto(
      { ...baseValid, puuid: 'puuid-other-player' },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(wrongPuuid.status).toBe('BLOCKED');
    expect(wrongPuuid.stopReason).toBe('IDENTITY_MISMATCH');
    expect(wrongPuuid.analysis).toBeNull();
    expect(wrongPuuid.coveredMatchIds).toEqual([]);

    // 2. Region mismatch
    const wrongRegion = normalizeCoachTimelinePreparationResultDto(
      { ...baseValid, region: 'kr' },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(wrongRegion.status).toBe('BLOCKED');
    expect(wrongRegion.stopReason).toBe('IDENTITY_MISMATCH');
    expect(wrongRegion.analysis).toBeNull();

    // 3. Unknown or missing status even when analysis object is present -> MUST NOT guess COMPLETE
    for (const badStatus of ['OK', 'READY', 'SUCCESS', '', undefined, 200]) {
      const unknownStatus = normalizeCoachTimelinePreparationResultDto(
        {
          ...baseValid,
          status: badStatus as unknown as CoachTimelinePreparationResultDto['status'],
        },
        'euw1',
        'puuid-expected',
        ['EUW1_1', 'EUW1_2']
      );
      expect(unknownStatus.status).toBe('BLOCKED');
      expect(unknownStatus.stopReason).toBe('INVALID_STATUS');
      expect(unknownStatus.analysis).toBeNull();
      expect(unknownStatus.coveredMatchIds).toEqual([]);
    }

    // 4. coveredMatchIds not a subset of requestedMatchIds
    const nonSubsetCovered = normalizeCoachTimelinePreparationResultDto(
      {
        ...baseValid,
        status: 'PARTIAL',
        coveredMatchIds: ['EUW1_999'],
        analysis: makeValidAnalysis(1, ['EUW1_999']),
      },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(nonSubsetCovered.status).toBe('BLOCKED');
    expect(nonSubsetCovered.stopReason).toBe('INCONSISTENT_COVERAGE');
    expect(nonSubsetCovered.analysis).toBeNull();

    // 5. Server requestedMatchIds contains stale/foreign IDs outside client-requested matchIds
    const foreignRequested = normalizeCoachTimelinePreparationResultDto(
      {
        ...baseValid,
        requestedMatchIds: ['EUW1_STALE_OLD'],
        coveredMatchIds: ['EUW1_STALE_OLD'],
        analysis: makeValidAnalysis(1, ['EUW1_STALE_OLD']),
      },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(foreignRequested.status).toBe('BLOCKED');
    expect(foreignRequested.stopReason).toBe('INCONSISTENT_COVERAGE');
    expect(foreignRequested.analysis).toBeNull();

    // 6. Contradictory COMPLETE when coveredMatchIds < serverRequestedIds or missingMatches is non-empty
    const contradictoryComplete = normalizeCoachTimelinePreparationResultDto(
      {
        ...baseValid,
        status: 'COMPLETE',
        coveredMatchIds: ['EUW1_1'],
        missingMatches: [{ matchId: 'EUW1_2', reason: 'RIOT_BUDGET_EXHAUSTED' }],
        analysis: makeValidAnalysis(1, ['EUW1_1']),
      },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(contradictoryComplete.status).toBe('BLOCKED');
    expect(contradictoryComplete.stopReason).toBe('INCONSISTENT_COVERAGE');
    expect(contradictoryComplete.analysis).toBeNull();

    // 7. aggregateSummary.gamesAnalyzed !== coveredMatchIds.length
    const mismatchedGamesCount = normalizeCoachTimelinePreparationResultDto(
      {
        ...baseValid,
        analysis: makeValidAnalysis(1, ['EUW1_1', 'EUW1_2']), // 1 !== 2 covered IDs
      },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(mismatchedGamesCount.status).toBe('BLOCKED');
    expect(mismatchedGamesCount.stopReason).toBe('INCONSISTENT_COVERAGE');
    expect(mismatchedGamesCount.analysis).toBeNull();

    // 8. Per-match sub-array contains matchId outside coveredMatchIds
    const foreignEventTimeline = normalizeCoachTimelinePreparationResultDto(
      {
        ...baseValid,
        status: 'PARTIAL',
        coveredMatchIds: ['EUW1_1'],
        missingMatches: [{ matchId: 'EUW1_2', reason: 'TIMELINE_NOT_FOUND' }],
        analysis: makeValidAnalysis(1, ['EUW1_2']), // eventTimeline references EUW1_2 instead of EUW1_1
      },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(foreignEventTimeline.status).toBe('BLOCKED');
    expect(foreignEventTimeline.stopReason).toBe('INCONSISTENT_COVERAGE');
    expect(foreignEventTimeline.analysis).toBeNull();

    // 9. Idempotency: normalizing an already-normalized valid PARTIAL result preserves exact fields
    const validPartial = normalizeCoachTimelinePreparationResultDto(
      {
        ...baseValid,
        status: 'PARTIAL',
        coveredMatchIds: ['EUW1_1'],
        missingMatches: [{ matchId: 'EUW1_2', reason: 'DEADLINE_EXCEEDED' }],
        stopReason: 'DEADLINE_EXCEEDED',
        analysis: makeValidAnalysis(1, ['EUW1_1']),
      },
      'euw1',
      'puuid-expected',
      ['EUW1_1', 'EUW1_2']
    );
    expect(validPartial.status).toBe('PARTIAL');
    expect(
      normalizeCoachTimelinePreparationResultDto(
        validPartial,
        'euw1',
        'puuid-expected',
        ['EUW1_1', 'EUW1_2']
      )
    ).toEqual(validPartial);
  });
});
