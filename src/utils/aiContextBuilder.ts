import type { MatchDto, ParticipantDto } from '../types/match';
import type { ChampionStats, OverallStats } from '../types/summoner';
import type {
  ImprovementStatsDto,
  ObjectiveTypeSummaryDto,
  PhaseFarmingWindowDto,
} from '../types/improvementStats';
import {
  isPlayerTimelineEvent,
  type BuildOrderDto,
  type MatchEventTimelineDto,
  type MatchPowerSpikeDto,
  type SkillOrderDto,
  type TimelineAggregateSummary,
  type TimelineAnalysisDto,
} from '../types/timeline';
import { useDataDragonStore, type ItemMap, type RuneMap, type SummonerSpellMap } from '../store/dataDragonStore';
import {
  calculateAverageLaneCsAt10,
  calculateConsistency,
  calculateLaneCsAt10Comparison,
  isEligibleLaneCsAt10Match,
  isLanerPosition,
  STAT_ROLE_MAPPING,
  type AverageLaneCsAt10Summary,
} from './statsCalculator';
import { formatPurchaseItemLabel, resolveImprovementStats } from './improvementStatsHelper';
import { camelCaseToTitleCase } from './formatters';

export const MAX_RECENT_MATCHES = 20;
export const MAX_EARLY_DEATHS_PER_GAME = 3;
export const MAX_ITEM_SPIKES_PER_GAME = 3;
export const MAX_COACH_HIGH_BALANCE_SAMPLES = 3;

export const VISION_DATA_PRECISION_NOTE =
  'Ward counts, types, and time-buckets only — Riot WARD_PLACED events carry no coordinates; never present ward locations.';

/** Known starter, consumable, boot-tier-1, and trinket item IDs to exclude from completed item spikes when DDragon gold metadata is unavailable. */
const COMPONENT_OR_CONSUMABLE_ITEM_IDS = new Set<number>([
  1001, // Boots
  1004, // Faerie Charm
  1006, // Rejuvenation Bead
  1011, // Giant's Belt
  1018, // Cloak of Agility
  1026, // Blasting Wand
  1027, // Sapphire Crystal
  1028, // Ruby Crystal
  1029, // Cloth Armor
  1031, // Chain Vest
  1033, // Null-Magic Mantle
  1036, // Long Sword
  1037, // Pickaxe
  1038, // B. F. Sword
  1042, // Dagger
  1043, // Recurve Bow
  1052, // Amplifying Tome
  1053, // Vampiric Scepter
  1054, // Doran's Shield
  1055, // Doran's Blade
  1056, // Doran's Ring
  1057, // Negatron Cloak
  1058, // Needlessly Large Rod
  1082, // Dark Seal
  1083, // Cull
  2003, // Health Potion
  2031, // Refillable Potion
  2033, // Corrupting Potion
  2055, // Control Ward
  2138, // Elixir of Iron
  2139, // Elixir of Sorcery
  2140, // Elixir of Wrath
  3340, // Stealth Ward
  3363, // Farsight Alteration
  3364, // Oracle Lens
]);

const SKILL_SLOT_LABELS: Record<number, string> = {
  1: 'Q',
  2: 'W',
  3: 'E',
  4: 'R',
};

export interface EarlyDeathEntry {
  /** Formatted timestamp MM:SS (e.g. "03:30"). */
  time: string;
  /** Decimal minute mark (e.g. 3.5). */
  minute: number;
  /** Approximate Summoner's Rift zone derived from death position/laneType/zone, or null if position is missing. */
  approxZone: string | null;
  /** Champion who scored the kill, or null if unknown. */
  killer: string | null;
  /** Known champions involved in the death (victim, killer, and any known assistants). */
  participants: string[];
  /** Enemy assistants array when provided by backend, or null when omitted/unknown. */
  assistants: string[] | null;
  /** True when >=1 enemy assistant contributed, false when explicitly 0 assistants (`[]`), or null when backend omitted `assistants`. Never labelled "gank". */
  assisted: boolean | null;
  /** Number of enemy assistants when provided by backend, or null when omitted/unknown (never 0 when unknown). */
  assistantsCount: number | null;
}

export interface MatchDeathContext {
  totalDeaths: number;
  firstDeathMinute: number | null;
  deathsBefore10: number;
  /** Count of deaths with >=1 assistant, or null when backend omitted `assistants` on all deaths in this game. */
  assistedDeaths: number | null;
  /** Count of deaths with 0 assistants (`assistants: []`), or null when backend omitted `assistants` on all deaths in this game. */
  unassistedDeaths: number | null;
  /** Count of deaths where `assistants` was null or omitted (unknown whether assisted or solo). */
  unknownAssistDeaths: number;
  /** Count of deaths where position/zone was null or omitted. */
  missingPositionDeaths: number;
  deathsNearObjectiveWindows: number;
  earlyDeaths: EarlyDeathEntry[];
}

export interface TimelineCheckpointDiff {
  goldDiff: number;
  xpDiff: number;
  csDiff: number;
}

export interface ItemSpikeEntry {
  item: string;
  minute: number;
}

export interface MatchDetail {
  matchId?: string;
  patch?: string;
  role: string;
  side: 'Blue' | 'Red';
  champion: string;
  win: boolean;
  kda: string;
  csPerMin: number;
  killParticipation: number;
  keystone?: string;
  subStyle?: string;
  summonerSpells: string[];
  items: string[];
  draft: {
    allies: string[];
    enemies: string[];
  };
  damageSplitPct: {
    physical: number;
    magic: number;
    true: number;
  };
  opponent: {
    champion: string;
    kda: string;
    csPerMin: number;
    killParticipation: number;
    visionScore: number;
    turretPlates: number;
    name?: string;
    keystone?: string;
    items: string[];
  } | null;
  gameDuration: number;
  visionScore: number;
  turretPlates: number;
  turretPlatesTaken: number;
  controlWardsPlaced: number;
  wardsPlaced: number;
  wardsKilled: number;
  damageDealtToObjectives: number;
  damageDealtToTurrets: number;

  // Early laning metrics
  laneCsAt10?: {
    actual: number;
    target: number | null;
    targetLabel: string | null;
  };
  jungleCsBefore10Minutes?: number;
  timelineAt10?: TimelineCheckpointDiff;
  timelineAt15?: TimelineCheckpointDiff;

  // Timeline-derived death, spike, and skill context (present only when timeline analysis was run and matchId matched)
  deathContext?: MatchDeathContext;
  itemSpikes?: ItemSpikeEntry[];
  skillMaxOrder?: string;

  // Advanced Optional Stats
  damagePerMinute?: number;
  goldPerMinute?: number;
  soloKills?: number;
  earlyLaningPhaseGoldExpAdvantage?: number;
  maxCsAdvantageOnLaneOpponent?: number;
  visionScoreAdvantageLaneOpponent?: number;
  timeCCingOthers?: number;
  totalDamageShieldedOnTeammates?: number;
  totalHealsOnTeammates?: number;
}

