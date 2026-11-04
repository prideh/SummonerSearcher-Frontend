import type {
  DeathCostBountySummaryDto,
  DeathCostStatsDto,
  ImprovementStatsBreakdownDto,
  ImprovementStatsDto,
  LeadRetentionStatsDto,
  MatchDeathCostDto,
  MatchTeamObjectivesDto,
  ObjectiveTypeSummaryDto,
  PhaseFarmingStatsDto,
  PhaseFarmingWindowDto,
  TeamObjectivesStatsDto,
  UnspentGoldStatsDto,
} from '../types/improvementStats';
import type { MatchDto, ObjectiveStatsDto, ParticipantDto, TeamObjectivesDto } from '../types/match';
import type { TimelineAnalysisDto } from '../types/timeline';

const roundTo1 = (v: number): number => Math.round(v * 10) / 10;
const roundTo2 = (v: number): number => Math.round(v * 100) / 100;
const roundTo4 = (v: number): number => Math.round(v * 10000) / 10000;

interface MatchContext {
  matchId: string;
  gameDurationSeconds: number;
  validDuration: boolean;
  player: ParticipantDto;
  championName: string;
  role: string;
  teamId: number | null;
  win: boolean;
  playerTeamObjectives: TeamObjectivesDto | null;
  enemyTeamObjectives: TeamObjectivesDto | null;
}

const emptyPhaseWindow = (
  windowLabel: string,
  excludedShortGames: number
): PhaseFarmingWindowDto => ({
  windowLabel,
  eligibleGames: 0,
  excludedShortGames,
  excludedMissingFrameCounters: 0,
  avgLaneCsGained: null,
  avgJungleCsGained: null,
  avgTotalCsGained: null,
  avgWindowMinutes: null,
  avgLaneCsPerMin: null,
  avgJungleCsPerMin: null,
  avgTotalCsPerMin: null,
});

const buildMatchOnlyPhaseFarming = (contexts: MatchContext[]): PhaseFarmingStatsDto => {
  const validContexts = contexts.filter(c => c.validDuration);
  const short10 = validContexts.filter(c => c.gameDurationSeconds < 600).length;
  const short20 = validContexts.filter(c => c.gameDurationSeconds <= 1200).length;

  return {
    totalGamesConsidered: validContexts.length,
    excludedMissingTimelineGames: validContexts.length,
    min10To20: emptyPhaseWindow('10-20m', short10),
    min20ToEnd: emptyPhaseWindow('20m-end', short20),
    perMatch: [],
    methodologyNote:
      'Computed from actual timestamped timeline checkpoints using separate minionsKilled (lane) and jungleMinionsKilled (jungle) counters. Games ending before a checkpoint are excluded and never extrapolated; individual missed CS is never claimed.',
  };
};

const buildMatchOnlyLeadRetention = (contexts: MatchContext[]): LeadRetentionStatsDto => {
  const validContexts = contexts.filter(c => c.validDuration);
  const short10 = validContexts.filter(c => c.gameDurationSeconds < 600).length;

  return {
    totalGamesConsidered: validContexts.length,
    excludedMissingTimelineGames: validContexts.length,
    excludedMissingOpponentGames: 0,
    excludedShortGamesBefore10: short10,
    excludedShortGamesBefore20: 0,
    eligibleGamesAt10: 0,
    eligibleGamesAt20: 0,
    avgGoldLeadAt10: null,
    avgXpLeadAt10: null,
    avgGoldLeadAt20: null,
    avgXpLeadAt20: null,
    gamesAheadInGoldAt10: 0,
    gamesAheadInGoldAt10Reaching20: 0,
    gamesRetainedGoldLeadAt20: 0,
    goldLeadRetentionRate: null,
    gamesAheadInXpAt10: 0,
    gamesAheadInXpAt10Reaching20: 0,
    gamesRetainedXpLeadAt20: 0,
    xpLeadRetentionRate: null,
    allyObjectiveEvents10To20: 0,
    enemyObjectiveEvents10To20: 0,
    allyTowerEvents10To20: 0,
    enemyTowerEvents10To20: 0,
    perMatch: [],
    associationNote:
      'Objective and tower events in the 10-20m window include all available team events (not only personally last-hit events) and represent temporal association only, not personal player credit or proof of a throw.',
  };
};

