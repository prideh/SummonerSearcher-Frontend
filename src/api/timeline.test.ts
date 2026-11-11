import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient';
import {
  DEFAULT_PREPARE_COACH_TIMEOUT_MS,
  MAX_COACH_PREPARATION_MATCH_IDS,
  prepareCoachTimelines,
} from './timeline';

vi.mock('./apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('prepareCoachTimelines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs deduplicated matchIds capped at 20 with AbortSignal and finite timeout, and normalizes COMPLETE payload', async () => {
    const controller = new AbortController();
    const rawMatchIds = [
      ' EUW1_1 ',
      'EUW1_1',
      '',
      '   ',
      ...Array.from({ length: 25 }, (_, idx) => `EUW1_${idx + 2}`),
    ];

    (apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        status: 'COMPLETE',
        region: 'euw1',
        puuid: 'puuid-abc',
        analyzerVersion: 'v2',
        requestedMatchIds: ['EUW1_1', 'EUW1_2'],
        coveredMatchIds: ['EUW1_1', 'EUW1_2'],
        missingMatches: [],
        stopReason: null,
        analysis: {
          heatmapPositions: [],
          deathPositions: [],
          wardPositions: [],
          killPositions: [],
          assistPositions: [],
          powerSpikeTimelines: [],
          buildOrders: [],
          skillOrders: [],
          eventTimelines: [
            {
              matchId: 'EUW1_1',
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
                },
              ],
            },
          ],
          aggregateSummary: {
            avgFirstDeathMinute: 0,
            mostDangerousZone: 'None',
            avgGoldLeadAt10: 300,
            avgGoldLeadAt15: 450,
            wardsPlacedTotal: 8,
            deathsTotal: 1,
            killsTotal: 4,
            assistsTotal: 5,
            gamesAnalyzed: 2,
          },
        },
      },
    });

    const result = await prepareCoachTimelines(' EUW1 ', ' puuid/abc ', {
      matchIds: rawMatchIds,
      signal: controller.signal,
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = (apiClient.post as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/riot/timeline/prepare-coach/euw1/puuid%2Fabc');
    expect(body.matchIds).toHaveLength(MAX_COACH_PREPARATION_MATCH_IDS);
    expect(body.matchIds[0]).toBe('EUW1_1');
    expect(body.matchIds[1]).toBe('EUW1_2');
    expect(config).toEqual({
      signal: controller.signal,
      timeout: DEFAULT_PREPARE_COACH_TIMEOUT_MS,
    });

    expect(result.status).toBe('COMPLETE');
    expect(result.coveredMatchIds).toEqual(['EUW1_1', 'EUW1_2']);
    expect(result.analysis?.eventTimelines[0].events[0].isPlayer).toBe(true);
    expect(result.analysis?.eventTimelines[0].events[0].isOpponent).toBe(false);
  });

  it('sends empty body when matchIds are omitted and normalizes PARTIAL and BLOCKED payloads truthfully', async () => {
    (apiClient.post as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        data: {
          status: 'COMPLETE', // mismatched server label when missingMatches exists -> downgraded to PARTIAL
          region: 'na1',
          puuid: 'p1',
          analyzerVersion: 'v2',
          requestedMatchIds: ['NA1_1', 'NA1_2'],
          coveredMatchIds: ['NA1_1'],
          missingMatches: [{ matchId: 'NA1_2', reason: 'RIOT_BUDGET_EXHAUSTED' }],
          stopReason: 'RIOT_BUDGET_EXHAUSTED',
          analysis: {
            heatmapPositions: [],
            deathPositions: [],
            wardPositions: [],
            killPositions: [],
            assistPositions: [],
            powerSpikeTimelines: [],
            buildOrders: [],
            skillOrders: [],
            eventTimelines: [],
            aggregateSummary: {
              avgFirstDeathMinute: 0,
              mostDangerousZone: 'None',
              avgGoldLeadAt10: 100,
              avgGoldLeadAt15: 150,
              wardsPlacedTotal: 4,
              deathsTotal: 1,
              killsTotal: 2,
              assistsTotal: 3,
              gamesAnalyzed: 1,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 'PARTIAL', // no usable covered timelines -> downgraded to BLOCKED
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

    const partial = await prepareCoachTimelines('NA1', 'p1', { timeoutMs: 5000 });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      '/riot/timeline/prepare-coach/na1/p1',
      {},
      { signal: undefined, timeout: 5000 }
    );
    expect(partial.status).toBe('PARTIAL');
    expect(partial.coveredMatchIds).toEqual(['NA1_1']);
    expect(partial.missingMatches).toEqual([{ matchId: 'NA1_2', reason: 'RIOT_BUDGET_EXHAUSTED' }]);

    const blocked = await prepareCoachTimelines('NA1', 'p1');
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.analysis).toBeNull();
    expect(blocked.stopReason).toBe('RIOT_RATE_LIMITED');
  });
});
