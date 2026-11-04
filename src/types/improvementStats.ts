import type { TeamObjectivesDto } from './match';

/**
 * TypeScript interfaces mirroring Backend #18 (`ImprovementStatsDto.kt`).
 *
 * Nullable, documented improvement statistics contract derived strictly from Riot Match-v5
 * (`MatchDto`) and Timeline-v5 (`MatchTimelineDto`) sources:
 *  1. `phaseFarming`: lane (`minionsKilled`) and jungle (`jungleMinionsKilled`) CS gained per minute
 *     across `10-20m` and `20m-end` using actual timestamped checkpoints.
 *  2. `leadRetention`: player-vs-role-opponent gold and XP leads at `10m` and `20m`, count of eligible
 *     games ahead at `10m` and still ahead at `20m`, plus all available relevant objective/tower events
 *     in `10-20m` explicitly marked as temporal association.
 *  3. `deathCost`: recorded `totalTimeSpentDead` seconds and game-duration share from `MatchDto`, plus
 *     recorded `bounty` (base kill gold) and `shutdownBounty` (streak bonus gold) on player deaths from
 *     timeline `CHAMPION_KILL` events without double-counting.
 *  4. `unspentGold`: median and max available 1-minute `currentGold` snapshots, sample count, and sampled
 *     timestamps carrying high balances (`>= highBalanceThresholdGold`) prior to an `ITEM_PURCHASED` event.
 *  5. `teamObjectives`: team-level objective outcomes (`first` flags and `kills` for `tower`, `dragon`,
 *     `baron`, `riftHerald`, `horde` [grubs]) from `MatchDto.info.teams`, kept distinct from personal
 *     takedowns and distinguishing absent fields (`null`) from `0`.
 */

export interface ImprovementStatsDto {
  totalGamesConsidered: number;
  excludedInvalidDurationGames: number;
  excludedMissingTimelineGames: number;
  phaseFarming: PhaseFarmingStatsDto;
  leadRetention: LeadRetentionStatsDto;
  deathCost: DeathCostStatsDto;
  unspentGold: UnspentGoldStatsDto;
  teamObjectives: TeamObjectivesStatsDto;
  byChampion: Record<string, ImprovementStatsBreakdownDto>;
  byRole: Record<string, ImprovementStatsBreakdownDto>;
}