const nonNegativeOrNull = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

const buildMatchOnlyDeathCost = (contexts: MatchContext[]): DeathCostStatsDto => {
  const validContexts = contexts.filter(c => c.validDuration);
  let excludedMissingTimeSpentDeadGames = 0;
  let eligibleTimeDeadGames = 0;
  let totalTimeDeadSec = 0;
  let totalEligibleDurationSec = 0;
  const deadShares: number[] = [];
  const perMatch: MatchDeathCostDto[] = [];

  for (const ctx of validContexts) {
    const validTimeDead = nonNegativeOrNull(ctx.player.totalTimeSpentDead);
    let deadShare: number | null = null;
    let deadSharePct: number | null = null;

    if (validTimeDead === null) {
      excludedMissingTimeSpentDeadGames++;
    } else {
      eligibleTimeDeadGames++;
      totalTimeDeadSec += validTimeDead;
      totalEligibleDurationSec += ctx.gameDurationSeconds;
      const rawShare = validTimeDead / ctx.gameDurationSeconds;
      deadShare = roundTo4(rawShare);
      deadSharePct = roundTo2(rawShare * 100);
      deadShares.push(rawShare);
    }

    perMatch.push({
      matchId: ctx.matchId,
      championName: ctx.championName,
      role: ctx.role,
      gameDurationSeconds: ctx.gameDurationSeconds,
      deathsFromMatchDto: nonNegativeOrNull(ctx.player.deaths),
      totalTimeSpentDeadSeconds: validTimeDead,
      deadTimeGameShare: deadShare,
      deadTimeGameSharePct: deadSharePct,
      hasTimeline: false,
      recordedDeathsCount: null,
      totalBaseKillBountyGold: null,
      totalShutdownBountyGold: null,
      totalCombinedBountyGold: null,
      recordedDeaths: [],
    });
  }

  const bountySummary: DeathCostBountySummaryDto = {
    eligibleTimelineGames: 0,
    excludedMissingTimelineGames: validContexts.length,
    totalRecordedDeaths: null,
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
  };

  const avgShare =
    deadShares.length > 0 ? deadShares.reduce((a, b) => a + b, 0) / deadShares.length : null;
  const overallShare =
    eligibleTimeDeadGames > 0 && totalEligibleDurationSec > 0
      ? totalTimeDeadSec / totalEligibleDurationSec
      : null;

  return {
    totalGamesConsidered: validContexts.length,
    eligibleTimeDeadGames,
    excludedMissingTimeSpentDeadGames,
    totalTimeSpentDeadSeconds: eligibleTimeDeadGames > 0 ? totalTimeDeadSec : null,
    avgTimeSpentDeadSeconds:
      eligibleTimeDeadGames > 0 ? roundTo1(totalTimeDeadSec / eligibleTimeDeadGames) : null,
    avgDeadTimeGameShare: avgShare !== null ? roundTo4(avgShare) : null,
    avgDeadTimeGameSharePct: avgShare !== null ? roundTo2(avgShare * 100) : null,
    overallDeadTimeGameShare: overallShare !== null ? roundTo4(overallShare) : null,
    overallDeadTimeGameSharePct: overallShare !== null ? roundTo2(overallShare * 100) : null,
    bountyOnPlayerDeaths: bountySummary,
    perMatch,
    goldComponentDefinition:
      'baseKillBountyGold (Riot event.bounty) is the base kill reward to the killer; shutdownBountyGold (Riot event.shutdownBounty) is the additional streak shutdown bonus. combinedBountyGold = baseKillBountyGold + shutdownBountyGold (disjoint components, never double-counted). Unknown fields remain null, not 0; no lost farm or death avoidability is inferred.',
  };
};

