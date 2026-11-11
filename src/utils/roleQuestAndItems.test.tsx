import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  classifyRoleBoundItem,
  describeMatchRoleQuestState,
  extractCleanSkillUps,
  extractDefensibleQuestCompletionSeconds,
  formatLeagueMonsterLabel,
  formatLeagueStructureLabel,
  formatLeagueWardLabel,
  reconcileTimelineBuildItems,
  TIER_3_BOOT_IDS,
  VERIFIED_ROLE_QUEST_METADATA,
} from './roleQuestUtils';
import ItemIcon from '../components/ItemIcon';
import ItemList from '../components/ItemList';
import MatchDetailsTab from '../components/MatchDetailsTab';
import TimelineAnalysisModal from '../components/TimelineAnalysisModal';
import * as timelineApi from '../api/timeline';
import { useDataDragonStore } from '../store/dataDragonStore';
import { buildAiContext } from './aiContextBuilder';
import type { MatchDto, ParticipantDto } from '../types/match';
import type { ChampionStats, OverallStats } from '../types/summoner';
import type { MatchTimelineDto, TimelineAnalysisDto } from '../types/timeline';

const BASE_OVERALL_STATS: OverallStats = {
  wins: 1,
  losses: 0,
  winRate: 100,
  kda: 5.0,
  avgKills: 7,
  avgDeaths: 2,
  avgAssists: 3,
  avgCsPerMinute: 8.5,
  avgKillParticipation: 60,
  avgSoloKills: 2,
  avgTurretPlates: 2,
  avgVisionScore: 22,
  blueSide: { games: 1, wins: 1, winRate: 100 },
  redSide: { games: 0, wins: 0, winRate: 0 },
  oppAvgKda: 2.0,
  oppAvgCsPerMinute: 7.5,
  oppAvgKillParticipation: 45,
  oppAvgSoloKills: 0,
  oppAvgTurretPlates: 1,
  oppAvgVisionScore: 18,
};

const BASE_CHAMP_STATS: ChampionStats[] = [
  {
    championName: 'Jinx',
    games: 1,
    wins: 1,
    losses: 0,
    kills: 7,
    deaths: 2,
    assists: 3,
    soloKills: 2,
    winRate: 100,
    kda: 5.0,
    averageKills: 7,
    averageDeaths: 2,
    averageAssists: 3,
    averageCsPerMinute: 8.5,
    averageSoloKills: 2,
    averageTurretPlates: 2,
  },
];

function makeParticipant(overrides: Partial<ParticipantDto> = {}): ParticipantDto {
  return {
    puuid: 'p1',
    participantId: 1,
    championName: 'Jinx',
    teamId: 100,
    teamPosition: 'BOTTOM',
    win: true,
    kills: 7,
    deaths: 2,
    assists: 3,
    totalMinionsKilled: 220,
    neutralMinionsKilled: 12,
    visionScore: 22,
    wardsPlaced: 8,
    wardsKilled: 3,
    detectorWardsPlaced: 2,
    damageDealtToObjectives: 12000,
    damageDealtToTurrets: 5500,
    totalDamageDealtToChampions: 28000,
    physicalDamageDealtToChampions: 25000,
    magicDamageDealtToChampions: 2000,
    trueDamageDealtToChampions: 1000,
    goldEarned: 15200,
    summoner1Id: 4,
    summoner2Id: 7,
    item0: 3031,
    item1: 3094,
    item2: 3036,
    item3: 3072,
    item4: 3026,
    item5: 6672,
    item6: 3363,
    ...overrides,
  };
}

const FORBIDDEN_RAW_SCHEMA_OR_ENUM_TOKENS = [
  'roleBoundItem',
  'dtoSchemaVersion',
  'WARD_PLACED',
  'WARD_KILL',
  'ITEM_UNDO',
  'ITEM_DESTROYED',
  'SKILL_LEVEL_UP',
  'BARON_NASHOR',
  'RIFTHERALD',
  'HORDE',
  'TOP_LANE',
  'MID_LANE',
  'BOT_LANE',
  'UNDEFINED',
  'UNKNOWN',
  'YELLOW_TRINKET',
  'CONTROL_WARD',
  'Data Dragon',
  'DDragon',
  'MatchDto',
  'TimelineDto',
  'RoleQuest:',
  'RoleSlot:',
  'Item #',
  'Item 9999',
  'Rune #',
  'Spell #',
];

