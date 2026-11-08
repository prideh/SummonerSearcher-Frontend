import type { MatchDto } from '../../types/match';
import type { MatchTimelineDto, TimelineFrameDto } from '../../types/timeline';

/**
 * SYNTHETIC TEST FIXTURES — Synthetic test profile / Not real player data.
 *
 * These profiles construct fabricated PUUIDs, profile/rank metadata, match IDs,
 * gold/xp values, and timeline frames solely to exercise the `MatchDto` + `MatchTimelineDto`
 * TypeScript contract and edge cases (non-index PUUID mapping, short games ending before 25m/30m,
 * and unsupported champion-role pairs) in offline review and unit tests.
 *
 * `BladeRunner#EUW` and `ArcaneWave#KR1` are synthetic test personas, NOT real searched Riot accounts.
 */
export interface SyntheticTestPlayerProfile {
  key: string;
  puuid: string;
  region: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number;
  profileIconId: number;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  visibleMatches: MatchDto[];
  timelinesByMatchId: Record<string, MatchTimelineDto>;
}

export type RecordedReviewPlayerProfile = SyntheticTestPlayerProfile;

function buildTimelineFrames(
  participantId: number,
  checkpoints: Array<{
    minute: number;
    offsetMs?: number;
    minionsKilled: number | null;
    jungleMinionsKilled: number | null;
  }>
): TimelineFrameDto[] {
  return checkpoints.map((cp) => ({
    timestamp: cp.minute * 60_000 + (cp.offsetMs ?? 0),
    participantFrames: {
      [String(participantId)]: {
        participantId,
        totalGold: cp.minute * 380,
        level: Math.min(18, Math.max(1, Math.floor(cp.minute * 0.65))),
        xp: cp.minute * 450,
        currentGold: 450,
        minionsKilled: cp.minionsKilled as unknown as number,
        jungleMinionsKilled: cp.jungleMinionsKilled,
        position: { x: 4200, y: 11200 },
      },
    },
    events: [],
  }));
}

