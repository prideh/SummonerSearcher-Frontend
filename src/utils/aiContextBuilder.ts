import type { MatchDto, ParticipantDto } from '../types/match';
import type { ChampionStats, OverallStats } from '../types/summoner';
import type {
  BuildOrderDto,
  MatchEventTimelineDto,
  MatchPowerSpikeDto,
  SkillOrderDto,
  TimelineAggregateSummary,
  TimelineAnalysisDto,
} from '../types/timeline';
import { useDataDragonStore, type ItemMap, type RuneMap, type SummonerSpellMap } from '../store/dataDragonStore';
import {
  calculateConsistency,
  calculateLaneCsAt10Comparison,
  isLanerPosition,
  STAT_ROLE_MAPPING,
} from './statsCalculator';
import { camelCaseToTitleCase } from './formatters';

export const MAX_RECENT_MATCHES = 20;
export const MAX_EARLY_DEATHS_PER_GAME = 3;
export const MAX_ITEM_SPIKES_PER_GAME = 3;

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
  minute: number;
  killer: string | null;
  /** True when >=1 enemy assistant contributed (lane 2v2, roam, skirmish, or teamfight — never labelled "gank"). */
  assisted: boolean;
  assistantsCount: number;
}

export interface MatchDeathContext {
  firstDeathMinute: number | null;
  deathsBefore10: number;
  assistedDeaths: number;
  unassistedDeaths: number;
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
    spawnedSupply: number | null;
    supplyLabel: string | null;
  };
  jungleCsBefore10Minutes?: number;
  timelineAt10?: TimelineCheckpointDiff;
  timelineAt15?: TimelineCheckpointDiff;

  // Timeline-derived death, spike, and skill context (present only when timeline analysis was run)
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
  assistedDeaths: number;
  unassistedDeaths: number;
  deathsNearObjectiveWindows: number;
  wardsByTimeBucket: {
    pre10: number;
    min10To20: number;
    post20: number;
  };
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