function expectNoForbiddenRawIdentifiers(text: string) {
  for (const token of FORBIDDEN_RAW_SCHEMA_OR_ENUM_TOKENS) {
    expect(text).not.toContain(token);
  }
  expect(text).not.toMatch(/\bnull\b/i);
  expect(text).not.toMatch(/\bundefined\b/i);
}

describe('Workstream 4: Season 2026 Role Quests, 7th-Slot Boots & Timeline Accuracy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useDataDragonStore.setState({
      version: '16.22.1',
      cdnUrl: 'https://ddragon.leagueoflegends.com/cdn/16.22.1',
      itemMap: {
        3006: {
          name: "Berserker's Greaves",
          description: 'Attack speed boots',
          plaintext: 'Attack speed boots',
          gold: { base: 500, total: 1100, sell: 770, purchasable: true },
        },
        3172: {
          name: 'Gunmetal Greaves',
          description: 'Tier 3 Attack Speed Boots',
          plaintext: 'Tier 3 Attack Speed Boots',
          gold: { base: 0, total: 1100, sell: 770, purchasable: true },
        },
        3031: {
          name: 'Infinity Edge',
          description: 'Crit spike',
          plaintext: 'Crit spike',
          gold: { base: 600, total: 3400, sell: 2380, purchasable: true },
        },
        3363: {
          name: 'Farsight Alteration',
          description: 'Blue trinket',
          plaintext: 'Blue trinket',
          gold: { base: 0, total: 0, sell: 0, purchasable: true },
        },
      },
    });
  });

  it('distinguishes legacy null/undefined roleBoundItem from 0, quest starters, rewards, boots, and unseen IDs', () => {
    expect(classifyRoleBoundItem(null)).toEqual({ kind: 'unknown' });
    expect(classifyRoleBoundItem(undefined)).toEqual({ kind: 'unknown' });
    expect(classifyRoleBoundItem(0)).toEqual({ kind: 'empty' });
    expect(classifyRoleBoundItem(1202).kind).toBe('quest_starter');
    expect(classifyRoleBoundItem(1206).kind).toBe('quest_reward');
    expect(classifyRoleBoundItem(3006)).toEqual({ kind: 'boots', itemId: 3006 });
    expect(classifyRoleBoundItem(3172)).toEqual({ kind: 'boots', itemId: 3172 });
    expect(classifyRoleBoundItem(9999)).toEqual({ kind: 'unknown_item', itemId: 9999 });
  });

  it('omits roleBoundItem slot in ItemList when null or 0, and renders 7th-slot / unseen positive IDs with plain League fallback labels', () => {
    const { rerender, container } = render(
      <ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={null} />
    );
    expect(container.querySelectorAll('img')).toHaveLength(4); // 2 desktop + 2 mobile (3031 + 3363)

    rerender(<ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={0} />);
    expect(container.querySelectorAll('img')).toHaveLength(4);

    rerender(<ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={3006} />);
    expect(container.querySelectorAll('img')).toHaveLength(6);

    rerender(<ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={9999} />);
    const unrecognizedImgs = screen.getAllByAltText('Unrecognized Item');
    expect(unrecognizedImgs).toHaveLength(2);
    const tooltipHtml = unrecognizedImgs[0].getAttribute('data-tooltip-content') ?? '';
    expect(tooltipHtml).toContain('Role Quest Slot');
    expect(tooltipHtml).toContain('Item details and icon are not yet available for this patch.');
    expectNoForbiddenRawIdentifiers(tooltipHtml);
  });

  it('switches ItemIcon to graceful plain-worded badge fallback on image 404 (#1184) without broken image or numeric IDs', () => {
    const { unmount } = render(<ItemIcon itemId={1206} isRoleBoundSlot />);
    const img = screen.getByAltText('Mid Lane Quest Reward');
    fireEvent.error(img);

    const fallback = screen.getByTestId('item-fallback-1206');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toBe('Reward');
    expectNoForbiddenRawIdentifiers(fallback.getAttribute('data-tooltip-content') ?? '');
    unmount();

    render(<ItemIcon itemId={9999} isRoleBoundSlot />);
    fireEvent.error(screen.getByAltText('Unrecognized Item'));
    const unknownFallback = screen.getByTestId('item-fallback-9999');
    expect(unknownFallback.textContent).toBe('Item');
    expect(unknownFallback.textContent).not.toContain('9999');
  });

  it('reconciles ITEM_UNDO safely including #1174 Tier 3 boot undo where beforeId is 0', () => {
    const timeline: MatchTimelineDto = {
      metadata: { matchId: 'NA1_1', participants: ['p1'] },
      info: {
        frameInterval: 60000,
        participants: [{ participantId: 1, puuid: 'p1' }],
        frames: [
          {
            timestamp: 60000,
            participantFrames: {},
            events: [
              { type: 'ITEM_PURCHASED', participantId: 1, itemId: 1055, timestamp: 15000 },
              { type: 'ITEM_PURCHASED', participantId: 1, itemId: 1036, timestamp: 120000 },
              { type: 'ITEM_UNDO', participantId: 1, beforeId: 1036, afterId: 0, timestamp: 122000 },
              { type: 'ITEM_PURCHASED', participantId: 1, itemId: 3172, timestamp: 900000 },
              // #1174 bug: Tier 3 boot undo emits beforeId = 0 -> must NOT pop unrelated items
              { type: 'ITEM_UNDO', participantId: 1, beforeId: 0, afterId: 3006, timestamp: 905000 },
            ],
          },
        ],
      },
    };

    const items = reconcileTimelineBuildItems(timeline, 1);
    expect(items.map(i => i.itemId)).toEqual([1055, 3172]);
  });

  it('filters EVOLVE skill events, deduplicates #1100 identical bursts, and preserves >18 points without hard cap', () => {
    const normalEvents = Array.from({ length: 19 }, (_, idx) => ({
      type: 'SKILL_LEVEL_UP',
      participantId: 1,
      skillSlot: (idx % 3) + 1,
      levelUpType: 'NORMAL',
      timestamp: (idx + 1) * 60000,
    }));

    const timeline: MatchTimelineDto = {
      metadata: { matchId: 'NA1_2', participants: ['p1'] },
      info: {
        frameInterval: 60000,
        participants: [{ participantId: 1, puuid: 'p1' }],
        frames: [
          {
            timestamp: 60000,
            participantFrames: {},
            events: [
              ...normalEvents,
              // Duplicate #1100 burst at identical timestamp
              { type: 'SKILL_LEVEL_UP', participantId: 1, skillSlot: 1, levelUpType: 'NORMAL', timestamp: 60000 },
              // Kai'Sa / Viktor / Kha'Zix evolution -> excluded
              { type: 'SKILL_LEVEL_UP', participantId: 1, skillSlot: 1, levelUpType: 'EVOLVE', timestamp: 660000 },
            ],
          },
        ],
      },
    };

    const skills = extractCleanSkillUps(timeline, 1);
    expect(skills).toHaveLength(19);
  });

  it('returns conservative Role Quest completion seconds only when unambiguously proven, and null on legacy/ambiguous states', () => {
    const baseTimeline: MatchTimelineDto = {
      metadata: { matchId: 'NA1_3', participants: ['p1'] },
      info: {
        frameInterval: 60000,
        participants: [{ participantId: 1, puuid: 'p1' }],
        frames: [
          {
            timestamp: 780000,
            participantFrames: {},
            events: [
              { type: 'ITEM_DESTROYED', participantId: 1, itemId: 1201, timestamp: 765000 },
            ],
          },
        ],
      },
    };

    // Proven completed Mid Quest reward (1206) + single starter destruction (1201) -> 765s
    expect(
      extractDefensibleQuestCompletionSeconds(
        baseTimeline,
        makeParticipant({ teamPosition: 'MIDDLE', roleBoundItem: 1206 }),
        1
      )
    ).toBe(765);

    // Legacy null roleBoundItem -> MUST return null (never infer completion from destruction alone)
    expect(
      extractDefensibleQuestCompletionSeconds(
        baseTimeline,
        makeParticipant({ teamPosition: 'MIDDLE', roleBoundItem: null }),
        1
      )
    ).toBeNull();

    // Unseen positive roleBoundItem (9999) -> MUST return null
    expect(
      extractDefensibleQuestCompletionSeconds(
        baseTimeline,
        makeParticipant({ teamPosition: 'MIDDLE', roleBoundItem: 9999 }),
        1
      )
    ).toBeNull();
  });

  it('enriches Coach context with Role Quest Boot Slot & Mid Tier 3 boot spikes without raw enum/variable prefixes', () => {
    expect(TIER_3_BOOT_IDS.has(3172)).toBe(true);

    const botMatch: MatchDto = {
      metadata: { matchId: 'NA1_BOT', participants: ['p1', 'opp1'] },
      info: {
        gameId: 1,
        gameCreation: 1770000000000,
        gameDuration: 1800,
        gameMode: 'CLASSIC',
        gameVersion: '16.22.1',
        queueId: 420,
        participants: [
          makeParticipant({ puuid: 'p1', teamPosition: 'BOTTOM', roleBoundItem: 3006 }),
          makeParticipant({ puuid: 'opp1', teamId: 200, teamPosition: 'BOTTOM', roleBoundItem: null }),
        ],
        teams: [
          { teamId: 100, win: true },
          { teamId: 200, win: false },
        ],
      },
    };

    const timelineAnalysis: TimelineAnalysisDto = {
      heatmapPositions: [],
      deathPositions: [],
      wardPositions: [],
      killPositions: [],
      assistPositions: [],
      powerSpikeTimelines: [],
      buildOrders: [
        {
          matchId: 'NA1_BOT',
          playerChampion: 'Jinx',
          win: true,
          items: [
            { itemId: 3172, timestamp: 840000, minuteMark: 14 },
            { itemId: 3031, timestamp: 1140000, minuteMark: 19 },
          ],
        },
      ],
      skillOrders: [],
      eventTimelines: [],
      aggregateSummary: {
        avgFirstDeathMinute: 6.5,
        mostDangerousZone: 'Bot Lane',
        avgGoldLeadAt10: 200,
        avgGoldLeadAt15: 450,
        wardsPlacedTotal: 8,
        deathsTotal: 2,
        killsTotal: 7,
        assistsTotal: 3,
        gamesAnalyzed: 1,
      },
    };

    const ctx = buildAiContext(
      'TestADC',
      'NA1',
      [botMatch],
      'p1',
      null,
      BASE_CHAMP_STATS,
      BASE_OVERALL_STATS,
      timelineAnalysis
    );

    expect(ctx.recentMatches[0].items).toContain("Berserker's Greaves (Role Quest Boot Slot)");
    expect(
      ctx.recentMatches[0].opponent?.items.some(i => i.includes('Slot') || i.includes('Quest'))
    ).toBe(false);
    expect(ctx.recentMatches[0].itemSpikes?.map(s => s.item)).toContain('Gunmetal Greaves');
    expect(ctx.visionDataPrecision).not.toContain('WARD_PLACED');
    expectNoForbiddenRawIdentifiers(JSON.stringify(ctx.recentMatches[0].items));
  });

  it('never exposes raw variable/schema/enum names across Role Quest metadata, League event formatters, MatchDetailsTab, or TimelineAnalysisModal, and distinguishes missing from zero in plain words', async () => {
    // 1. Every verified Role Quest & Tier 3 Boot metadata entry uses plain League language
    for (const meta of Object.values(VERIFIED_ROLE_QUEST_METADATA)) {
      expectNoForbiddenRawIdentifiers(`${meta.name} | ${meta.shortLabel} | ${meta.summary}`);
    }

    // 2. Monster, structure, and ward formatters translate raw Riot enums and missing values cleanly
    expect(formatLeagueMonsterLabel('BARON_NASHOR')).toBe('Baron Nashor');
    expect(formatLeagueMonsterLabel('RIFTHERALD')).toBe('Rift Herald');
    expect(formatLeagueMonsterLabel('HORDE')).toBe('Void Grubs');
    expect(formatLeagueMonsterLabel('DRAGON', 'FIRE_DRAGON')).toBe('Infernal Drake');
    expect(formatLeagueMonsterLabel(null)).toBe('Epic Monster');
    expect(formatLeagueStructureLabel('TOP_LANE', 'TOWER_BUILDING', 'BUILDING_KILL')).toBe('Top Lane Turret');
    expect(formatLeagueStructureLabel('MID_LANE', undefined, 'TURRET_PLATE_DESTROYED')).toBe('Mid Turret Plate');
    expect(formatLeagueStructureLabel(null, 'TOWER_BUILDING', 'BUILDING_KILL')).toBe('Enemy Turret');
    expect(formatLeagueWardLabel('YELLOW_TRINKET')).toBe('Stealth Ward');
    expect(formatLeagueWardLabel('CONTROL_WARD')).toBe('Control Ward');

    // 3. Explicit missing/unrecorded (null) vs zero (0) vs in-progress vs completed Role Quest states
    const missingState = describeMatchRoleQuestState({
      participant: makeParticipant({ teamPosition: 'MIDDLE', roleBoundItem: null }),
      gameVersion: '16.22.1',
      queueId: 420,
      gameDurationSeconds: 1800,
      completionSeconds: null,
    });
    const zeroState = describeMatchRoleQuestState({
      participant: makeParticipant({ teamPosition: 'MIDDLE', roleBoundItem: 0 }),
      gameVersion: '16.22.1',
      queueId: 420,
      gameDurationSeconds: 1800,
      completionSeconds: null,
    });
    const starterState = describeMatchRoleQuestState({
      participant: makeParticipant({ teamPosition: 'MIDDLE', roleBoundItem: 1201 }),
      gameVersion: '16.22.1',
      queueId: 420,
      gameDurationSeconds: 1800,
      completionSeconds: null,
    });
    const completedAmbiguousTimeState = describeMatchRoleQuestState({
      participant: makeParticipant({ teamPosition: 'MIDDLE', roleBoundItem: 1206 }),
      gameVersion: '16.22.1',
      queueId: 420,
      gameDurationSeconds: 1800,
      completionSeconds: null,
    });

    expect(missingState.label).toBe('Role Quest data not recorded for this match');
    expect(zeroState.label).toBe('No Role Quest item (0 completed)');
    expect(missingState.label).not.toBe(zeroState.label);
    expect(starterState.label).toBe('Mid Lane Quest in progress (not completed)');
    expect(completedAmbiguousTimeState.label).toBe('Role Quest Completed (exact time unavailable)');
    for (const s of [missingState, zeroState, starterState, completedAmbiguousTimeState]) {
      expectNoForbiddenRawIdentifiers(s.label);
    }

    // 4. End-to-end MatchDetailsTab render with raw Riot enums + unseen item 9999 + missing vs zero quest states
    const rawTimeline: MatchTimelineDto = {
      metadata: { matchId: 'EUW1_900', participants: ['p1', 'opp1'] },
      info: {
        frameInterval: 60000,
        participants: [
          { participantId: 1, puuid: 'p1' },
          { participantId: 6, puuid: 'opp1' },
        ],
        frames: [
          {
            timestamp: 600000,
            participantFrames: {},
            events: [
              { type: 'ITEM_PURCHASED', participantId: 1, itemId: 9999, timestamp: 480000 },
              { type: 'ELITE_MONSTER_KILL', killerId: 1, monsterType: 'HORDE', timestamp: 390000 },
              { type: 'ELITE_MONSTER_KILL', killerId: 1, monsterType: 'RIFTHERALD', timestamp: 870000 },
              { type: 'ELITE_MONSTER_KILL', killerId: 6, monsterType: 'BARON_NASHOR', timestamp: 1320000 },
              { type: 'BUILDING_KILL', killerId: 1, laneType: 'TOP_LANE', buildingType: 'TOWER_BUILDING', timestamp: 900000 },
              { type: 'BUILDING_KILL', killerId: 6, buildingType: 'TOWER_BUILDING', timestamp: 960000 },
            ],
          },
        ],
      },
    };
    vi.spyOn(timelineApi, 'getMatchTimeline').mockResolvedValue(rawTimeline);

    const playerMissingQuest = makeParticipant({
      puuid: 'p1',
      participantId: 1,
      championName: 'Ahri',
      teamPosition: 'MIDDLE',
      roleBoundItem: null,
    });
    const opponent = makeParticipant({
      puuid: 'opp1',
      participantId: 6,
      teamId: 200,
      championName: 'Syndra',
      teamPosition: 'MIDDLE',
    });

    const { container, unmount } = render(
      <MatchDetailsTab
        matchId="EUW1_900"
        region="euw1"
        puuid="p1"
        playerParticipant={playerMissingQuest}
        opponentParticipant={opponent}
        allParticipants={[playerMissingQuest, opponent]}
        gameDuration={1800}
        gameVersion="16.22.1"
        queueId={420}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Void Grubs')).toBeInTheDocument();
    });
    expect(screen.getByText('Rift Herald')).toBeInTheDocument();
    expect(screen.getByText('Baron Nashor')).toBeInTheDocument();
    expect(screen.getByText('Top Lane Turret')).toBeInTheDocument();
    expect(screen.getByText('Enemy Turret')).toBeInTheDocument();
    expect(screen.getByTestId('role-quest-status-badge')).toHaveTextContent(
      'Role Quest data not recorded for this match'
    );
    expectNoForbiddenRawIdentifiers(container.textContent ?? '');
    for (const el of Array.from(container.querySelectorAll('[title], [alt], [data-tooltip-content]'))) {
      expectNoForbiddenRawIdentifiers(el.getAttribute('title') ?? '');
      expectNoForbiddenRawIdentifiers(el.getAttribute('alt') ?? '');
      expectNoForbiddenRawIdentifiers(el.getAttribute('data-tooltip-content') ?? '');
    }
    unmount();

    // 5. TimelineAnalysisModal Aggregate Summary distinguishes 0 deaths & 0 quest completions from unavailable timing
    const zeroCompletionsAnalysis: TimelineAnalysisDto = {
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
        gamesAnalyzed: 2,
        killsTotal: 9,
        deathsTotal: 0,
        assistsTotal: 11,
        wardsPlacedTotal: 14,
        avgFirstDeathMinute: 0,
        mostDangerousZone: 'Unknown',
        avgGoldLeadAt10: 320,
        avgGoldLeadAt15: 610,
        roleQuestEligibleGames: 2,
        roleQuestCompletedGames: 0,
        roleQuestAmbiguousGames: 0,
        avgRoleQuestCompletionMinute: null,
      },
    };

    const modalZero = render(
      <TimelineAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        analysis={zeroCompletionsAnalysis}
        summonerName="PlainWordsTester"
        onOpenAiCoach={vi.fn()}
      />
    );
    expect(screen.getByText('No deaths')).toBeInTheDocument();
    expect(screen.getByText('No deaths recorded')).toBeInTheDocument();
    expect(screen.getByText('0 completed')).toBeInTheDocument();
    expectNoForbiddenRawIdentifiers(document.body.textContent ?? '');
    modalZero.unmount();

    const ambiguousAnalysis: TimelineAnalysisDto = {
      ...zeroCompletionsAnalysis,
      aggregateSummary: {
        ...zeroCompletionsAnalysis.aggregateSummary,
        roleQuestEligibleGames: 2,
        roleQuestCompletedGames: null,
        roleQuestAmbiguousGames: 1,
        avgRoleQuestCompletionMinute: null,
      },
    };
    const modalAmbiguous = render(
      <TimelineAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        analysis={ambiguousAnalysis}
        summonerName="PlainWordsTester"
        onOpenAiCoach={vi.fn()}
      />
    );
    expect(screen.getByText('Timing unavailable')).toBeInTheDocument();
    expectNoForbiddenRawIdentifiers(document.body.textContent ?? '');
    modalAmbiguous.unmount();
  });
});

