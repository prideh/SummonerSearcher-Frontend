import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildAiContext,
  formatPatchMajorMinor,
  MAX_EARLY_DEATHS_PER_GAME,
  MAX_ITEM_SPIKES_PER_GAME,
  MAX_RECENT_MATCHES,
  VISION_DATA_PRECISION_NOTE,
} from './aiContextBuilder';
import { useDataDragonStore } from '../store/dataDragonStore';
import type { MatchDto, ParticipantDto } from '../types/match';
import type { ChampionStats, OverallStats } from '../types/summoner';
import type { TimelineAnalysisDto } from '../types/timeline';

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
    championName: 'Syndndra',
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

  it('formats major.minor patch strings cleanly', () => {
    expect(formatPatchMajorMinor('16.22.612.4910')).toBe('16.22');
    expect(formatPatchMajorMinor('15.24.1')).toBe('15.24');
    expect(formatPatchMajorMinor(undefined)).toBeUndefined();
    expect(formatPatchMajorMinor('')).toBeUndefined();
  });

  it('builds match context with loadout, draft, early CS, vision/objective counts, and NOT_ANALYZED status when timeline was not run', () => {
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
          laneMinionsFirst10Minutes: 79,
          turretPlatesTaken: 1,
          controlWardsPlaced: 1,
        },
      },
    });

    const ctx = buildAiContext(
      'Faker',
      'KR1',
      [post26Match, pre26JungleMatch, pre26LaneMatch],
      'player-puuid',
      { tier: 'DIAMOND', rank: 'I', leaguePoints: 75, wins: 40, losses: 30 },
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      null
    );

    expect(ctx.timelineStatus).toBe('NOT_ANALYZED');
    expect(ctx.visionDataPrecision).toBe(VISION_DATA_PRECISION_NOTE);
    expect(ctx.timelineInsights).toBeUndefined();

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
      enemies: ['Syndndra', 'Renekton', 'Viego', 'KaiSa', 'Nautilus'],
    });
    expect(m1.damageSplitPct).toEqual({ physical: 15, magic: 75, true: 10 });
    expect(m1.laneCsAt10).toEqual({
      actual: 86,
      spawnedSupply: 120,
      supplyLabel: 'Theoretical spawned supply (not guaranteed farmable)',
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

    // Match 3: Laner on pre-26.1 patch excludes 120 ceiling
    const m3 = ctx.recentMatches[2];
    expect(m3.patch).toBe('15.24');
    expect(m3.laneCsAt10).toEqual({
      actual: 79,
      spawnedSupply: null,
      supplyLabel: null,
    });
  });

  it('enriches matches with timeline diffs, death context (labelled assisted, never gank), capped item spikes, and skillMaxOrder when timelineAnalysis is provided', () => {
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
              actor: 'LeeSin',
              target: 'Ahri',
              killer: 'LeeSin',
              assistants: ['Syndra'],
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: { x: 6800, y: 6900 },
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
              actor: 'Syndra',
              target: 'Ahri',
              killer: 'Syndra',
              assistants: [],
              isPlayer: true,
              isOpponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 7000, y: 7100 },
            },
            {
              minuteMark: 9,
              secondMark: 0,
              type: 'DEATH',
              actor: 'Syndra',
              target: 'Ahri',
              killer: 'Syndra',
              assistants: ['LeeSin', 'Nautilus'],
              isPlayer: true,
              isOpponent: true,
              laneType: null,
              monsterType: null,
              position: { x: 7200, y: 7200 },
            },
            {
              minuteMark: 13,
              secondMark: 0,
              type: 'DEATH',
              actor: 'Renekton',
              target: 'Ahri',
              killer: 'Renekton',
              assistants: [],
              isPlayer: true,
              isOpponent: false,
              laneType: null,
              monsterType: null,
              position: { x: 6500, y: 6500 },
            },
            {
              minuteMark: 20,
              secondMark: 0,
              type: 'DEATH',
              actor: 'KaiSa',
              target: 'Ahri',
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
    expect(ctx.timelineInsights?.deathsNearObjectiveWindows).toBe(1);
    expect(ctx.timelineInsights?.wardsByTimeBucket).toEqual({
      pre10: 1,
      min10To20: 1,
      post20: 1,
    });

    const m = ctx.recentMatches[0];
    expect(m.timelineAt10).toEqual({ goldDiff: 350, xpDiff: 300, csDiff: 8 });
    expect(m.timelineAt15).toEqual({ goldDiff: 600, xpDiff: 500, csDiff: 14 });

    expect(m.deathContext).toBeDefined();
    expect(m.deathContext?.firstDeathMinute).toBe(3.5);
    expect(m.deathContext?.deathsBefore10).toBe(3);
    expect(m.deathContext?.assistedDeaths).toBe(3);
    expect(m.deathContext?.unassistedDeaths).toBe(2);
    expect(m.deathContext?.deathsNearObjectiveWindows).toBe(1);
    expect(m.deathContext?.earlyDeaths).toHaveLength(MAX_EARLY_DEATHS_PER_GAME);
    expect(m.deathContext?.earlyDeaths[0]).toEqual({
      minute: 3.5,
      killer: 'LeeSin',
      assisted: true,
      assistantsCount: 1,
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

  it('caps recentMatches deterministically at MAX_RECENT_MATCHES (20)', () => {
    const matches = Array.from({ length: 25 }, (_, idx) =>
      createMatch({ matchId: `EUW1_${2000 + idx}`, gameVersion: '16.22.1' })
    );

    const ctx = buildAiContext(
      'Faker',
      'KR1',
      matches,
      'player-puuid',
      null,
      BASE_CHAMPION_STATS,
      BASE_OVERALL_STATS,
      null
    );

    expect(ctx.totalGamesAnalyzed).toBe(25);
    expect(ctx.recentMatches).toHaveLength(MAX_RECENT_MATCHES);
    expect(ctx.recentMatches[0].matchId).toBe('EUW1_2000');
    expect(ctx.recentMatches[19].matchId).toBe('EUW1_2019');
  });
});
