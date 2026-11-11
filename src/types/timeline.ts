// TypeScript interfaces mirroring the backend TimelineAnalysisDto

export interface HeatmapPoint {
  x: number;
  y: number;
  matchId: string;
  minute: number;
}

export interface PowerSpikePoint {
  minute: number;
  playerGold: number;
  opponentGold: number;
  playerGoldLead: number;
  playerXp: number;
  opponentXp: number;
  playerCs: number;
  opponentCs: number;
  playerItems: number[];
  opponentItems: number[];
  events: MatchEventEntry[];
}

export interface MatchPowerSpikeDto {
  matchId: string;
  playerChampion: string;
  opponentChampion: string;
  win: boolean;
  points: PowerSpikePoint[];
}

export interface BuildItem {
  itemId: number;
  timestamp: number;
  minuteMark: number;
}

export interface BuildOrderDto {
  matchId: string;
  playerChampion: string;
  win: boolean;
  items: BuildItem[];
}

export interface SkillUp {
  skillSlot: number; // 1=Q, 2=W, 3=E, 4=R
  level: number;
  minuteMark: number;
}

export interface SkillOrderDto {
  matchId: string;
  playerChampion: string;
  win: boolean;
  maxOrder: number[];
  levelUps: SkillUp[];
}

export interface MatchEventEntry {
  type: 'KILL' | 'DEATH' | 'ASSIST' | 'PLATE' | 'OBJECTIVE' | 'WARD_PLACED' | 'WARD_KILLED';
  minuteMark: number;
  secondMark: number;
  actor: string | null;
  target: string | null;
  killer?: string | null;
  assistants?: string[] | null;
  participants?: string[] | null;
  zone?: string | null;
  wardType?: string | null;
  /** Frontend normalized boolean flag (`true` when event involves the queried player). */
  isPlayer?: boolean;
  /** Frontend normalized boolean flag (`true` when event involves the lane opponent). */
  isOpponent?: boolean;
  /** Jackson boolean property serialized by Spring Boot (`boolean isPlayer()` -> `"player"`). */
  player?: boolean;
  /** Jackson boolean property serialized by Spring Boot (`boolean isOpponent()` -> `"opponent"`). */
  opponent?: boolean;
  laneType: string | null;
  monsterType: string | null;
  position: { x: number; y: number } | null;
}

/**
 * Resolves whether a timeline event belongs to the queried player across both
 * Jackson's `player` property (`boolean isPlayer()` getter) and `isPlayer`.
 */
export function isPlayerTimelineEvent(
  ev: Pick<MatchEventEntry, 'isPlayer' | 'player'> | null | undefined
): boolean {
  if (!ev) return false;
  if (typeof ev.isPlayer === 'boolean') return ev.isPlayer;
  if (typeof ev.player === 'boolean') return ev.player;
  return false;
}

/**
 * Resolves whether a timeline event belongs to the lane opponent across both
 * Jackson's `opponent` property (`boolean isOpponent()` getter) and `isOpponent`.
 */
export function isOpponentTimelineEvent(
  ev: Pick<MatchEventEntry, 'isOpponent' | 'opponent'> | null | undefined
): boolean {
  if (!ev) return false;
  if (typeof ev.isOpponent === 'boolean') return ev.isOpponent;
  if (typeof ev.opponent === 'boolean') return ev.opponent;
  return false;
}

/**
 * Normalizes a single `MatchEventEntry` so both `isPlayer`/`player` and `isOpponent`/`opponent`
 * are populated consistently regardless of whether the payload came from Jackson (`player`/`opponent`)
 * or frontend fixtures (`isPlayer`/`isOpponent`).
 */
export function normalizeMatchEventEntry(ev: MatchEventEntry): MatchEventEntry {
  const isPlayer = isPlayerTimelineEvent(ev);
  const isOpponent = isOpponentTimelineEvent(ev);
  return {
    ...ev,
    isPlayer,
    isOpponent,
    player: isPlayer,
    opponent: isOpponent,
  };
}

/**
 * Normalizes all `MatchEventEntry` items inside a `TimelineAnalysisDto` (`eventTimelines` and
 * `powerSpikeTimelines[].points[].events`).
 */