export interface EnrichedTimelineInsights extends TimelineAggregateSummary {
  deathsBefore10: number;
  /** Count of deaths with >=1 assistant across analyzed games, or null when backend omitted `assistants` on all analyzed deaths. */
  assistedDeaths: number | null;
  /** Count of deaths with 0 assistants (`assistants: []`) across analyzed games, or null when backend omitted `assistants` on all analyzed deaths. */
  unassistedDeaths: number | null;
  /** Count of deaths across analyzed games where `assistants` was null or omitted. */
  unknownAssistDeaths: number;
  /** Count of deaths across analyzed games where position/zone was null or omitted. */
  missingPositionDeaths: number;
  deathsNearObjectiveWindows: number;
  /** Ward counts by time bucket when `WARD_PLACED` events are present in `eventTimelines`, or null when omitted by backend (never `{0,0,0}` when unknown). */
  wardsByTimeBucket: {
    pre10: number;
    min10To20: number;
    post20: number;
  } | null;
  /** Number of recentMatches that did not have a matching `matchId` in `timelineAnalysis`. */
  missingTimelineMatches: number;
}

export interface CoachPhaseFarmingWindowSummary {
  eligibleGames: number;
  shortGames: number;
  missingFrameGames: number;
  avgLaneCsGained: number | null;
  avgJungleCsGained: number | null;
  avgLaneCsPerMin: number | null;
  avgJungleCsPerMin: number | null;
  avgTotalCsPerMin: number | null;
}

export interface CoachHighBalanceSample {
  matchId: string;
  championName: string;
  role: string;
  sampledMinute: number;
  currentGoldAtSample: number;
  nextPurchaseMinute: number | null;
  nextPurchaseItemId: number | null;
  nextPurchaseItemName: string | null;
}

export interface CoachObjectiveTypeSummary {
  eligibleGames: number;
  missingGames: number;
  firstCount: number | null;
  firstRate: number | null;
  teamKills: number | null;
  teamAvg: number | null;
  enemyAvg: number | null;
  personalLh: number | null;
  personalTd: number | null;
  timelineInvolved: number | null;
}

export interface CoachImprovementStatsContext {
  totalGamesConsidered: number;
  excludedInvalidDurationGames: number;
  excludedMissingTimelineGames: number;
  hasTimelineAnalysis: boolean;
  phaseFarming: {
    min10To20: CoachPhaseFarmingWindowSummary;
    min20ToEnd: CoachPhaseFarmingWindowSummary;
  };
  leadRetention: {
    missingOpponentGames: number;
    shortBefore10: number;
    shortBefore20: number;
    eligibleGamesAt10: number;
    eligibleGamesAt20: number;
    avgGoldLeadAt10: number | null;
    avgXpLeadAt10: number | null;
    avgGoldLeadAt20: number | null;
    avgXpLeadAt20: number | null;
    aheadGold10: number;
    aheadGold10Reach20: number;
    retainedGold20: number;
    goldLeadRetentionRate: number | null;
    aheadXp10: number;
    aheadXp10Reach20: number;
    retainedXp20: number;
    xpLeadRetentionRate: number | null;
    allyObj10To20: number;
    enemyObj10To20: number;
    allyTowers10To20: number;
    enemyTowers10To20: number;
  };
  deathCost: {
    eligibleTimeDeadGames: number;
    missingTimeDeadGames: number;
    totalTimeSpentDeadSeconds: number | null;
    avgTimeSpentDeadSeconds: number | null;
    avgDeadTimeGameSharePct: number | null;
    overallDeadTimeGameSharePct: number | null;
    bounty: {
      eligibleTimelineGames: number;
      totalRecordedDeaths: number | null;
      deathsWithAnyBountyData: number;
      deathsMissingBountyData: number;
      totalBaseKillBountyGold: number | null;
      totalShutdownBountyGold: number | null;
      totalCombinedBountyGold: number | null;
      avgCombinedBountyPerDeath: number | null;
    };
  };
  unspentGold: {
    eligibleGames: number;
    missingSampleGames: number;
    sampleCount: number;
    medianCurrentGold: number | null;
    maxCurrentGold: number | null;
    avgCurrentGold: number | null;
    highBalanceThresholdGold: number;
    highBalanceSampleCount: number | null;
    highBalancePrePurchaseCount: number | null;
    prePurchaseSamples: CoachHighBalanceSample[];
  };
  teamObjectives: {
    eligibleTeamObjectiveGames: number;
    missingTeamsGames: number;
    timelineEligibleGames: number;
    tower: CoachObjectiveTypeSummary;
    dragon: CoachObjectiveTypeSummary;
    baron: CoachObjectiveTypeSummary;
    riftHerald: CoachObjectiveTypeSummary;
    horde: CoachObjectiveTypeSummary;
  };
}