function extractMatchDeathContext(eventTimeline: MatchEventTimelineDto | undefined): MatchDeathContext | undefined {
  if (!eventTimeline || !Array.isArray(eventTimeline.events)) return undefined;
  const events = eventTimeline.events;
  const objectiveMinutes = events
    .filter(ev => ev.type === 'OBJECTIVE')
    .map(ev => ev.minuteMark + (ev.secondMark ?? 0) / 60);

  const playerDeaths = events
    .filter(ev => ev.type === 'DEATH' && ev.isPlayer)
    .sort((a, b) => a.minuteMark * 60 + (a.secondMark ?? 0) - (b.minuteMark * 60 + (b.secondMark ?? 0)));

  let firstDeathMinute: number | null = null;
  let deathsBefore10 = 0;
  let assistedDeaths = 0;
  let unassistedDeaths = 0;
  let deathsNearObjectiveWindows = 0;
  const earlyDeaths: EarlyDeathEntry[] = [];

  for (const death of playerDeaths) {
    const exactMinute = Number((death.minuteMark + (death.secondMark ?? 0) / 60).toFixed(1));
    if (firstDeathMinute === null || exactMinute < firstDeathMinute) {
      firstDeathMinute = exactMinute;
    }
    if (death.minuteMark < 10) {
      deathsBefore10 += 1;
    }
    const assistantsCount = Array.isArray(death.assistants) ? death.assistants.length : 0;
    const assisted = assistantsCount > 0;
    if (assisted) {
      assistedDeaths += 1;
    } else {
      unassistedDeaths += 1;
    }

    const nearObjective = objectiveMinutes.some(objMin => Math.abs(objMin - exactMinute) <= 1.0);
    if (nearObjective) {
      deathsNearObjectiveWindows += 1;
    }

    if (death.minuteMark < 15 && earlyDeaths.length < MAX_EARLY_DEATHS_PER_GAME) {
      earlyDeaths.push({
        minute: exactMinute,
        killer: death.killer ?? death.actor ?? null,
        assisted,
        assistantsCount,
      });
    }
  }

  return {
    firstDeathMinute,
    deathsBefore10,
    assistedDeaths,
    unassistedDeaths,
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

/**
 * Builds comprehensive, token-bounded AI context from matches, Data Dragon maps, and optional TimelineAnalysisDto.
 */
export function buildAiContext(
  summonerName: string,
  tagLine: string,
  allMatches: MatchDto[],
  puuid: string,
  rankInfo: { tier: string; rank: string; leaguePoints: number; wins: number; losses: number } | null,
  championStats: ChampionStats[],
  overallStats: OverallStats | null,
  timelineAnalysis?: TimelineAnalysisDto | null
): {
  summonerName: string;
  rank: string;
  totalWins: number;
  totalLosses: number;
  primaryRole: string;
  totalGamesAnalyzed: number;
  timelineStatus: 'ANALYZED' | 'NOT_ANALYZED';
  visionDataPrecision: string;
  timelineInsights?: EnrichedTimelineInsights;
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
    return {
      summonerName: `${summonerName}#${tagLine}`,
      rank: 'Unranked',
      totalWins: 0,
      totalLosses: 0,
      primaryRole: 'UNKNOWN',
      totalGamesAnalyzed: 0,
      timelineStatus,
      visionDataPrecision: VISION_DATA_PRECISION_NOTE,
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

  // Index optional timeline per-match DTOs by matchId (with positional fallback)
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

    // Early laning CS @10 (role-gated)
    const laneCsAt10 =
      isLanerPosition(role) && typeof myParticipant.challenges?.laneMinionsFirst10Minutes === 'number'
        ? (() => {
            const comp = calculateLaneCsAt10Comparison(
              myParticipant.challenges!.laneMinionsFirst10Minutes!,
              match.info?.gameVersion
            );
            return {
              actual: comp.actual,
              spawnedSupply: comp.spawnedSupply,
              supplyLabel: comp.supplyLabel,
            };
          })()
        : undefined;

    const jungleCsBefore10Minutes =
      role === 'JUNGLE' && typeof myParticipant.challenges?.jungleCsBefore10Minutes === 'number'
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

    // Optional timeline enrichment (only when user ran timeline analysis)
    let timelineAt10: TimelineCheckpointDiff | undefined;
    let timelineAt15: TimelineCheckpointDiff | undefined;
    let deathContext: MatchDeathContext | undefined;
    let itemSpikes: ItemSpikeEntry[] | undefined;
    let skillMaxOrder: string | undefined;

    if (timelineAnalysis) {
      const spikeDto =
        (matchId ? spikeByMatchId.get(matchId) : undefined) ??
        timelineAnalysis.powerSpikeTimelines?.[matchDetails.length];
      const buildDto =
        (matchId ? buildByMatchId.get(matchId) : undefined) ??
        timelineAnalysis.buildOrders?.[matchDetails.length];
      const skillDto =
        (matchId ? skillByMatchId.get(matchId) : undefined) ??
        timelineAnalysis.skillOrders?.[matchDetails.length];
      const eventDto =
        (matchId ? eventsByMatchId.get(matchId) : undefined) ??
        timelineAnalysis.eventTimelines?.[matchDetails.length];

      timelineAt10 = extractCheckpointDiff(spikeDto, 10);
      timelineAt15 = extractCheckpointDiff(spikeDto, 15);
      deathContext = extractMatchDeathContext(eventDto);
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
  const primaryRoleMatches = matchDetails.slice(0, MAX_RECENT_MATCHES);

  // Build enriched timelineInsights summary (without any raw [x, y] coordinate arrays)
  let timelineInsights: EnrichedTimelineInsights | undefined;
  if (timelineAnalysis?.aggregateSummary) {
    let totalDeathsBefore10 = 0;
    let totalAssistedDeaths = 0;
    let totalUnassistedDeaths = 0;
    let totalDeathsNearObjectives = 0;
    const wardsByTimeBucket = { pre10: 0, min10To20: 0, post20: 0 };

    for (const evTimeline of timelineAnalysis.eventTimelines || []) {
      const ctx = extractMatchDeathContext(evTimeline);
      if (ctx) {
        totalDeathsBefore10 += ctx.deathsBefore10;
        totalAssistedDeaths += ctx.assistedDeaths;
        totalUnassistedDeaths += ctx.unassistedDeaths;
        totalDeathsNearObjectives += ctx.deathsNearObjectiveWindows;
      }
      for (const ev of evTimeline.events || []) {
        if (ev.type === 'WARD_PLACED' && ev.isPlayer) {
          if (ev.minuteMark < 10) wardsByTimeBucket.pre10 += 1;
          else if (ev.minuteMark < 20) wardsByTimeBucket.min10To20 += 1;
          else wardsByTimeBucket.post20 += 1;
        }
      }
    }

    timelineInsights = {
      ...timelineAnalysis.aggregateSummary,
      deathsBefore10: totalDeathsBefore10,
      assistedDeaths: totalAssistedDeaths,
      unassistedDeaths: totalUnassistedDeaths,
      deathsNearObjectiveWindows: totalDeathsNearObjectives,
      wardsByTimeBucket,
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
    ...(timelineInsights ? { timelineInsights } : {}),
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
