import type { MatchDto, ParticipantDto } from '../../types/match';
import type { MatchTimelineDto, TimelineFrameDto } from '../../types/timeline';
import {
  PRO_CHECKPOINT_MINUTES,
  type ProCheckpointMinute,
  type ProRoleKey,
  type ProSliceComputationResult,
  type RawProBenchmarkDataset,
} from './proBenchmarkTypes';
import {
  DEFAULT_PRO_BENCHMARK_DATASET,
  computeProComparisonSlice,
  formatRoleDisplay,
} from './proBenchmarkEngine';

/**
 * Maximum +/- tolerance in milliseconds around a target minute checkpoint (`M * 60_000`).
 * Matches Backend `TimelineAnalysisService.findCheckpointFrame` (`abs(timestamp - targetMs) <= 30_000L`).
 */
export const CHECKPOINT_TOLERANCE_MS = 30_000;

/**
 * Maximum number of single-match timeline fetches allowed in a single user-triggered batch
 * for a selected champion+role slice, preventing large API fanout.
 */
export const MAX_BOUNDED_TIMELINE_FETCHES = 5;

export type PlayerCheckpointStatus =
  | 'available'
  | 'game_ended_before_checkpoint'
  | 'timeline_not_loaded'
  | 'missing_frame'
  | 'missing_counter';

export interface PlayerMatchCheckpointValue {
  minute: ProCheckpointMinute;
  label: `${ProCheckpointMinute}m`;
  status: PlayerCheckpointStatus;
  totalCs: number | null;
  laneCs: number | null;
  jungleCs: number | null;
  csPerMin: number | null;
  frameTimestampMs: number | null;
}

export type MatchTimelineResolutionStatus =
  | 'loaded'
  | 'not_loaded'
  | 'mismatched_match_id'
  | 'participant_not_found'
  | 'empty_frames';

export interface SearchedPlayerMatchSummary {
  matchId: string;
  puuid: string;
  participantId: number | null;
  championId: string;
  rawChampionName: string;
  role: ProRoleKey;
  roleDisplay: string;
  win: boolean;
  gameDurationSeconds: number;
  gameDurationFormatted: string;
  patch: string;
  queueId: number | null;
  queueLabel: string;
  endTotalCsFromMatchDto: number | null;
  timelineStatus: MatchTimelineResolutionStatus;
  checkpoints: Record<ProCheckpointMinute, PlayerMatchCheckpointValue>;
}

export interface SearchedPlayerPairOption {
  pairKey: string;
  championId: string;
  role: ProRoleKey;
  roleDisplay: string;
  playerGameCount: number;
  loadedTimelineCount: number;
  patches: string[];
  queueLabels: string[];
  proReferenceAvailable: boolean;
  proSampleGameCount: number;
  proPlayers: string[];
  matches: SearchedPlayerMatchSummary[];
}

export interface PairedCheckpointComparison {
  minute: ProCheckpointMinute;
  label: `${ProCheckpointMinute}m`;
  // Searched player metrics
  playerStatus:
    | 'available'
    | 'all_ended_before_checkpoint'
    | 'timeline_not_loaded'
    | 'missing_frame_or_counter';
  playerMeanTotalCs: number | null;
  playerMeanLaneCs: number | null;
  playerMeanJungleCs: number | null;
  playerMeanCsPerMin: number | null;
  playerMinTotalCs: number | null;
  playerMaxTotalCs: number | null;
  playerGamesReached: number;
  playerGamesWithTimeline: number;
  playerTotalGames: number;
  playerShortGamesExcluded: number;
  playerMissingCounterExcluded: number;
  // Pro reference metrics (same champion + role only)
  proReferenceAvailable: boolean;
  proStatus: 'available' | 'not_in_sample_export' | 'all_games_ended_prior' | 'unsupported_pair';
  proMeanTotalCs: number | null;
  proMeanCsPerMin: number | null;
  proMinTotalCs: number | null;
  proMaxTotalCs: number | null;
  proGamesReached: number;
  proTotalGames: number;
  proGamesReachingDuration: number;
  // Delta (Player minus Pro reference, only when both are available)
  deltaTotalCs: number | null;
}