export interface ImprovementStatsBreakdownDto {
  key: string;
  totalGamesConsidered: number;
  excludedInvalidDurationGames: number;
  excludedMissingTimelineGames: number;
  phaseFarming: PhaseFarmingStatsDto;
  leadRetention: LeadRetentionStatsDto;
  deathCost: DeathCostStatsDto;
  unspentGold: UnspentGoldStatsDto;
  teamObjectives: TeamObjectivesStatsDto;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Phase Farming (10-20m and 20m-end)
// ─────────────────────────────────────────────────────────────────────────────

export interface PhaseFarmingStatsDto {
  totalGamesConsidered: number;
  excludedMissingTimelineGames: number;
  min10To20: PhaseFarmingWindowDto;
  min20ToEnd: PhaseFarmingWindowDto;
  perMatch: MatchPhaseFarmingDto[];
  methodologyNote: string;
}

export interface PhaseFarmingWindowDto {
  windowLabel: string;
  eligibleGames: number;
  excludedShortGames: number;
  excludedMissingFrameCounters: number;
  avgLaneCsGained: number | null;
  avgJungleCsGained: number | null;
  avgTotalCsGained: number | null;
  avgWindowMinutes: number | null;
  avgLaneCsPerMin: number | null;
  avgJungleCsPerMin: number | null;
  avgTotalCsPerMin: number | null;
}

export interface MatchPhaseFarmingDto {
  matchId: string;
  championName: string;
  role: string;
  gameDurationSeconds: number;
  reached10To20: boolean;
  checkpoint10TimestampMs: number | null;
  checkpoint20TimestampMs: number | null;
  laneCsAt10: number | null;
  jungleCsAt10: number | null;
  laneCsAt20: number | null;
  jungleCsAt20: number | null;
  laneCsGained10To20: number | null;
  jungleCsGained10To20: number | null;
  laneCsPerMin10To20: number | null;
  jungleCsPerMin10To20: number | null;
  totalCsPerMin10To20: number | null;
  reached20ToEnd: boolean;
  checkpointEndTimestampMs: number | null;
  laneCsAtEnd: number | null;
  jungleCsAtEnd: number | null;
  laneCsGained20ToEnd: number | null;
  jungleCsGained20ToEnd: number | null;
  laneCsPerMin20ToEnd: number | null;
  jungleCsPerMin20ToEnd: number | null;
  totalCsPerMin20ToEnd: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lead Retention (10m vs 20m Gold/XP Leads & Temporal Objective Events)
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadRetentionStatsDto {
  totalGamesConsidered: number;
  excludedMissingTimelineGames: number;
  excludedMissingOpponentGames: number;
  excludedShortGamesBefore10: number;
  excludedShortGamesBefore20: number;
  eligibleGamesAt10: number;
  eligibleGamesAt20: number;
  avgGoldLeadAt10: number | null;
  avgXpLeadAt10: number | null;
  avgGoldLeadAt20: number | null;
  avgXpLeadAt20: number | null;
  gamesAheadInGoldAt10: number;
  gamesAheadInGoldAt10Reaching20: number;
  gamesRetainedGoldLeadAt20: number;
  goldLeadRetentionRate: number | null;
  gamesAheadInXpAt10: number;
  gamesAheadInXpAt10Reaching20: number;
  gamesRetainedXpLeadAt20: number;
  xpLeadRetentionRate: number | null;
  allyObjectiveEvents10To20: number;
  enemyObjectiveEvents10To20: number;
  allyTowerEvents10To20: number;
  enemyTowerEvents10To20: number;
  perMatch: MatchLeadRetentionDto[];
  associationNote: string;
}

export interface MatchLeadRetentionDto {
  matchId: string;
  championName: string;
  opponentChampionName: string | null;
  role: string;
  win: boolean;
  goldLeadAt10: number | null;
  xpLeadAt10: number | null;
  goldLeadAt20: number | null;
  xpLeadAt20: number | null;
  aheadInGoldAt10: boolean | null;
  retainedGoldLeadAt20: boolean | null;
  aheadInXpAt10: boolean | null;
  retainedXpLeadAt20: boolean | null;
  goldLeadDelta10To20: number | null;
  xpLeadDelta10To20: number | null;
  temporalEvents10To20: TemporalObjectiveEventDto[];
}

export interface TemporalObjectiveEventDto {
  eventCategory: string;
  timestampMs: number;
  minuteMark: number;
  secondMark: number;
  objectiveType: string;
  monsterSubType?: string | null;
  laneType?: string | null;
  towerType?: string | null;
  securingTeam: 'ALLY_TEAM' | 'ENEMY_TEAM' | 'UNKNOWN' | string;
  killerChampion?: string | null;
  assistingChampions: string[];
  playerPersonallyInvolved: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Death Cost (totalTimeSpentDead & Recorded Death Bounties)
// ─────────────────────────────────────────────────────────────────────────────

export interface DeathCostStatsDto {
  totalGamesConsidered: number;
  eligibleTimeDeadGames: number;
  excludedMissingTimeSpentDeadGames: number;
  totalTimeSpentDeadSeconds: number | null;
  avgTimeSpentDeadSeconds: number | null;
  avgDeadTimeGameShare: number | null;
  avgDeadTimeGameSharePct: number | null;
  overallDeadTimeGameShare: number | null;
  overallDeadTimeGameSharePct: number | null;
  bountyOnPlayerDeaths: DeathCostBountySummaryDto;
  perMatch: MatchDeathCostDto[];
  goldComponentDefinition: string;
}

export interface DeathCostBountySummaryDto {
  eligibleTimelineGames: number;
  excludedMissingTimelineGames: number;
  totalRecordedDeaths: number | null;
  deathsWithBaseBountyData: number;
  deathsWithShutdownBountyData: number;
  deathsWithAnyBountyData: number;
  deathsMissingBountyData: number;
  totalBaseKillBountyGold: number | null;
  totalShutdownBountyGold: number | null;
  totalCombinedBountyGold: number | null;
  avgBaseKillBountyPerDeath: number | null;
  avgShutdownBountyPerDeath: number | null;
  avgCombinedBountyPerDeath: number | null;
}

export interface MatchDeathCostDto {
  matchId: string;
  championName: string;
  role: string;
  gameDurationSeconds: number;
  deathsFromMatchDto: number | null;
  totalTimeSpentDeadSeconds: number | null;
  deadTimeGameShare: number | null;
  deadTimeGameSharePct: number | null;
  hasTimeline: boolean;
  recordedDeathsCount: number | null;
  totalBaseKillBountyGold: number | null;
  totalShutdownBountyGold: number | null;
  totalCombinedBountyGold: number | null;
  recordedDeaths: RecordedDeathBountyEventDto[];
}

export interface RecordedDeathBountyEventDto {
  timestampMs: number;
  minuteMark: number;
  secondMark: number;
  killerChampion?: string | null;
  assistingChampions: string[];
  baseKillBountyGold: number | null;
  shutdownBountyGold: number | null;
  combinedBountyGold: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Unspent Gold (1-Minute currentGold Snapshots)
// ─────────────────────────────────────────────────────────────────────────────

export interface UnspentGoldStatsDto {
  totalGamesConsidered: number;
  eligibleGames: number;
  excludedMissingTimelineGames: number;
  excludedNoCurrentGoldSamplesGames: number;
  sampleCount: number;
  medianCurrentGold: number | null;
  maxCurrentGold: number | null;
  avgCurrentGold: number | null;
  highBalanceThresholdGold: number;
  highBalanceSampleCount: number | null;
  highBalanceBeforePurchaseSampleCount: number | null;
  highBalanceBeforePurchaseSamples: UnspentGoldHighBalanceSampleDto[];
  perMatch: MatchUnspentGoldDto[];
  samplingSemanticsNote: string;
}

export interface UnspentGoldHighBalanceSampleDto {
  matchId: string;
  championName: string;
  role: string;
  sampledMinute: number;
  sampledTimestampMs: number;
  currentGoldAtSample: number;
  nextPurchaseTimestampMs?: number | null;
  nextPurchaseMinute?: number | null;
  nextPurchaseItemId?: number | null;
}

export interface MatchUnspentGoldDto {
  matchId: string;
  championName: string;
  role: string;
  sampleCount: number;
  medianCurrentGold: number | null;
  maxCurrentGold: number | null;
  avgCurrentGold: number | null;
  highBalanceSampleCount: number | null;
  highBalanceBeforePurchaseSampleCount: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Team Objectives (MatchDto.info.teams vs Personal Takedowns)
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamObjectivesStatsDto {
  totalGamesConsidered: number;
  eligibleTeamObjectiveGames: number;
  excludedMissingTeamsDataGames: number;
  tower: ObjectiveTypeSummaryDto;
  dragon: ObjectiveTypeSummaryDto;
  baron: ObjectiveTypeSummaryDto;
  riftHerald: ObjectiveTypeSummaryDto;
  horde: ObjectiveTypeSummaryDto;
  perMatch: MatchTeamObjectivesDto[];
  attributionNote: string;
}

export interface ObjectiveTypeSummaryDto {
  objectiveKey: string;
  eligibleGamesWithKills: number;
  eligibleGamesWithFirstFlag: number;
  excludedMissingObjectiveGames: number;
  teamFirstCount: number | null;
  teamFirstRate: number | null;
  teamTotalKills: number | null;
  teamAvgKills: number | null;
  enemyEligibleGamesWithKills: number;
  enemyTeamTotalKills: number | null;
  enemyTeamAvgKills: number | null;
  personalLastHitEligibleGames: number;
  personalTotalLastHits: number | null;
  personalAvgLastHits: number | null;
  personalTakedownEligibleGames: number;
  personalTotalTakedowns: number | null;
  personalAvgTakedowns: number | null;
  timelineEligibleGames: number;
  timelinePersonalInvolvements: number | null;
}

export interface MatchTeamObjectivesDto {
  matchId: string;
  championName: string;
  role: string;
  teamId: number | null;
  win: boolean | null;
  hasTeamsData: boolean;
  allyObjectives?: TeamObjectivesDto | null;
  enemyObjectives?: TeamObjectivesDto | null;
  personalTurretKills: number | null;
  personalTurretTakedowns: number | null;
  personalDragonKills: number | null;
  personalDragonTakedowns: number | null;
  personalBaronKills: number | null;
  personalVoidMonsterKills: number | null;
}
