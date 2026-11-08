import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ImprovementStatsSection from './ImprovementStatsSection';
import { useDataDragonStore } from '../store/dataDragonStore';
import type { ImprovementStatsDto } from '../types/improvementStats';
import {
  resolveImprovementStats,
  formatTemporalEventDescription,
  formatPurchaseItemLabel,
} from '../utils/improvementStatsHelper';
import type { MatchDto } from '../types/match';
import type { TimelineAnalysisDto } from '../types/timeline';
import { isPlayerTimelineEvent, isOpponentTimelineEvent } from '../types/timeline';
import backend18ContractJson from '../test/fixtures/improvement-stats-contract.json';

/**
 * Exact byte-for-byte Jackson-serialized JSON contract fixture from Backend #18
 * (`src/test/resources/fixtures/improvement-stats-contract.json` in `prideh/SummonerSearcher-Backend`).
 */
const BACKEND_18_ANALYZED_FIXTURE = backend18ContractJson as unknown as ImprovementStatsDto;

describe('ImprovementStatsSection', () => {
  it('renders pre-timeline match-only stats honestly (Unavailable for timeline metrics, never 0) and does not auto-call timeline analysis', () => {
    const rawProviderMatchJson = `{
      "metadata": { "matchId": "NA1_101", "participants": ["player-puuid"] },
      "info": {
        "gameId": 101,
        "gameCreation": 1700000000000,
        "gameDuration": 1800,
        "gameMode": "CLASSIC",
        "gameVersion": "16.2.1",
        "queueId": 420,
        "participants": [
          {
            "puuid": "player-puuid",
            "summonerName": "TestUser",
            "championName": "Ahri",
            "teamPosition": "MIDDLE",
            "individualPosition": "MIDDLE",
            "teamId": 100,
            "win": true,
            "kills": 8,
            "deaths": 2,
            "assists": 7,
            "totalMinionsKilled": 210,
            "neutralMinionsKilled": 12,
            "visionScore": 28,
            "totalDamageDealtToChampions": 24000,
            "totalDamageTaken": 14000,
            "goldEarned": 13500,
            "champLevel": 16,
            "item0": 0,
            "item1": 0,
            "item2": 0,
            "item3": 0,
            "item4": 0,
            "item5": 0,
            "item6": 0,
            "summoner1Id": 4,
            "summoner2Id": 14,
            "turretKills": 2,
            "turretTakedowns": 4,
            "dragonKills": 1,
            "baronKills": 0,
            "totalTimeSpentDead": 60,
            "challenges": {
              "turretTakedowns": 4,
              "dragonTakedowns": 2,
              "baronTakedowns": 1,
              "riftHeraldTakedowns": 1,
              "voidMonsterKill": 3
            }
          }
        ],
        "teams": [
          {
            "teamId": 100,
            "win": true,
            "objectives": {
              "tower": { "first": true, "kills": 9 },
              "dragon": { "first": true, "kills": 3 },
              "baron": { "first": true, "kills": 1 },
              "riftHerald": { "first": false, "kills": 0 },
              "horde": null
            }
          },
          {
            "teamId": 200,
            "win": false,
            "objectives": {
              "tower": { "first": false, "kills": 2 },
              "dragon": { "first": false, "kills": 1 },
              "baron": { "first": false, "kills": 0 },
              "riftHerald": { "first": true, "kills": 1 },
              "horde": null
            }
          }
        ]
      }
    }`;

    const mockMatches: MatchDto[] = [JSON.parse(rawProviderMatchJson) as MatchDto];
    const resolved = resolveImprovementStats(null, null, mockMatches, 'player-puuid');
    expect(resolved.hasTimelineAnalysis).toBe(false);

    const onAnalyzeTimeline = vi.fn();
    render(
      <ImprovementStatsSection
        stats={resolved.stats}
        hasTimelineAnalysis={resolved.hasTimelineAnalysis}
        onAnalyzeTimeline={onAnalyzeTimeline}
      />
    );

    // Must never auto-call onAnalyzeTimeline on mount
    expect(onAnalyzeTimeline).not.toHaveBeenCalled();

    // Status badge reflects match-level only state
    expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
      'Match-Level Only (Timeline Not Analyzed · 1G)'
    );

    // Timeline-dependent cards show Unavailable (Analyze Timeline required), not 0
    expect(screen.getByTestId('card-phase-farming')).toHaveTextContent(
      'Unavailable (Analyze Timeline required)'
    );
    expect(screen.getByTestId('card-lead-retention')).toHaveTextContent(
      'Unavailable (Analyze Timeline required'
    );
    expect(screen.getByTestId('card-unspent-gold')).toHaveTextContent(
      'Unavailable (Analyze Timeline required'
    );

    // Death Cost card shows match-level time dead (60.0s) while bounty section shows Unavailable
    const deathCostCard = screen.getByTestId('card-death-cost');
    expect(deathCostCard).toHaveTextContent('60.0s');
    expect(deathCostCard).toHaveTextContent('3.33%');
    expect(deathCostCard).toHaveTextContent('Unavailable (Analyze Timeline required)');

    // Team Objectives card shows team first rate, team vs enemy kills, and personal LH/TD;
    // horde was null on info.teams so team first/kills show Unavailable (never 0) while personal TD renders
    const towerRow = screen.getByTestId('objective-row-tower');
    expect(towerRow).toHaveTextContent('100% (1/1)');
    expect(towerRow).toHaveTextContent('9.00');
    expect(towerRow).toHaveTextContent('LH: 2');
    expect(towerRow).toHaveTextContent('TD: 4');

    const hordeRow = screen.getByTestId('objective-row-horde');
    expect(hordeRow).toHaveTextContent('(0G)');
    expect(within(hordeRow).getAllByText('Unavailable').length).toBe(2);
    expect(hordeRow).toHaveTextContent('TD: 3');

    // Clicking the CTA triggers onAnalyzeTimeline once
    fireEvent.click(screen.getByTestId('improvement-stats-analyze-cta'));
    expect(onAnalyzeTimeline).toHaveBeenCalledTimes(1);
  });

  it('renders all 5 improvement stats from Backend #18 serialized contract JSON and supports role/champion slicing', () => {
    render(
      <ImprovementStatsSection
        stats={BACKEND_18_ANALYZED_FIXTURE}
        hasTimelineAnalysis={true}
      />
    );

    expect(screen.getByTestId('improvement-stats-sample-badge')).toHaveTextContent(
      '4 Games Considered'
    );
    expect(screen.getByTestId('improvement-stats-timeline-status')).toHaveTextContent(
      'Timeline Analyzed (3/4G)'
    );

    // 1. Phase Farming
    const window10To20 = screen.getByTestId('phase-window-10-20m');
    expect(window10To20).toHaveTextContent('2G eligible');
    expect(window10To20).toHaveTextContent('9.15/m');
    expect(window10To20).toHaveTextContent('5.25/m');
    expect(window10To20).toHaveTextContent('3.90/m');
    expect(window10To20).toHaveTextContent('Excl: 1 short · 1 missing timeline');

    const window20ToEnd = screen.getByTestId('phase-window-20m-end');
    expect(window20ToEnd).toHaveTextContent('1G eligible');
    expect(window20ToEnd).toHaveTextContent('9.20/m');
    expect(window20ToEnd).toHaveTextContent('8.00/m');
    expect(window20ToEnd).toHaveTextContent('1.20/m');
    expect(window20ToEnd).toHaveTextContent('Excl: 2 short · 1 missing timeline');

    // 2. Lead Retention
    const leadCard = screen.getByTestId('card-lead-retention');
    expect(leadCard).toHaveTextContent('+216.7g');
    expect(leadCard).toHaveTextContent('+150.0g');
    expect(leadCard).toHaveTextContent('50% (1/2G)');
    expect(screen.getByTestId('lead-retention-temporal-events')).toHaveTextContent(
      'Ahri 14:30 Ally Infernal Drake (team-only)'
    );
    expect(screen.getByTestId('lead-retention-temporal-events')).toHaveTextContent(
      'Ahri 16:00 Enemy Outer Turret (team-only)'
    );

    // 3. Death Cost
    const deathCard = screen.getByTestId('card-death-cost');
    expect(deathCard).toHaveTextContent('34.0s');
    expect(deathCard).toHaveTextContent('2.33%');
    expect(deathCard).toHaveTextContent('102s (2.43%)');
    expect(deathCard).toHaveTextContent('3 (2 w/ bounty, 1 unknown)');
    expect(deathCard).toHaveTextContent('600g + 150g');
    expect(deathCard).toHaveTextContent('750g');

    // 4. Unspent Gold (when itemMap is not loaded yet, falls back honestly to Item #3157)
    const unspentCard = screen.getByTestId('card-unspent-gold');
    expect(unspentCard).toHaveTextContent('3G · 11 snapshots');
    expect(unspentCard).toHaveTextContent('800.0g');
    expect(unspentCard).toHaveTextContent('854.5g');
    expect(unspentCard).toHaveTextContent('1,600g');
    expect(unspentCard).toHaveTextContent('2 / 11 frames');
    expect(unspentCard).toHaveTextContent('1 frames');
    expect(unspentCard).toHaveTextContent('Ahri @10m (1600g → Item #3157)');

    // 5. Team Objectives (stacked per-objective on mobile <sm, 4-column table on desktop sm+)
    const teamObjectivesCard = screen.getByTestId('card-team-objectives');
    const objectivesTable = teamObjectivesCard.querySelector('table');
    const objectivesThead = teamObjectivesCard.querySelector('thead');
    expect(objectivesTable?.className).toContain('block sm:table');
    expect(objectivesThead?.className).toContain('hidden sm:table-header-group');

    const hordeRow = screen.getByTestId('objective-row-horde');
    expect(hordeRow.className).toContain('block sm:table-row');
    expect(hordeRow).toHaveTextContent('Void Grubs');
    expect(hordeRow).toHaveTextContent('(2G)');
    expect(hordeRow).toHaveTextContent('First Rate');
    expect(hordeRow).toHaveTextContent('50% (1/2)');
    expect(hordeRow).toHaveTextContent('Team vs Enemy');
    expect(hordeRow).toHaveTextContent('4.00');
    expect(hordeRow).toHaveTextContent('1.00');
    expect(hordeRow).toHaveTextContent('Personal LH / TD');
    expect(hordeRow).toHaveTextContent('TD: 6');

    // Compact 5-stat summary is rendered by default while full numbers/explanations are collapsed under Details
    const compactSummary = screen.getByTestId('improvement-stats-compact-summary');
    expect(compactSummary).toBeInTheDocument();
    expect(screen.getByTestId('summary-phase-farming')).toHaveTextContent('9.15/m (2G)');
    expect(screen.getByTestId('summary-phase-farming')).toHaveTextContent('9.20/m (1G)');
    expect(screen.getByTestId('summary-lead-retention')).toHaveTextContent('3G vs 2G');
    expect(screen.getByTestId('summary-lead-retention')).toHaveTextContent('+216.7g / +150.0g');
    expect(screen.getByTestId('summary-lead-retention')).toHaveTextContent('50% (1/2G)');
    expect(screen.getByTestId('summary-death-cost')).toHaveTextContent('34.0s (2.33%)');
    expect(screen.getByTestId('summary-death-cost')).toHaveTextContent('750g (3D)');
    expect(screen.getByTestId('summary-unspent-gold')).toHaveTextContent('800.0g / 854.5g');
    expect(screen.getByTestId('summary-unspent-gold')).toHaveTextContent('≥1300g (neutral):');
    expect(screen.getByTestId('summary-unspent-gold')).toHaveTextContent('2/11');
    expect(screen.getByTestId('summary-team-objectives')).toHaveTextContent('5.67 vs 3.50');
    expect(screen.getByTestId('summary-team-objectives')).toHaveTextContent('2.00 vs 1.50');

    const detailsEl = screen.getByTestId('improvement-stats-details');
    expect(detailsEl).not.toHaveAttribute('open');
    expect(screen.getByTestId('improvement-stats-details-toggle')).toHaveTextContent(
      'Details (Full Numbers & Explanations)'
    );

    // Plain wording check: zero raw API / DTO field names anywhere in the rendered section
    const sectionText = screen.getByTestId('improvement-stats-section').textContent ?? '';
    for (const forbiddenApiName of [
      'info.teams',
      'MatchDto',
      'minionsKilled',
      'jungleMinionsKilled',
      'baseKillBountyGold',
      'shutdownBountyGold',
      'combinedBountyGold',
      'event.bounty',
      'event.shutdownBounty',
      'participantFrame',
      'currentGold',
    ]) {
      expect(sectionText).not.toContain(forbiddenApiName);
    }

    // Unmatched 10m vs 20m leads and neutral 1300g snapshot semantics are explicitly preserved
    expect(screen.getByTestId('card-lead-retention')).toHaveTextContent(
      '@10m: 3G · @20m: 2G (unmatched)'
    );
    expect(screen.getByTestId('card-unspent-gold')).toHaveTextContent(
      'Snapshots ≥ 1300g (neutral):'
    );
    expect(screen.getByTestId('card-unspent-gold')).toHaveTextContent('not a mistake score');

    // Switch to Champion slice: LeeSin (1G, exact 20m game with missing totalTimeSpentDead, missing team objective data, and null personal objective counters)
    fireEvent.click(screen.getByTestId('filter-champ-LeeSin'));
    expect(screen.getByTestId('improvement-stats-sample-badge')).toHaveTextContent(
      '1 Game Considered'
    );

    // LeeSin 20m-end has 0 eligible games (1 short) -> must show Unavailable, never 0
    expect(screen.getByTestId('phase-window-20m-end')).toHaveTextContent(
      'Unavailable (0 eligible games; 1 short)'
    );

    // LeeSin time spent dead was null -> must show Unavailable, never 0
    expect(screen.getByTestId('card-death-cost')).toHaveTextContent(
      'Unavailable (1G missing time-dead data)'
    );

    // LeeSin team objectives had missing team data and null personal counters -> all 3 columns show Unavailable
    const leeTowerRow = screen.getByTestId('objective-row-tower');
    expect(within(leeTowerRow).getAllByText('Unavailable').length).toBe(3);

    // Switch to Role slice: Mid (3G)
    fireEvent.click(screen.getByTestId('filter-role-MIDDLE'));
    expect(screen.getByTestId('improvement-stats-sample-badge')).toHaveTextContent(
      '3 Games Considered'
    );
    expect(screen.getByTestId('card-lead-retention')).toHaveTextContent('100% (1/1G)');
  });

  afterEach(() => {
    act(() => {
      useDataDragonStore.setState({ itemMap: null });
    });
  });

  it('replaces raw event enums (including ALLY_TEAM_TURRET_PLATE) with human text and resolves item names from itemMap with honest fallback for unknown IDs', () => {
    expect(
      formatTemporalEventDescription({
        securingTeam: 'ALLY_TEAM',
        objectiveType: 'ALLY_TEAM_TURRET_PLATE',
      })
    ).toBe('Ally Turret Plate');
    expect(
      formatTemporalEventDescription({
        securingTeam: 'ENEMY_TEAM',
        objectiveType: 'ENEMY_TEAM_TURRET_PLATE',
      })
    ).toBe('Enemy Turret Plate');
    expect(
      formatTemporalEventDescription({
        securingTeam: 'ALLY_TEAM',
        objectiveType: 'TURRET_PLATE',
      })
    ).toBe('Ally Turret Plate');
    expect(
      formatTemporalEventDescription({
        securingTeam: 'ALLY_TEAM',
        objectiveType: 'HORDE',
      })
    ).toBe('Ally Void Grubs');

    const mockItemMap = {
      '3152': {
        name: 'Hextech Rocketbelt',
        description: '',
        plaintext: '',
        gold: { base: 600, total: 2600, sell: 1820, purchasable: true },
      },
      '3157': {
        name: "Zhonya's Hourglass",
        description: '',
        plaintext: '',
        gold: { base: 650, total: 3250, sell: 2275, purchasable: true },
      },
    };

    expect(formatPurchaseItemLabel(3152, mockItemMap)).toBe('Hextech Rocketbelt');
    expect(formatPurchaseItemLabel(3157, mockItemMap)).toBe("Zhonya's Hourglass");
    expect(formatPurchaseItemLabel(999999, mockItemMap)).toBe('Item #999999');

    useDataDragonStore.setState({ itemMap: mockItemMap });
    render(
      <ImprovementStatsSection
        stats={BACKEND_18_ANALYZED_FIXTURE}
        hasTimelineAnalysis={true}
      />
    );
    expect(screen.getByTestId('card-unspent-gold')).toHaveTextContent(
      "Ahri @10m (1600g → Zhonya's Hourglass)"
    );
  });

  it('deserializes a production-shaped TimelineAnalysisDto wire JSON with Jackson player/opponent booleans and improvementStats', () => {
    const rawTimelineWireJson = JSON.stringify({
      puuid: 'player-puuid-1',
      gamesAnalyzed: 3,
      heatmapPositions: [],
      killPositions: [],
      deathPositions: [],
      wardPositions: [],
      assistPositions: [],
      powerSpikeTimelines: [],
      eventTimelines: [
        {
          matchId: 'M1',
          events: [
            {
              type: 'DEATH',
              minuteMark: 8,
              secondMark: 0,
              description: 'Ahri died to Syndra',
              actor: 'Ahri',
              target: 'Syndra',
              player: true,
              opponent: false,
            },
            {
              type: 'DEATH',
              minuteMark: 12,
              secondMark: 15,
              description: 'Syndra died to Vi',
              actor: 'Syndra',
              target: 'Vi',
              player: false,
              opponent: true,
            },
          ],
        },
      ],
      aggregateSummary: {
        gamesAnalyzed: 3,
        avgFirstDeathMinute: 8.0,
        mostDangerousZone: 'Mid Lane',
        avgGoldLeadAt10: 217,
        avgGoldLeadAt15: 300,
        wardsPlacedTotal: 12,
        killsTotal: 5,
        deathsTotal: 3,
        assistsTotal: 7,
      },
      improvementStats: backend18ContractJson,
    });

    const parsed = JSON.parse(rawTimelineWireJson) as TimelineAnalysisDto;
    const events = parsed.eventTimelines?.[0]?.events ?? [];
    expect(events).toHaveLength(2);
    expect(isPlayerTimelineEvent(events[0])).toBe(true);
    expect(isOpponentTimelineEvent(events[0])).toBe(false);
    expect(isPlayerTimelineEvent(events[1])).toBe(false);
    expect(isOpponentTimelineEvent(events[1])).toBe(true);

    const resolved = resolveImprovementStats(null, parsed, [], 'player-puuid-1');
    expect(resolved.hasTimelineAnalysis).toBe(true);
    expect(resolved.stats.totalGamesConsidered).toBe(4);
    expect(resolved.stats.deathCost.bountyOnPlayerDeaths.totalCombinedBountyGold).toBe(750);
  });

  it('renders Inspectable Coach Evidence Cards with Observed Facts vs Coach Inference Boundaries, per-match/checkpoint inspection, and short/missing-data states without raw API identifiers', () => {
    const mockMatches = [
      {
        metadata: { matchId: 'EUW1_101' },
        info: {
          gameCreation: 1740000000000,
          gameDuration: 1860, // 31:00
          gameVersion: '16.5.600.1234', // Patch 26.5
          queueId: 420,
          participants: [
            {
              puuid: 'player-puuid-1',
              championName: 'Ahri',
              teamPosition: 'MIDDLE',
              win: true,
              kills: 8,
              deaths: 2,
              assists: 7,
              totalMinionsKilled: 210,
              neutralMinionsKilled: 14,
              challenges: { laneMinionsFirst10Minutes: 82 },
            },
            {
              puuid: 'opp-1',
              championName: 'Syndra',
              teamPosition: 'MIDDLE',
              win: false,
            },
          ],
        },
      },
      {
        metadata: { matchId: 'EUW1_102' },
        info: {
          gameCreation: 1740003600000,
          gameDuration: 540, // 9:00 short game (<600s)
          gameVersion: '16.5.600.1234',
          queueId: 420,
          participants: [
            {
              puuid: 'player-puuid-1',
              championName: 'Orianna',
              teamPosition: 'MIDDLE',
              win: false,
              kills: 1,
              deaths: 1,
              assists: 0,
              totalMinionsKilled: 58,
              neutralMinionsKilled: 0,
              challenges: { laneMinionsFirst10Minutes: 58 },
            },
          ],
        },
      },
      {
        metadata: { matchId: 'EUW1_103' },
        info: {
          gameCreation: 1740007200000,
          gameDuration: 1680, // 28:00 pre-26.1 patch
          gameVersion: '15.24.500.1111',
          queueId: 420,
          participants: [
            {
              puuid: 'player-puuid-1',
              championName: 'Viktor',
              teamPosition: 'MIDDLE',
              win: true,
              kills: 6,
              deaths: 3,
              assists: 9,
              totalMinionsKilled: 195,
              neutralMinionsKilled: 8,
              challenges: { laneMinionsFirst10Minutes: 76 },
            },
          ],
        },
      },
      {
        metadata: { matchId: 'EUW1_104' },
        info: {
          gameCreation: 1740010800000,
          gameDuration: 1750,
          gameVersion: '16.5.600.1234',
          queueId: 420,
          participants: [
            {
              puuid: 'player-puuid-1',
              championName: 'LeeSin',
              teamPosition: 'JUNGLE',
              win: false,
              kills: 4,
              deaths: 4,
              assists: 6,
              totalMinionsKilled: 22,
              neutralMinionsKilled: 148,
              challenges: { laneMinionsFirst10Minutes: 8 },
            },
          ],
        },
      },
    ] as never[];

    render(
      <ImprovementStatsSection
        stats={BACKEND_18_ANALYZED_FIXTURE}
        hasTimelineAnalysis={true}
        matches={mockMatches}
        puuid="player-puuid-1"
      />
    );

    const summaryLaneCs10 = screen.getByTestId('summary-lane-cs-10');
    expect(summaryLaneCs10).toHaveTextContent('2G laner · 1 excl.');
    expect(screen.getByTestId('summary-lane-cs-10-actual')).toHaveTextContent('Avg @10m:');
    expect(screen.getByTestId('summary-lane-cs-10-actual')).toHaveTextContent('79 CS (2G)');
    const summaryTargetRow = screen.getByTestId('summary-lane-cs-10-target');
    expect(summaryTargetRow).toHaveTextContent('Target (≠ missed CS):');
    expect(summaryTargetRow).toHaveTextContent('Unavailable (mixed patch)');
    // Regression guard: supported actual (82 CS) must NEVER be rendered under the Target row
    expect(summaryTargetRow).not.toHaveTextContent('82');
    const summarySupportedActualRow = screen.getByTestId('summary-lane-cs-10-supported-actual');
    expect(summarySupportedActualRow).toHaveTextContent('26.1+ actual:');
    expect(summarySupportedActualRow).toHaveTextContent('82 CS (1G)');
    expect(summaryLaneCs10).toHaveTextContent('Inspect evidence (4G) →');

    const toggleBtn = screen.getByTestId('inspect-evidence-cards-toggle');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('inspectable-evidence-cards-panel')).not.toBeInTheDocument();

    // Expand Inspectable Coach Evidence Cards
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByTestId('inspectable-evidence-cards-panel');
    expect(panel).toBeInTheDocument();

    // Default tab is ALL: cards show concise Observed metrics with per-card Inspect evidence disclosure collapsed by default
    const laneCs10Card = screen.getByTestId('evidence-card-lane-cs-10');
    expect(laneCs10Card).toHaveTextContent('79 CS (2G)');
    expect(laneCs10Card).toHaveTextContent('Target ≠ missed CS (114 Top/Bot, 120 Mid benchmark)');
    expect(laneCs10Card).toHaveTextContent(
      'Unavailable (1 pre-26.1 / mixed-patch · supported actual 82 CS in 1G)'
    );
    expect(laneCs10Card).toHaveTextContent('Missing/Short Laner Excl: 1G');
    expect(laneCs10Card).toHaveTextContent('never subtract target - actual');
    const laneCs10Details = laneCs10Card.querySelector('details');
    expect(laneCs10Details).not.toHaveAttribute('open');

    // Focusing '10m Lane CS' tab opens the per-match table disclosure
    fireEvent.click(screen.getByTestId('evidence-tab-LANE_CS_10'));
    expect(screen.getByTestId('evidence-card-lane-cs-10').querySelector('details')).toHaveAttribute(
      'open'
    );

    // Inspect per-match rows in Early Lane CS@10
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_101')).toHaveTextContent('Ahri');
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_101')).toHaveTextContent('82 CS');
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_101')).toHaveTextContent('120 CS');
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_101')).toHaveTextContent('Patch 16.5');

    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_102')).toHaveTextContent('Orianna');
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_102')).toHaveTextContent(
      'Short game <10:00 (excluded from 10m benchmark)'
    );

    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_103')).toHaveTextContent('Viktor');
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_103')).toHaveTextContent('76 CS');
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_103')).toHaveTextContent(
      'Pre-26.1 patch (actual recorded · no target)'
    );

    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_104')).toHaveTextContent('LeeSin');
    expect(screen.getByTestId('evidence-lane-cs-row-EUW1_104')).toHaveTextContent(
      'Non-laner role (excluded from lane benchmark)'
    );

    // Switch through all category tabs and verify Observed Facts + Coach Inference Boundaries + Per-Match/Checkpoint rows
    fireEvent.click(screen.getByTestId('evidence-tab-PHASE_FARMING'));
    expect(screen.queryByTestId('evidence-card-lane-cs-10')).not.toBeInTheDocument();
    const phaseCard = screen.getByTestId('evidence-card-phase-farming');
    expect(phaseCard).toHaveTextContent('9.15/m');
    expect(phaseCard).toHaveTextContent('missed last-hits or wave states are never guessed');
    expect(screen.getByTestId('evidence-phase-row-M1')).toHaveTextContent('Ahri');
    expect(screen.getByTestId('evidence-phase-row-M2')).toHaveTextContent(
      'Short game <20:00 (10–20m & 20m+ excluded)'
    );

    fireEvent.click(screen.getByTestId('evidence-tab-LEAD_RETENTION'));
    const leadCard = screen.getByTestId('evidence-card-lead-retention');
    expect(leadCard).toHaveTextContent('@10m: 3G · @20m: 2G');
    expect(leadCard).toHaveTextContent('50% (1/2G)');
    expect(leadCard).toHaveTextContent('temporal associations only—never proof of a throw');
    expect(screen.getByTestId('evidence-lead-row-M1')).toHaveTextContent('Ahri vs Syndra');

    fireEvent.click(screen.getByTestId('evidence-tab-DEATH_COST'));
    const deathCard = screen.getByTestId('evidence-card-death-cost');
    expect(deathCard).toHaveTextContent('750g (Base 600g + Shutdown 150g)');
    expect(deathCard).toHaveTextContent(
      'Never estimates lost minion waves, indirect map pressure, or whether a death was avoidable'
    );
    expect(screen.getByTestId('evidence-death-row-M1')).toHaveTextContent('54s (3.00%)');
    expect(screen.getByTestId('evidence-death-row-M4')).toHaveTextContent('Timeline required');

    fireEvent.click(screen.getByTestId('evidence-tab-UNSPENT_GOLD'));
    const unspentCard = screen.getByTestId('evidence-card-unspent-gold');
    expect(unspentCard).toHaveTextContent('800.0g');
    expect(unspentCard).toHaveTextContent('never an automatic mistake score');
    expect(screen.getByTestId('evidence-unspent-sample-M1-10')).toHaveTextContent('Ahri (M1) @10m');

    fireEvent.click(screen.getByTestId('evidence-tab-TEAM_OBJECTIVES'));
    const objCard = screen.getByTestId('evidence-card-team-objectives');
    expect(objCard).toHaveTextContent('Towers: Team 5.67/g vs Enemy 3.50/g');
    expect(objCard).toHaveTextContent(
      'kept strictly separate from personal last-hits and takedowns'
    );
    expect(screen.getByTestId('evidence-objective-row-M1')).toHaveTextContent('Ahri');

    // Switch back to ALL so every evidence card is mounted for the raw API identifier check
    fireEvent.click(screen.getByTestId('evidence-tab-ALL'));

    // Verify zero forbidden raw API identifiers even with the entire evidence panel open
    const sectionText = screen.getByTestId('improvement-stats-section').textContent ?? '';
    for (const forbiddenApiName of [
      'info.teams',
      'MatchDto',
      'minionsKilled',
      'jungleMinionsKilled',
      'baseKillBountyGold',
      'shutdownBountyGold',
      'combinedBountyGold',
      'event.bounty',
      'event.shutdownBounty',
      'participantFrame',
      'currentGold',
    ]) {
      expect(sectionText).not.toContain(forbiddenApiName);
    }
  });
});

