import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildAiContext,
  buildCoachGreetingMessage,
  classifyRiftApproxZone,
  formatEventTimestamp,
  formatPatchMajorMinor,
  MAX_EARLY_DEATHS_PER_GAME,
  MAX_ITEM_SPIKES_PER_GAME,
  MAX_RECENT_MATCHES,
  VISION_DATA_PRECISION_NOTE,
} from './aiContextBuilder';
import { useDataDragonStore } from '../store/dataDragonStore';
import type { MatchDto, ParticipantDto } from '../types/match';
import type { ChampionStats, OverallStats } from '../types/summoner';
import { normalizeTimelineAnalysisDto, type TimelineAnalysisDto } from '../types/timeline';

const BASE_OVERALL_STATS: OverallStats = {
  wins: 1,
  losses: 1,
  winRate: 50,
  kda: 3.5,
  avgKills: 6,
  avgDeaths: 2,
  avgAssists: 5,
  avgCsPerMinute: 8.2,
  avgKillParticipation: 58,
  avgSoloKills: 1.5,
  avgTurretPlates: 2.5,
  avgVisionScore: 24,
  blueSide: { games: 1, wins: 1, winRate: 100 },
  redSide: { games: 1, wins: 0, winRate: 0 },
  oppAvgKda: 2.1,
  oppAvgCsPerMinute: 7.4,
  oppAvgKillParticipation: 49,
  oppAvgSoloKills: 0.5,
  oppAvgTurretPlates: 1.0,
  oppAvgVisionScore: 19,
};

const BASE_CHAMPION_STATS: ChampionStats[] = [
  {
    championName: 'Ahri',
    games: 2,
    wins: 1,
    losses: 1,
    kills: 12,
    deaths: 4,
    assists: 10,
    soloKills: 3,
    winRate: 50,
    kda: 5.5,
    averageKills: 6,
    averageDeaths: 2,
    averageAssists: 5,
    averageCsPerMinute: 8.2,
    averageSoloKills: 1.5,
    averageTurretPlates: 2.5,
  },
];

function createParticipant(overrides: Partial<ParticipantDto> = {}): ParticipantDto {
  return {
    puuid: 'other-puuid',
    championName: 'Garen',
    teamId: 100,
    teamPosition: 'TOP',
    win: true,
    kills: 3,
    deaths: 2,
    assists: 4,
    totalMinionsKilled: 180,
    neutralMinionsKilled: 10,
    visionScore: 22,
    wardsPlaced: 8,
    wardsKilled: 3,
    detectorWardsPlaced: 2,
    damageDealtToObjectives: 8400,
    damageDealtToTurrets: 4200,
    totalDamageDealtToChampions: 20000,
    physicalDamageDealtToChampions: 3000,
    magicDamageDealtToChampions: 15000,
    trueDamageDealtToChampions: 2000,
    goldEarned: 12500,
    summoner1Id: 4,
    summoner2Id: 14,
    item0: 1056,
    item1: 6655,
    item2: 3089,
    item3: 3020,
    item4: 0,
    item5: 0,
    item6: 3340,
    perks: {
      statPerks: { defense: 5002, flex: 5008, offense: 5008 },
      styles: [
        {
          description: 'primaryStyle',
          style: 8100,
          selections: [{ perk: 8112 }],
        },
        {
          description: 'subStyle',
          style: 8200,
          selections: [],
        },
      ],
    },
    challenges: {
      laneMinionsFirst10Minutes: 86,
      turretPlatesTaken: 3,
      controlWardsPlaced: 2,
      soloKills: 2,
    },
    ...overrides,
  };
}

function createMatch(overrides: {
  matchId?: string;
  gameVersion?: string;
  playerOverrides?: Partial<ParticipantDto>;
  opponentOverrides?: Partial<ParticipantDto>;
} = {}): MatchDto {
  const role = overrides.playerOverrides?.teamPosition ?? 'MIDDLE';
  const playerTeamId = overrides.playerOverrides?.teamId ?? 100;
  const enemyTeamId = playerTeamId === 100 ? 200 : 100;

  const player = createParticipant({
    puuid: 'player-puuid',
    championName: 'Ahri',
    teamId: playerTeamId,
    teamPosition: role,
    ...overrides.playerOverrides,
  });

  const opponent = createParticipant({
    puuid: 'opp-puuid',
    riotIdGameName: 'RivalMid',
    championName: 'Syndra',
    teamId: enemyTeamId,
    teamPosition: role,
    kills: 2,
    deaths: 5,
    assists: 3,
    item0: 6653,
    item1: 3157,
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
    item6: 3363,
    perks: {
      statPerks: { defense: 5002, flex: 5008, offense: 5008 },
      styles: [
        {
          description: 'primaryStyle',
          style: 8200,
          selections: [{ perk: 8229 }],
        },
        {
          description: 'subStyle',
          style: 8300,
          selections: [],
        },
      ],
    },
    ...overrides.opponentOverrides,
  });

  const allies = [
    createParticipant({ puuid: 'ally-1', championName: 'Jax', teamId: playerTeamId, teamPosition: 'TOP' }),
    createParticipant({ puuid: 'ally-2', championName: 'LeeSin', teamId: playerTeamId, teamPosition: 'JUNGLE' }),
    createParticipant({ puuid: 'ally-3', championName: 'Jinx', teamId: playerTeamId, teamPosition: 'BOTTOM' }),
    createParticipant({ puuid: 'ally-4', championName: 'Thresh', teamId: playerTeamId, teamPosition: 'UTILITY' }),
  ];

  const enemies = [
    opponent,
    createParticipant({ puuid: 'enemy-1', championName: 'Renekton', teamId: enemyTeamId, teamPosition: 'TOP' }),
    createParticipant({ puuid: 'enemy-2', championName: 'Viego', teamId: enemyTeamId, teamPosition: 'JUNGLE' }),
    createParticipant({ puuid: 'enemy-3', championName: 'KaiSa', teamId: enemyTeamId, teamPosition: 'BOTTOM' }),
    createParticipant({ puuid: 'enemy-4', championName: 'Nautilus', teamId: enemyTeamId, teamPosition: 'UTILITY' }),
  ];

  return {
    metadata: {
      matchId: overrides.matchId ?? 'EUW1_1001',
    },
    info: {
      gameId: 1001,
      gameDuration: 1800,
      gameVersion: overrides.gameVersion ?? '16.22.1',
      participants: [player, ...allies, ...enemies],
    },
  };
}