export function normalizeTimelineAnalysisDto(dto: TimelineAnalysisDto): TimelineAnalysisDto {
  if (!dto || typeof dto !== 'object') return dto;
  return {
    ...dto,
    powerSpikeTimelines: Array.isArray(dto.powerSpikeTimelines)
      ? dto.powerSpikeTimelines.map(spike => ({
          ...spike,
          points: Array.isArray(spike.points)
            ? spike.points.map(pt => ({
                ...pt,
                events: Array.isArray(pt.events) ? pt.events.map(normalizeMatchEventEntry) : [],
              }))
            : [],
        }))
      : [],
    eventTimelines: Array.isArray(dto.eventTimelines)
      ? dto.eventTimelines.map(et => ({
          ...et,
          events: Array.isArray(et.events) ? et.events.map(normalizeMatchEventEntry) : [],
        }))
      : [],
  };
}

export interface MatchEventTimelineDto {
  matchId: string;
  playerChampion: string;
  opponentChampion: string;
  win: boolean;
  events: MatchEventEntry[];
}

import type { ImprovementStatsDto } from './improvementStats';

export interface TimelineAggregateSummary {
  avgFirstDeathMinute: number;
  mostDangerousZone: string;
  avgGoldLeadAt10: number;
  avgGoldLeadAt15: number;
  wardsPlacedTotal: number;
  deathsTotal: number;
  killsTotal: number;
  assistsTotal: number;
  gamesAnalyzed: number;
  deathsBefore10?: number | null;
  assistedDeaths?: number | null;
  unassistedDeaths?: number | null;
  deathsNearObjectiveWindows?: number | null;
}

export interface TimelineAnalysisDto {
  heatmapPositions: HeatmapPoint[];
  deathPositions: HeatmapPoint[];
  wardPositions: HeatmapPoint[];
  killPositions: HeatmapPoint[];
  assistPositions: HeatmapPoint[];
  powerSpikeTimelines: MatchPowerSpikeDto[];
  buildOrders: BuildOrderDto[];
  skillOrders: SkillOrderDto[];
  eventTimelines: MatchEventTimelineDto[];
  aggregateSummary: TimelineAggregateSummary;
  improvementStats?: ImprovementStatsDto | null;
}

export type CoachTimelinePreparationStatus = 'COMPLETE' | 'PARTIAL' | 'BLOCKED';

export interface CoachTimelinePreparationRequestDto {
  matchIds?: string[] | null;
}

export interface MissingMatchTimelineDto {
  matchId: string;
  reason: string;
}

export interface CoachTimelinePreparationResultDto {
  status: CoachTimelinePreparationStatus;
  region: string;
  puuid: string;
  analyzerVersion: string;
  requestedMatchIds: string[];
  coveredMatchIds: string[];
  missingMatches: MissingMatchTimelineDto[];
  stopReason?: string | null;
  cacheHit?: boolean;
  peakRetainedRawTimelines?: number;
  analysis?: TimelineAnalysisDto | null;
}

export interface CoachTimelineCoverageContext {
  status: CoachTimelinePreparationStatus;
  covered: number;
  requested: number;
  stopReason?: string | null;
}

function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function parseStrictMatchIdArray(input: unknown): { valid: boolean; ids: string[] } {
  if (!Array.isArray(input)) {
    return { valid: false, ids: [] };
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') {
      return { valid: false, ids: [] };
    }
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      return { valid: false, ids: [] };
    }
    seen.add(trimmed);
    ids.push(trimmed);
  }
  return { valid: true, ids };
}

function parseStrictMissingMatchesArray(
  input: unknown
): { valid: boolean; items: MissingMatchTimelineDto[] } {
  if (!Array.isArray(input)) {
    return { valid: false, items: [] };
  }
  const seen = new Set<string>();
  const items: MissingMatchTimelineDto[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') {
      return { valid: false, items: [] };
    }
    const candidate = entry as { matchId?: unknown; reason?: unknown };
    if (typeof candidate.matchId !== 'string') {
      return { valid: false, items: [] };
    }
    const matchId = candidate.matchId.trim();
    if (!matchId || seen.has(matchId)) {
      return { valid: false, items: [] };
    }
    if (
      candidate.reason !== undefined &&
      candidate.reason !== null &&
      typeof candidate.reason !== 'string'
    ) {
      return { valid: false, items: [] };
    }
    const reason =
      typeof candidate.reason === 'string' && candidate.reason.trim().length > 0
        ? candidate.reason.trim()
        : 'TIMELINE_UNAVAILABLE';
    seen.add(matchId);
    items.push({ matchId, reason });
  }
  return { valid: true, items };
}