const buildMatchOnlyUnspentGold = (contexts: MatchContext[]): UnspentGoldStatsDto => {
  const validContexts = contexts.filter(c => c.validDuration);
  return {
    totalGamesConsidered: validContexts.length,
    eligibleGames: 0,
    excludedMissingTimelineGames: validContexts.length,
    excludedNoCurrentGoldSamplesGames: 0,
    sampleCount: 0,
    medianCurrentGold: null,
    maxCurrentGold: null,
    avgCurrentGold: null,
    highBalanceThresholdGold: 1300,
    highBalanceSampleCount: null,
    highBalanceBeforePurchaseSampleCount: null,
    highBalanceBeforePurchaseSamples: [],
    perMatch: [],
    samplingSemanticsNote:
      'Derived from discrete 1-minute participantFrame.currentGold snapshots (not continuous duration). High balances before purchases are descriptive timestamp samples, not an automatic mistake score or invented recall window.',
  };
};

const summarizeObjectiveType = (
  objectiveKey: string,
  contexts: MatchContext[],
  teamSelector: (obj: TeamObjectivesDto | null) => ObjectiveStatsDto | null | undefined,
  personalLastHitsSelector: (p: ParticipantDto) => number | null | undefined,
  personalTakedownsSelector: (p: ParticipantDto) => number | null | undefined
): ObjectiveTypeSummaryDto => {
  const validContexts = contexts.filter(c => c.validDuration);
  let eligibleGamesWithKills = 0;
  let eligibleGamesWithFirstFlag = 0;
  let excludedMissingObjectiveGames = 0;
  let teamFirstCount = 0;
  let teamTotalKills = 0;
  let enemyTotalKills = 0;
  let enemyEligibleGamesWithKills = 0;

  let personalLastHitsTotal = 0;
  let personalLastHitEligibleGames = 0;
  let personalTakedownsTotal = 0;
  let personalTakedownEligibleGames = 0;

  for (const ctx of validContexts) {
    const lh = nonNegativeOrNull(personalLastHitsSelector(ctx.player));
    if (lh !== null) {
      personalLastHitsTotal += lh;
      personalLastHitEligibleGames++;
    }
    const td = nonNegativeOrNull(personalTakedownsSelector(ctx.player));
    if (td !== null) {
      personalTakedownsTotal += td;
      personalTakedownEligibleGames++;
    }

    if (!ctx.playerTeamObjectives) {
      excludedMissingObjectiveGames++;
      continue;
    }
    const playerObj = teamSelector(ctx.playerTeamObjectives);
    if (!playerObj) {
      excludedMissingObjectiveGames++;
      continue;
    }
    const kills = nonNegativeOrNull(playerObj.kills);
    if (kills !== null) {
      eligibleGamesWithKills++;
      teamTotalKills += kills;
    } else {
      excludedMissingObjectiveGames++;
    }
    if (typeof playerObj.first === 'boolean') {
      eligibleGamesWithFirstFlag++;
      if (playerObj.first) teamFirstCount++;
    }
    const enemyKills = nonNegativeOrNull(teamSelector(ctx.enemyTeamObjectives)?.kills);
    if (enemyKills !== null) {
      enemyTotalKills += enemyKills;
      enemyEligibleGamesWithKills++;
    }
  }

  return {
    objectiveKey,
    eligibleGamesWithKills,
    eligibleGamesWithFirstFlag,
    excludedMissingObjectiveGames,
    teamFirstCount: eligibleGamesWithFirstFlag > 0 ? teamFirstCount : null,
    teamFirstRate:
      eligibleGamesWithFirstFlag > 0
        ? roundTo4(teamFirstCount / eligibleGamesWithFirstFlag)
        : null,
    teamTotalKills: eligibleGamesWithKills > 0 ? teamTotalKills : null,
    teamAvgKills:
      eligibleGamesWithKills > 0 ? roundTo2(teamTotalKills / eligibleGamesWithKills) : null,
    enemyEligibleGamesWithKills,
    enemyTeamTotalKills: enemyEligibleGamesWithKills > 0 ? enemyTotalKills : null,
    enemyTeamAvgKills:
      enemyEligibleGamesWithKills > 0
        ? roundTo2(enemyTotalKills / enemyEligibleGamesWithKills)
        : null,
    personalLastHitEligibleGames,
    personalTotalLastHits: personalLastHitEligibleGames > 0 ? personalLastHitsTotal : null,
    personalAvgLastHits:
      personalLastHitEligibleGames > 0
        ? roundTo2(personalLastHitsTotal / personalLastHitEligibleGames)
        : null,
    personalTakedownEligibleGames,
    personalTotalTakedowns: personalTakedownEligibleGames > 0 ? personalTakedownsTotal : null,
    personalAvgTakedowns:
      personalTakedownEligibleGames > 0
        ? roundTo2(personalTakedownsTotal / personalTakedownEligibleGames)
        : null,
    timelineEligibleGames: 0,
    timelinePersonalInvolvements: null,
  };
};

