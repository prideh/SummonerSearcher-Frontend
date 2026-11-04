import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ImprovementStatsSection from './ImprovementStatsSection';
import type { ImprovementStatsDto } from '../types/improvementStats';
import { resolveImprovementStats } from '../utils/improvementStatsHelper';
import type { MatchDto } from '../types/match';

/**
 * Exact Backend #18 (`ImprovementStatsDto.kt` / `ImprovementStatsTest.kt`) serialized payload fixture
 * covering 4 matches:
 * - M1: Ahri (MIDDLE, 1800s / 30m, win, full timeline + teams)
 * - M2: Ahri (MIDDLE, 900s / 15m short game <20m, loss, timeline with missing death bounty, horde=null)
 * - M3: LeeSin (JUNGLE, 1200s / 20m exact, loss, timeline, totalTimeSpentDead=null, teams=null)
 * - M4: Orianna (MIDDLE, 1500s / 25m, win, missing timeline, full teams)
 */
const BACKEND_18_ANALYZED_FIXTURE: ImprovementStatsDto = {
  totalGamesConsidered: 4,
  excludedInvalidDurationGames: 0,
  excludedMissingTimelineGames: 1,
  phaseFarming: {
    totalGamesConsidered: 4,
    excludedMissingTimelineGames: 1,
    min10To20: {
      windowLabel: '10-20m',
      eligibleGames: 2,
      excludedShortGames: 1,
      excludedMissingFrameCounters: 0,
      avgLaneCsGained: 52.5,
      avgJungleCsGained: 39.0,
      avgTotalCsGained: 91.5,
      avgWindowMinutes: 10.0,
      avgLaneCsPerMin: 5.25,
      avgJungleCsPerMin: 3.9,
      avgTotalCsPerMin: 9.15,
    },
    min20ToEnd: {
      windowLabel: '20m-end',
      eligibleGames: 1,
      excludedShortGames: 2,
      excludedMissingFrameCounters: 0,
      avgLaneCsGained: 80.0,
      avgJungleCsGained: 12.0,
      avgTotalCsGained: 92.0,
      avgWindowMinutes: 10.0,
      avgLaneCsPerMin: 8.0,
      avgJungleCsPerMin: 1.2,
      avgTotalCsPerMin: 9.2,
    },
    perMatch: [],
    methodologyNote:
      'Computed from actual timestamped timeline checkpoints using separate minionsKilled (lane) and jungleMinionsKilled (jungle) counters. Games ending before a checkpoint are excluded and never extrapolated; individual missed CS is never claimed.',
  },
  leadRetention: {
    totalGamesConsidered: 4,
    excludedMissingTimelineGames: 1,
    excludedMissingOpponentGames: 0,
    excludedShortGamesBefore10: 0,
    excludedShortGamesBefore20: 1,
    eligibleGamesAt10: 3,
    eligibleGamesAt20: 2,
    avgGoldLeadAt10: 216.7,
    avgXpLeadAt10: 123.3,
    avgGoldLeadAt20: 150.0,
    avgXpLeadAt20: 150.0,
    gamesAheadInGoldAt10: 2,
    gamesAheadInGoldAt10Reaching20: 2,
    gamesRetainedGoldLeadAt20: 1,
    goldLeadRetentionRate: 0.5,
    gamesAheadInXpAt10: 2,
    gamesAheadInXpAt10Reaching20: 2,
    gamesRetainedXpLeadAt20: 1,
    xpLeadRetentionRate: 0.5,
    allyObjectiveEvents10To20: 1,
    enemyObjectiveEvents10To20: 0,
    allyTowerEvents10To20: 0,
    enemyTowerEvents10To20: 1,
    perMatch: [
      {
        matchId: 'M1',
        championName: 'Ahri',
        opponentChampionName: 'Syndra',
        role: 'MIDDLE',
        win: true,
        goldLeadAt10: 450,
        xpLeadAt10: 320,
        goldLeadAt20: 900,
        xpLeadAt20: 600,
        aheadInGoldAt10: true,
        retainedGoldLeadAt20: true,
        aheadInXpAt10: true,
        retainedXpLeadAt20: true,
        goldLeadDelta10To20: 450,
        xpLeadDelta10To20: 280,
        temporalEvents10To20: [
          {
            eventCategory: 'ELITE_MONSTER_KILL',
            timestampMs: 870000,
            minuteMark: 14,
            secondMark: 30,
            objectiveType: 'DRAGON',
            monsterSubType: 'FIRE_DRAGON',
            laneType: null,
            towerType: null,
            securingTeam: 'ALLY_TEAM',
            killerChampion: 'Vi',
            assistingChampions: [],
            playerPersonallyInvolved: false,
          },
          {
            eventCategory: 'BUILDING_KILL',
            timestampMs: 960000,
            minuteMark: 16,
            secondMark: 0,
            objectiveType: 'TOWER_BUILDING',
            monsterSubType: null,
            laneType: 'MID_LANE',
            towerType: 'OUTER_TURRET',
            securingTeam: 'ENEMY_TEAM',
            killerChampion: 'Syndra',
            assistingChampions: [],
            playerPersonallyInvolved: false,
          },
        ],
      },
    ],
    associationNote:
      'Objective and tower events in the 10-20m window include all available team events (not only personally last-hit events) and represent temporal association only, not personal player credit or proof of a throw.',
  },
  deathCost: {
    totalGamesConsidered: 4,
    eligibleTimeDeadGames: 3,
    excludedMissingTimeSpentDeadGames: 1,
    totalTimeSpentDeadSeconds: 102,
    avgTimeSpentDeadSeconds: 34.0,
    avgDeadTimeGameShare: 0.0233,
    avgDeadTimeGameSharePct: 2.33,
    overallDeadTimeGameShare: 0.0243,
    overallDeadTimeGameSharePct: 2.43,
    bountyOnPlayerDeaths: {
      eligibleTimelineGames: 3,
      excludedMissingTimelineGames: 1,
      totalRecordedDeaths: 3,
      deathsWithBaseBountyData: 2,
      deathsWithShutdownBountyData: 2,
      deathsWithAnyBountyData: 2,
      deathsMissingBountyData: 1,
      totalBaseKillBountyGold: 600,
      totalShutdownBountyGold: 150,
      totalCombinedBountyGold: 750,
      avgBaseKillBountyPerDeath: 300.0,
      avgShutdownBountyPerDeath: 75.0,
      avgCombinedBountyPerDeath: 375.0,
    },
    perMatch: [],
    goldComponentDefinition:
      'baseKillBountyGold (Riot event.bounty) is the base kill reward to the killer; shutdownBountyGold (Riot event.shutdownBounty) is the additional streak shutdown bonus. combinedBountyGold = baseKillBountyGold + shutdownBountyGold (disjoint components, never double-counted). Unknown fields remain null, not 0; no lost farm or death avoidability is inferred.',
  },
  unspentGold: {
    totalGamesConsidered: 4,
    eligibleGames: 3,
    excludedMissingTimelineGames: 1,
    excludedNoCurrentGoldSamplesGames: 0,
    sampleCount: 11,
    medianCurrentGold: 800.0,
    maxCurrentGold: 1600,
    avgCurrentGold: 890.9,
    highBalanceThresholdGold: 1300,
    highBalanceSampleCount: 2,
    highBalanceBeforePurchaseSampleCount: 1,
    highBalanceBeforePurchaseSamples: [
      {
        matchId: 'M1',
        championName: 'Ahri',
        role: 'MIDDLE',
        sampledMinute: 10,
        sampledTimestampMs: 600000,
        currentGoldAtSample: 1600,
        nextPurchaseTimestampMs: 630000,
        nextPurchaseMinute: 10,
        nextPurchaseItemId: 3157,
      },
    ],
    perMatch: [],
    samplingSemanticsNote:
      'Derived from discrete 1-minute participantFrame.currentGold snapshots (not continuous duration). High balances before purchases are descriptive timestamp samples, not an automatic mistake score or invented recall window.',
  },
  teamObjectives: {
    totalGamesConsidered: 4,
    eligibleTeamObjectiveGames: 3,
    excludedMissingTeamsDataGames: 1,
    tower: {
      objectiveKey: 'tower',
      eligibleGamesWithKills: 3,
      eligibleGamesWithFirstFlag: 3,
      excludedMissingObjectiveGames: 1,
      teamFirstCount: 2,
      teamFirstRate: 0.6667,
      teamTotalKills: 17,
      teamAvgKills: 5.67,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 7,
      enemyTeamAvgKills: 3.5,
      personalLastHitEligibleGames: 3,
      personalTotalLastHits: 3,
      personalAvgLastHits: 1.0,
      personalTakedownEligibleGames: 3,
      personalTotalTakedowns: 6,
      personalAvgTakedowns: 2.0,
      timelineEligibleGames: 3,
      timelinePersonalInvolvements: 0,
    },
    dragon: {
      objectiveKey: 'dragon',
      eligibleGamesWithKills: 3,
      eligibleGamesWithFirstFlag: 3,
      excludedMissingObjectiveGames: 1,
      teamFirstCount: 1,
      teamFirstRate: 0.3333,
      teamTotalKills: 6,
      teamAvgKills: 2.0,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 3,
      enemyTeamAvgKills: 1.5,
      personalLastHitEligibleGames: 3,
      personalTotalLastHits: 1,
      personalAvgLastHits: 0.33,
      personalTakedownEligibleGames: 3,
      personalTotalTakedowns: 5,
      personalAvgTakedowns: 1.67,
      timelineEligibleGames: 3,
      timelinePersonalInvolvements: 0,
    },
    baron: {
      objectiveKey: 'baron',
      eligibleGamesWithKills: 3,
      eligibleGamesWithFirstFlag: 3,
      excludedMissingObjectiveGames: 1,
      teamFirstCount: 2,
      teamFirstRate: 0.6667,
      teamTotalKills: 2,
      teamAvgKills: 0.67,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 0,
      enemyTeamAvgKills: 0.0,
      personalLastHitEligibleGames: 3,
      personalTotalLastHits: 1,
      personalAvgLastHits: 0.33,
      personalTakedownEligibleGames: 0,
      personalTotalTakedowns: null,
      personalAvgTakedowns: null,
      timelineEligibleGames: 3,
      timelinePersonalInvolvements: 0,
    },
    riftHerald: {
      objectiveKey: 'riftHerald',
      eligibleGamesWithKills: 3,
      eligibleGamesWithFirstFlag: 3,
      excludedMissingObjectiveGames: 1,
      teamFirstCount: 1,
      teamFirstRate: 0.3333,
      teamTotalKills: 1,
      teamAvgKills: 0.33,
      enemyEligibleGamesWithKills: 2,
      enemyTeamTotalKills: 2,
      enemyTeamAvgKills: 1.0,
      personalLastHitEligibleGames: 0,
      personalTotalLastHits: null,
      personalAvgLastHits: null,
      personalTakedownEligibleGames: 0,
      personalTotalTakedowns: null,
      personalAvgTakedowns: null,
      timelineEligibleGames: 3,
      timelinePersonalInvolvements: 0,
    },
    horde: {
      objectiveKey: 'horde',
      eligibleGamesWithKills: 2,
      eligibleGamesWithFirstFlag: 2,
      excludedMissingObjectiveGames: 2,
      teamFirstCount: 1,
      teamFirstRate: 0.5,
      teamTotalKills: 8,
      teamAvgKills: 4.0,
      enemyEligibleGamesWithKills: 1,
      enemyTeamTotalKills: 1,
      enemyTeamAvgKills: 1.0,
      personalLastHitEligibleGames: 0,
      personalTotalLastHits: null,
      personalAvgLastHits: null,
      personalTakedownEligibleGames: 2,
      personalTotalTakedowns: 6,
      personalAvgTakedowns: 3.0,
      timelineEligibleGames: 3,
      timelinePersonalInvolvements: 0,
    },
    perMatch: [],
    attributionNote:
      'Team objective outcomes (first flags and kills from MatchDto.info.teams) are reported separately from personal last-hits/takedowns. Absent fields remain null and are excluded from denominators rather than treated as 0.',
  },
  byChampion: {
    LeeSin: {
      key: 'LeeSin',
      totalGamesConsidered: 1,
      excludedInvalidDurationGames: 0,
      excludedMissingTimelineGames: 0,
      phaseFarming: {
        totalGamesConsidered: 1,
        excludedMissingTimelineGames: 0,
        min10To20: {
          windowLabel: '10-20m',
          eligibleGames: 1,
          excludedShortGames: 0,
          excludedMissingFrameCounters: 0,
          avgLaneCsGained: 15.0,
          avgJungleCsGained: 70.0,
          avgTotalCsGained: 85.0,
          avgWindowMinutes: 10.0,
          avgLaneCsPerMin: 1.5,
          avgJungleCsPerMin: 7.0,
          avgTotalCsPerMin: 8.5,
        },
        min20ToEnd: {
          windowLabel: '20m-end',
          eligibleGames: 0,
          excludedShortGames: 1,
          excludedMissingFrameCounters: 0,
          avgLaneCsGained: null,
          avgJungleCsGained: null,
          avgTotalCsGained: null,
          avgWindowMinutes: null,
          avgLaneCsPerMin: null,
          avgJungleCsPerMin: null,
          avgTotalCsPerMin: null,
        },
        perMatch: [],
        methodologyNote: 'Computed from actual timestamped timeline checkpoints.',
      },
      leadRetention: {
        totalGamesConsidered: 1,
        excludedMissingTimelineGames: 0,
        excludedMissingOpponentGames: 0,
        excludedShortGamesBefore10: 0,
        excludedShortGamesBefore20: 0,
        eligibleGamesAt10: 1,
        eligibleGamesAt20: 1,
        avgGoldLeadAt10: 500.0,
        avgXpLeadAt10: 250.0,
        avgGoldLeadAt20: -600.0,
        avgXpLeadAt20: -300.0,
        gamesAheadInGoldAt10: 1,
        gamesAheadInGoldAt10Reaching20: 1,
        gamesRetainedGoldLeadAt20: 0,
        goldLeadRetentionRate: 0.0,
        gamesAheadInXpAt10: 1,
        gamesAheadInXpAt10Reaching20: 1,
        gamesRetainedXpLeadAt20: 0,
        xpLeadRetentionRate: 0.0,
        allyObjectiveEvents10To20: 0,
        enemyObjectiveEvents10To20: 0,
        allyTowerEvents10To20: 0,
        enemyTowerEvents10To20: 0,
        perMatch: [],
        associationNote: 'Temporal association only.',
      },
      deathCost: {
        totalGamesConsidered: 1,
        eligibleTimeDeadGames: 0,
        excludedMissingTimeSpentDeadGames: 1,
        totalTimeSpentDeadSeconds: null,
        avgTimeSpentDeadSeconds: null,
        avgDeadTimeGameShare: null,
        avgDeadTimeGameSharePct: null,
        overallDeadTimeGameShare: null,
        overallDeadTimeGameSharePct: null,
        bountyOnPlayerDeaths: {
          eligibleTimelineGames: 1,
          excludedMissingTimelineGames: 0,
          totalRecordedDeaths: 0,
          deathsWithBaseBountyData: 0,
          deathsWithShutdownBountyData: 0,
          deathsWithAnyBountyData: 0,
          deathsMissingBountyData: 0,
          totalBaseKillBountyGold: null,
          totalShutdownBountyGold: null,
          totalCombinedBountyGold: null,
          avgBaseKillBountyPerDeath: null,
          avgShutdownBountyPerDeath: null,
          avgCombinedBountyPerDeath: null,
        },
        perMatch: [],
        goldComponentDefinition: 'Disjoint components, never double-counted.',
      },
      unspentGold: {
        totalGamesConsidered: 1,
        eligibleGames: 1,
        excludedMissingTimelineGames: 0,
        excludedNoCurrentGoldSamplesGames: 0,
        sampleCount: 2,
        medianCurrentGold: 650.0,
        maxCurrentGold: 1000,
        avgCurrentGold: 650.0,
        highBalanceThresholdGold: 1300,
        highBalanceSampleCount: 0,
        highBalanceBeforePurchaseSampleCount: 0,
        highBalanceBeforePurchaseSamples: [],
        perMatch: [],
        samplingSemanticsNote: 'Derived from discrete 1-minute snapshots.',
      },
      teamObjectives: {
        totalGamesConsidered: 1,
        eligibleTeamObjectiveGames: 0,
        excludedMissingTeamsDataGames: 1,
        tower: {
          objectiveKey: 'tower',
          eligibleGamesWithKills: 0,
          eligibleGamesWithFirstFlag: 0,
          excludedMissingObjectiveGames: 1,
          teamFirstCount: null,
          teamFirstRate: null,
          teamTotalKills: null,
          teamAvgKills: null,
          enemyEligibleGamesWithKills: 0,
          enemyTeamTotalKills: null,
          enemyTeamAvgKills: null,
          personalLastHitEligibleGames: 1,
          personalTotalLastHits: 1,
          personalAvgLastHits: 1.0,
          personalTakedownEligibleGames: 1,
          personalTotalTakedowns: 3,
          personalAvgTakedowns: 3.0,
          timelineEligibleGames: 1,
          timelinePersonalInvolvements: 0,
        },
        dragon: {
          objectiveKey: 'dragon',
          eligibleGamesWithKills: 0,
          eligibleGamesWithFirstFlag: 0,
          excludedMissingObjectiveGames: 1,
          teamFirstCount: null,
          teamFirstRate: null,
          teamTotalKills: null,
          teamAvgKills: null,
          enemyEligibleGamesWithKills: 0,
          enemyTeamTotalKills: null,
          enemyTeamAvgKills: null,
          personalLastHitEligibleGames: 0,
          personalTotalLastHits: null,
          personalAvgLastHits: null,
          personalTakedownEligibleGames: 0,
          personalTotalTakedowns: null,
          personalAvgTakedowns: null,
          timelineEligibleGames: 1,
          timelinePersonalInvolvements: 0,
        },
        baron: {
          objectiveKey: 'baron',
          eligibleGamesWithKills: 0,
          eligibleGamesWithFirstFlag: 0,
          excludedMissingObjectiveGames: 1,
          teamFirstCount: null,
          teamFirstRate: null,
          teamTotalKills: null,
          teamAvgKills: null,
          enemyEligibleGamesWithKills: 0,
          enemyTeamTotalKills: null,
          enemyTeamAvgKills: null,
          personalLastHitEligibleGames: 0,
          personalTotalLastHits: null,
          personalAvgLastHits: null,
          personalTakedownEligibleGames: 0,
          personalTotalTakedowns: null,
          personalAvgTakedowns: null,
          timelineEligibleGames: 1,
          timelinePersonalInvolvements: 0,
        },
        riftHerald: {
          objectiveKey: 'riftHerald',
          eligibleGamesWithKills: 0,
          eligibleGamesWithFirstFlag: 0,
          excludedMissingObjectiveGames: 1,
          teamFirstCount: null,
          teamFirstRate: null,
          teamTotalKills: null,
          teamAvgKills: null,
          enemyEligibleGamesWithKills: 0,
          enemyTeamTotalKills: null,
          enemyTeamAvgKills: null,
          personalLastHitEligibleGames: 0,
          personalTotalLastHits: null,
          personalAvgLastHits: null,
          personalTakedownEligibleGames: 0,
          personalTotalTakedowns: null,
          personalAvgTakedowns: null,
          timelineEligibleGames: 1,
          timelinePersonalInvolvements: 0,
        },
        horde: {
          objectiveKey: 'horde',
          eligibleGamesWithKills: 0,
          eligibleGamesWithFirstFlag: 0,
          excludedMissingObjectiveGames: 1,
          teamFirstCount: null,
          teamFirstRate: null,
          teamTotalKills: null,
          teamAvgKills: null,
          enemyEligibleGamesWithKills: 0,
          enemyTeamTotalKills: null,
          enemyTeamAvgKills: null,
          personalLastHitEligibleGames: 0,
          personalTotalLastHits: null,
          personalAvgLastHits: null,
          personalTakedownEligibleGames: 0,
          personalTotalTakedowns: null,
          personalAvgTakedowns: null,
          timelineEligibleGames: 1,
          timelinePersonalInvolvements: 0,
        },
        perMatch: [],
        attributionNote: 'Team objective outcomes are reported separately.',
      },
    },
  },
  byRole: {
    MIDDLE: {
      key: 'MIDDLE',
      totalGamesConsidered: 3,
      excludedInvalidDurationGames: 0,
      excludedMissingTimelineGames: 1,
      phaseFarming: {
        totalGamesConsidered: 3,
        excludedMissingTimelineGames: 1,
        min10To20: {
          windowLabel: '10-20m',
          eligibleGames: 1,
          excludedShortGames: 1,
          excludedMissingFrameCounters: 0,
          avgLaneCsGained: 90.0,
          avgJungleCsGained: 8.0,
          avgTotalCsGained: 98.0,
          avgWindowMinutes: 10.0,
          avgLaneCsPerMin: 9.0,
          avgJungleCsPerMin: 0.8,
          avgTotalCsPerMin: 9.8,
        },
        min20ToEnd: {
          windowLabel: '20m-end',
          eligibleGames: 1,
          excludedShortGames: 1,
          excludedMissingFrameCounters: 0,
          avgLaneCsGained: 80.0,
          avgJungleCsGained: 12.0,
          avgTotalCsGained: 92.0,
          avgWindowMinutes: 10.0,
          avgLaneCsPerMin: 8.0,
          avgJungleCsPerMin: 1.2,
          avgTotalCsPerMin: 9.2,
        },
        perMatch: [],
        methodologyNote: 'Computed from actual timestamped timeline checkpoints.',
      },
      leadRetention: {
        totalGamesConsidered: 3,
        excludedMissingTimelineGames: 1,
        excludedMissingOpponentGames: 0,
        excludedShortGamesBefore10: 0,
        excludedShortGamesBefore20: 1,
        eligibleGamesAt10: 2,
        eligibleGamesAt20: 1,
        avgGoldLeadAt10: 75.0,
        avgXpLeadAt10: 60.0,
        avgGoldLeadAt20: 900.0,
        avgXpLeadAt20: 600.0,
        gamesAheadInGoldAt10: 1,
        gamesAheadInGoldAt10Reaching20: 1,
        gamesRetainedGoldLeadAt20: 1,
        goldLeadRetentionRate: 1.0,
        gamesAheadInXpAt10: 1,
        gamesAheadInXpAt10Reaching20: 1,
        gamesRetainedXpLeadAt20: 1,
        xpLeadRetentionRate: 1.0,
        allyObjectiveEvents10To20: 1,
        enemyObjectiveEvents10To20: 0,
        allyTowerEvents10To20: 0,
        enemyTowerEvents10To20: 1,
        perMatch: [],
        associationNote: 'Temporal association only.',
      },
      deathCost: {
        totalGamesConsidered: 3,
        eligibleTimeDeadGames: 3,
        excludedMissingTimeSpentDeadGames: 0,
        totalTimeSpentDeadSeconds: 102,
        avgTimeSpentDeadSeconds: 34.0,
        avgDeadTimeGameShare: 0.0233,
        avgDeadTimeGameSharePct: 2.33,
        overallDeadTimeGameShare: 0.0243,
        overallDeadTimeGameSharePct: 2.43,
        bountyOnPlayerDeaths: {
          eligibleTimelineGames: 2,
          excludedMissingTimelineGames: 1,
          totalRecordedDeaths: 3,
          deathsWithBaseBountyData: 2,
          deathsWithShutdownBountyData: 2,
          deathsWithAnyBountyData: 2,
          deathsMissingBountyData: 1,
          totalBaseKillBountyGold: 600,
          totalShutdownBountyGold: 150,
          totalCombinedBountyGold: 750,
          avgBaseKillBountyPerDeath: 300.0,
          avgShutdownBountyPerDeath: 75.0,
          avgCombinedBountyPerDeath: 375.0,
        },
        perMatch: [],
        goldComponentDefinition: 'Disjoint components, never double-counted.',
      },
      unspentGold: {
        totalGamesConsidered: 3,
        eligibleGames: 2,
        excludedMissingTimelineGames: 1,
        excludedNoCurrentGoldSamplesGames: 0,
        sampleCount: 9,
        medianCurrentGold: 800.0,
        maxCurrentGold: 1600,
        avgCurrentGold: 944.4,
        highBalanceThresholdGold: 1300,
        highBalanceSampleCount: 2,
        highBalanceBeforePurchaseSampleCount: 1,
        highBalanceBeforePurchaseSamples: [],
        perMatch: [],
        samplingSemanticsNote: 'Derived from discrete 1-minute snapshots.',
      },
      teamObjectives: {
        totalGamesConsidered: 3,
        eligibleTeamObjectiveGames: 3,
        excludedMissingTeamsDataGames: 0,
        tower: {
          objectiveKey: 'tower',
          eligibleGamesWithKills: 3,
          eligibleGamesWithFirstFlag: 3,
          excludedMissingObjectiveGames: 0,
          teamFirstCount: 2,
          teamFirstRate: 0.6667,
          teamTotalKills: 17,
          teamAvgKills: 5.67,
          enemyEligibleGamesWithKills: 2,
          enemyTeamTotalKills: 7,
          enemyTeamAvgKills: 3.5,
          personalLastHitEligibleGames: 3,
          personalTotalLastHits: 3,
          personalAvgLastHits: 1.0,
          personalTakedownEligibleGames: 3,
          personalTotalTakedowns: 6,
          personalAvgTakedowns: 2.0,
          timelineEligibleGames: 2,
          timelinePersonalInvolvements: 0,
        },
        dragon: {
          objectiveKey: 'dragon',
          eligibleGamesWithKills: 3,
          eligibleGamesWithFirstFlag: 3,
          excludedMissingObjectiveGames: 0,
          teamFirstCount: 1,
          teamFirstRate: 0.3333,
          teamTotalKills: 6,
          teamAvgKills: 2.0,
          enemyEligibleGamesWithKills: 2,
          enemyTeamTotalKills: 3,
          enemyTeamAvgKills: 1.5,
          personalLastHitEligibleGames: 3,
          personalTotalLastHits: 1,
          personalAvgLastHits: 0.33,
          personalTakedownEligibleGames: 3,
          personalTotalTakedowns: 5,
          personalAvgTakedowns: 1.67,
          timelineEligibleGames: 2,
          timelinePersonalInvolvements: 0,
        },
        baron: {
          objectiveKey: 'baron',
          eligibleGamesWithKills: 3,
          eligibleGamesWithFirstFlag: 3,
          excludedMissingObjectiveGames: 0,
          teamFirstCount: 2,
          teamFirstRate: 0.6667,
          teamTotalKills: 2,
          teamAvgKills: 0.67,
          enemyEligibleGamesWithKills: 2,
          enemyTeamTotalKills: 0,
          enemyTeamAvgKills: 0.0,
          personalLastHitEligibleGames: 3,
          personalTotalLastHits: 1,
          personalAvgLastHits: 0.33,
          personalTakedownEligibleGames: 0,
          personalTotalTakedowns: null,
          personalAvgTakedowns: null,
          timelineEligibleGames: 2,
          timelinePersonalInvolvements: 0,
        },
        riftHerald: {
          objectiveKey: 'riftHerald',
          eligibleGamesWithKills: 3,
          eligibleGamesWithFirstFlag: 3,
          excludedMissingObjectiveGames: 0,
          teamFirstCount: 1,
          teamFirstRate: 0.3333,
          teamTotalKills: 1,
          teamAvgKills: 0.33,
          enemyEligibleGamesWithKills: 2,
          enemyTeamTotalKills: 2,
          enemyTeamAvgKills: 1.0,
          personalLastHitEligibleGames: 0,
          personalTotalLastHits: null,
          personalAvgLastHits: null,
          personalTakedownEligibleGames: 0,
          personalTotalTakedowns: null,
          personalAvgTakedowns: null,
          timelineEligibleGames: 2,
          timelinePersonalInvolvements: 0,
        },
        horde: {
          objectiveKey: 'horde',
          eligibleGamesWithKills: 2,
          eligibleGamesWithFirstFlag: 2,
          excludedMissingObjectiveGames: 1,
          teamFirstCount: 1,
          teamFirstRate: 0.5,
          teamTotalKills: 8,
          teamAvgKills: 4.0,
          enemyEligibleGamesWithKills: 1,
          enemyTeamTotalKills: 1,
          enemyTeamAvgKills: 1.0,
          personalLastHitEligibleGames: 0,
          personalTotalLastHits: null,
          personalAvgLastHits: null,
          personalTakedownEligibleGames: 2,
          personalTotalTakedowns: 6,
          personalAvgTakedowns: 3.0,
          timelineEligibleGames: 2,
          timelinePersonalInvolvements: 0,
        },
        perMatch: [],
        attributionNote: 'Team objective outcomes are reported separately.',
      },
    },
  },
};