export function formatEventTimestamp(minuteMark: number, secondMark: number = 0): string {
  const mins = Math.max(0, Math.floor(minuteMark));
  const secs = Math.max(0, Math.min(59, Math.round(secondMark)));
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Classifies a Summoner's Rift world coordinate (`0..14850` x `0..14850`) or `laneType` / explicit `zone`
 * into a compact approximate map zone string without leaking raw `[x, y]` coordinate arrays.
 * Returns `null` when position, laneType, and zone are all null/missing.
 */
export function classifyRiftApproxZone(
  position?: { x: number; y: number } | null,
  laneType?: string | null,
  explicitZone?: string | null
): string | null {
  if (explicitZone && explicitZone.trim()) {
    return explicitZone.trim();
  }

  if (
    position &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
  ) {
    const { x, y } = position;
    if (x < 3500 && y < 3500) return 'Blue Base';
    if (x > 11350 && y > 11350) return 'Red Base';
    if (Math.hypot(x - 5007, y - 10471) <= 1600) return 'Baron / Top River';
    if (Math.hypot(x - 9866, y - 4414) <= 1600) return 'Dragon / Bot River';

    const distToMidDiag = Math.abs(x - y);
    const distToRiverDiag = Math.abs(x + y - 14850);

    if ((x < 3200 && y > 5500) || (y > 11650 && x < 9350) || y - x > 8500) {
      return 'Top Lane';
    }
    if ((y < 3200 && x > 5500) || (x > 11650 && y < 9350) || x - y > 8500) {
      return 'Bot Lane';
    }
    if (distToMidDiag <= 2000 && x >= 3000 && x <= 11850) {
      return distToRiverDiag <= 2000 ? 'Mid River' : 'Mid Lane';
    }
    if (distToRiverDiag <= 1800) {
      return y > x ? 'Top River' : 'Bot River';
    }
    return y > x ? 'Top Side Jungle' : 'Bot Side Jungle';
  }

  if (laneType && laneType.trim()) {
    const normalized = laneType.trim().toUpperCase();
    if (normalized === 'MID_LANE' || normalized === 'MIDDLE') return 'Mid Lane';
    if (normalized === 'TOP_LANE' || normalized === 'TOP') return 'Top Lane';
    if (normalized === 'BOT_LANE' || normalized === 'BOTTOM') return 'Bot Lane';
    return laneType.trim();
  }

  return null;
}

/**
 * Extracts major.minor patch string from Riot `info.gameVersion` (e.g. "16.22.1" -> "16.22").
 */
export function formatPatchMajorMinor(gameVersion?: string): string | undefined {
  if (!gameVersion || !gameVersion.trim()) return undefined;
  const parts = gameVersion.trim().split('.');
  if (parts.length < 2) return parts[0];
  const major = Number.parseInt(parts[0], 10);
  const minor = Number.parseInt(parts[1], 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) return undefined;
  return `${major}.${minor}`;
}

function resolveItemName(itemId: number | undefined, itemMap: ItemMap | null): string | null {
  if (!itemId || itemId <= 0) return null;
  const entry = itemMap?.[String(itemId)];
  return entry?.name || `Item #${itemId}`;
}

function resolveParticipantItems(p: ParticipantDto, itemMap: ItemMap | null): string[] {
  const rawSlots = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
  const resolved: string[] = [];
  for (const id of rawSlots) {
    const name = resolveItemName(id, itemMap);
    if (name) resolved.push(name);
  }
  return resolved;
}

function resolveRuneName(runeId: number | undefined, runeMap: RuneMap | null): string | undefined {
  if (!runeId || runeId <= 0) return undefined;
  return runeMap?.[String(runeId)]?.name || `Rune #${runeId}`;
}

function resolveSummonerSpells(p: ParticipantDto, spellMap: SummonerSpellMap | null): string[] {
  const ids = [p.summoner1Id, p.summoner2Id];
  const names: string[] = [];
  for (const id of ids) {
    if (!id || id <= 0) continue;
    const spell = spellMap?.[String(id)];
    names.push(spell?.name || `Spell #${id}`);
  }
  return names;
}

function computeDamageSplitPct(p: ParticipantDto): { physical: number; magic: number; true: number } {
  const phys = Math.max(0, p.physicalDamageDealtToChampions ?? 0);
  const magic = Math.max(0, p.magicDamageDealtToChampions ?? 0);
  const trueDmg = Math.max(0, p.trueDamageDealtToChampions ?? 0);
  const total = phys + magic + trueDmg;
  if (total <= 0) {
    return { physical: 0, magic: 0, true: 0 };
  }
  const physicalPct = Math.round((phys / total) * 100);
  const magicPct = Math.round((magic / total) * 100);
  const truePct = Math.max(0, 100 - physicalPct - magicPct);
  return {
    physical: physicalPct,
    magic: magicPct,
    true: truePct,
  };
}

function isCompletedSpikeItem(itemId: number, itemMap: ItemMap | null): boolean {
  if (!itemId || itemId <= 0 || COMPONENT_OR_CONSUMABLE_ITEM_IDS.has(itemId)) {
    return false;
  }
  const itemData = itemMap?.[String(itemId)];
  if (itemData?.gold && typeof itemData.gold.total === 'number') {
    return itemData.gold.total >= 2000;
  }
  return true;
}

function extractItemSpikes(
  buildOrder: BuildOrderDto | undefined,
  itemMap: ItemMap | null
): ItemSpikeEntry[] | undefined {
  if (!buildOrder || !Array.isArray(buildOrder.items)) return undefined;
  const spikes: ItemSpikeEntry[] = [];
  for (const entry of buildOrder.items) {
    if (!isCompletedSpikeItem(entry.itemId, itemMap)) continue;
    const itemName = resolveItemName(entry.itemId, itemMap);
    if (!itemName) continue;
    spikes.push({
      item: itemName,
      minute: entry.minuteMark,
    });
    if (spikes.length >= MAX_ITEM_SPIKES_PER_GAME) break;
  }
  return spikes;
}

function extractSkillMaxOrder(skillOrder: SkillOrderDto | undefined): string | undefined {
  if (!skillOrder || !Array.isArray(skillOrder.maxOrder) || skillOrder.maxOrder.length === 0) {
    return undefined;
  }
  const labels = skillOrder.maxOrder
    .filter(slot => slot === 1 || slot === 2 || slot === 3)
    .map(slot => SKILL_SLOT_LABELS[slot])
    .filter(Boolean);
  return labels.length > 0 ? labels.join('>') : undefined;
}

function extractCheckpointDiff(
  spikeTimeline: MatchPowerSpikeDto | undefined,
  minute: number
): TimelineCheckpointDiff | undefined {
  if (!spikeTimeline || !Array.isArray(spikeTimeline.points)) return undefined;
  const point = spikeTimeline.points.find(pt => pt.minute === minute);
  if (!point) return undefined;
  return {
    goldDiff: Math.round(point.playerGoldLead),
    xpDiff: Math.round((point.playerXp ?? 0) - (point.opponentXp ?? 0)),
    csDiff: Math.round((point.playerCs ?? 0) - (point.opponentCs ?? 0)),
  };
}

function extractMatchDeathContext(
  eventTimeline: MatchEventTimelineDto | undefined,
  fallbackPlayerChampion?: string
): MatchDeathContext | undefined {
  if (!eventTimeline || !Array.isArray(eventTimeline.events)) return undefined;
  const events = eventTimeline.events;
  const victimChamp =
    eventTimeline.playerChampion?.trim() || fallbackPlayerChampion?.trim() || null;

  const objectiveMinutes = events
    .filter(ev => ev.type === 'OBJECTIVE')
    .map(ev => ev.minuteMark + (ev.secondMark ?? 0) / 60);

  const playerDeaths = events
    .filter(ev => ev.type === 'DEATH' && isPlayerTimelineEvent(ev))
    .sort((a, b) => a.minuteMark * 60 + (a.secondMark ?? 0) - (b.minuteMark * 60 + (b.secondMark ?? 0)));

  let firstDeathMinute: number | null = null;
  let deathsBefore10 = 0;
  let knownAssistedDeaths = 0;
  let knownUnassistedDeaths = 0;
  let knownAssistEventsCount = 0;
  let unknownAssistDeaths = 0;
  let missingPositionDeaths = 0;
  let deathsNearObjectiveWindows = 0;
  const earlyDeaths: EarlyDeathEntry[] = [];

  for (const death of playerDeaths) {
    const time = formatEventTimestamp(death.minuteMark, death.secondMark ?? 0);
    const exactMinute = Number((death.minuteMark + (death.secondMark ?? 0) / 60).toFixed(1));
    if (firstDeathMinute === null || exactMinute < firstDeathMinute) {
      firstDeathMinute = exactMinute;
    }
    if (death.minuteMark < 10) {
      deathsBefore10 += 1;
    }

    // Resolve killer across both explicit `killer` and backend DEATH format (`actor` died to `target`)
    let resolvedKiller: string | null = null;
    if (death.killer && death.killer.trim()) {
      resolvedKiller = death.killer.trim();
    } else if (death.target && death.target.trim() && death.target.trim() !== victimChamp) {
      resolvedKiller = death.target.trim();
    } else if (death.actor && death.actor.trim() && death.actor.trim() !== victimChamp) {
      resolvedKiller = death.actor.trim();
    } else {
      resolvedKiller = death.target?.trim() || death.actor?.trim() || null;
    }

    // null or missing assistants MUST mean unknown (null), never solo/0
    const hasAssistantsArray = Array.isArray(death.assistants);
    const cleanedAssistants = hasAssistantsArray
      ? death
          .assistants!.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
          .map(a => a.trim())
      : null;
    const assistantsCount: number | null =
      cleanedAssistants !== null ? cleanedAssistants.length : null;
    const assisted: boolean | null =
      assistantsCount !== null ? assistantsCount > 0 : null;

    if (assisted === true) {
      knownAssistedDeaths += 1;
      knownAssistEventsCount += 1;
    } else if (assisted === false) {
      knownUnassistedDeaths += 1;
      knownAssistEventsCount += 1;
    } else {
      unknownAssistDeaths += 1;
    }

    const approxZone = classifyRiftApproxZone(death.position, death.laneType, death.zone);
    if (approxZone === null) {
      missingPositionDeaths += 1;
    }

    const rawParticipants =
      Array.isArray(death.participants) && death.participants.length > 0
        ? death.participants
        : [victimChamp, resolvedKiller, ...(cleanedAssistants ?? [])];
    const participants = Array.from(
      new Set(
        rawParticipants
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map(p => p.trim())
      )
    );

    const nearObjective = objectiveMinutes.some(objMin => Math.abs(objMin - exactMinute) <= 1.0);
    if (nearObjective) {
      deathsNearObjectiveWindows += 1;
    }

    if (death.minuteMark < 15 && earlyDeaths.length < MAX_EARLY_DEATHS_PER_GAME) {
      earlyDeaths.push({
        time,
        minute: exactMinute,
        approxZone,
        killer: resolvedKiller,
        participants,
        assistants: cleanedAssistants,
        assisted,
        assistantsCount,
      });
    }
  }

  const totalDeaths = playerDeaths.length;
  const assistedDeaths: number | null =
    totalDeaths === 0 ? 0 : knownAssistEventsCount > 0 ? knownAssistedDeaths : null;
  const unassistedDeaths: number | null =
    totalDeaths === 0 ? 0 : knownAssistEventsCount > 0 ? knownUnassistedDeaths : null;

  return {
    totalDeaths,
    firstDeathMinute,
    deathsBefore10,
    assistedDeaths,
    unassistedDeaths,
    unknownAssistDeaths,
    missingPositionDeaths,
    deathsNearObjectiveWindows,
    earlyDeaths,
  };
}

/**
 * Finds the lane opponent for a given participant
 */
function findLaneOpponent(
  myParticipant: ParticipantDto,
  allParticipants: ParticipantDto[]
): ParticipantDto | null {
  const myPosition = myParticipant.teamPosition;
  const myTeamId = myParticipant.teamId;

  // Find opponent with same position on different team
  const opponent = allParticipants.find(
    p => p.teamPosition === myPosition && p.teamId !== myTeamId && myPosition && myPosition !== 'NONE'
  );

  return opponent || null;
}

function summarizePhaseWindow(w: PhaseFarmingWindowDto): CoachPhaseFarmingWindowSummary {
  return {
    eligibleGames: w.eligibleGames,
    shortGames: w.excludedShortGames,
    missingFrameGames: w.excludedMissingFrameCounters,
    avgLaneCsGained: w.avgLaneCsGained,
    avgJungleCsGained: w.avgJungleCsGained,
    avgLaneCsPerMin: w.avgLaneCsPerMin,
    avgJungleCsPerMin: w.avgJungleCsPerMin,
    avgTotalCsPerMin: w.avgTotalCsPerMin,
  };
}

function summarizeObjectiveType(obj: ObjectiveTypeSummaryDto): CoachObjectiveTypeSummary {
  return {
    eligibleGames: obj.eligibleGamesWithKills,
    missingGames: obj.excludedMissingObjectiveGames,
    firstCount: obj.teamFirstCount,
    firstRate: obj.teamFirstRate,
    teamKills: obj.teamTotalKills,
    teamAvg: obj.teamAvgKills,
    enemyAvg: obj.enemyTeamAvgKills,
    personalLh: obj.personalTotalLastHits,
    personalTd: obj.personalTotalTakedowns,
    timelineInvolved: obj.timelinePersonalInvolvements,
  };
}

export function buildCoachImprovementStatsContext(
  stats: ImprovementStatsDto,
  hasTimelineAnalysis: boolean,
  itemMap: ItemMap | null
): CoachImprovementStatsContext {
  const pf = stats.phaseFarming;
  const lr = stats.leadRetention;
  const dc = stats.deathCost;
  const ug = stats.unspentGold;
  const to = stats.teamObjectives;

  const prePurchaseSamples: CoachHighBalanceSample[] = (
    ug.highBalanceBeforePurchaseSamples || []
  )
    .slice(0, MAX_COACH_HIGH_BALANCE_SAMPLES)
    .map(s => {
      const label = formatPurchaseItemLabel(s.nextPurchaseItemId, itemMap);
      return {
        matchId: s.matchId,
        championName: s.championName,
        role: s.role,
        sampledMinute: s.sampledMinute,
        currentGoldAtSample: s.currentGoldAtSample,
        nextPurchaseMinute: s.nextPurchaseMinute ?? null,
        nextPurchaseItemId: s.nextPurchaseItemId ?? null,
        nextPurchaseItemName: label ? label : null,
      };
    });

  return {
    totalGamesConsidered: stats.totalGamesConsidered,
    excludedInvalidDurationGames: stats.excludedInvalidDurationGames,
    excludedMissingTimelineGames: stats.excludedMissingTimelineGames,
    hasTimelineAnalysis,
    phaseFarming: {
      min10To20: summarizePhaseWindow(pf.min10To20),
      min20ToEnd: summarizePhaseWindow(pf.min20ToEnd),
    },
    leadRetention: {
      missingOpponentGames: lr.excludedMissingOpponentGames,
      shortBefore10: lr.excludedShortGamesBefore10,
      shortBefore20: lr.excludedShortGamesBefore20,
      eligibleGamesAt10: lr.eligibleGamesAt10,
      eligibleGamesAt20: lr.eligibleGamesAt20,
      avgGoldLeadAt10: lr.avgGoldLeadAt10,
      avgXpLeadAt10: lr.avgXpLeadAt10,
      avgGoldLeadAt20: lr.avgGoldLeadAt20,
      avgXpLeadAt20: lr.avgXpLeadAt20,
      aheadGold10: lr.gamesAheadInGoldAt10,
      aheadGold10Reach20: lr.gamesAheadInGoldAt10Reaching20,
      retainedGold20: lr.gamesRetainedGoldLeadAt20,
      goldLeadRetentionRate: lr.goldLeadRetentionRate,
      aheadXp10: lr.gamesAheadInXpAt10,
      aheadXp10Reach20: lr.gamesAheadInXpAt10Reaching20,
      retainedXp20: lr.gamesRetainedXpLeadAt20,
      xpLeadRetentionRate: lr.xpLeadRetentionRate,
      allyObj10To20: lr.allyObjectiveEvents10To20,
      enemyObj10To20: lr.enemyObjectiveEvents10To20,
      allyTowers10To20: lr.allyTowerEvents10To20,
      enemyTowers10To20: lr.enemyTowerEvents10To20,
    },
    deathCost: {
      eligibleTimeDeadGames: dc.eligibleTimeDeadGames,
      missingTimeDeadGames: dc.excludedMissingTimeSpentDeadGames,
      totalTimeSpentDeadSeconds: dc.totalTimeSpentDeadSeconds,
      avgTimeSpentDeadSeconds: dc.avgTimeSpentDeadSeconds,
      avgDeadTimeGameSharePct: dc.avgDeadTimeGameSharePct,
      overallDeadTimeGameSharePct: dc.overallDeadTimeGameSharePct,
      bounty: {
        eligibleTimelineGames: dc.bountyOnPlayerDeaths.eligibleTimelineGames,
        totalRecordedDeaths: dc.bountyOnPlayerDeaths.totalRecordedDeaths,
        deathsWithAnyBountyData: dc.bountyOnPlayerDeaths.deathsWithAnyBountyData,
        deathsMissingBountyData: dc.bountyOnPlayerDeaths.deathsMissingBountyData,
        totalBaseKillBountyGold: dc.bountyOnPlayerDeaths.totalBaseKillBountyGold,
        totalShutdownBountyGold: dc.bountyOnPlayerDeaths.totalShutdownBountyGold,
        totalCombinedBountyGold: dc.bountyOnPlayerDeaths.totalCombinedBountyGold,
        avgCombinedBountyPerDeath: dc.bountyOnPlayerDeaths.avgCombinedBountyPerDeath,
      },
    },
    unspentGold: {
      eligibleGames: ug.eligibleGames,
      missingSampleGames: ug.excludedNoCurrentGoldSamplesGames,
      sampleCount: ug.sampleCount,
      medianCurrentGold: ug.medianCurrentGold,
      maxCurrentGold: ug.maxCurrentGold,
      avgCurrentGold: ug.avgCurrentGold,
      highBalanceThresholdGold: ug.highBalanceThresholdGold,
      highBalanceSampleCount: ug.highBalanceSampleCount,
      highBalancePrePurchaseCount: ug.highBalanceBeforePurchaseSampleCount,
      prePurchaseSamples,
    },
    teamObjectives: {
      eligibleTeamObjectiveGames: to.eligibleTeamObjectiveGames,
      missingTeamsGames: to.excludedMissingTeamsDataGames,
      timelineEligibleGames: to.tower.timelineEligibleGames,
      tower: summarizeObjectiveType(to.tower),
      dragon: summarizeObjectiveType(to.dragon),
      baron: summarizeObjectiveType(to.baron),
      riftHerald: summarizeObjectiveType(to.riftHerald),
      horde: summarizeObjectiveType(to.horde),
    },
  };
}

/**
 * Builds comprehensive, token-bounded AI context from matches, Data Dragon maps, and optional TimelineAnalysisDto / ImprovementStatsDto.
 */
export function buildAiContext(
  summonerName: string,
  tagLine: string,
  allMatches: MatchDto[],
  puuid: string,
  rankInfo: { tier: string; rank: string; leaguePoints: number; wins: number; losses: number } | null,
  championStats: ChampionStats[],
  overallStats: OverallStats | null,
  timelineAnalysis?: TimelineAnalysisDto | null,
  improvementStats?: ImprovementStatsDto | null
): {
  summonerName: string;
  rank: string;
  totalWins: number;
  totalLosses: number;
  primaryRole: string;
  totalGamesAnalyzed: number;
  timelineStatus: 'ANALYZED' | 'NOT_ANALYZED';
  visionDataPrecision: string;
  avgLaneCsAt10: AverageLaneCsAt10Summary | null;
  missingLaneCsAt10Matches: number;
  timelineInsights?: EnrichedTimelineInsights;
  improvementStats?: CoachImprovementStatsContext;
  winRate: string;
  kda: string;
  avgKills: string;
  avgDeaths: string;
  avgAssists: string;
  avgCsPerMin: string;
  avgKillParticipation: string;
  avgSoloKills: string;
  avgTurretPlates: string;
  avgVisionScore: string;
  topChampions: Array<{ name: string; games: number; winRate: string; kda: string }>;
  blueSideWinRate: string;
  redSideWinRate: string;
  recentMatches: MatchDetail[];
  opponentStats: {
    avgKda: string;
    avgCsPerMin: string;
    avgKillParticipation: string;
    avgSoloKills: string;
    avgTurretPlates: string;
    avgVisionScore: string;
  };
  topStrengths: Array<{ name: string; consistency: string }>;
  topWeaknesses: Array<{ name: string; consistency: string }>;
  championMatchups: Record<string, { wins: number; losses: number; total: number; winRate: string }>;
} {
  const { bestStats, worstStats } = calculateConsistency(allMatches, puuid);
  const ddState =
    typeof useDataDragonStore.getState === 'function' ? useDataDragonStore.getState() : undefined;
  const itemMap = ddState?.itemMap ?? null;
  const runeMap = ddState?.runeMap ?? null;
  const summonerSpellMap = ddState?.summonerSpellMap ?? null;
  const timelineStatus: 'ANALYZED' | 'NOT_ANALYZED' = timelineAnalysis ? 'ANALYZED' : 'NOT_ANALYZED';

  if (!overallStats) {
    const fallbackResolvedImprovement = resolveImprovementStats(
      improvementStats,
      timelineAnalysis,
      allMatches.slice(0, MAX_RECENT_MATCHES),
      puuid
    );
    const fallbackCoachImprovementStats = buildCoachImprovementStatsContext(
      fallbackResolvedImprovement.stats,
      fallbackResolvedImprovement.hasTimelineAnalysis,
      itemMap
    );
    return {
      summonerName: `${summonerName}#${tagLine}`,
      rank: 'Unranked',
      totalWins: 0,
      totalLosses: 0,
      primaryRole: 'UNKNOWN',
      totalGamesAnalyzed: allMatches.length || fallbackResolvedImprovement.stats.totalGamesConsidered,
      timelineStatus,
      visionDataPrecision: VISION_DATA_PRECISION_NOTE,
      avgLaneCsAt10: null,
      missingLaneCsAt10Matches: 0,
      improvementStats: fallbackCoachImprovementStats,
      winRate: '0.0',
      kda: '0.00',
      avgKills: '0.0',
      avgDeaths: '0.0',
      avgAssists: '0.0',
      avgCsPerMin: '0.0',
      avgKillParticipation: '0.0',
      avgSoloKills: '0.0',
      avgTurretPlates: '0.0',
      avgVisionScore: '0.0',
      topChampions: [],
      blueSideWinRate: '0.0',
      redSideWinRate: '0.0',
      recentMatches: [],
      opponentStats: {
        avgKda: '0.00',
        avgCsPerMin: '0.0',
        avgKillParticipation: '0.0',
        avgSoloKills: '0.0',
        avgTurretPlates: '0.0',
        avgVisionScore: '0.0',
      },
      topStrengths: [],
      topWeaknesses: [],
      championMatchups: {},
    };
  }

  // Index optional timeline per-match DTOs strictly by matchId (NEVER use positional index fallback across match IDs)
  const spikeByMatchId = new Map<string, MatchPowerSpikeDto>();
  const buildByMatchId = new Map<string, BuildOrderDto>();
  const skillByMatchId = new Map<string, SkillOrderDto>();
  const eventsByMatchId = new Map<string, MatchEventTimelineDto>();

  if (timelineAnalysis) {
    timelineAnalysis.powerSpikeTimelines?.forEach(dto => {
      if (dto.matchId) spikeByMatchId.set(dto.matchId, dto);
    });
    timelineAnalysis.buildOrders?.forEach(dto => {
      if (dto.matchId) buildByMatchId.set(dto.matchId, dto);
    });
    timelineAnalysis.skillOrders?.forEach(dto => {
      if (dto.matchId) skillByMatchId.set(dto.matchId, dto);
    });
    timelineAnalysis.eventTimelines?.forEach(dto => {
      if (dto.matchId) eventsByMatchId.set(dto.matchId, dto);
    });
  }

  const matchDetails: MatchDetail[] = [];
  let primaryRole = '';
  const roleCount: Record<string, number> = {};
  let missingLaneCsAt10Matches = 0;
  let missingTimelineMatches = 0;

  for (let matchIdx = 0; matchIdx < allMatches.length; matchIdx++) {
    const match = allMatches[matchIdx];
    if (!match.info?.participants) continue;

    const myParticipant = match.info.participants.find(p => p.puuid === puuid);
    if (!myParticipant) continue;

    const role = myParticipant.teamPosition || 'UNKNOWN';
    roleCount[role] = (roleCount[role] || 0) + 1;

    // Cap deterministic per-match processing to MAX_RECENT_MATCHES (20)
    if (matchDetails.length >= MAX_RECENT_MATCHES) {
      continue;
    }

    const matchId =
      match.metadata?.matchId ||
      (match.info.gameId !== undefined ? String(match.info.gameId) : undefined);
    const patch = formatPatchMajorMinor(match.info.gameVersion);
    const side: 'Blue' | 'Red' = myParticipant.teamId === 200 ? 'Red' : 'Blue';

    const gameDuration = (match.info.gameDuration || 0) / 60;
    const totalCs = (myParticipant.totalMinionsKilled || 0) + (myParticipant.neutralMinionsKilled || 0);
    const csPerMin = gameDuration > 0 ? totalCs / gameDuration : 0;

    const kills = myParticipant.kills || 0;
    const deaths = myParticipant.deaths || 0;
    const assists = myParticipant.assists || 0;
    const kda = deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : 'Perfect';
    const turretPlates = myParticipant.challenges?.turretPlatesTaken || 0;

    const playerKeystoneId = myParticipant.perks?.styles?.[0]?.selections?.[0]?.perk;
    const playerSubStyleId = myParticipant.perks?.styles?.[1]?.style;
    const keystone = resolveRuneName(playerKeystoneId, runeMap);
    const subStyle = resolveRuneName(playerSubStyleId, runeMap);
    const summonerSpells = resolveSummonerSpells(myParticipant, summonerSpellMap);
    const items = resolveParticipantItems(myParticipant, itemMap);

    // 5v5 draft context
    const allies = match.info.participants
      .filter(p => p.teamId === myParticipant.teamId && p.puuid !== puuid)
      .map(p => p.championName || 'Unknown');
    const enemies = match.info.participants
      .filter(p => p.teamId !== myParticipant.teamId)
      .map(p => p.championName || 'Unknown');

    const damageSplitPct = computeDamageSplitPct(myParticipant);

    // Find lane opponent
    const opponent = findLaneOpponent(myParticipant, match.info.participants);
    let opponentData: MatchDetail['opponent'] = null;

    if (opponent) {
      const oppCs = (opponent.totalMinionsKilled || 0) + (opponent.neutralMinionsKilled || 0);
      const oppCsPerMin = gameDuration > 0 ? oppCs / gameDuration : 0;
      const oppKills = opponent.kills || 0;
      const oppDeaths = opponent.deaths || 0;
      const oppAssists = opponent.assists || 0;
      const oppKda = oppDeaths > 0 ? ((oppKills + oppAssists) / oppDeaths).toFixed(2) : 'Perfect';
      const oppTurretPlates = opponent.challenges?.turretPlatesTaken || 0;
      const oppName = opponent.riotIdGameName || opponent.summonerName || opponent.championName || 'Unknown';
      const oppKeystoneId = opponent.perks?.styles?.[0]?.selections?.[0]?.perk;
      const oppKeystone = resolveRuneName(oppKeystoneId, runeMap);
      const oppItems = resolveParticipantItems(opponent, itemMap);

      const oppTeamKills = match.info.participants
        .filter(p => p.teamId === opponent.teamId)
        .reduce((sum, p) => sum + (p.kills || 0), 0);
      const oppKp = oppTeamKills > 0 ? ((oppKills + oppAssists) / oppTeamKills) * 100 : 0;

      opponentData = {
        name: oppName,
        champion: opponent.championName || 'Unknown',
        kda: oppKda,
        csPerMin: parseFloat(oppCsPerMin.toFixed(1)),
        killParticipation: parseFloat(oppKp.toFixed(1)),
        visionScore: opponent.visionScore || 0,
        turretPlates: oppTurretPlates,
        ...(oppKeystone ? { keystone: oppKeystone } : {}),
        items: oppItems,
      };
    }

    const teamKills = match.info.participants
      .filter(p => p.teamId === myParticipant.teamId)
      .reduce((sum, p) => sum + (p.kills || 0), 0);
    const killParticipation = teamKills > 0 ? ((kills + assists) / teamKills) * 100 : 0;

    const damagePerMinute = gameDuration > 0 ? (myParticipant.totalDamageDealtToChampions || 0) / gameDuration : 0;
    const goldPerMinute = gameDuration > 0 ? (myParticipant.goldEarned || 0) / gameDuration : 0;

    const isStatRelevant = (statKey: string) => {
      const requiredRole = STAT_ROLE_MAPPING[statKey];
      if (!requiredRole || requiredRole === 'ALL') return true;
      const currentRole = role === 'UTILITY' ? 'SUPPORT' : role;
      return requiredRole === currentRole;
    };

    const soloKills = myParticipant.challenges?.soloKills || 0;
    const earlyLaningPhaseGoldExpAdvantage = myParticipant.challenges?.earlyLaningPhaseGoldExpAdvantage;
    const maxCsAdvantageOnLaneOpponent = myParticipant.challenges?.maxCsAdvantageOnLaneOpponent;
    const visionScoreAdvantageLaneOpponent = myParticipant.challenges?.visionScoreAdvantageLaneOpponent;

    const timeCCingOthers = myParticipant.timeCCingOthers;
    const totalDamageShieldedOnTeammates = myParticipant.totalDamageShieldedOnTeammates;
    const totalHealsOnTeammates = myParticipant.totalHealsOnTeammates;

    // Early laning CS @10 (role-gated and duration/queue-gated; missing or short-game values preserved in missingLaneCsAt10Matches, never counted as 0)
    const rawLaneCs10 = myParticipant.challenges?.laneMinionsFirst10Minutes;
    const hasValidLaneCsAt10 =
      isEligibleLaneCsAt10Match(match.info) &&
      !myParticipant.gameEndedInEarlySurrender &&
      typeof rawLaneCs10 === 'number' &&
      Number.isFinite(rawLaneCs10) &&
      rawLaneCs10 >= 0;
    if (isLanerPosition(role) && !hasValidLaneCsAt10) {
      missingLaneCsAt10Matches += 1;
    }

    const laneCsAt10 =
      isLanerPosition(role) && hasValidLaneCsAt10
        ? (() => {
            const comp = calculateLaneCsAt10Comparison(
              rawLaneCs10,
              match.info?.gameVersion,
              role
            );
            return {
              actual: comp.actual,
              target: comp.target,
              targetLabel: comp.targetLabel,
            };
          })()
        : undefined;

    const jungleCsBefore10Minutes =
      role === 'JUNGLE' &&
      typeof myParticipant.challenges?.jungleCsBefore10Minutes === 'number' &&
      Number.isFinite(myParticipant.challenges.jungleCsBefore10Minutes)
        ? Math.round(myParticipant.challenges.jungleCsBefore10Minutes)
        : undefined;

    // Vision & objective counts
    const controlWardsPlaced =
      myParticipant.challenges?.controlWardsPlaced ??
      myParticipant.detectorWardsPlaced ??
      myParticipant.visionWardsBoughtInGame ??
      0;
    const wardsPlaced = myParticipant.wardsPlaced ?? 0;
    const wardsKilled = myParticipant.wardsKilled ?? 0;
    const damageDealtToObjectives = myParticipant.damageDealtToObjectives ?? 0;
    const damageDealtToTurrets =
      myParticipant.damageDealtToTurrets ?? myParticipant.damageDealtToBuildings ?? 0;

    // Optional timeline enrichment (strictly by matchId — never fall back to array index)
    let timelineAt10: TimelineCheckpointDiff | undefined;
    let timelineAt15: TimelineCheckpointDiff | undefined;
    let deathContext: MatchDeathContext | undefined;
    let itemSpikes: ItemSpikeEntry[] | undefined;
    let skillMaxOrder: string | undefined;

    if (timelineAnalysis) {
      const spikeDto = matchId ? spikeByMatchId.get(matchId) : undefined;
      const buildDto = matchId ? buildByMatchId.get(matchId) : undefined;
      const skillDto = matchId ? skillByMatchId.get(matchId) : undefined;
      const eventDto = matchId ? eventsByMatchId.get(matchId) : undefined;

      if (!spikeDto && !buildDto && !skillDto && !eventDto) {
        missingTimelineMatches += 1;
      }

      timelineAt10 = extractCheckpointDiff(spikeDto, 10);
      timelineAt15 = extractCheckpointDiff(spikeDto, 15);
      deathContext = extractMatchDeathContext(eventDto, myParticipant.championName);
      itemSpikes = extractItemSpikes(buildDto, itemMap);
      skillMaxOrder = extractSkillMaxOrder(skillDto);
    }

    matchDetails.push({
      ...(matchId ? { matchId } : {}),
      ...(patch ? { patch } : {}),
      role,
      side,
      champion: myParticipant.championName || 'Unknown',
      win: myParticipant.win || false,
      kda,
      csPerMin: parseFloat(csPerMin.toFixed(1)),
      killParticipation: parseFloat(killParticipation.toFixed(1)),
      ...(keystone ? { keystone } : {}),
      ...(subStyle ? { subStyle } : {}),
      summonerSpells,
      items,
      draft: {
        allies,
        enemies,
      },
      damageSplitPct,
      visionScore: myParticipant.visionScore || 0,
      turretPlates,
      turretPlatesTaken: turretPlates,
      controlWardsPlaced,
      wardsPlaced,
      wardsKilled,
      damageDealtToObjectives,
      damageDealtToTurrets,
      opponent: opponentData,
      gameDuration: parseFloat(gameDuration.toFixed(1)),
      ...(laneCsAt10 ? { laneCsAt10 } : {}),
      ...(jungleCsBefore10Minutes !== undefined ? { jungleCsBefore10Minutes } : {}),
      ...(timelineAt10 ? { timelineAt10 } : {}),
      ...(timelineAt15 ? { timelineAt15 } : {}),
      ...(deathContext ? { deathContext } : {}),
      ...(itemSpikes && itemSpikes.length > 0 ? { itemSpikes } : {}),
      ...(skillMaxOrder ? { skillMaxOrder } : {}),

      // Advanced stats conditionally & filtered by role
      ...(isStatRelevant('damagePerMinute') ? { damagePerMinute: Math.round(damagePerMinute) } : {}),
      ...(isStatRelevant('goldPerMinute') ? { goldPerMinute: Math.round(goldPerMinute) } : {}),
      ...(isStatRelevant('soloKills') ? { soloKills } : {}),
      ...(earlyLaningPhaseGoldExpAdvantage !== undefined
        ? { earlyLaningPhaseGoldExpAdvantage: Math.round(earlyLaningPhaseGoldExpAdvantage * 100) / 100 }
        : {}),
      ...(maxCsAdvantageOnLaneOpponent !== undefined
        ? { maxCsAdvantageOnLaneOpponent: Math.round(maxCsAdvantageOnLaneOpponent * 10) / 10 }
        : {}),
      ...(visionScoreAdvantageLaneOpponent !== undefined
        ? { visionScoreAdvantageLaneOpponent: Math.round(visionScoreAdvantageLaneOpponent * 10) / 10 }
        : {}),
      ...(timeCCingOthers !== undefined ? { timeCCingOthers } : {}),
      ...(totalDamageShieldedOnTeammates !== undefined ? { totalDamageShieldedOnTeammates } : {}),
      ...(totalHealsOnTeammates !== undefined ? { totalHealsOnTeammates } : {}),
    });
  }

  // Determine primary role
  primaryRole = Object.entries(roleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';

  // Cap recentMatches deterministically at MAX_RECENT_MATCHES (20)
  const cappedMatches = allMatches.slice(0, MAX_RECENT_MATCHES);
  const primaryRoleMatches = matchDetails.slice(0, MAX_RECENT_MATCHES);
  const avgLaneCsAt10 = calculateAverageLaneCsAt10(cappedMatches, puuid);

  const resolvedImprovement = resolveImprovementStats(
    improvementStats,
    timelineAnalysis,
    cappedMatches,
    puuid
  );
  const coachImprovementStats = buildCoachImprovementStatsContext(
    resolvedImprovement.stats,
    resolvedImprovement.hasTimelineAnalysis,
    itemMap
  );

  // Build enriched timelineInsights summary (without any raw [x, y] coordinate arrays)
  let timelineInsights: EnrichedTimelineInsights | undefined;
  if (timelineAnalysis?.aggregateSummary) {
    let totalDeathsCount = 0;
    let totalDeathsBefore10 = 0;
    let totalKnownAssistedDeaths = 0;
    let totalKnownUnassistedDeaths = 0;
    let totalKnownAssistDeathsCount = 0;
    let totalUnknownAssistDeaths = 0;
    let totalMissingPositionDeaths = 0;
    let totalDeathsNearObjectives = 0;
    let wardEventsCount = 0;
    const wardBuckets = { pre10: 0, min10To20: 0, post20: 0 };

    for (const evTimeline of timelineAnalysis.eventTimelines || []) {
      const ctx = extractMatchDeathContext(evTimeline);
      if (ctx) {
        totalDeathsCount += ctx.totalDeaths;
        totalDeathsBefore10 += ctx.deathsBefore10;
        if (ctx.assistedDeaths !== null && ctx.unassistedDeaths !== null) {
          totalKnownAssistedDeaths += ctx.assistedDeaths;
          totalKnownUnassistedDeaths += ctx.unassistedDeaths;
          totalKnownAssistDeathsCount += ctx.assistedDeaths + ctx.unassistedDeaths;
        }
        totalUnknownAssistDeaths += ctx.unknownAssistDeaths;
        totalMissingPositionDeaths += ctx.missingPositionDeaths;
        totalDeathsNearObjectives += ctx.deathsNearObjectiveWindows;
      }
      for (const ev of evTimeline.events || []) {
        if (ev.type === 'WARD_PLACED' && isPlayerTimelineEvent(ev)) {
          wardEventsCount += 1;
          if (ev.minuteMark < 10) wardBuckets.pre10 += 1;
          else if (ev.minuteMark < 20) wardBuckets.min10To20 += 1;
          else wardBuckets.post20 += 1;
        }
      }
    }

    const assistedDeaths: number | null =
      totalDeathsCount === 0 ? 0 : totalKnownAssistDeathsCount > 0 ? totalKnownAssistedDeaths : null;
    const unassistedDeaths: number | null =
      totalDeathsCount === 0 ? 0 : totalKnownAssistDeathsCount > 0 ? totalKnownUnassistedDeaths : null;
    // null or missing ward events in eventTimelines MUST mean unknown (null), not {0,0,0}
    const wardsByTimeBucket = wardEventsCount > 0 ? wardBuckets : null;

    timelineInsights = {
      ...timelineAnalysis.aggregateSummary,
      deathsBefore10: totalDeathsBefore10,
      assistedDeaths,
      unassistedDeaths,
      unknownAssistDeaths: totalUnknownAssistDeaths,
      missingPositionDeaths: totalMissingPositionDeaths,
      deathsNearObjectiveWindows: totalDeathsNearObjectives,
      wardsByTimeBucket,
      missingTimelineMatches,
    };
  }

  return {
    summonerName: `${summonerName}#${tagLine}`,
    rank: rankInfo ? `${rankInfo.tier} ${rankInfo.rank} (${rankInfo.leaguePoints} LP)` : 'Unranked',
    totalWins: rankInfo ? rankInfo.wins : 0,
    totalLosses: rankInfo ? rankInfo.losses : 0,
    primaryRole,
    totalGamesAnalyzed: allMatches.length,
    timelineStatus,
    visionDataPrecision: VISION_DATA_PRECISION_NOTE,
    avgLaneCsAt10,
    missingLaneCsAt10Matches,
    ...(timelineInsights ? { timelineInsights } : {}),
    improvementStats: coachImprovementStats,
    // Aggregate stats
    winRate: Number(overallStats.winRate).toFixed(1),
    kda: Number(overallStats.kda) === Infinity ? 'Perfect' : Number(overallStats.kda).toFixed(2),
    avgKills: Number(overallStats.avgKills).toFixed(1),
    avgDeaths: Number(overallStats.avgDeaths).toFixed(1),
    avgAssists: Number(overallStats.avgAssists).toFixed(1),
    avgCsPerMin: Number(overallStats.avgCsPerMinute).toFixed(1),
    avgKillParticipation: Number(overallStats.avgKillParticipation).toFixed(1),
    avgSoloKills: Number(overallStats.avgSoloKills).toFixed(1),
    avgTurretPlates: Number(overallStats.avgTurretPlates).toFixed(1),
    avgVisionScore: Number(overallStats.avgVisionScore).toFixed(1),
    // Champion pool
    topChampions: championStats.slice(0, 5).map(c => ({
      name: c.championName,
      games: c.games,
      winRate: ((c.wins / c.games) * 100).toFixed(0),
      kda: c.deaths > 0 ? ((c.kills + c.assists) / c.deaths).toFixed(2) : 'Perfect',
    })),
    // Side preference
    blueSideWinRate: Number(overallStats.blueSide.winRate).toFixed(1),
    redSideWinRate: Number(overallStats.redSide.winRate).toFixed(1),
    // Detailed match history (capped at 20 games)
    recentMatches: primaryRoleMatches,
    opponentStats: {
      avgKda: Number(overallStats.oppAvgKda) === Infinity ? 'Perfect' : Number(overallStats.oppAvgKda).toFixed(2),
      avgCsPerMin: Number(overallStats.oppAvgCsPerMinute).toFixed(1),
      avgKillParticipation: Number(overallStats.oppAvgKillParticipation).toFixed(1),
      avgSoloKills: Number(overallStats.oppAvgSoloKills).toFixed(1),
      avgTurretPlates: Number(overallStats.oppAvgTurretPlates).toFixed(1),
      avgVisionScore: Number(overallStats.oppAvgVisionScore).toFixed(1),
    },
    topStrengths: bestStats.map(s => ({
      name: camelCaseToTitleCase(s.key),
      consistency: s.consistency.toFixed(0) + '%',
    })),
    topWeaknesses: worstStats.map(s => ({
      name: camelCaseToTitleCase(s.key),
      consistency: s.lossConsistency.toFixed(0) + '%',
    })),
    championMatchups: computeChampionMatchups(primaryRoleMatches),
  };
}

/**
 * Computes win/loss stats against specific opponent champions
 */
function computeChampionMatchups(
  matches: MatchDetail[]
): Record<string, { wins: number; losses: number; total: number; winRate: string }> {
  const matchups: Record<string, { wins: number; losses: number; total: number }> = {};

  matches.forEach(match => {
    if (!match.opponent?.champion) return;
    const oppChamp = match.opponent.champion;

    if (!matchups[oppChamp]) {
      matchups[oppChamp] = { wins: 0, losses: 0, total: 0 };
    }

    matchups[oppChamp].total++;
    if (match.win) {
      matchups[oppChamp].wins++;
    } else {
      matchups[oppChamp].losses++;
    }
  });

  const result: Record<string, { wins: number; losses: number; total: number; winRate: string }> = {};
  Object.entries(matchups).forEach(([champ, stats]) => {
    result[champ] = {
      ...stats,
      winRate: ((stats.wins / stats.total) * 100).toFixed(0) + '%',
    };
  });

  return result;
}