function arePerMatchSubArraysConsistent(
  analysis: TimelineAnalysisDto,
  coveredSet: Set<string>
): boolean {
  const checkMatchIdList = (items: unknown): boolean => {
    if (!Array.isArray(items)) return false;
    if (items.length > coveredSet.size) return false;
    const seen = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== 'object') return false;
      const matchId = (item as { matchId?: unknown }).matchId;
      if (typeof matchId !== 'string') return false;
      const trimmed = matchId.trim();
      if (!trimmed || !coveredSet.has(trimmed) || seen.has(trimmed)) {
        return false;
      }
      seen.add(trimmed);
    }
    return true;
  };

  return (
    checkMatchIdList(analysis.powerSpikeTimelines) &&
    checkMatchIdList(analysis.buildOrders) &&
    checkMatchIdList(analysis.skillOrders) &&
    checkMatchIdList(analysis.eventTimelines)
  );
}

/**
 * Normalizes and validates a `CoachTimelinePreparationResultDto` returned by
 * `POST /riot/timeline/prepare-coach/{region}/{puuid}`.
 *
 * Fails closed (`status: 'BLOCKED'`, `analysis: null`, `coveredMatchIds: []`) on:
 * - malformed / non-object payloads (`MALFORMED_RESPONSE`)
 * - missing or mismatched `region` / `puuid` identity (`IDENTITY_MISMATCH`)
 * - unknown or malformed `status` (`INVALID_STATUS` — never guesses `COMPLETE` from `analysis`)
 * - `coveredMatchIds` not a subset of `requestedMatchIds`, foreign `requestedMatchIds` outside client-requested
 *   `matchIds`, overlapping `coveredMatchIds`/`missingMatches`, contradictory `COMPLETE`/`PARTIAL` claims,
 *   or `aggregateSummary.gamesAnalyzed !== coveredMatchIds.length` (`INCONSISTENT_COVERAGE`).
 *
 * Preserves honest `PARTIAL` and `missingMatches` denominators when the server covers a valid subset
 * of the client-requested match list.
 */