export const SYNTHETIC_TEST_PROFILES: Record<string, SyntheticTestPlayerProfile> = {
  euw_top_specialist: {
    key: 'euw_top_specialist',
    puuid: 'puuid-synthetic-euw-top-001',
    region: 'EUW1',
    gameName: 'BladeRunner',
    tagLine: 'EUW',
    summonerLevel: 412,
    profileIconId: 588,
    tier: 'MASTER',
    rank: 'I',
    leaguePoints: 342,
    wins: 88,
    losses: 69,
    visibleMatches: [
      {
        metadata: {
          matchId: 'EUW1_7201001',
          participants: ['puuid-enemy-top-1', 'puuid-synthetic-euw-top-001'],
        },
        info: {
          gameId: 7201001,
          gameDuration: 1920, // 32:00 (reaches 30m)
          gameMode: 'CLASSIC',
          gameVersion: '16.22.648.1000',
          queueId: 420,
          participants: [
            // Intentionally placed at array index 0 with another PUUID so array-index matching would fail
            {
              participantId: 1,
              puuid: 'puuid-enemy-top-1',
              championName: 'Gnar',
              teamPosition: 'TOP',
              teamId: 100,
              win: false,
              totalMinionsKilled: 240,
              neutralMinionsKilled: 8,
            },
            {
              participantId: 6,
              puuid: 'puuid-synthetic-euw-top-001',
              championName: 'KSante',
              teamPosition: 'TOP',
              teamId: 200,
              win: true,
              totalMinionsKilled: 254,
              neutralMinionsKilled: 16,
            },
          ],
        },
      },
      {
        metadata: {
          matchId: 'EUW1_7201002',
          participants: ['puuid-synthetic-euw-top-001', 'puuid-enemy-top-2'],
        },
        info: {
          gameId: 7201002,
          gameDuration: 1380, // 23:00 (ends before 25m and 30m!)
          gameMode: 'CLASSIC',
          gameVersion: '16.22.648.1000',
          queueId: 420,
          participants: [
            {
              participantId: 1,
              puuid: 'puuid-synthetic-euw-top-001',
              championName: 'KSante',
              teamPosition: 'TOP',
              teamId: 100,
              win: true,
              totalMinionsKilled: 192,
              neutralMinionsKilled: 8,
            },
            {
              participantId: 6,
              puuid: 'puuid-enemy-top-2',
              championName: 'Jax',
              teamPosition: 'TOP',
              teamId: 200,
              win: false,
              totalMinionsKilled: 170,
              neutralMinionsKilled: 4,
            },
          ],
        },
      },
      {
        metadata: {
          matchId: 'EUW1_7201003',
          participants: ['puuid-synthetic-euw-top-001'],
        },
        info: {
          gameId: 7201003,
          gameDuration: 1680, // 28:00 — Unsupported champion-role in 8G pro sample (Garen Top has 0G)
          gameMode: 'CLASSIC',
          gameVersion: '16.22.648.1000',
          queueId: 420,
          participants: [
            {
              participantId: 1,
              puuid: 'puuid-synthetic-euw-top-001',
              championName: 'Garen',
              teamPosition: 'TOP',
              teamId: 100,
              win: false,
              totalMinionsKilled: 222,
              neutralMinionsKilled: 12,
            },
          ],
        },
      },
    ],
    timelinesByMatchId: {
      EUW1_7201001: {
        metadata: {
          matchId: 'EUW1_7201001',
          participants: ['puuid-enemy-top-1', 'puuid-synthetic-euw-top-001'],
        },
        info: {
          frameInterval: 60_000,
          participants: [
            { participantId: 1, puuid: 'puuid-enemy-top-1', championName: 'Gnar' },
            { participantId: 6, puuid: 'puuid-synthetic-euw-top-001', championName: 'KSante' },
          ],
          frames: buildTimelineFrames(6, [
            { minute: 5, offsetMs: 120, minionsKilled: 38, jungleMinionsKilled: 0 },
            { minute: 10, offsetMs: 240, minionsKilled: 86, jungleMinionsKilled: 4 },
            { minute: 15, offsetMs: 180, minionsKilled: 130, jungleMinionsKilled: 4 },
            { minute: 20, offsetMs: 310, minionsKilled: 168, jungleMinionsKilled: 8 },
            { minute: 25, offsetMs: 420, minionsKilled: 206, jungleMinionsKilled: 12 },
            { minute: 30, offsetMs: 500, minionsKilled: 242, jungleMinionsKilled: 16 },
          ]),
        },
      },
      EUW1_7201002: {
        metadata: {
          matchId: 'EUW1_7201002',
          participants: ['puuid-synthetic-euw-top-001', 'puuid-enemy-top-2'],
        },
        info: {
          frameInterval: 60_000,
          participants: [
            { participantId: 1, puuid: 'puuid-synthetic-euw-top-001', championName: 'KSante' },
            { participantId: 6, puuid: 'puuid-enemy-top-2', championName: 'Jax' },
          ],
          frames: buildTimelineFrames(1, [
            { minute: 5, offsetMs: 80, minionsKilled: 36, jungleMinionsKilled: 0 },
            { minute: 10, offsetMs: 150, minionsKilled: 84, jungleMinionsKilled: 0 },
            { minute: 15, offsetMs: 200, minionsKilled: 126, jungleMinionsKilled: 4 },
            { minute: 20, offsetMs: 260, minionsKilled: 166, jungleMinionsKilled: 8 },
          ]),
        },
      },
      EUW1_7201003: {
        metadata: {
          matchId: 'EUW1_7201003',
          participants: ['puuid-synthetic-euw-top-001'],
        },
        info: {
          frameInterval: 60_000,
          participants: [
            { participantId: 1, puuid: 'puuid-synthetic-euw-top-001', championName: 'Garen' },
          ],
          frames: buildTimelineFrames(1, [
            { minute: 5, minionsKilled: 34, jungleMinionsKilled: 0 },
            { minute: 10, minionsKilled: 78, jungleMinionsKilled: 0 },
            { minute: 15, minionsKilled: 120, jungleMinionsKilled: 4 },
            { minute: 20, minionsKilled: 162, jungleMinionsKilled: 8 },
            { minute: 25, minionsKilled: 200, jungleMinionsKilled: 12 },
          ]),
        },
      },
    },
  },
  kr_mid_specialist: {
    key: 'kr_mid_specialist',
    puuid: 'puuid-synthetic-kr-mid-002',
    region: 'KR',
    gameName: 'ArcaneWave',
    tagLine: 'KR1',
    summonerLevel: 530,
    profileIconId: 29,
    tier: 'GRANDMASTER',
    rank: 'I',
    leaguePoints: 615,
    wins: 124,
    losses: 98,
    visibleMatches: [
      {
        metadata: {
          matchId: 'KR_8102001',
          participants: ['puuid-synthetic-kr-mid-002'],
        },
        info: {
          gameId: 8102001,
          gameDuration: 1740, // 29:00
          gameMode: 'CLASSIC',
          gameVersion: '16.22.648.1000',
          queueId: 420,
          participants: [
            {
              participantId: 3,
              puuid: 'puuid-synthetic-kr-mid-002',
              championName: 'Syndra',
              teamPosition: 'MIDDLE',
              teamId: 100,
              win: true,
              totalMinionsKilled: 248,
              neutralMinionsKilled: 12,
            },
          ],
        },
      },
    ],
    timelinesByMatchId: {
      KR_8102001: {
        metadata: {
          matchId: 'KR_8102001',
          participants: ['puuid-synthetic-kr-mid-002'],
        },
        info: {
          frameInterval: 60_000,
          participants: [
            { participantId: 3, puuid: 'puuid-synthetic-kr-mid-002', championName: 'Syndra' },
          ],
          frames: buildTimelineFrames(3, [
            { minute: 5, minionsKilled: 40, jungleMinionsKilled: 0 },
            { minute: 10, minionsKilled: 90, jungleMinionsKilled: 4 },
            { minute: 15, minionsKilled: 140, jungleMinionsKilled: 4 },
            { minute: 20, minionsKilled: 184, jungleMinionsKilled: 8 },
            { minute: 25, minionsKilled: 222, jungleMinionsKilled: 12 },
          ]),
        },
      },
    },
  },
};

export const RECORDED_REVIEW_PROFILES = SYNTHETIC_TEST_PROFILES;

