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
  euw_full_contract_sample: buildFullContractSampleProfile(),
};

function buildFullContractSampleProfile(): SyntheticTestPlayerProfile {
  const puuid = 'puuid-synthetic-euw-full-contract-003';
  const baseTs = 1_762_800_000_000;
  const visibleMatches: MatchDto[] = [];
  const timelinesByMatchId: Record<string, MatchTimelineDto> = {};

  // 22 positional matches sorted newest-first (ranks 1..20 analyzed in recent20; ranks 21..22 excluded by recent20 cap):
  // - Ranks 1..9: Top KSante (full 5v5 teams + timeline; rank 9 ends at 22:30 <25m)
  // - Ranks 10..14: Top Aatrox (full 5v5 teams + timeline)
  // - Ranks 15..16: Top Garen (unsupported champion in 8G pro sample; rank 16 leaves timeline unloaded to demo Load Timelines)
  // - Ranks 17..20: Mid Syndra (secondary role in recent20)
  // - Ranks 21..22: Bot Ezreal (older matches beyond recent20 cap, excluded automatically)
  for (let rank = 1; rank <= 22; rank++) {
    const matchId = `EUW1_FULL_${String(rank).padStart(3, '0')}`;
    const isTopKsante = rank <= 9;
    const isTopAatrox = rank >= 10 && rank <= 14;
    const isTopGaren = rank >= 15 && rank <= 16;
    const isMidSyndra = rank >= 17 && rank <= 20;
    const championName = isTopKsante
      ? 'KSante'
      : isTopAatrox
        ? 'Aatrox'
        : isTopGaren
          ? 'Garen'
          : isMidSyndra
            ? 'Syndra'
            : 'Ezreal';
    const oppChampion = isMidSyndra
      ? 'Orianna'
      : rank <= 16
        ? 'Rumble'
        : 'KaiSa';

    const durationSec = rank === 9 ? 1350 : rank % 3 === 0 ? 1920 : 1740;
    const win = rank % 3 !== 2;
    const playerPid = isMidSyndra ? 3 : rank <= 16 ? 1 : 4;
    const oppPid = playerPid + 5;

    const playerKills = win ? 5 + (rank % 3) : 2 + (rank % 2);
    const playerDeaths = win ? 1 + (rank % 2) : 3 + (rank % 2);
    const playerAssists = win ? 7 + (rank % 4) : 4 + (rank % 3);
    const playerLaneCs = Math.round((durationSec / 60) * (isMidSyndra ? 8.4 : 7.8));
    const playerJungleCs = rank % 2 === 0 ? 12 : 8;
    const playerGold = Math.round((durationSec / 60) * (win ? 415 : 372));
    const playerLevel = durationSec >= 1860 ? 17 : durationSec <= 1400 ? 13 : 16;
    const playerDmg = isMidSyndra ? 26_400 + rank * 250 : 21_800 + rank * 220;

    const blueRoles: Array<{ pos: string; champ: string; pid: number }> = [
      { pos: 'TOP', champ: playerPid === 1 ? championName : 'Renekton', pid: 1 },
      { pos: 'JUNGLE', champ: 'XinZhao', pid: 2 },
      { pos: 'MIDDLE', champ: playerPid === 3 ? championName : 'Ahri', pid: 3 },
      { pos: 'BOTTOM', champ: playerPid === 4 ? championName : 'Varus', pid: 4 },
      { pos: 'UTILITY', champ: 'Rell', pid: 5 },
    ];
    const redRoles: Array<{ pos: string; champ: string; pid: number }> = [
      { pos: 'TOP', champ: oppPid === 6 ? oppChampion : 'Jax', pid: 6 },
      { pos: 'JUNGLE', champ: 'Vi', pid: 7 },
      { pos: 'MIDDLE', champ: oppPid === 8 ? oppChampion : 'Taliyah', pid: 8 },
      { pos: 'BOTTOM', champ: oppPid === 9 ? oppChampion : 'Ashe', pid: 9 },
      { pos: 'UTILITY', champ: 'Nautilus', pid: 10 },
    ];

    const participants = [
      ...blueRoles.map((slot) => {
        const isSearched = slot.pid === playerPid;
        return {
          participantId: slot.pid,
          puuid: isSearched ? puuid : `puuid-ally-${matchId}-${slot.pid}`,
          championName: slot.champ,
          teamPosition: slot.pos,
          teamId: 100,
          win,
          kills: isSearched ? playerKills : slot.pid === 5 ? 1 : 3,
          deaths: isSearched ? playerDeaths : 2 + (slot.pid % 2),
          assists: isSearched ? playerAssists : slot.pid === 5 ? 11 : 6,
          goldEarned: isSearched ? playerGold : 10_800 + slot.pid * 400,
          champLevel: isSearched ? playerLevel : 15,
          totalDamageDealtToChampions: isSearched
            ? playerDmg
            : slot.pid === 5
              ? 7_200
              : 19_500 + slot.pid * 800,
          wardsPlaced: slot.pid === 5 ? 42 : 13,
          wardsKilled: slot.pid === 5 ? 14 : 5,
          totalMinionsKilled: isSearched ? playerLaneCs : slot.pid === 5 ? 32 : 195,
          neutralMinionsKilled: isSearched ? playerJungleCs : slot.pid === 2 ? 168 : 8,
        };
      }),
      ...redRoles.map((slot) => {
        const isOpp = slot.pid === oppPid;
        return {
          participantId: slot.pid,
          puuid: `puuid-enemy-${matchId}-${slot.pid}`,
          championName: slot.champ,
          teamPosition: slot.pos,
          teamId: 200,
          win: !win,
          kills: isOpp ? 3 : 2,
          deaths: isOpp ? 3 : 4,
          assists: 5,
          goldEarned: 10_400 + slot.pid * 320,
          champLevel: 15,
          totalDamageDealtToChampions: 17_800 + slot.pid * 500,
          wardsPlaced: 12,
          wardsKilled: 4,
          totalMinionsKilled: isOpp ? playerLaneCs - 12 : 180,
          neutralMinionsKilled: slot.pid === 7 ? 156 : 6,
        };
      }),
    ];

    visibleMatches.push({
      metadata: {
        matchId,
        participants: participants.map((p) => p.puuid!),
      },
      info: {
        gameId: 7_500_000 + rank,
        gameCreation: baseTs - rank * 5_400_000,
        gameEndTimestamp: baseTs - rank * 5_400_000 + durationSec * 1000,
        gameDuration: durationSec,
        gameMode: 'CLASSIC',
        gameVersion: '16.20.648.1000',
        queueId: 420,
        participants,
      },
    });

    // Leave rank 16 unloaded so private review exercises missing-timeline denominators with network OFF
    if (rank !== 16 && rank <= 20) {
      const targetMarks = [5, 10, 14, 15, 20, 25, 30].filter(
        (m) => m * 60 <= durationSec
      );
      const frames: TimelineFrameDto[] = targetMarks.map((m) => {
        const laneCsAtMark = Math.round(m * (isMidSyndra ? 8.5 : 7.9) - (rank % 3));
        const jgCsAtMark = m >= 15 ? 4 * Math.floor((m - 10) / 5) : 0;
        const goldAtMark = 500 + Math.round(m * (win ? 345 : 312)) + (rank % 4) * 35;
        const levelAtMark = Math.min(
          18,
          m === 5 ? 5 : m === 10 ? 8 + (rank % 2) : m === 14 ? 10 : m === 15 ? 11 : m === 20 ? 13 : m === 25 ? 15 : 17
        );
        const oppLaneCs = Math.max(0, laneCsAtMark - (win ? 6 : -4));
        const oppGold = goldAtMark - (win ? 240 : -180);

        const events =
          m === 10 && !win
            ? [
                {
                  type: 'CHAMPION_KILL',
                  timestamp: 8 * 60_000 + 15_000,
                  killerId: oppPid,
                  victimId: playerPid,
                  assistingParticipantIds: [7],
                },
              ]
            : m === 20 && rank % 2 === 1
              ? [
                  {
                    type: 'CHAMPION_KILL',
                    timestamp: 17 * 60_000 + 25_000,
                    killerId: oppPid,
                    victimId: playerPid,
                    assistingParticipantIds: [7, 10],
                  },
                ]
              : [];

        return {
          timestamp: m * 60_000,
          participantFrames: {
            [String(playerPid)]: {
              participantId: playerPid,
              totalGold: goldAtMark,
              level: levelAtMark,
              xp: m * 510,
              currentGold: 420,
              minionsKilled: laneCsAtMark,
              jungleMinionsKilled: jgCsAtMark,
              position: { x: 4200, y: 11200 },
            },
            [String(oppPid)]: {
              participantId: oppPid,
              totalGold: oppGold,
              level: Math.max(1, levelAtMark - (win ? 1 : 0)),
              xp: m * 485,
              currentGold: 380,
              minionsKilled: oppLaneCs,
              jungleMinionsKilled: 0,
              position: { x: 4500, y: 11500 },
            },
          },
          events,
        };
      });

      timelinesByMatchId[matchId] = {
        metadata: {
          matchId,
          participants: participants.map((p) => p.puuid!),
        },
        info: {
          frameInterval: 60_000,
          participants: participants.map((p) => ({
            participantId: p.participantId,
            puuid: p.puuid!,
            championName: p.championName,
          })),
          frames,
        },
      };
    }
  }

  return {
    key: 'euw_full_contract_sample',
    puuid,
    region: 'EUW1',
    gameName: 'Ironclad',
    tagLine: 'EUW',
    summonerLevel: 384,
    profileIconId: 588,
    tier: 'MASTER',
    rank: 'I',
    leaguePoints: 268,
    wins: 96,
    losses: 78,
    visibleMatches,
    timelinesByMatchId,
  };
}

export const RECORDED_REVIEW_PROFILES = SYNTHETIC_TEST_PROFILES;