describe('ImprovementStatsSection', () => {
  it('renders pre-timeline match-only stats honestly (Unavailable for timeline metrics, never 0) and does not auto-call timeline analysis', () => {
    const mockMatches: MatchDto[] = [
      {
        metadata: { matchId: 'NA1_101' },
        info: {
          gameId: 101,
          gameCreation: 1700000000000,
          gameDuration: 1800,
          gameMode: 'CLASSIC',
          queueId: 420,
          participants: [
            {
              puuid: 'player-puuid',
              summonerName: 'TestUser',
              championName: 'Ahri',
              teamPosition: 'MIDDLE',
              teamId: 100,
              win: true,
              kills: 8,
              deaths: 2,
              assists: 7,
              totalMinionsKilled: 210,
              neutralMinionsKilled: 12,
              visionScore: 28,
              totalDamageDealtToChampions: 24000,
              totalDamageTaken: 14000,
              goldEarned: 13500,
              champLevel: 16,
              item0: 0,
              item1: 0,
              item2: 0,
              item3: 0,
              item4: 0,
              item5: 0,
              item6: 0,
              summoner1Id: 4,
              summoner2Id: 14,
              turretKills: 2,
              turretTakedowns: 4,
              dragonKills: 1,
              baronKills: 0,
              totalTimeSpentDead: 60,
              challenges: {
                turretTakedowns: 4,
                dragonTakedowns: 2,
                baronTakedowns: 1,
                riftHeraldTakedowns: 1,
                voidMonsterKill: 3,
              },
            },
          ],
          teams: [
            {
              teamId: 100,
              win: true,
              objectives: {
                tower: { first: true, kills: 9 },
                dragon: { first: true, kills: 3 },
                baron: { first: true, kills: 1 },
                riftHerald: { first: false, kills: 0 },
                horde: { first: true, kills: 5 },
              },
            },
            {
              teamId: 200,
              win: false,
              objectives: {
                tower: { first: false, kills: 2 },
                dragon: { first: false, kills: 1 },
                baron: { first: false, kills: 0 },
                riftHerald: { first: true, kills: 1 },
                horde: { first: false, kills: 1 },
              },
            },
          ],
        },
      },
    ];

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

    // Team Objectives card shows team first rate, team vs enemy kills, and personal LH/TD
    const towerRow = screen.getByTestId('objective-row-tower');
    expect(towerRow).toHaveTextContent('100% (1/1)');
    expect(towerRow).toHaveTextContent('9.00');
    expect(towerRow).toHaveTextContent('LH: 2');
    expect(towerRow).toHaveTextContent('TD: 4');

    // Clicking the CTA triggers onAnalyzeTimeline once
    fireEvent.click(screen.getByTestId('improvement-stats-analyze-cta'));
    expect(onAnalyzeTimeline).toHaveBeenCalledTimes(1);
  });

  it('renders all 5 improvement stats from Backend #18 analyzed payload and supports role/champion slicing', () => {
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
      'Ahri 14:30 ALLY_TEAM FIRE_DRAGON (team-only)'
    );
    expect(screen.getByTestId('lead-retention-temporal-events')).toHaveTextContent(
      'Ahri 16:00 ENEMY_TEAM OUTER_TURRET (team-only)'
    );

    // 3. Death Cost
    const deathCard = screen.getByTestId('card-death-cost');
    expect(deathCard).toHaveTextContent('34.0s');
    expect(deathCard).toHaveTextContent('2.33%');
    expect(deathCard).toHaveTextContent('102s (2.43%)');
    expect(deathCard).toHaveTextContent('3 (2 w/ bounty, 1 unknown)');
    expect(deathCard).toHaveTextContent('600g + 150g');
    expect(deathCard).toHaveTextContent('750g');

    // 4. Unspent Gold
    const unspentCard = screen.getByTestId('card-unspent-gold');
    expect(unspentCard).toHaveTextContent('3G · 11 snapshots');
    expect(unspentCard).toHaveTextContent('800.0g');
    expect(unspentCard).toHaveTextContent('890.9g');
    expect(unspentCard).toHaveTextContent('1,600g');
    expect(unspentCard).toHaveTextContent('2 / 11 frames');
    expect(unspentCard).toHaveTextContent('1 frames');
    expect(unspentCard).toHaveTextContent('Ahri @10m (1600g → item #3157)');

    // 5. Team Objectives
    const hordeRow = screen.getByTestId('objective-row-horde');
    expect(hordeRow).toHaveTextContent('Void Grubs');
    expect(hordeRow).toHaveTextContent('(2G)');
    expect(hordeRow).toHaveTextContent('50% (1/2)');
    expect(hordeRow).toHaveTextContent('4.00');
    expect(hordeRow).toHaveTextContent('1.00');
    expect(hordeRow).toHaveTextContent('TD: 6');

    // Switch to Champion slice: LeeSin (1G, exact 20m game with missing totalTimeSpentDead and missing info.teams)
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
      'Unavailable (1G missing field)'
    );

    // LeeSin team objectives had missing info.teams -> team columns show Unavailable while personal LH/TD still render
    const leeTowerRow = screen.getByTestId('objective-row-tower');
    expect(within(leeTowerRow).getAllByText('Unavailable').length).toBe(2);
    expect(leeTowerRow).toHaveTextContent('LH: 1');
    expect(leeTowerRow).toHaveTextContent('TD: 3');

    // Switch to Role slice: Mid (3G)
    fireEvent.click(screen.getByTestId('filter-role-MIDDLE'));
    expect(screen.getByTestId('improvement-stats-sample-badge')).toHaveTextContent(
      '3 Games Considered'
    );
    expect(screen.getByTestId('card-lead-retention')).toHaveTextContent('100% (1/1G)');
  });
});