const buildMatchOnlyTeamObjectives = (contexts: MatchContext[]): TeamObjectivesStatsDto => {
  const validContexts = contexts.filter(c => c.validDuration);
  const eligibleTeamGames = validContexts.filter(c => c.playerTeamObjectives !== null).length;
  const missingTeamGames = validContexts.length - eligibleTeamGames;

  const tower = summarizeObjectiveType(
    'tower',
    contexts,
    obj => obj?.tower,
    p => p.turretKills,
    p => p.turretTakedowns ?? p.challenges?.turretTakedowns
  );
  const dragon = summarizeObjectiveType(
    'dragon',
    contexts,
    obj => obj?.dragon,
    p => p.dragonKills,
    p => p.challenges?.dragonTakedowns
  );
  const baron = summarizeObjectiveType(
    'baron',
    contexts,
    obj => obj?.baron,
    p => p.baronKills,
    p => p.challenges?.baronTakedowns
  );
  const riftHerald = summarizeObjectiveType(
    'riftHerald',
    contexts,
    obj => obj?.riftHerald ?? obj?.herald,
    () => null,
    p => p.challenges?.riftHeraldTakedowns
  );
  const horde = summarizeObjectiveType(
    'horde',
    contexts,
    obj => obj?.horde ?? obj?.grubs,
    () => null,
    p => p.challenges?.voidMonsterKill
  );

  const perMatch: MatchTeamObjectivesDto[] = validContexts.map(ctx => {
    const ch = ctx.player.challenges;
    return {
      matchId: ctx.matchId,
      championName: ctx.championName,
      role: ctx.role,
      teamId: ctx.teamId,
      win: ctx.win,
      hasTeamsData: ctx.playerTeamObjectives !== null,
      allyObjectives: ctx.playerTeamObjectives,
      enemyObjectives: ctx.enemyTeamObjectives,
      personalTurretKills: nonNegativeOrNull(ctx.player.turretKills),
      personalTurretTakedowns: nonNegativeOrNull(
        ctx.player.turretTakedowns ?? ch?.turretTakedowns
      ),
      personalDragonKills: nonNegativeOrNull(ctx.player.dragonKills),
      personalDragonTakedowns: nonNegativeOrNull(ch?.dragonTakedowns),
      personalBaronKills: nonNegativeOrNull(ctx.player.baronKills),
      personalVoidMonsterKills: nonNegativeOrNull(ch?.voidMonsterKill),
    };
  });

  return {
    totalGamesConsidered: validContexts.length,
    eligibleTeamObjectiveGames: eligibleTeamGames,
    excludedMissingTeamsDataGames: missingTeamGames,
    tower,
    dragon,
    baron,
    riftHerald,
    horde,
    perMatch,
    attributionNote:
      'Team objective outcomes (first flags and kills from MatchDto.info.teams) are reported separately from personal last-hits/takedowns. Absent fields remain null and are excluded from denominators rather than treated as 0.',
  };
};

const buildSliceBreakdown = (
  key: string,
  contexts: MatchContext[]
): ImprovementStatsBreakdownDto => {
  const invalidDurationCount = contexts.filter(c => !c.validDuration).length;
  const validCount = contexts.length - invalidDurationCount;
  return {
    key,
    totalGamesConsidered: validCount,
    excludedInvalidDurationGames: invalidDurationCount,
    excludedMissingTimelineGames: validCount,
    phaseFarming: buildMatchOnlyPhaseFarming(contexts),
    leadRetention: buildMatchOnlyLeadRetention(contexts),
    deathCost: buildMatchOnlyDeathCost(contexts),
    unspentGold: buildMatchOnlyUnspentGold(contexts),
    teamObjectives: buildMatchOnlyTeamObjectives(contexts),
  };
};