describe('aiContextBuilder (#14)', () => {
  beforeEach(() => {
    useDataDragonStore.setState({
      version: '16.22.1',
      itemMap: {
        '1001': { name: 'Boots', description: '', plaintext: '', gold: { base: 300, total: 300, sell: 210, purchasable: true } },
        '1056': { name: "Doran's Ring", description: '', plaintext: '', gold: { base: 400, total: 400, sell: 160, purchasable: true } },
        '2003': { name: 'Health Potion', description: '', plaintext: '', gold: { base: 50, total: 50, sell: 20, purchasable: true } },
        '3020': { name: "Sorcerer's Shoes", description: '', plaintext: '', gold: { base: 800, total: 1100, sell: 770, purchasable: true } },
        '3089': { name: "Rabadon's Deathcap", description: '', plaintext: '', gold: { base: 1100, total: 3600, sell: 2520, purchasable: true } },
        '3157': { name: "Zhonya's Hourglass", description: '', plaintext: '', gold: { base: 1050, total: 3250, sell: 2275, purchasable: true } },
        '3340': { name: 'Stealth Ward', description: '', plaintext: '', gold: { base: 0, total: 0, sell: 0, purchasable: true } },
        '3363': { name: 'Farsight Alteration', description: '', plaintext: '', gold: { base: 0, total: 0, sell: 0, purchasable: true } },
        '4645': { name: 'Shadowflame', description: '', plaintext: '', gold: { base: 950, total: 3200, sell: 2240, purchasable: true } },
        '6653': { name: "Liandry's Torment", description: '', plaintext: '', gold: { base: 900, total: 3000, sell: 2100, purchasable: true } },
        '6655': { name: "Luden's Companion", description: '', plaintext: '', gold: { base: 900, total: 2850, sell: 1995, purchasable: true } },
      },
      runeMap: {
        '8100': { id: 8100, key: 'Domination', name: 'Domination', icon: '', shortDesc: '', longDesc: '' },
        '8112': { id: 8112, key: 'Electrocute', name: 'Electrocute', icon: '', shortDesc: '', longDesc: '' },
        '8200': { id: 8200, key: 'Sorcery', name: 'Sorcery', icon: '', shortDesc: '', longDesc: '' },
        '8229': { id: 8229, key: 'ArcaneComet', name: 'Arcane Comet', icon: '', shortDesc: '', longDesc: '' },
      },
      summonerSpellMap: {
        '4': { id: 'SummonerFlash', name: 'Flash', description: '', key: '4', image: { full: 'SummonerFlash.png' } },
        '14': { id: 'SummonerDot', name: 'Ignite', description: '', key: '14', image: { full: 'SummonerDot.png' } },
      },
    });
  });

  it('formats major.minor patch strings, event timestamps, and approximate Rift zones cleanly', () => {
    expect(formatPatchMajorMinor('16.22.612.4910')).toBe('16.22');
    expect(formatPatchMajorMinor('15.24.1')).toBe('15.24');
    expect(formatPatchMajorMinor(undefined)).toBeUndefined();
    expect(formatPatchMajorMinor('')).toBeUndefined();

    expect(formatEventTimestamp(3, 5)).toBe('03:05');
    expect(formatEventTimestamp(14, 30)).toBe('14:30');

    expect(classifyRiftApproxZone({ x: 7200, y: 7200 }, null, null)).toBe('Mid River');
    expect(classifyRiftApproxZone({ x: 5200, y: 5100 }, null, null)).toBe('Mid Lane');
    expect(classifyRiftApproxZone({ x: 5007, y: 10471 }, null, null)).toBe('Baron / Top River');
    expect(classifyRiftApproxZone({ x: 9866, y: 4414 }, null, null)).toBe('Dragon / Bot River');
    expect(classifyRiftApproxZone({ x: 1800, y: 11200 }, null, null)).toBe('Top Lane');
    expect(classifyRiftApproxZone({ x: 12200, y: 2100 }, null, null)).toBe('Bot Lane');
    expect(classifyRiftApproxZone(null, 'MID_LANE', null)).toBe('Mid Lane');
    expect(classifyRiftApproxZone(null, null, null)).toBeNull();
  });

  it('builds match context with loadout, draft, early CS (preserving missing counts), vision/objective counts, and NOT_ANALYZED status when timeline was not run', () => {
    const post26Match = createMatch({
      matchId: 'EUW1_1001',
      gameVersion: '16.22.1',
      playerOverrides: {
        teamId: 100,
        teamPosition: 'MIDDLE',
        challenges: {
          laneMinionsFirst10Minutes: 86,
          turretPlatesTaken: 3,
          controlWardsPlaced: 2,
          soloKills: 2,
        },
      },
    });
    const pre26JungleMatch = createMatch({
      matchId: 'EUW1_1002',
      gameVersion: '15.24.1',
      playerOverrides: {
        teamId: 200,
        teamPosition: 'JUNGLE',
        challenges: {
          jungleCsBefore10Minutes: 58,
          turretPlatesTaken: 0,
          controlWardsPlaced: 3,
        },
      },
    });
    const pre26LaneMatch = createMatch({
      matchId: 'EUW1_1003',
      gameVersion: '15.24.1',
      playerOverrides: {
        teamId: 100,
        teamPosition: 'TOP',
        challenges: {
          laneMinionsFirst10Minutes: 74,
          turretPlatesTaken: 1,
          controlWardsPlaced: 1,
        },
      },
    });
    const missingCsLaneMatch = createMatch({
      matchId: 'EUW1_1004',
      gameVersion: '16.22.1',
      playerOverrides: {
        teamId: 100,
        teamPosition: 'BOTTOM',
        challenges: {
          turretPlatesTaken: 2,
          controlWardsPlaced: 1,
        },
      },
    });

    const ctx = buildAiContext(
      'Faker',
      'KR1',
      [post26Match, pre26JungleMatch, pre26LaneMatch, missingCsLaneMatch],
      'player-puuid',
      { tier: 'DIAMOND', rank: 'I', leaguePoints: 75, wins: 40, losses: 30 },
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      null
    );

    expect(ctx.timelineStatus).toBe('NOT_ANALYZED');
    expect(ctx.visionDataPrecision).toBe(VISION_DATA_PRECISION_NOTE);
    expect(ctx.timelineInsights).toBeUndefined();
    expect(ctx.missingLaneCsAt10Matches).toBe(1);
    expect(ctx.avgLaneCsAt10).toEqual({
      avgActual: 80, // (86 + 74) / 2; missing EUW1_1004 not counted as 0
      matchCount: 2,
      avgSupportedActual: 86,
      avgTarget: null,
      targetMatchCount: 1,
      roleBreakdown: { TOP: 1, MIDDLE: 1, BOTTOM: 0 },
      targetLabel: null,
    });

    const m1 = ctx.recentMatches[0];
    expect(m1.patch).toBe('16.22');
    expect(m1.role).toBe('MIDDLE');
    expect(m1.side).toBe('Blue');
    expect(m1.keystone).toBe('Electrocute');
    expect(m1.subStyle).toBe('Sorcery');
    expect(m1.summonerSpells).toEqual(['Flash', 'Ignite']);
    expect(m1.items).toEqual([
      "Doran's Ring",
      "Luden's Companion",
      "Rabadon's Deathcap",
      "Sorcerer's Shoes",
      'Stealth Ward',
    ]);
    expect(m1.opponent?.keystone).toBe('Arcane Comet');
    expect(m1.opponent?.items).toEqual(["Liandry's Torment", "Zhonya's Hourglass", 'Farsight Alteration']);
    expect(m1.draft).toEqual({
      allies: ['Jax', 'LeeSin', 'Jinx', 'Thresh'],
      enemies: ['Syndra', 'Renekton', 'Viego', 'KaiSa', 'Nautilus'],
    });
    expect(m1.damageSplitPct).toEqual({ physical: 15, magic: 75, true: 10 });
    expect(m1.laneCsAt10).toEqual({
      actual: 86,
      target: 120,
      targetLabel: 'Mid lane target',
    });
    expect(m1.jungleCsBefore10Minutes).toBeUndefined();
    expect(m1.controlWardsPlaced).toBe(2);
    expect(m1.wardsPlaced).toBe(8);
    expect(m1.wardsKilled).toBe(3);
    expect(m1.turretPlatesTaken).toBe(3);
    expect(m1.damageDealtToObjectives).toBe(8400);
    expect(m1.damageDealtToTurrets).toBe(4200);
    expect(m1.timelineAt10).toBeUndefined();
    expect(m1.deathContext).toBeUndefined();
    expect(m1.itemSpikes).toBeUndefined();
    expect(m1.skillMaxOrder).toBeUndefined();

    // Match 2: Jungler on pre-26.1 patch
    const m2 = ctx.recentMatches[1];
    expect(m2.patch).toBe('15.24');
    expect(m2.side).toBe('Red');
    expect(m2.role).toBe('JUNGLE');
    expect(m2.laneCsAt10).toBeUndefined();
    expect(m2.jungleCsBefore10Minutes).toBe(58);

    // Match 3: Laner on pre-26.1 patch excludes post-26.1 lane target
    const m3 = ctx.recentMatches[2];
    expect(m3.patch).toBe('15.24');
    expect(m3.laneCsAt10).toEqual({
      actual: 74,
      target: null,
      targetLabel: null,
    });
  });

  it('handles current real backend contract: omitted assistants/wards produce null (unknown, never solo/zero) and matchId-only lookup never attaches another game timeline by index', () => {
    // Match 0 (EUW1_1001) has NO timeline entry in timelineAnalysis.
    // Match 1 (EUW1_1002) HAS a timeline entry at index 0 of timelineAnalysis arrays.
    // Positional fallback would have wrongly attached EUW1_1002's timeline to EUW1_1001!
    const match1 = createMatch({ matchId: 'EUW1_1001', gameVersion: '16.22.1' });
    const match2 = createMatch({ matchId: 'EUW1_1002', gameVersion: '16.22.1' });

    const realBackendTimeline: TimelineAnalysisDto = {
      heatmapPositions: [{ x: 7000, y: 7200, matchId: 'EUW1_1002', minute: 5 }],
      wardPositions: [{ x: 6400, y: 8100, matchId: 'EUW1_1002', minute: 4 }],
      killPositions: [],
      deathPositions: [{ x: 5200, y: 5100, matchId: 'EUW1_1002', minute: 3 }],
      assistPositions: [],
      powerSpikeTimelines: [
        {
          matchId: 'EUW1_1002',
          playerChampion: 'Ahri',
          opponentChampion: 'Syndra',
          win: true,
          points: [
            {
              minute: 10,
              playerGold: 3400,
              opponentGold: 3600,
              playerGoldLead: -200,
              playerXp: 4400,
              opponentXp: 4550,
              playerCs: 78,
              opponentCs: 84,
              playerItems: [],
              opponentItems: [],
              events: [],
            },
          ],
        },
      ],
      buildOrders: [],
      skillOrders: [],
      eventTimelines: [
        {
          matchId: 'EUW1_1002',
          playerChampion: 'Ahri',
          opponentChampion: 'Syndra',
          win: true,
          events: [
            // Real backend Jackson serialization: `player` / `opponent` (NOT `isPlayer` / `isOpponent`),
            // actor = player ("Ahri"), target = killer ("Syndra"),
            // NO `killer` field, NO `assistants` field, NO `WARD_PLACED` events in eventTimelines.
            {
              minuteMark: 3,
              secondMark: 30,
              type: 'DEATH',
              actor: 'Ahri',
              target: 'Syndra',
              player: true,
              opponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 5200, y: 5100 }, // Mid Lane
            },
            {
              minuteMark: 8,
              secondMark: 5,
              type: 'DEATH',
              actor: 'Ahri',
              target: 'Viego',
              player: true,
              opponent: false,
              laneType: null,
              monsterType: null,
              position: null, // Missing position
            },
            // Opponent's own death (`player: false, opponent: true`) must NOT be counted as a player death!
            {
              minuteMark: 6,
              secondMark: 15,
              type: 'DEATH',
              actor: 'Syndra',
              target: 'LeeSin',
              player: false,
              opponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 7400, y: 7400 },
            },
          ],
        },
      ],
      aggregateSummary: {
        avgFirstDeathMinute: 3.5,
        mostDangerousZone: 'Mid Lane',
        avgGoldLeadAt10: -200,
        avgGoldLeadAt15: -100,
        wardsPlacedTotal: 9,
        deathsTotal: 2,
        killsTotal: 4,
        assistsTotal: 6,
        gamesAnalyzed: 1,
      },
    };

    const ctx = buildAiContext(
      'Faker',
      'KR1',
      [match1, match2],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      realBackendTimeline
    );

    // Match 1 (EUW1_1001) must NOT receive EUW1_1002's timeline via index 0 fallback
    expect(ctx.recentMatches[0].matchId).toBe('EUW1_1001');
    expect(ctx.recentMatches[0].timelineAt10).toBeUndefined();
    expect(ctx.recentMatches[0].deathContext).toBeUndefined();

    // Match 2 (EUW1_1002) receives its matched timeline with 2 player deaths (opponent death excluded)
    const m2 = ctx.recentMatches[1];
    expect(m2.matchId).toBe('EUW1_1002');
    expect(m2.timelineAt10).toEqual({ goldDiff: -200, xpDiff: -150, csDiff: -6 });
    expect(m2.deathContext).toEqual({
      totalDeaths: 2,
      firstDeathMinute: 3.5,
      deathsBefore10: 2,
      assistedDeaths: null, // Unknown, NEVER 0
      unassistedDeaths: null, // Unknown, NEVER 2 (solo)
      unknownAssistDeaths: 2,
      missingPositionDeaths: 1,
      deathsNearObjectiveWindows: 0,
      earlyDeaths: [
        {
          time: '03:30',
          minute: 3.5,
          approxZone: 'Mid Lane',
          killer: 'Syndra',
          participants: ['Ahri', 'Syndra'],
          assistants: null,
          assisted: null,
          assistantsCount: null,
        },
        {
          time: '08:05',
          minute: 8.1,
          approxZone: null,
          killer: 'Viego',
          participants: ['Ahri', 'Viego'],
          assistants: null,
          assisted: null,
          assistantsCount: null,
        },
      ],
    });

    // Aggregate timelineInsights preserves null for unknown assistants/wards and missingTimelineMatches = 1
    expect(ctx.timelineInsights).toBeDefined();
    expect(ctx.timelineInsights?.assistedDeaths).toBeNull();
    expect(ctx.timelineInsights?.unassistedDeaths).toBeNull();
    expect(ctx.timelineInsights?.unknownAssistDeaths).toBe(2);
    expect(ctx.timelineInsights?.missingPositionDeaths).toBe(1);
    expect(ctx.timelineInsights?.wardsByTimeBucket).toBeNull();
    expect(ctx.timelineInsights?.missingTimelineMatches).toBe(1);
  });

  it('normalizes exact old-production /timeline/analyze Jackson payload (Galio vs Ryze: event.player / event.opponent without isPlayer / isOpponent, omitted killer/assistants, and unknown-identity events) so 4 Galio player deaths are counted and Ryze opponent death is excluded', () => {
    const galioMatch = createMatch({
      matchId: 'NA1_5200001',
      gameVersion: '26.1.1',
      playerOverrides: {
        championName: 'Galio',
        teamPosition: 'MIDDLE',
        kills: 3,
        deaths: 4,
        assists: 9,
      },
      opponentOverrides: {
        championName: 'Ryze',
        teamPosition: 'MIDDLE',
      },
    });

    // Exact old-production /riot/timeline/analyze payload serialized by Spring Boot Jackson:
    // - MatchEventEntry getters `boolean isPlayer()` and `boolean isOpponent()` serialize as `"player"` and `"opponent"` (NO `isPlayer` / `isOpponent`).
    // - No `killer` or `assistants` fields on DEATH events (`actor` = victim, `target` = killer).
    // - 4 Galio player deaths (`player: true`) + 1 Ryze opponent death (`player: false, opponent: true`) + 1 malformed/unknown-identity DEATH event (neither `isPlayer` nor `player` present).
    // Under old `ev.isPlayer !== false`, the Ryze opponent death (`isPlayer === undefined`) was wrongly admitted, yielding `totalDeaths: 5`.
    const rawOldProductionPayload = {
      heatmapPositions: [{ x: 7100, y: 7200, matchId: 'NA1_5200001', minute: 4 }],
      wardPositions: [{ x: 6400, y: 8100, matchId: 'NA1_5200001', minute: 3 }],
      killPositions: [{ x: 7500, y: 7400, matchId: 'NA1_5200001', minute: 7 }],
      deathPositions: [
        { x: 6900, y: 7000, matchId: 'NA1_5200001', minute: 4 },
        { x: 5100, y: 10300, matchId: 'NA1_5200001', minute: 9 },
        { x: 9800, y: 4500, matchId: 'NA1_5200001', minute: 13 },
        { x: 8500, y: 8600, matchId: 'NA1_5200001', minute: 21 },
      ],
      assistPositions: [],
      powerSpikeTimelines: [
        {
          matchId: 'NA1_5200001',
          playerChampion: 'Galio',
          opponentChampion: 'Ryze',
          win: true,
          points: [
            {
              minute: 10,
              playerGold: 3350,
              opponentGold: 3500,
              playerGoldLead: -150,
              playerXp: 4400,
              opponentXp: 4550,
              playerCs: 74,
              opponentCs: 81,
              playerItems: [1056, 3111],
              opponentItems: [1056, 3020],
              events: [
                {
                  type: 'DEATH' as const,
                  minuteMark: 9,
                  secondMark: 24,
                  actor: 'Galio',
                  target: 'Viego',
                  player: true,
                  opponent: false,
                  laneType: null,
                  monsterType: null,
                  position: { x: 5100, y: 10300 },
                },
              ],
            },
          ],
        },
      ],
      buildOrders: [],
      skillOrders: [],
      eventTimelines: [
        {
          matchId: 'NA1_5200001',
          playerChampion: 'Galio',
          opponentChampion: 'Ryze',
          win: true,
          events: [
            // Galio death #1
            {
              type: 'DEATH' as const,
              minuteMark: 4,
              secondMark: 12,
              actor: 'Galio',
              target: 'Ryze',
              player: true,
              opponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 6900, y: 7000 },
            },
            // Ryze opponent death (`player: false, opponent: true`) -> MUST BE EXCLUDED!
            {
              type: 'DEATH' as const,
              minuteMark: 6,
              secondMark: 40,
              actor: 'Ryze',
              target: 'LeeSin',
              player: false,
              opponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 7500, y: 7400 },
            },
            // Galio death #2
            {
              type: 'DEATH' as const,
              minuteMark: 9,
              secondMark: 24,
              actor: 'Galio',
              target: 'Viego',
              player: true,
              opponent: false,
              laneType: null,
              monsterType: null,
              position: { x: 5100, y: 10300 },
            },
            // Galio death #3
            {
              type: 'DEATH' as const,
              minuteMark: 13,
              secondMark: 48,
              actor: 'Galio',
              target: 'Jinx',
              player: true,
              opponent: false,
              laneType: null,
              monsterType: null,
              position: { x: 9800, y: 4500 },
            },
            // Galio death #4
            {
              type: 'DEATH' as const,
              minuteMark: 21,
              secondMark: 5,
              actor: 'Galio',
              target: 'Ryze',
              player: true,
              opponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 8500, y: 8600 },
            },
            // Unknown-identity event (both `isPlayer` and `player` omitted) -> MUST NOT count!
            {
              type: 'DEATH' as const,
              minuteMark: 11,
              secondMark: 10,
              actor: 'Ryze',
              target: 'Galio',
              laneType: null,
              monsterType: null,
              position: { x: 7200, y: 7200 },
            },
          ],
        },
      ],
      aggregateSummary: {
        avgFirstDeathMinute: 4.2,
        mostDangerousZone: 'Mid Lane',
        avgGoldLeadAt10: -150,
        avgGoldLeadAt15: 100,
        wardsPlacedTotal: 11,
        deathsTotal: 4,
        killsTotal: 3,
        assistsTotal: 9,
        gamesAnalyzed: 1,
      },
    } satisfies TimelineAnalysisDto;

    // Works both when passed raw to buildAiContext AND when normalized via normalizeTimelineAnalysisDto
    const ctxRaw = buildAiContext(
      'Faker',
      'KR1',
      [galioMatch],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      rawOldProductionPayload
    );

    const m = ctxRaw.recentMatches[0];
    expect(m.champion).toBe('Galio');
    expect(m.deathContext).toBeDefined();
    expect(m.deathContext?.totalDeaths).toBe(4); // 4 Galio deaths ONLY (Ryze death & unknown-identity event excluded)
    expect(m.deathContext?.firstDeathMinute).toBe(4.2);
    expect(m.deathContext?.deathsBefore10).toBe(2);
    expect(m.deathContext?.assistedDeaths).toBeNull(); // Omitted assistants -> null (unknown)
    expect(m.deathContext?.unassistedDeaths).toBeNull(); // Omitted assistants -> null (unknown)
    expect(m.deathContext?.unknownAssistDeaths).toBe(4);
    expect(m.deathContext?.earlyDeaths).toHaveLength(3); // 3 pre-15m Galio deaths (04:12, 09:24, 13:48)
    expect(m.deathContext?.earlyDeaths.map(d => d.time)).toEqual(['04:12', '09:24', '13:48']);
    expect(m.deathContext?.earlyDeaths.map(d => d.killer)).toEqual(['Ryze', 'Viego', 'Jinx']);

    const normalizedPayload = normalizeTimelineAnalysisDto(rawOldProductionPayload);
    expect(normalizedPayload.eventTimelines[0].events[0].isPlayer).toBe(true);
    expect(normalizedPayload.eventTimelines[0].events[0].isOpponent).toBe(true);
    expect(normalizedPayload.eventTimelines[0].events[1].isPlayer).toBe(false);
    expect(normalizedPayload.eventTimelines[0].events[1].isOpponent).toBe(true);
    expect(normalizedPayload.eventTimelines[0].events[5].isPlayer).toBe(false);
    expect(normalizedPayload.powerSpikeTimelines[0].points[0].events[0].isPlayer).toBe(true);
    expect(normalizedPayload.powerSpikeTimelines[0].points[0].events[0].isOpponent).toBe(false);

    const ctxNormalized = buildAiContext(
      'Faker',
      'KR1',
      [galioMatch],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      normalizedPayload
    );
    expect(ctxNormalized.recentMatches[0].deathContext).toEqual(m.deathContext);
  });

  it('enriches matches with timeline diffs, death context (labelled assisted, never gank), capped item spikes, and skillMaxOrder when backend provides assistants and WARD_PLACED events', () => {
    const match = createMatch({ matchId: 'EUW1_1001', gameVersion: '16.22.1' });

    const timelineAnalysis: TimelineAnalysisDto = {
      powerSpikeTimelines: [
        {
          matchId: 'EUW1_1001',
          playerChampion: 'Ahri',
          opponentChampion: 'Syndra',
          win: true,
          points: [
            {
              minute: 10,
              playerGold: 3600,
              opponentGold: 3250,
              playerGoldLead: 350,
              playerXp: 4600,
              opponentXp: 4300,
              playerCs: 86,
              opponentCs: 78,
              playerItems: [],
              opponentItems: [],
              events: [],
            },
            {
              minute: 15,
              playerGold: 5900,
              opponentGold: 5300,
              playerGoldLead: 600,
              playerXp: 7400,
              opponentXp: 6900,
              playerCs: 134,
              opponentCs: 120,
              playerItems: [],
              opponentItems: [],
              events: [],
            },
          ],
        },
      ],
      heatmapPositions: [{ x: 7000, y: 7200, matchId: 'EUW1_1001', minute: 5 }],
      wardPositions: [{ x: 6400, y: 8100, matchId: 'EUW1_1001', minute: 4 }],
      killPositions: [{ x: 7500, y: 7500, matchId: 'EUW1_1001', minute: 8 }],
      deathPositions: [{ x: 6800, y: 6900, matchId: 'EUW1_1001', minute: 3 }],
      assistPositions: [{ x: 8000, y: 8000, matchId: 'EUW1_1001', minute: 12 }],
      buildOrders: [
        {
          matchId: 'EUW1_1001',
          playerChampion: 'Ahri',
          win: true,
          items: [
            { itemId: 1056, minuteMark: 0, timestamp: 10000 }, // Doran's Ring (starter - excluded)
            { itemId: 2003, minuteMark: 0, timestamp: 12000 }, // Health Potion (consumable - excluded)
            { itemId: 1001, minuteMark: 4, timestamp: 240000 }, // Boots (component - excluded)
            { itemId: 3020, minuteMark: 8, timestamp: 480000 }, // Sorc Shoes (1100g < 2000g - excluded)
            { itemId: 6655, minuteMark: 11, timestamp: 660000 }, // Luden's Companion (spike #1)
            { itemId: 4645, minuteMark: 18, timestamp: 1080000 }, // Shadowflame (spike #2)
            { itemId: 3089, minuteMark: 24, timestamp: 1440000 }, // Rabadon's Deathcap (spike #3)
            { itemId: 3157, minuteMark: 29, timestamp: 1740000 }, // Zhonya's Hourglass (4th spike - capped)
          ],
        },
      ],
      skillOrders: [
        {
          matchId: 'EUW1_1001',
          playerChampion: 'Ahri',
          win: true,
          levelUps: [
            { skillSlot: 1, level: 1, minuteMark: 1 },
            { skillSlot: 3, level: 2, minuteMark: 2 },
            { skillSlot: 2, level: 3, minuteMark: 3 },
          ],
          maxOrder: [1, 2, 3],
        },
      ],
      eventTimelines: [
        {
          matchId: 'EUW1_1001',
          playerChampion: 'Ahri',
          opponentChampion: 'Syndra',
          win: true,
          events: [
            {
              minuteMark: 3,
              secondMark: 30,
              type: 'DEATH',
              actor: 'Ahri',
              target: 'LeeSin',
              killer: 'LeeSin',
              assistants: ['Syndra'],
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: { x: 7200, y: 7200 },
            },
            {
              minuteMark: 6,
              secondMark: 0,
              type: 'OBJECTIVE',
              actor: 'Viego',
              target: 'DRAGON',
              isPlayer: false,
              isOpponent: false,
              laneType: null,
              monsterType: 'DRAGON',
              position: null,
            },
            {
              minuteMark: 6,
              secondMark: 30,
              type: 'DEATH',
              actor: 'Ahri',
              target: 'Syndra',
              killer: 'Syndra',
              assistants: [],
              isPlayer: true,
              isOpponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 9866, y: 4414 },
            },
            {
              minuteMark: 9,
              secondMark: 0,
              type: 'DEATH',
              actor: 'Ahri',
              target: 'Syndra',
              killer: 'Syndra',
              assistants: ['LeeSin', 'Nautilus'],
              isPlayer: true,
              isOpponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 5200, y: 5100 },
            },
            {
              minuteMark: 13,
              secondMark: 0,
              type: 'DEATH',
              actor: 'Ahri',
              target: 'Renekton',
              killer: 'Renekton',
              assistants: [],
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: { x: 5007, y: 10471 },
            },
            {
              minuteMark: 20,
              secondMark: 0,
              type: 'DEATH',
              actor: 'Ahri',
              target: 'KaiSa',
              killer: 'KaiSa',
              assistants: ['Nautilus'],
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: { x: 9000, y: 9000 },
            },
            {
              minuteMark: 4,
              secondMark: 0,
              type: 'WARD_PLACED',
              actor: 'Ahri',
              target: 'YELLOW_TRINKET',
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: null,
            },
            {
              minuteMark: 14,
              secondMark: 0,
              type: 'WARD_PLACED',
              actor: 'Ahri',
              target: 'CONTROL_WARD',
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: null,
            },
            {
              minuteMark: 23,
              secondMark: 0,
              type: 'WARD_PLACED',
              actor: 'Ahri',
              target: 'BLUE_TRINKET',
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: null,
            },
          ],
        },
      ],
      aggregateSummary: {
        avgFirstDeathMinute: 3.5,
        mostDangerousZone: 'Mid River',
        avgGoldLeadAt10: 350,
        avgGoldLeadAt15: 600,
        wardsPlacedTotal: 3,
        deathsTotal: 5,
        killsTotal: 6,
        assistsTotal: 5,
        gamesAnalyzed: 1,
      },
    };

    const ctx = buildAiContext(
      'Faker',
      'KR1',
      [match],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      timelineAnalysis
    );

    expect(ctx.timelineStatus).toBe('ANALYZED');
    expect(ctx.timelineInsights).toBeDefined();
    expect(ctx.timelineInsights?.deathsBefore10).toBe(3);
    expect(ctx.timelineInsights?.assistedDeaths).toBe(3);
    expect(ctx.timelineInsights?.unassistedDeaths).toBe(2);
    expect(ctx.timelineInsights?.unknownAssistDeaths).toBe(0);
    expect(ctx.timelineInsights?.missingPositionDeaths).toBe(0);
    expect(ctx.timelineInsights?.deathsNearObjectiveWindows).toBe(1);
    expect(ctx.timelineInsights?.missingTimelineMatches).toBe(0);
    expect(ctx.timelineInsights?.wardsByTimeBucket).toEqual({
      pre10: 1,
      min10To20: 1,
      post20: 1,
    });

    const m = ctx.recentMatches[0];
    expect(m.timelineAt10).toEqual({ goldDiff: 350, xpDiff: 300, csDiff: 8 });
    expect(m.timelineAt15).toEqual({ goldDiff: 600, xpDiff: 500, csDiff: 14 });

    expect(m.deathContext).toBeDefined();
    expect(m.deathContext?.totalDeaths).toBe(5);
    expect(m.deathContext?.firstDeathMinute).toBe(3.5);
    expect(m.deathContext?.deathsBefore10).toBe(3);
    expect(m.deathContext?.assistedDeaths).toBe(3);
    expect(m.deathContext?.unassistedDeaths).toBe(2);
    expect(m.deathContext?.unknownAssistDeaths).toBe(0);
    expect(m.deathContext?.missingPositionDeaths).toBe(0);
    expect(m.deathContext?.deathsNearObjectiveWindows).toBe(1);
    expect(m.deathContext?.earlyDeaths).toHaveLength(MAX_EARLY_DEATHS_PER_GAME);
    expect(m.deathContext?.earlyDeaths[0]).toEqual({
      time: '03:30',
      minute: 3.5,
      approxZone: 'Mid River',
      killer: 'LeeSin',
      participants: ['Ahri', 'LeeSin', 'Syndra'],
      assistants: ['Syndra'],
      assisted: true,
      assistantsCount: 1,
    });
    expect(m.deathContext?.earlyDeaths[1]).toEqual({
      time: '06:30',
      minute: 6.5,
      approxZone: 'Dragon / Bot River',
      killer: 'Syndra',
      participants: ['Ahri', 'Syndra'],
      assistants: [],
      assisted: false,
      assistantsCount: 0,
    });

    expect(m.itemSpikes).toHaveLength(MAX_ITEM_SPIKES_PER_GAME);
    expect(m.itemSpikes).toEqual([
      { item: "Luden's Companion", minute: 11 },
      { item: 'Shadowflame', minute: 18 },
      { item: "Rabadon's Deathcap", minute: 24 },
    ]);

    expect(m.skillMaxOrder).toBe('Q>W>E');

    // Verify excluded fields and honest terminology across serialized payload
    const serialized = JSON.stringify(ctx);
    expect(serialized.toLowerCase()).not.toContain('gank');
    expect(serialized).not.toContain('heatmapPositions');
    expect(serialized).not.toContain('wardPositions');
    expect(serialized).not.toContain('deathPositions');
    expect(serialized).not.toContain('killPositions');
    expect(serialized).not.toContain('assistPositions');
    expect(serialized).not.toContain('levelUps');
  });

  it('caps recentMatches deterministically at MAX_RECENT_MATCHES (20) and stays within bounded JSON byte size', () => {
    const matches = Array.from({ length: 25 }, (_, idx) =>
      createMatch({ matchId: `EUW1_${2000 + idx}`, gameVersion: '16.22.1' })
    );

    const ctxNotAnalyzed = buildAiContext(
      'Faker',
      'KR1',
      matches,
      'player-puuid',
      { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1250, wins: 120, losses: 90 },
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      null
    );

    expect(ctxNotAnalyzed.totalGamesAnalyzed).toBe(25);
    expect(ctxNotAnalyzed.recentMatches).toHaveLength(MAX_RECENT_MATCHES);
    expect(ctxNotAnalyzed.recentMatches[0].matchId).toBe('EUW1_2000');
    expect(ctxNotAnalyzed.recentMatches[19].matchId).toBe('EUW1_2019');

    const timelineFor20Matches: TimelineAnalysisDto = {
      heatmapPositions: Array.from({ length: 400 }, (_, i) => ({
        x: 5000 + i,
        y: 5000 + i,
        matchId: `EUW1_${2000 + (i % 20)}`,
        minute: i % 25,
      })),
      wardPositions: [],
      killPositions: [],
      deathPositions: [],
      assistPositions: [],
      powerSpikeTimelines: Array.from({ length: 20 }, (_, idx) => ({
        matchId: `EUW1_${2000 + idx}`,
        playerChampion: 'Ahri',
        opponentChampion: 'Syndra',
        win: idx % 2 === 0,
        points: [
          {
            minute: 10,
            playerGold: 3600,
            opponentGold: 3300,
            playerGoldLead: 300,
            playerXp: 4500,
            opponentXp: 4300,
            playerCs: 86,
            opponentCs: 78,
            playerItems: [],
            opponentItems: [],
            events: [],
          },
          {
            minute: 15,
            playerGold: 5800,
            opponentGold: 5300,
            playerGoldLead: 500,
            playerXp: 7300,
            opponentXp: 6900,
            playerCs: 132,
            opponentCs: 120,
            playerItems: [],
            opponentItems: [],
            events: [],
          },
        ],
      })),
      buildOrders: Array.from({ length: 20 }, (_, idx) => ({
        matchId: `EUW1_${2000 + idx}`,
        playerChampion: 'Ahri',
        win: idx % 2 === 0,
        items: [
          { itemId: 6655, minuteMark: 11, timestamp: 660000 },
          { itemId: 4645, minuteMark: 18, timestamp: 1080000 },
          { itemId: 3089, minuteMark: 24, timestamp: 1440000 },
        ],
      })),
      skillOrders: Array.from({ length: 20 }, (_, idx) => ({
        matchId: `EUW1_${2000 + idx}`,
        playerChampion: 'Ahri',
        win: idx % 2 === 0,
        levelUps: [{ skillSlot: 1, level: 1, minuteMark: 1 }],
        maxOrder: [1, 2, 3],
      })),
      eventTimelines: Array.from({ length: 20 }, (_, idx) => ({
        matchId: `EUW1_${2000 + idx}`,
        playerChampion: 'Ahri',
        opponentChampion: 'Syndra',
        win: idx % 2 === 0,
        events: [
          {
            minuteMark: 4,
            secondMark: 15,
            type: 'DEATH',
            actor: 'Ahri',
            target: 'Syndra',
            isPlayer: true,
            isOpponent: true,
            laneType: null,
            monsterType: null,
            position: { x: 5200, y: 5100 },
          },
        ],
      })),
      aggregateSummary: {
        avgFirstDeathMinute: 4.3,
        mostDangerousZone: 'Mid Lane',
        avgGoldLeadAt10: 300,
        avgGoldLeadAt15: 500,
        wardsPlacedTotal: 160,
        deathsTotal: 20,
        killsTotal: 120,
        assistsTotal: 100,
        gamesAnalyzed: 20,
      },
    };

    const ctxAnalyzed = buildAiContext(
      'Faker',
      'KR1',
      matches,
      'player-puuid',
      { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1250, wins: 120, losses: 90 },
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      timelineFor20Matches
    );

    const notAnalyzedBytes = new TextEncoder().encode(JSON.stringify(ctxNotAnalyzed)).byteLength;
    const analyzedBytes = new TextEncoder().encode(JSON.stringify(ctxAnalyzed)).byteLength;
    const oneMatchNotAnalyzedBytes = new TextEncoder().encode(
      JSON.stringify(
        buildAiContext(
          'Faker',
          'KR1',
          [matches[0]],
          'player-puuid',
          { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1250, wins: 120, losses: 90 },
          BASE_CHAMPION_STATS,
          BASE_OVERALL_STATS,
          null
        )
      )
    ).byteLength;
    const oneMatchAnalyzedBytes = new TextEncoder().encode(
      JSON.stringify(
        buildAiContext(
          'Faker',
          'KR1',
          [matches[0]],
          'player-puuid',
          { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1250, wins: 120, losses: 90 },
          BASE_CHAMPION_STATS,
          BASE_OVERALL_STATS,
          timelineFor20Matches
        )
      )
    ).byteLength;

    // Exact measured deterministic UTF-8 payload sizes & upper bounds (with 5-stat improvementStats + scoped sample records)
    expect(oneMatchNotAnalyzedBytes).toBe(5171);
    expect(oneMatchAnalyzedBytes).toBe(6234);
    expect(notAnalyzedBytes).toBe(25177);
    expect(analyzedBytes).toBe(38590);
    expect(notAnalyzedBytes).toBeLessThan(26000);
    expect(analyzedBytes).toBeLessThan(40000);
  });

  it('excludes short (<600s) and early-surrendered laner games from 10m lane CS target and counts them in missingLaneCsAt10Matches', () => {
    const shortMatch = createMatch({
      matchId: 'KR_SHORT_1',
      playerOverrides: { challenges: { laneMinionsFirst10Minutes: 53 } },
    });
    shortMatch.info!.gameDuration = 420; // 7m remake/short game

    const earlyFfMatch = createMatch({
      matchId: 'KR_EARLYFF_2',
      playerOverrides: {
        gameEndedInEarlySurrender: true,
        challenges: { laneMinionsFirst10Minutes: 54 },
      },
    });

    const fullValidMatch = createMatch({
      matchId: 'KR_VALID_3',
      playerOverrides: { challenges: { laneMinionsFirst10Minutes: 85 } },
    });

    const ctx = buildAiContext(
      'Faker',
      'KR1',
      [shortMatch, earlyFfMatch, fullValidMatch],
      'player-puuid',
      { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1250, wins: 120, losses: 90 },
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      null
    );

    expect(ctx.missingLaneCsAt10Matches).toBe(2);
    expect(ctx.avgLaneCsAt10).toMatchObject({
      matchCount: 1,
      targetMatchCount: 1,
      avgActual: 85,
      avgTarget: 120,
    });
    expect(ctx.recentMatches[0].laneCsAt10).toBeUndefined();
    expect(ctx.recentMatches[1].laneCsAt10).toBeUndefined();
    expect(ctx.recentMatches[2].laneCsAt10).toEqual({
      actual: 85,
      target: 120,
      targetLabel: 'Mid lane target',
    });
  });

  it('includes all 5 structured improvementStats evidence groups with denominators, missingness, and pre-purchase samples without duplicating perMatch/byChampion', () => {
    const match1 = createMatch({ matchId: 'KR_IMP_1' });
    const ctx = buildAiContext(
      'Faker',
      'KR1',
      [match1],
      'player-puuid',
      { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1250, wins: 120, losses: 90 },
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      null
    );

    expect(ctx.improvementStats).toBeDefined();
    expect(ctx.improvementStats?.totalGamesConsidered).toBe(1);
    expect(ctx.improvementStats?.excludedInvalidDurationGames).toBe(0);
    expect(ctx.improvementStats?.excludedMissingTimelineGames).toBe(1);
    expect(ctx.improvementStats?.hasTimelineAnalysis).toBe(false);

    // 1. Phase Farming
    expect(ctx.improvementStats?.phaseFarming.min10To20).toHaveProperty('eligibleGames');
    expect(ctx.improvementStats?.phaseFarming.min10To20).toHaveProperty('shortGames');
    expect(ctx.improvementStats?.phaseFarming.min10To20).toHaveProperty('missingFrameGames');
    expect(ctx.improvementStats?.phaseFarming.min20ToEnd).toHaveProperty('eligibleGames');

    // 2. Lead Retention
    expect(ctx.improvementStats?.leadRetention).toHaveProperty('eligibleGamesAt10');
    expect(ctx.improvementStats?.leadRetention).toHaveProperty('eligibleGamesAt20');
    expect(ctx.improvementStats?.leadRetention).toHaveProperty('missingOpponentGames');
    expect(ctx.improvementStats?.leadRetention).toHaveProperty('goldLeadRetentionRate');

    // 3. Death Cost
    expect(ctx.improvementStats?.deathCost).toHaveProperty('eligibleTimeDeadGames');
    expect(ctx.improvementStats?.deathCost.bounty).toHaveProperty('eligibleTimelineGames');
    expect(ctx.improvementStats?.deathCost.bounty).toHaveProperty('totalCombinedBountyGold');

    // 4. Unspent Gold
    expect(ctx.improvementStats?.unspentGold).toHaveProperty('eligibleGames');
    expect(ctx.improvementStats?.unspentGold).toHaveProperty('highBalanceThresholdGold', 1300);
    expect(Array.isArray(ctx.improvementStats?.unspentGold.prePurchaseSamples)).toBe(true);

    // 5. Team Objectives
    expect(ctx.improvementStats?.teamObjectives).toHaveProperty('eligibleTeamObjectiveGames');
    expect(ctx.improvementStats?.teamObjectives.tower).toHaveProperty('teamKills');
    expect(ctx.improvementStats?.teamObjectives.dragon).toHaveProperty('firstCount');
    expect(ctx.improvementStats?.teamObjectives.baron).toHaveProperty('personalTd');
    expect(ctx.improvementStats?.teamObjectives.riftHerald).toHaveProperty('timelineInvolved');
    expect(ctx.improvementStats?.teamObjectives.horde).toHaveProperty('teamAvg');

    // Ensure duplicate heavy arrays are omitted from coach payload
    expect(ctx.improvementStats).not.toHaveProperty('perMatch');
    expect(ctx.improvementStats).not.toHaveProperty('byChampion');
    expect(ctx.improvementStats).not.toHaveProperty('byRole');
  });

  it('scopes Spear Shot rankedRecord (1020W 884L = 1904G, 53.6%), savedHistory (462W 421L = 883G, 52.3%), and recentMatchSample (20G) without mixing denominators or emitting unscoped scalar winRate/totalWins/totalLosses (#34)', () => {
    const twentyMatches = Array.from({ length: 20 }, (_, idx) =>
      createMatch({
        matchId: `EUW1_${8000 + idx}`,
        gameVersion: '26.1.1',
        playerOverrides: {
          championName: 'Pantheon',
          teamPosition: 'TOP',
          win: idx < 11, // 11 wins, 9 losses in recent 20 games (55.0%)
        },
      })
    );

    const spearShotOverallStats: OverallStats = {
      ...BASE_OVERALL_STATS,
      wins: 462,
      losses: 421,
      winRate: (462 / 883) * 100,
      blueSide: { games: 440, wins: 240, winRate: (240 / 440) * 100 },
      redSide: { games: 443, wins: 222, winRate: (222 / 443) * 100 },
    };

    const spearShotChampions: ChampionStats[] = [
      {
        championName: 'Pantheon',
        games: 790,
        wins: 418,
        losses: 372,
        kills: 4500,
        deaths: 3900,
        assists: 4100,
        soloKills: 950,
        winRate: 52.91139,
        kda: 2.21,
        averageKills: 5.7,
        averageDeaths: 4.9,
        averageAssists: 5.2,
        averageCsPerMinute: 7.1,
        averageSoloKills: 1.2,
        averageTurretPlates: 2.1,
      },
    ];

    const ctx = buildAiContext(
      'Spear Shot',
      'EUW',
      twentyMatches,
      'player-puuid',
      { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1120, wins: 1020, losses: 884 },
      spearShotChampions,
      spearShotOverallStats,
      null
    );

    expect(ctx.rankedRecord).toEqual({
      wins: 1020,
      losses: 884,
      games: 1904,
      winRate: '53.6',
    });
    expect(ctx.savedHistory).toEqual({
      wins: 462,
      losses: 421,
      games: 883,
      winRate: '52.3',
    });
    expect(ctx.recentMatchSample).toEqual({
      games: 20,
      wins: 11,
      losses: 9,
      winRate: '55.0',
    });
    expect(ctx.blueSide).toEqual({
      games: 440,
      wins: 240,
      losses: 200,
      winRate: '54.5',
    });
    expect(ctx.redSide).toEqual({
      games: 443,
      wins: 222,
      losses: 221,
      winRate: '50.1',
    });
    expect(ctx.topChampions[0]).toEqual({
      name: 'Pantheon',
      games: 790,
      wins: 418,
      losses: 372,
      winRate: '53',
      kda: '2.21',
    });

    // Reject unscoped top-level scalars that previously caused LLM sample conflation
    expect(ctx).not.toHaveProperty('totalWins');
    expect(ctx).not.toHaveProperty('totalLosses');
    expect(ctx).not.toHaveProperty('winRate');
    expect(ctx).not.toHaveProperty('blueSideWinRate');
    expect(ctx).not.toHaveProperty('redSideWinRate');
  });

  it('marks rankedRecord or savedHistory as null when absent, zero-game, or counter-mismatched, and never borrows another sample denominator (#34)', () => {
    const match = createMatch({ matchId: 'EUW1_9001' });

    // 1. Missing overallStats (savedHistory null) while rankedRecord (1020W 884L) and recentMatchSample (1G) exist
    const ctxMissingSaved = buildAiContext(
      'Spear Shot',
      'EUW',
      [match],
      'player-puuid',
      { tier: 'CHALLENGER', rank: 'I', leaguePoints: 1120, wins: 1020, losses: 884 },
      BASE_CHAMPION_STATS,
      null,
      null
    );
    expect(ctxMissingSaved.rankedRecord).toEqual({
      wins: 1020,
      losses: 884,
      games: 1904,
      winRate: '53.6',
    });
    expect(ctxMissingSaved.savedHistory).toBeNull();
    expect(ctxMissingSaved.blueSide).toBeNull();
    expect(ctxMissingSaved.redSide).toBeNull();
    expect(ctxMissingSaved.topChampions).toEqual([]);
    expect(ctxMissingSaved.recentMatchSample).toEqual({
      games: 1,
      wins: 1,
      losses: 0,
      winRate: '100.0',
    });

    // 2. Unranked / zero-game rankInfo and zero-game overallStats
    const ctxZeroSamples = buildAiContext(
      'NewPlayer',
      'NA1',
      [],
      'player-puuid',
      { tier: 'UNRANKED', rank: '', leaguePoints: 0, wins: 0, losses: 0 },
      [],
      { ...BASE_OVERALL_STATS, wins: 0, losses: 0, winRate: 0 },
      null
    );
    expect(ctxZeroSamples.rank).toBe('Unranked');
    expect(ctxZeroSamples.rankedRecord).toBeNull();
    expect(ctxZeroSamples.savedHistory).toBeNull();
    expect(ctxZeroSamples.recentMatchSample).toEqual({
      games: 0,
      wins: 0,
      losses: 0,
      winRate: null,
    });

    // 3. Mismatched overallStats (winRate 52.3% paired with 1020W 884L or mismatched explicit totalMatches) -> savedHistory rejected as null
    const ctxMismatchedRate = buildAiContext(
      'CorruptCache',
      'EUW',
      [match],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      { ...BASE_OVERALL_STATS, wins: 1020, losses: 884, winRate: 52.3 },
      null
    );
    expect(ctxMismatchedRate.rankedRecord).toBeNull();
    expect(ctxMismatchedRate.savedHistory).toBeNull();

    const ctxMismatchedTotal = buildAiContext(
      'CorruptTotal',
      'EUW',
      [match],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      {
        ...BASE_OVERALL_STATS,
        wins: 462,
        losses: 421,
        winRate: 52.3216308,
        totalMatches: 1904,
      } as OverallStats,
      null
    );
    expect(ctxMismatchedTotal.savedHistory).toBeNull();
  });

  it('maps COMPLETE, PARTIAL, and BLOCKED timelineCoverage into truthful timelineStatus and player-safe greetings', () => {
    const m1 = createMatch({ matchId: 'EUW1_1001' });
    const m2 = createMatch({ matchId: 'EUW1_1002' });
    const partialTimeline: TimelineAnalysisDto = {
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
        avgGoldLeadAt10: 150,
        avgGoldLeadAt15: 200,
        wardsPlacedTotal: 6,
        deathsTotal: 1,
        killsTotal: 3,
        assistsTotal: 4,
        gamesAnalyzed: 1,
      },
    };

    const completeTimeline: TimelineAnalysisDto = {
      ...partialTimeline,
      aggregateSummary: {
        ...partialTimeline.aggregateSummary,
        gamesAnalyzed: 2,
      },
    };

    const completeCtx = buildAiContext(
      'TestMid',
      'EUW',
      [m1, m2],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      completeTimeline,
      null,
      { status: 'COMPLETE', covered: 2, requested: 2, stopReason: null }
    );
    expect(completeCtx.timelineStatus).toBe('ANALYZED');
    expect(completeCtx.timelineCoverage).toEqual({
      status: 'COMPLETE',
      covered: 2,
      requested: 2,
    });

    // Claiming COMPLETE when covered < requested downgrades honestly to PARTIAL
    const downgradedPartialCtx = buildAiContext(
      'TestMid',
      'EUW',
      [m1, m2],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      partialTimeline,
      null,
      { status: 'COMPLETE', covered: 1, requested: 2, stopReason: 'PARTIAL_PROFILE_MATCH_COVERAGE' }
    );
    expect(downgradedPartialCtx.timelineStatus).toBe('PARTIAL');
    expect(downgradedPartialCtx.timelineCoverage).toEqual({
      status: 'PARTIAL',
      covered: 1,
      requested: 2,
      stopReason: 'PARTIAL_PROFILE_MATCH_COVERAGE',
    });

    // Inconsistent gamesAnalyzed !== covered fails closed to BLOCKED and strips timelineInsights
    const inconsistentCtx = buildAiContext(
      'TestMid',
      'EUW',
      [m1, m2],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      partialTimeline, // gamesAnalyzed === 1 while coverage claims covered === 2
      null,
      { status: 'COMPLETE', covered: 2, requested: 2, stopReason: null }
    );
    expect(inconsistentCtx.timelineStatus).toBe('BLOCKED');
    expect(inconsistentCtx.timelineCoverage).toEqual({
      status: 'BLOCKED',
      covered: 0,
      requested: 2,
    });
    expect(inconsistentCtx.timelineInsights).toBeUndefined();

    const partialCtx = buildAiContext(
      'TestMid',
      'EUW',
      [m1, m2],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      partialTimeline,
      null,
      { status: 'PARTIAL', covered: 1, requested: 2, stopReason: 'RIOT_BUDGET_EXHAUSTED' }
    );
    expect(partialCtx.timelineStatus).toBe('PARTIAL');
    expect(partialCtx.timelineCoverage).toEqual({
      status: 'PARTIAL',
      covered: 1,
      requested: 2,
      stopReason: 'RIOT_BUDGET_EXHAUSTED',
    });

    const blockedCtx = buildAiContext(
      'TestMid',
      'EUW',
      [m1, m2],
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      null,
      null,
      { status: 'BLOCKED', covered: 0, requested: 2, stopReason: 'RIOT_RATE_LIMITED' }
    );
    expect(blockedCtx.timelineStatus).toBe('BLOCKED');
    expect(blockedCtx.timelineCoverage).toEqual({
      status: 'BLOCKED',
      covered: 0,
      requested: 2,
      stopReason: 'RIOT_RATE_LIMITED',
    });

    const greetings = {
      empty: buildCoachGreetingMessage({ totalGamesAnalyzed: 0 }, false),
      preparing: buildCoachGreetingMessage(blockedCtx, true),
      analyzed: buildCoachGreetingMessage(completeCtx, false),
      partial: buildCoachGreetingMessage(partialCtx, false),
      blocked: buildCoachGreetingMessage(blockedCtx, false),
      notAnalyzed: buildCoachGreetingMessage(
        { totalGamesAnalyzed: 2, timelineStatus: 'NOT_ANALYZED' },
        false
      ),
    };

    expect(greetings.empty).toContain('No recent matches are loaded yet');
    expect(greetings.preparing).toContain('preparing 10m/20m timeline checkpoints');
    expect(greetings.analyzed).toContain('10m/20m timeline checkpoints from 2 recent games are ready');
    expect(greetings.partial).toContain('ready for 1 of 2 games');
    expect(greetings.blocked).toContain('temporarily unavailable');
    expect(greetings.notAnalyzed).toContain('deep timeline analysis not run yet');

    for (const text of Object.values(greetings)) {
      expect(text).not.toMatch(/I've analyzed/i);
      expect(text).not.toMatch(/timelineStatus|timelineCoverage|NOT_ANALYZED|PARTIAL|BLOCKED/);
    }
  });
});

