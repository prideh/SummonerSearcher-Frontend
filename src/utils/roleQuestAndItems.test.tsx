import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  classifyRoleBoundItem,
  extractCleanSkillUps,
  extractDefensibleQuestCompletionSeconds,
  reconcileTimelineBuildItems,
  TIER_3_BOOT_IDS,
} from './roleQuestUtils';
import ItemIcon from '../components/ItemIcon';
import ItemList from '../components/ItemList';
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

describe('Workstream 4: Season 2026 Role Quests, 7th-Slot Boots & Timeline Accuracy', () => {
  beforeEach(() => {
    useDataDragonStore.setState({
      version: '16.22.1',
      cdnUrl: 'https://ddragon.leagueoflegends.com/cdn/16.22.1',
      itemMap: {
        3006: {
          name: "Berserker's Greaves",
          description: 'Attack speed boots',
          gold: { base: 500, total: 1100, sell: 770, purchasable: true },
        },
        3172: {
          name: 'Gunmetal Greaves',
          description: 'Tier 3 Attack Speed Boots',
          gold: { base: 0, total: 1100, sell: 770, purchasable: true },
        },
        3031: {
          name: 'Infinity Edge',
          description: 'Crit spike',
          gold: { base: 600, total: 3400, sell: 2380, purchasable: true },
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

  it('omits roleBoundItem slot in ItemList when null or 0, and renders 7th-slot / unseen positive IDs with fallback safety', () => {
    const { rerender, container } = render(
      <ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={null} />
    );
    expect(container.querySelectorAll('img')).toHaveLength(4); // 2 desktop + 2 mobile (3031 + 3363)

    rerender(<ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={0} />);
    expect(container.querySelectorAll('img')).toHaveLength(4);

    rerender(<ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={3006} />);
    expect(container.querySelectorAll('img')).toHaveLength(6);

    rerender(<ItemList mainItems={[3031, 0, 0, 0, 0, 0]} trinket={3363} roleBoundItem={9999} />);
    expect(screen.getAllByAltText('Item #9999')).toHaveLength(2);
  });

  it('switches ItemIcon to graceful badge fallback on image 404 (#1184) without broken image element', () => {
    render(<ItemIcon itemId={1206} isRoleBoundSlot />);
    const img = screen.getByAltText('Mid Lane Quest Reward');
    fireEvent.error(img);

    const fallback = screen.getByTestId('item-fallback-1206');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toBe('QR');
  });

  it('reconciles ITEM_UNDO safely including #1174 Tier 3 boot undo where beforeId is 0', () => {
    const timeline: MatchTimelineDto = {
      metadata: { dataVersion: '2', matchId: 'NA1_1', participants: ['p1'] },
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
      metadata: { dataVersion: '2', matchId: 'NA1_2', participants: ['p1'] },
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
      metadata: { dataVersion: '2', matchId: 'NA1_3', participants: ['p1'] },
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

  it('enriches Coach context with 7th-slot boots & Mid Tier 3 boot spikes (including 3172 Gunmetal Greaves) while omitting legacy null', () => {
    expect(TIER_3_BOOT_IDS.has(3172)).toBe(true);

    const botMatch: MatchDto = {
      metadata: { matchId: 'NA1_BOT', participants: ['p1', 'opp1'] },
      info: {
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
      matchesAnalyzed: 1,
      powerSpikeTimelines: [],
      buildOrders: [
        {
          matchId: 'NA1_BOT',
          championName: 'Jinx',
          win: true,
          items: [
            { itemId: 3172, timestamp: 840000, minuteMark: 14 },
            { itemId: 3031, timestamp: 1140000, minuteMark: 19 },
          ],
        },
      ],
      skillOrders: [],
      eventTimelines: [],
      positionHeatmaps: [],
      summary: {
        avgGoldDiffAt10: 200,
        avgGoldDiffAt15: 450,
        avgCsDiffAt10: 5,
        avgCsDiffAt15: 10,
        avgXpDiffAt10: 150,
        avgXpDiffAt15: 300,
        earlyLeadWinRate: 100,
        comebackRate: 0,
        throwRate: 0,
        avgFirstItemMinute: 12,
      },
    };

    const ctx = buildAiContext(
      {
        puuid: 'p1',
        gameName: 'TestADC',
        tagLine: 'NA1',
        profileIconId: 1,
        summonerLevel: 250,
        leagues: [],
        recentMatches: [botMatch],
        overallStats: BASE_OVERALL_STATS,
        championStats: BASE_CHAMP_STATS,
      },
      [botMatch],
      BASE_OVERALL_STATS,
      BASE_CHAMP_STATS,
      null,
      timelineAnalysis
    );

    const recentGames = ctx.recentGames as Array<{
      items?: string[];
      opponent?: { items?: string[] };
      itemSpikes?: Array<{ item: string; minute: number }>;
    }>;
    expect(recentGames[0].items).toContain("Berserker's Greaves (7th Slot)");
    expect(recentGames[0].opponent?.items?.some(i => i.includes('Slot') || i.includes('RoleQuest'))).toBe(false);
    expect(recentGames[0].itemSpikes?.map(s => s.item)).toContain('Gunmetal Greaves');
  });
});