/**
 * Fallback match-only improvementStats builder matching Backend #18 (`computeImprovementStats` with `timelines = emptyList()`).
 * Used only when neither `timelineAnalysis.improvementStats` nor `summonerData.improvementStats` is populated on the payload.
 */
export const buildFallbackImprovementStatsFromMatches = (
  matches: MatchDto[],
  puuid: string
): ImprovementStatsDto => {
  const contexts: MatchContext[] = [];

  for (const match of matches) {
    const matchId = match.metadata?.matchId;
    if (!matchId) continue;
    const participants = match.info?.participants ?? [];
    const player = participants.find(p => p.puuid === puuid);
    if (!player) continue;

    const durationSec = match.info?.gameDuration ?? 0;
    const validDuration =
      typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0;
    const rawRole = (player.teamPosition || player.individualPosition || '').trim().toUpperCase();
    const normalizedRole =
      rawRole.length > 0 && rawRole !== 'NONE' && rawRole !== 'INVALID' ? rawRole : 'UNKNOWN';

    const teams = match.info?.teams;
    const playerTeamObj = teams?.find(t => t.teamId === player.teamId)?.objectives ?? null;
    const enemyTeamObj =
      teams?.find(t => t.teamId !== undefined && t.teamId !== player.teamId)?.objectives ?? null;

    contexts.push({
      matchId,
      gameDurationSeconds: durationSec,
      validDuration,
      player,
      championName: player.championName || 'Unknown',
      role: normalizedRole,
      teamId: player.teamId ?? null,
      win: Boolean(player.win),
      playerTeamObjectives: playerTeamObj,
      enemyTeamObjectives: enemyTeamObj,
    });
  }

  const root = buildSliceBreakdown('ALL', contexts);

  const byChampionGroups = new Map<string, MatchContext[]>();
  const byRoleGroups = new Map<string, MatchContext[]>();

  for (const ctx of contexts) {
    const champList = byChampionGroups.get(ctx.championName) ?? [];
    champList.push(ctx);
    byChampionGroups.set(ctx.championName, champList);

    const roleList = byRoleGroups.get(ctx.role) ?? [];
    roleList.push(ctx);
    byRoleGroups.set(ctx.role, roleList);
  }

  const byChampion: Record<string, ImprovementStatsBreakdownDto> = {};
  Array.from(byChampionGroups.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .forEach(([champ, list]) => {
      byChampion[champ] = buildSliceBreakdown(champ, list);
    });

  const byRole: Record<string, ImprovementStatsBreakdownDto> = {};
  Array.from(byRoleGroups.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .forEach(([role, list]) => {
      byRole[role] = buildSliceBreakdown(role, list);
    });

  return {
    totalGamesConsidered: root.totalGamesConsidered,
    excludedInvalidDurationGames: root.excludedInvalidDurationGames,
    excludedMissingTimelineGames: root.excludedMissingTimelineGames,
    phaseFarming: root.phaseFarming,
    leadRetention: root.leadRetention,
    deathCost: root.deathCost,
    unspentGold: root.unspentGold,
    teamObjectives: root.teamObjectives,
    byChampion,
    byRole,
  };
};

export interface ResolvedImprovementStats {
  stats: ImprovementStatsDto;
  hasTimelineAnalysis: boolean;
}

/**
 * Resolves the active `ImprovementStatsDto`:
 * 1. Prefers `timelineAnalysis.improvementStats` when the user has analyzed timelines.
 * 2. Otherwise uses `summonerStats` (`summonerData.improvementStats`) returned by Backend #18 on `/riot/summoner`.
 * 3. Falls back to `buildFallbackImprovementStatsFromMatches` only when both backend DTO fields are absent.
 */
export const resolveImprovementStats = (
  summonerStats: ImprovementStatsDto | null | undefined,
  timelineAnalysis: TimelineAnalysisDto | null | undefined,
  matches: MatchDto[],
  puuid: string
): ResolvedImprovementStats => {
  if (timelineAnalysis?.improvementStats) {
    return {
      stats: timelineAnalysis.improvementStats,
      hasTimelineAnalysis: true,
    };
  }
  if (summonerStats) {
    const hasTimeline =
      summonerStats.phaseFarming.min10To20.eligibleGames > 0 ||
      summonerStats.leadRetention.eligibleGamesAt10 > 0 ||
      summonerStats.deathCost.bountyOnPlayerDeaths.eligibleTimelineGames > 0 ||
      summonerStats.unspentGold.eligibleGames > 0;
    return {
      stats: summonerStats,
      hasTimelineAnalysis: hasTimeline,
    };
  }
  return {
    stats: buildFallbackImprovementStatsFromMatches(matches, puuid),
    hasTimelineAnalysis: false,
  };
};

const OBJECTIVE_EVENT_LABELS: Record<string, string> = {
  TURRET_PLATE: 'Turret Plate',
  TURRET_PLATE_DESTROYED: 'Turret Plate',
  OUTER_TURRET: 'Outer Turret',
  INNER_TURRET: 'Inner Turret',
  BASE_TURRET: 'Base Turret',
  NEXUS_TURRET: 'Nexus Turret',
  UNDEFINED_TURRET: 'Turret',
  TOWER_BUILDING: 'Turret',
  TOWER: 'Turret',
  INHIBITOR_BUILDING: 'Inhibitor',
  INHIBITOR: 'Inhibitor',
  FIRE_DRAGON: 'Infernal Drake',
  WATER_DRAGON: 'Ocean Drake',
  EARTH_DRAGON: 'Mountain Drake',
  AIR_DRAGON: 'Cloud Drake',
  HEXTECH_DRAGON: 'Hextech Drake',
  CHEMTECH_DRAGON: 'Chemtech Drake',
  ELDER_DRAGON: 'Elder Dragon',
  DRAGON: 'Dragon',
  HORDE: 'Void Grubs',
  VOID_GRUB: 'Void Grubs',
  VOID_GRUBS: 'Void Grubs',
  RIFTHERALD: 'Rift Herald',
  RIFT_HERALD: 'Rift Herald',
  BARON_NASHOR: 'Baron Nashor',
  BARON: 'Baron Nashor',
  ATAKHAN: 'Atakhan',
};

const humanizeEnumToken = (raw: string): string =>
  raw
    .trim()
    .split(/_+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

export const formatTemporalEventDescription = (ev: {
  securingTeam?: string | null;
  objectiveType?: string | null;
  monsterSubType?: string | null;
  towerType?: string | null;
}): string => {
  const rawTeam = (ev.securingTeam ?? '').trim().toUpperCase();
  let teamPrefix =
    rawTeam === 'ALLY_TEAM'
      ? 'Ally'
      : rawTeam === 'ENEMY_TEAM'
      ? 'Enemy'
      : rawTeam === 'UNKNOWN_TEAM' || !rawTeam
      ? ''
      : humanizeEnumToken(rawTeam.replace(/_TEAM$/, ''));

  let rawTarget = (ev.monsterSubType ?? ev.towerType ?? ev.objectiveType ?? '').trim().toUpperCase();
  if (rawTarget.startsWith('ALLY_TEAM_')) {
    if (!teamPrefix) teamPrefix = 'Ally';
    rawTarget = rawTarget.slice('ALLY_TEAM_'.length);
  } else if (rawTarget.startsWith('ENEMY_TEAM_')) {
    if (!teamPrefix) teamPrefix = 'Enemy';
    rawTarget = rawTarget.slice('ENEMY_TEAM_'.length);
  }

  const targetLabel =
    OBJECTIVE_EVENT_LABELS[rawTarget] ?? (rawTarget ? humanizeEnumToken(rawTarget) : 'Objective');

  return teamPrefix ? `${teamPrefix} ${targetLabel}` : targetLabel;
};

export const formatPurchaseItemLabel = (
  itemId: number | null | undefined,
  itemMap: Record<string, { name?: string }> | null | undefined
): string => {
  if (itemId === null || itemId === undefined || itemId <= 0) return '';
  const name = itemMap?.[String(itemId)]?.name?.trim();
  return name && name.length > 0 ? name : `Item #${itemId}`;
};