export function normalizeCoachTimelinePreparationResultDto(
  raw: Partial<CoachTimelinePreparationResultDto> | null | undefined,
  fallbackRegion = '',
  fallbackPuuid = '',
  fallbackRequestedMatchIds: string[] = []
): CoachTimelinePreparationResultDto {
  const expectedRegion = fallbackRegion.trim().toLowerCase();
  const expectedPuuid = fallbackPuuid.trim();
  const clientIds = sanitizeStringArray(fallbackRequestedMatchIds);
  const clientIdSet = new Set(clientIds);

  const returnedRegion =
    raw && typeof raw === 'object' && typeof raw.region === 'string'
      ? raw.region.trim().toLowerCase()
      : '';
  const returnedPuuid =
    raw && typeof raw === 'object' && typeof raw.puuid === 'string'
      ? raw.puuid.trim()
      : '';
  const analyzerVersion =
    raw && typeof raw === 'object' && typeof raw.analyzerVersion === 'string' && raw.analyzerVersion.trim()
      ? raw.analyzerVersion.trim()
      : 'v1';

  const buildBlockedFailClosed = (
    stopReason: string,
    requestedIds: string[] = clientIds
  ): CoachTimelinePreparationResultDto => ({
    status: 'BLOCKED',
    region: expectedRegion || returnedRegion,
    puuid: expectedPuuid || returnedPuuid,
    analyzerVersion,
    requestedMatchIds: requestedIds,
    coveredMatchIds: [],
    missingMatches: requestedIds.map(matchId => ({ matchId, reason: stopReason })),
    stopReason,
    cacheHit: false,
    peakRetainedRawTimelines: 0,
    analysis: null,
  });

  if (!raw || typeof raw !== 'object') {
    return buildBlockedFailClosed('MALFORMED_RESPONSE');
  }

  if (
    !returnedRegion ||
    !returnedPuuid ||
    (expectedRegion.length > 0 && returnedRegion !== expectedRegion) ||
    (expectedPuuid.length > 0 && returnedPuuid !== expectedPuuid)
  ) {
    return buildBlockedFailClosed('IDENTITY_MISMATCH');
  }

  const rawStatus = typeof raw.status === 'string' ? raw.status.trim().toUpperCase() : '';
  if (rawStatus !== 'COMPLETE' && rawStatus !== 'PARTIAL' && rawStatus !== 'BLOCKED') {
    return buildBlockedFailClosed('INVALID_STATUS');
  }

  const parsedRequested = parseStrictMatchIdArray(raw.requestedMatchIds);
  const parsedCovered = parseStrictMatchIdArray(raw.coveredMatchIds);
  const parsedMissing = parseStrictMissingMatchesArray(raw.missingMatches);
  if (!parsedRequested.valid || !parsedCovered.valid || !parsedMissing.valid) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE');
  }

  const serverRequestedIds = parsedRequested.ids;
  const serverCoveredIds = parsedCovered.ids;
  const serverMissingItems = parsedMissing.items;

  if (
    clientIds.length > 0 &&
    serverRequestedIds.some(id => !clientIdSet.has(id))
  ) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', clientIds);
  }

  const honestRequestedIds = clientIds.length > 0 ? clientIds : serverRequestedIds;
  const serverRequestedSet = new Set(serverRequestedIds);
  const honestRequestedSet = new Set(honestRequestedIds);
  const coveredSet = new Set(serverCoveredIds);

  if (serverCoveredIds.some(id => !serverRequestedSet.has(id))) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
  }

  if (
    serverMissingItems.some(
      m =>
        !honestRequestedSet.has(m.matchId) ||
        coveredSet.has(m.matchId) ||
        (!serverRequestedSet.has(m.matchId) && m.reason !== 'NOT_IN_SERVER_PROFILE')
    )
  ) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
  }

  const rawStopReason =
    typeof raw.stopReason === 'string' && raw.stopReason.trim().length > 0
      ? raw.stopReason.trim()
      : null;

  const missingReasonById = new Map<string, string>(
    serverMissingItems.map(m => [m.matchId, m.reason])
  );
  const buildHonestMissing = (defaultServerMissingReason: string): MissingMatchTimelineDto[] => {
    const list: MissingMatchTimelineDto[] = [];
    for (const id of honestRequestedIds) {
      if (coveredSet.has(id)) continue;
      const existing = missingReasonById.get(id);
      if (existing) {
        list.push({ matchId: id, reason: existing });
      } else if (serverRequestedSet.has(id)) {
        list.push({ matchId: id, reason: defaultServerMissingReason });
      } else {
        list.push({ matchId: id, reason: 'NOT_IN_SERVER_PROFILE' });
      }
    }
    return list;
  };

  if (rawStatus === 'BLOCKED') {
    if (serverCoveredIds.length > 0 || (raw.analysis !== null && raw.analysis !== undefined)) {
      return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
    }
    const stopReason =
      rawStopReason ?? serverMissingItems[0]?.reason ?? 'TIMELINE_UNAVAILABLE';
    return {
      status: 'BLOCKED',
      region: returnedRegion,
      puuid: returnedPuuid,
      analyzerVersion,
      requestedMatchIds: honestRequestedIds,
      coveredMatchIds: [],
      missingMatches: buildHonestMissing(stopReason),
      stopReason,
      cacheHit: Boolean(raw.cacheHit),
      peakRetainedRawTimelines:
        typeof raw.peakRetainedRawTimelines === 'number' && Number.isFinite(raw.peakRetainedRawTimelines)
          ? raw.peakRetainedRawTimelines
          : 0,
      analysis: null,
    };
  }

  // rawStatus is 'COMPLETE' or 'PARTIAL'
  if (serverRequestedIds.length === 0) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
  }

  if (serverCoveredIds.length === 0) {
    if (rawStatus === 'COMPLETE' || (raw.analysis !== null && raw.analysis !== undefined)) {
      return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
    }
    const stopReason =
      rawStopReason ?? serverMissingItems[0]?.reason ?? 'TIMELINE_UNAVAILABLE';
    return {
      status: 'BLOCKED',
      region: returnedRegion,
      puuid: returnedPuuid,
      analyzerVersion,
      requestedMatchIds: honestRequestedIds,
      coveredMatchIds: [],
      missingMatches: buildHonestMissing(stopReason),
      stopReason,
      cacheHit: Boolean(raw.cacheHit),
      peakRetainedRawTimelines:
        typeof raw.peakRetainedRawTimelines === 'number' && Number.isFinite(raw.peakRetainedRawTimelines)
          ? raw.peakRetainedRawTimelines
          : 0,
      analysis: null,
    };
  }

  if (!raw.analysis || typeof raw.analysis !== 'object') {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
  }

  const normalizedAnalysis = normalizeTimelineAnalysisDto(raw.analysis);
  const gamesAnalyzed = normalizedAnalysis?.aggregateSummary?.gamesAnalyzed;
  if (
    typeof gamesAnalyzed !== 'number' ||
    !Number.isInteger(gamesAnalyzed) ||
    gamesAnalyzed !== serverCoveredIds.length ||
    !arePerMatchSubArraysConsistent(normalizedAnalysis, coveredSet)
  ) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
  }

  // Server claiming COMPLETE while its own coveredMatchIds < serverRequestedIds or serverMissingItems > 0 is contradictory
  if (
    rawStatus === 'COMPLETE' &&
    (serverCoveredIds.length !== serverRequestedIds.length || serverMissingItems.length > 0)
  ) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
  }

  const honestMissingMatches = buildHonestMissing(
    rawStopReason ?? serverMissingItems[0]?.reason ?? 'PARTIAL_TIMELINE_COVERAGE'
  );

  // Server claiming PARTIAL when 100% of honestRequestedIds are covered and 0 are missing is contradictory
  if (
    rawStatus === 'PARTIAL' &&
    serverCoveredIds.length === honestRequestedIds.length &&
    honestMissingMatches.length === 0
  ) {
    return buildBlockedFailClosed('INCONSISTENT_COVERAGE', honestRequestedIds);
  }

  const isFullyCovered =
    rawStatus === 'COMPLETE' &&
    serverCoveredIds.length === honestRequestedIds.length &&
    honestMissingMatches.length === 0;

  const finalStatus: CoachTimelinePreparationStatus = isFullyCovered ? 'COMPLETE' : 'PARTIAL';
  const finalStopReason =
    finalStatus === 'COMPLETE'
      ? null
      : rawStopReason ??
        (honestRequestedIds.length > serverRequestedIds.length && serverMissingItems.length === 0
          ? 'PARTIAL_PROFILE_MATCH_COVERAGE'
          : honestMissingMatches[0]?.reason ?? 'PARTIAL_TIMELINE_COVERAGE');

  return {
    status: finalStatus,
    region: returnedRegion,
    puuid: returnedPuuid,
    analyzerVersion,
    requestedMatchIds: honestRequestedIds,
    coveredMatchIds: serverCoveredIds,
    missingMatches: honestMissingMatches,
    stopReason: finalStopReason,
    cacheHit: Boolean(raw.cacheHit),
    peakRetainedRawTimelines:
      typeof raw.peakRetainedRawTimelines === 'number' && Number.isFinite(raw.peakRetainedRawTimelines)
        ? raw.peakRetainedRawTimelines
        : 0,
    analysis: normalizedAnalysis,
  };
}