export interface SearchedPlayerProComparisonView {
  identity: {
    puuid: string;
    region: string;
    gameName: string;
    tagLine: string;
  };
  pairOptions: SearchedPlayerPairOption[];
  selectedPair: SearchedPlayerPairOption | null;
  selectedMatchId: 'ALL' | string;
  activeMatches: SearchedPlayerMatchSummary[];
  proSlice: ProSliceComputationResult | null;
  checkpoints: PairedCheckpointComparison[];
  unloadedMatchIdsForSelectedPair: string[];
  excludedNonPositionalMatches: number;
}

const round1 = (val: number): number => Math.round(val * 10) / 10;

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function extractPatchMajorMinor(gameVersion?: string | null): string {
  if (!gameVersion || typeof gameVersion !== 'string') return 'Unknown';
  const parts = gameVersion.trim().split('.');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}.${parts[1]}`;
  }
  return gameVersion.trim();
}

export function formatQueueLabel(queueId?: number | null, gameMode?: string | null): string {
  if (queueId === 420) return 'Ranked Solo';
  if (queueId === 440) return 'Ranked Flex';
  if (queueId === 400) return 'Normal Draft';
  if (queueId === 430) return 'Normal Blind';
  if (queueId === 490) return 'Quickplay';
  if (queueId === 700) return 'Clash';
  if (gameMode) return gameMode;
  return 'Matchmade';
}

/**
 * Normalizes Riot Match-v5 `teamPosition` / `individualPosition` strings to canonical `ProRoleKey`.
 * Returns `null` for non-positional or unknown roles (`NONE`, `INVALID`, ARAM, etc.).
 */
export function normalizeRiotRoleToProRole(rawPosition?: string | null): ProRoleKey | null {
  if (!rawPosition || typeof rawPosition !== 'string') return null;
  const upper = rawPosition.trim().toUpperCase();
  switch (upper) {
    case 'TOP':
      return 'top';
    case 'JUNGLE':
      return 'jungle';
    case 'MIDDLE':
    case 'MID':
      return 'mid';
    case 'BOTTOM':
    case 'BOT':
    case 'ADC':
      return 'bottom';
    case 'UTILITY':
    case 'SUPPORT':
    case 'SUP':
      return 'support';
    default:
      return null;
  }
}

const CHAMPION_ALIAS_MAP: Record<string, string> = {
  monkeyking: 'Wukong',
  wukong: 'Wukong',
  kaisa: 'Kaisa',
  ksante: 'KSante',
  jarvaniv: 'JarvanIV',
  xinzhao: 'XinZhao',
  leesin: 'LeeSin',
  reksai: 'RekSai',
  missfortune: 'MissFortune',
  twistedfate: 'TwistedFate',
  drmundo: 'DrMundo',
  tahmkench: 'TahmKench',
  masteryi: 'MasterYi',
  kogmaw: 'KogMaw',
  chogath: 'ChoGath',
  khazix: 'KhaZix',
  velkoz: 'VelKoz',
  belveth: 'BelVeth',
  aurelionsol: 'AurelionSol',
  nunu: 'Nunu',
  renata: 'Renata',
};

/**
 * Normalizes a Riot `championName` to match the canonical `championId` in the pro dataset
 * (case-insensitive match first, alias table second, trimmed original name third).
 */
export function normalizeChampionIdForProDataset(
  rawChampionName: string | null | undefined,
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET
): string {
  if (!rawChampionName || typeof rawChampionName !== 'string') return 'Unknown';
  const trimmed = rawChampionName.trim();
  if (!trimmed) return 'Unknown';

  const compactLower = trimmed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  for (const game of dataset.games ?? []) {
    for (const pidKey of Object.keys(game.participants ?? {})) {
      const p = game.participants[pidKey];
      if (p && p.championId.toLowerCase() === compactLower) {
        return p.championId;
      }
    }
  }

  if (CHAMPION_ALIAS_MAP[compactLower]) {
    return CHAMPION_ALIAS_MAP[compactLower];
  }

  return trimmed;
}

/**
 * Resolves the searched player's `ParticipantDto` inside `MatchDto` strictly by `puuid`.
 * Never falls back to array index.
 */
export function resolvePlayerMatchParticipant(
  matchDto: MatchDto,
  puuid: string
): ParticipantDto | null {
  if (!puuid || typeof puuid !== 'string') return null;
  const participants = matchDto.info?.participants;
  if (!Array.isArray(participants)) return null;
  return participants.find((p) => p.puuid === puuid) ?? null;
}

/**
 * Resolves the searched player's numeric `participantId` inside `MatchTimelineDto`
 * strictly by `puuid` (or validated `matchParticipant.participantId` when `timeline.info.participants` is absent).
 *
 * Never uses array-index position (`idx + 1`). Rejects timelines whose metadata or participant list
 * belongs to a different player set.
 */
export function resolveTimelineParticipantIdByPuuid(
  timeline: MatchTimelineDto,
  puuid: string,
  matchParticipant: ParticipantDto
): number | null {
  if (!puuid) return null;

  const metaParticipants = timeline.metadata?.participants;
  if (Array.isArray(metaParticipants) && metaParticipants.length > 0) {
    if (!metaParticipants.includes(puuid)) {
      return null;
    }
  }

  const timelineParticipants = timeline.info?.participants;
  if (Array.isArray(timelineParticipants) && timelineParticipants.length > 0) {
    const matched = timelineParticipants.find((tp) => tp.puuid === puuid);
    if (
      !matched ||
      typeof matched.participantId !== 'number' ||
      !Number.isFinite(matched.participantId)
    ) {
      return null;
    }
    return matched.participantId;
  }

  if (
    typeof matchParticipant.participantId === 'number' &&
    Number.isInteger(matchParticipant.participantId) &&
    matchParticipant.participantId >= 1 &&
    matchParticipant.participantId <= 10
  ) {
    return matchParticipant.participantId;
  }

  return null;
}

/**
 * Finds the timeline frame closest to `targetMinute * 60_000` within `±CHECKPOINT_TOLERANCE_MS` (30s).
 * Never uses frame array index (`frames[targetMinute]`) and never accepts frames after `gameDurationSeconds + 30`.
 */
export function findTimestampedCheckpointFrame(
  frames: TimelineFrameDto[],
  targetMinute: ProCheckpointMinute,
  gameDurationSeconds: number
): TimelineFrameDto | null {
  const targetMs = targetMinute * 60_000;
  const maxAllowedMs = (gameDurationSeconds + 30) * 1000;

  let bestFrame: TimelineFrameDto | null = null;
  let bestDiff = Infinity;

  for (const frame of frames) {
    const ts = frame?.timestamp;
    if (typeof ts !== 'number' || !Number.isFinite(ts) || ts < 0 || ts > maxAllowedMs) {
      continue;
    }
    const diff = Math.abs(ts - targetMs);
    if (diff <= CHECKPOINT_TOLERANCE_MS && diff < bestDiff) {
      bestFrame = frame;
      bestDiff = diff;
    }
  }

  return bestFrame;
}

const isStrictNonNegativeCounter = (val: unknown): val is number =>
  typeof val === 'number' && Number.isFinite(val) && val >= 0;

/**
 * Extracts `5m / 10m / 15m / 20m / 25m / 30m` CS checkpoints for a single match of the searched player
 * using raw `minionsKilled` and `jungleMinionsKilled` counters from `MatchTimelineDto`.
 *
 * Rules enforced:
 * - Never uses `powerSpikeTimelines` (which floors timestamps and defaults missing counters to 0).
 * - Games ending before `M * 60` seconds get `status: 'game_ended_before_checkpoint'` and `totalCs: null` (never 0).
 * - Frame must be within ±30s (`CHECKPOINT_TOLERANCE_MS`) of `M * 60_000` ms.
 * - Both `minionsKilled` and `jungleMinionsKilled` must be finite non-negative numbers; if either is
 *   `null` or `undefined`, returns `status: 'missing_counter'` and `totalCs: null` (never defaults to 0).
 */
export function extractPlayerMatchSummary(
  matchDto: MatchDto,
  puuid: string,
  timelinesByMatchId: Record<string, MatchTimelineDto | null | undefined>,
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET
): SearchedPlayerMatchSummary | null {
  const matchId = matchDto.metadata?.matchId?.trim();
  if (!matchId || !puuid) return null;

  const matchInfo = matchDto.info;
  const gameDurationSeconds = matchInfo?.gameDuration ?? 0;
  if (
    !matchInfo ||
    typeof gameDurationSeconds !== 'number' ||
    !Number.isFinite(gameDurationSeconds) ||
    gameDurationSeconds <= 0
  ) {
    return null;
  }

  const playerParticipant = resolvePlayerMatchParticipant(matchDto, puuid);
  if (!playerParticipant) return null;

  // Skip remakes / early surrenders under 5 minutes
  if (playerParticipant.gameEndedInEarlySurrender === true || gameDurationSeconds < 300) {
    return null;
  }

  const role = normalizeRiotRoleToProRole(
    playerParticipant.teamPosition || playerParticipant.individualPosition
  );
  if (!role) return null;

  const rawChampionName = playerParticipant.championName?.trim() || 'Unknown';
  const championId = normalizeChampionIdForProDataset(rawChampionName, dataset);

  const endLane = isStrictNonNegativeCounter(playerParticipant.totalMinionsKilled)
    ? playerParticipant.totalMinionsKilled
    : null;
  const endJungle = isStrictNonNegativeCounter(playerParticipant.neutralMinionsKilled)
    ? playerParticipant.neutralMinionsKilled
    : null;
  const endTotalCsFromMatchDto =
    endLane !== null && endJungle !== null ? endLane + endJungle : null;

  const rawTimeline = timelinesByMatchId[matchId];
  let timelineStatus: MatchTimelineResolutionStatus = 'not_loaded';
  let resolvedParticipantId: number | null = null;
  let validFrames: TimelineFrameDto[] | null = null;

  if (rawTimeline) {
    const timelineMatchId = rawTimeline.metadata?.matchId?.trim();
    if (timelineMatchId && timelineMatchId !== matchId) {
      timelineStatus = 'mismatched_match_id';
    } else {
      resolvedParticipantId = resolveTimelineParticipantIdByPuuid(
        rawTimeline,
        puuid,
        playerParticipant
      );
      if (resolvedParticipantId === null) {
        timelineStatus = 'participant_not_found';
      } else if (!Array.isArray(rawTimeline.info?.frames) || rawTimeline.info.frames.length === 0) {
        timelineStatus = 'empty_frames';
      } else {
        timelineStatus = 'loaded';
        validFrames = rawTimeline.info.frames;
      }
    }
  }

  const checkpoints = {} as Record<ProCheckpointMinute, PlayerMatchCheckpointValue>;

  for (const minute of PRO_CHECKPOINT_MINUTES) {
    const label = `${minute}m` as const;
    const checkpointSeconds = minute * 60;

    if (gameDurationSeconds < checkpointSeconds) {
      checkpoints[minute] = {
        minute,
        label,
        status: 'game_ended_before_checkpoint',
        totalCs: null,
        laneCs: null,
        jungleCs: null,
        csPerMin: null,
        frameTimestampMs: null,
      };
      continue;
    }

    if (timelineStatus !== 'loaded' || !validFrames || resolvedParticipantId === null) {
      checkpoints[minute] = {
        minute,
        label,
        status: 'timeline_not_loaded',
        totalCs: null,
        laneCs: null,
        jungleCs: null,
        csPerMin: null,
        frameTimestampMs: null,
      };
      continue;
    }

    const frame = findTimestampedCheckpointFrame(validFrames, minute, gameDurationSeconds);
    if (!frame) {
      checkpoints[minute] = {
        minute,
        label,
        status: 'missing_frame',
        totalCs: null,
        laneCs: null,
        jungleCs: null,
        csPerMin: null,
        frameTimestampMs: null,
      };
      continue;
    }

    const pf = frame.participantFrames?.[String(resolvedParticipantId)];
    const laneCs = pf?.minionsKilled;
    const jungleCs = pf?.jungleMinionsKilled;

    if (!isStrictNonNegativeCounter(laneCs) || !isStrictNonNegativeCounter(jungleCs)) {
      checkpoints[minute] = {
        minute,
        label,
        status: 'missing_counter',
        totalCs: null,
        laneCs: null,
        jungleCs: null,
        csPerMin: null,
        frameTimestampMs: frame.timestamp ?? null,
      };
      continue;
    }

    const totalCs = laneCs + jungleCs;
    checkpoints[minute] = {
      minute,
      label,
      status: 'available',
      totalCs,
      laneCs,
      jungleCs,
      csPerMin: round1(totalCs / minute),
      frameTimestampMs: frame.timestamp,
    };
  }

  return {
    matchId,
    puuid,
    participantId: resolvedParticipantId,
    championId,
    rawChampionName,
    role,
    roleDisplay: formatRoleDisplay(role),
    win: Boolean(playerParticipant.win),
    gameDurationSeconds,
    gameDurationFormatted: formatDurationSeconds(gameDurationSeconds),
    patch: extractPatchMajorMinor(matchInfo.gameVersion),
    queueId: typeof matchInfo.queueId === 'number' ? matchInfo.queueId : null,
    queueLabel: formatQueueLabel(matchInfo.queueId, matchInfo.gameMode),
    endTotalCsFromMatchDto,
    timelineStatus,
    checkpoints,
  };
}

/**
 * Builds the complete searched-player vs pro-reference comparison view bound to the searched player's
 * `{ puuid, region, gameName, tagLine }`.
 */
export function buildSearchedPlayerProComparison(params: {
  identity: {
    puuid: string;
    region: string;
    gameName: string;
    tagLine: string;
  };
  visibleMatches: MatchDto[];
  timelinesByMatchId: Record<string, MatchTimelineDto | null | undefined>;
  dataset?: RawProBenchmarkDataset;
  selectedPairKey?: string | null;
  selectedMatchId?: 'ALL' | string;
}): SearchedPlayerProComparisonView {
  const {
    identity,
    visibleMatches,
    timelinesByMatchId,
    dataset = DEFAULT_PRO_BENCHMARK_DATASET,
    selectedPairKey,
    selectedMatchId = 'ALL',
  } = params;

  const parsedMatches: SearchedPlayerMatchSummary[] = [];
  let excludedNonPositionalMatches = 0;
  const seenMatchIds = new Set<string>();

  for (const matchDto of visibleMatches || []) {
    const mid = matchDto?.metadata?.matchId?.trim();
    if (!mid || seenMatchIds.has(mid)) continue;
    seenMatchIds.add(mid);

    const summary = extractPlayerMatchSummary(
      matchDto,
      identity.puuid,
      timelinesByMatchId,
      dataset
    );
    if (summary) {
      parsedMatches.push(summary);
    } else {
      excludedNonPositionalMatches++;
    }
  }

  // Group by (role, championId)
  const pairMap = new Map<string, SearchedPlayerMatchSummary[]>();
  for (const m of parsedMatches) {
    const key = `${m.role}::${m.championId}`;
    const list = pairMap.get(key) ?? [];
    list.push(m);
    pairMap.set(key, list);
  }

  const pairOptions: SearchedPlayerPairOption[] = Array.from(pairMap.entries())
    .map(([pairKey, matches]) => {
      const { championId, role, roleDisplay } = matches[0];
      const proSlice = computeProComparisonSlice(dataset, {
        role,
        championId,
      });
      const proReferenceAvailable =
        proSlice.isSupportedSelection && proSlice.matchingObservationCount > 0;
      const loadedTimelineCount = matches.filter((m) => m.timelineStatus === 'loaded').length;
      const patches = Array.from(
        new Set(matches.map((m) => m.patch).filter((p) => p !== 'Unknown'))
      );
      const queueLabels = Array.from(new Set(matches.map((m) => m.queueLabel)));

      return {
        pairKey,
        championId,
        role,
        roleDisplay,
        playerGameCount: matches.length,
        loadedTimelineCount,
        patches,
        queueLabels,
        proReferenceAvailable,
        proSampleGameCount: proReferenceAvailable ? proSlice.matchingObservationCount : 0,
        proPlayers: proReferenceAvailable ? proSlice.playersInSlice : [],
        matches,
      };
    })
    .sort((a, b) => {
      if (b.playerGameCount !== a.playerGameCount) {
        return b.playerGameCount - a.playerGameCount;
      }
      if (a.proReferenceAvailable !== b.proReferenceAvailable) {
        return a.proReferenceAvailable ? -1 : 1;
      }
      return a.championId.localeCompare(b.championId);
    });

  const selectedPair =
    (selectedPairKey ? pairOptions.find((p) => p.pairKey === selectedPairKey) : null) ??
    pairOptions[0] ??
    null;

  if (!selectedPair) {
    return {
      identity,
      pairOptions: [],
      selectedPair: null,
      selectedMatchId: 'ALL',
      activeMatches: [],
      proSlice: null,
      checkpoints: [],
      unloadedMatchIdsForSelectedPair: [],
      excludedNonPositionalMatches,
    };
  }

  const resolvedMatchId =
    selectedMatchId !== 'ALL' && selectedPair.matches.some((m) => m.matchId === selectedMatchId)
      ? selectedMatchId
      : 'ALL';

  const activeMatches =
    resolvedMatchId === 'ALL'
      ? selectedPair.matches
      : selectedPair.matches.filter((m) => m.matchId === resolvedMatchId);

  const proSlice = computeProComparisonSlice(dataset, {
    role: selectedPair.role,
    championId: selectedPair.championId,
  });
  const proReferenceAvailable =
    proSlice.isSupportedSelection && proSlice.matchingObservationCount > 0;

  const checkpoints: PairedCheckpointComparison[] = PRO_CHECKPOINT_MINUTES.map((minute) => {
    const label = `${minute}m` as const;
    const proCp = proSlice.checkpoints[minute];

    const totalGames = activeMatches.length;
    const gamesWithTimeline = activeMatches.filter((m) => m.timelineStatus === 'loaded').length;
    let shortGamesExcluded = 0;
    let missingCounterExcluded = 0;

    const availableValues: PlayerMatchCheckpointValue[] = [];
    for (const m of activeMatches) {
      const cp = m.checkpoints[minute];
      if (cp.status === 'game_ended_before_checkpoint') {
        shortGamesExcluded++;
      } else if (cp.status === 'available' && cp.totalCs !== null) {
        availableValues.push(cp);
      } else if (cp.status === 'missing_counter' || cp.status === 'missing_frame') {
        missingCounterExcluded++;
      }
    }

    let playerStatus: PairedCheckpointComparison['playerStatus'];
    let playerMeanTotalCs: number | null = null;
    let playerMeanLaneCs: number | null = null;
    let playerMeanJungleCs: number | null = null;
    let playerMeanCsPerMin: number | null = null;
    let playerMinTotalCs: number | null = null;
    let playerMaxTotalCs: number | null = null;

    if (availableValues.length > 0) {
      playerStatus = 'available';
      const totals = availableValues.map((v) => v.totalCs!);
      const lanes = availableValues.map((v) => v.laneCs!);
      const jungles = availableValues.map((v) => v.jungleCs!);
      const meanTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
      const meanLane = lanes.reduce((a, b) => a + b, 0) / lanes.length;
      const meanJungle = jungles.reduce((a, b) => a + b, 0) / jungles.length;

      playerMeanTotalCs = round1(meanTotal);
      playerMeanLaneCs = round1(meanLane);
      playerMeanJungleCs = round1(meanJungle);
      playerMeanCsPerMin = round1(meanTotal / minute);
      playerMinTotalCs = Math.min(...totals);
      playerMaxTotalCs = Math.max(...totals);
    } else if (totalGames > 0 && shortGamesExcluded === totalGames) {
      playerStatus = 'all_ended_before_checkpoint';
    } else if (gamesWithTimeline === 0) {
      playerStatus = 'timeline_not_loaded';
    } else {
      playerStatus = 'missing_frame_or_counter';
    }

    const proStatus: PairedCheckpointComparison['proStatus'] = proReferenceAvailable
      ? proCp.status === 'AVAILABLE'
        ? 'available'
        : proCp.unavailableReason === 'SNAPSHOT_NOT_EXPORTED_AT_MARK'
        ? 'not_in_sample_export'
        : 'all_games_ended_prior'
      : 'unsupported_pair';

    const proMeanTotalCs =
      proReferenceAvailable && proCp.status === 'AVAILABLE' ? proCp.meanTotalCs : null;
    const proMeanCsPerMin =
      proReferenceAvailable && proCp.status === 'AVAILABLE' ? proCp.meanTotalCsPerMin : null;
    const proMinTotalCs =
      proReferenceAvailable && proCp.status === 'AVAILABLE' ? proCp.minTotalCs : null;
    const proMaxTotalCs =
      proReferenceAvailable && proCp.status === 'AVAILABLE' ? proCp.maxTotalCs : null;

    const deltaTotalCs =
      playerMeanTotalCs !== null && proMeanTotalCs !== null
        ? round1(playerMeanTotalCs - proMeanTotalCs)
        : null;

    return {
      minute,
      label,
      playerStatus,
      playerMeanTotalCs,
      playerMeanLaneCs,
      playerMeanJungleCs,
      playerMeanCsPerMin,
      playerMinTotalCs,
      playerMaxTotalCs,
      playerGamesReached: availableValues.length,
      playerGamesWithTimeline: gamesWithTimeline,
      playerTotalGames: totalGames,
      playerShortGamesExcluded: shortGamesExcluded,
      playerMissingCounterExcluded: missingCounterExcluded,
      proReferenceAvailable,
      proStatus,
      proMeanTotalCs,
      proMeanCsPerMin,
      proMinTotalCs,
      proMaxTotalCs,
      proGamesReached: proReferenceAvailable ? proCp.availableSnapshotCount : 0,
      proTotalGames: proReferenceAvailable ? proCp.totalSliceGames : 0,
      proGamesReachingDuration: proReferenceAvailable ? proCp.gamesReachedDurationCount : 0,
      deltaTotalCs,
    };
  });

  const unloadedMatchIdsForSelectedPair = selectedPair.matches
    .filter((m) => m.timelineStatus === 'not_loaded')
    .map((m) => m.matchId)
    .slice(0, MAX_BOUNDED_TIMELINE_FETCHES);

  return {
    identity,
    pairOptions,
    selectedPair,
    selectedMatchId: resolvedMatchId,
    activeMatches,
    proSlice: proReferenceAvailable ? proSlice : null,
    checkpoints,
    unloadedMatchIdsForSelectedPair,
    excludedNonPositionalMatches,
  };
}

// Module-level bounded timeline cache keyed by `${region.toLowerCase()}::${matchId}`
// so re-opening the tab reuses already-fetched MatchTimelineDto payloads without re-requesting.
export const sharedTimelineCache = new Map<string, MatchTimelineDto>();

export function clearSharedProTimelineCacheForTests(): void {
  sharedTimelineCache.clear();
}