// Raw timeline types (for the Details tab single-match view)
export interface TimelinePositionDto {
  x: number;
  y: number;
}

export interface ParticipantFrameDto {
  participantId: number;
  totalGold: number;
  level: number;
  xp: number;
  currentGold: number;
  minionsKilled: number;
  jungleMinionsKilled?: number | null;
  position: TimelinePositionDto;
}

export interface TimelineEventDto {
  type: string;
  timestamp: number;
  participantId?: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  itemId?: number;
  afterId?: number;
  skillSlot?: number;
  level?: number;
  wardType?: string;
  buildingType?: string;
  laneType?: string;
  towerType?: string;
  monsterType?: string;
  monsterSubType?: string;
  teamId?: number;
  killerTeamId?: number;
  creatorId?: number;
  position?: TimelinePositionDto;
  bounty?: number | null;
  shutdownBounty?: number | null;
  goldGain?: number | null;
}

export interface TimelineFrameDto {
  timestamp: number;
  participantFrames: Record<string, ParticipantFrameDto>;
  events: TimelineEventDto[];
}

export interface MatchTimelineDto {
  metadata?: {
    matchId: string;
    participants: string[];
  };
  info?: {
    frameInterval: number;
    frames: TimelineFrameDto[];
    participants: Array<{ participantId: number; puuid: string; championName?: string }>;
  };
}
