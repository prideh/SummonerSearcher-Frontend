import type { MatchDto, ParticipantDto } from "../../types/match";
import type { MatchTimelineDto, TimelineFrameDto } from "../../types/timeline";
import {
  PRO_CHECKPOINT_MINUTES,
  type ExplicitUnavailableMetricDescriptor,
  type ProCheckpointMinute,
  type ProRoleFilter,
  type ProRoleKey,
  type ProSliceComputationResult,
  type RawProBenchmarkDataset,
  type RequestedUnavailableMetricKey,
  type SelectableProPlayerOption,
} from "./proBenchmarkTypes";
import {
  DEFAULT_PRO_BENCHMARK_DATASET,
  PRO_ROLE_ORDER,
  computeProComparisonSlice,
  formatRoleDisplay,
  getUnavailableRequestedMetrics,
  listSelectableProPlayers,
  resolveSelectableProPlayer,
  roundToDecimals,
} from "./proBenchmarkEngine";

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

/**
 * Product requirement: comparison uses the searched player's most recent 20 matches ONLY.
 * Any matches beyond the 20 most recent deduplicated matches are excluded before role
 * detection, champion+role grouping, and checkpoint/whole-game aggregation.
 */
export const MAX_RECENT_PLAYER_MATCHES = 20;

export type PlayerCheckpointStatus =
  | "available"
  | "game_ended_before_checkpoint"
  | "timeline_not_loaded"
  | "missing_frame"
  | "missing_counter";

export type PlayerRoleOpponentCheckpointStatus =
  | "available"
  | "game_ended_before_checkpoint"
  | "timeline_not_loaded"
  | "missing_frame"
  | "opponent_not_resolved"
  | "missing_counter";

export type PlayerEarlyDeathsCheckpointStatus =
  | "available"
  | "game_ended_before_checkpoint"
  | "timeline_not_loaded"
  | "missing_frame"
  | "missing_events_array"
  | "malformed_kill_event";

export type PlayerTeamShareMetricStatus =
  | "available"
  | "incomplete_team_participants"
  | "missing_counter"
  | "zero_team_denominator";

export type PlayerWardRateMetricStatus = "available" | "missing_counter";

export interface PlayerWholeGameMetrics {
  killParticipationStatus: PlayerTeamShareMetricStatus;
  killParticipation: number | null; // 0..1 ratio
  championDamageShareStatus: PlayerTeamShareMetricStatus;
  championDamageShare: number | null; // 0..1 ratio
  wardsPlacedPerMinStatus: PlayerWardRateMetricStatus;
  wardsPlaced: number | null;
  wardsPlacedPerMin: number | null;
  wardsDestroyedPerMinStatus: PlayerWardRateMetricStatus;
  wardsDestroyed: number | null;
  wardsDestroyedPerMin: number | null;
}

export type PlayerTimelineAssistAttributionStatus =
  | "available"
  | "timeline_not_loaded"
  | "missing_events_array"
  | "malformed_kill_event"
  | "incomplete_missing_assist_array";

/**
 * Per-match death attribution and Match-History display audit.
 *
 * Strict semantic & nullability rules:
 * - `soloDeaths` is strictly `null` (`UNAVAILABLE`): Riot `ChallengesDto` has no `soloDeaths` field,
 *   and `CHAMPION_KILL` events with `assistingParticipantIds: []` only indicate 0 recorded assists
 *   within Riot's assist timer — NOT a proven 1v1 solo death.
 * - Missing `assistingParticipantIds` (`null` or `undefined`) is NEVER coerced to `[]` or `0`
 *   (unlike `MatchDetailsTab.tsx` line 138 `(event.assistingParticipantIds || [])` and backend
 *   `TimelineAnalysisService.kt` line 139 `event.assistingParticipantIds ?: emptyList()`).
 *   If any player death in a match has a missing `assistingParticipantIds` array,
 *   `timelineAssistStatus` is `"incomplete_missing_assist_array"` and `zeroAssistDeathsNotProvenSolo`
 *   is `null` (`unknown`).
 * - `opponentOwnSoloKillsChallengeNotPlayerSoloDeaths` captures the lane opponent's own
 *   `challenges.soloKills` (which `PlayerStats.tsx` line 269 and `RecentChampionStats.tsx` line 134
 *   display on the opponent column, but which counts the opponent's whole-game solo kills against
 *   ANY member of the player's 5-man team and excludes solo deaths to other enemies).
 */
export interface PlayerMatchDeathAttribution {
  timelineAssistStatus: PlayerTimelineAssistAttributionStatus;
  totalDeathsFromMatchDto: number | null;
  totalTimelineDeaths: number | null;
  knownAssistedDeaths: number | null;
  zeroAssistDeathsNotProvenSolo: number | null;
  zeroAssistDeathShareNotProvenSolo: number | null;
  unknownAssistDeathsCount: number | null;
  opponentOwnSoloKillsChallengeNotPlayerSoloDeaths: number | null;
  soloDeaths: null;
}

export interface PlayerMatchCheckpointValue {
  minute: ProCheckpointMinute;
  label: `${ProCheckpointMinute}m`;
  // Total CS (lane + jungle)
  status: PlayerCheckpointStatus;
  totalCs: number | null;
  laneCs: number | null;
  jungleCs: number | null;
  csPerMin: number | null;
  // Total Gold
  goldStatus: PlayerCheckpointStatus;
  totalGold: number | null;
  // Champion Level
  levelStatus: PlayerCheckpointStatus;
  level: number | null;
  // Role-Opponent CS Diff (CSD) & Gold Diff (GD)
  csDiffStatus: PlayerRoleOpponentCheckpointStatus;
  opponentTotalCs: number | null;
  csDiffVsRoleOpponent: number | null;
  goldDiffStatus: PlayerRoleOpponentCheckpointStatus;
  opponentTotalGold: number | null;
  goldDiffVsRoleOpponent: number | null;
  // Early Total Deaths (strictly from timeline CHAMPION_KILL victimId, never TimelineAnalysisService)
  earlyDeathsStatus: PlayerEarlyDeathsCheckpointStatus;
  earlyTotalDeaths: number | null;
  frameTimestampMs: number | null;
}

export type MatchTimelineResolutionStatus =
  | "loaded"
  | "not_loaded"
  | "mismatched_match_id"
  | "participant_not_found"
  | "empty_frames";

export interface SearchedPlayerMatchSummary {
  matchId: string;
  puuid: string;
  participantId: number | null;
  roleOpponentPuuid: string | null;
  roleOpponentParticipantId: number | null;
  roleOpponentChampionId: string | null;
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
  wholeGame: PlayerWholeGameMetrics;
  deathAttribution: PlayerMatchDeathAttribution;
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
  selectableProPlayers: SelectableProPlayerOption[];
  matches: SearchedPlayerMatchSummary[];
}

export interface RecentPlayerMatchWindowSummary {
  maxRecentMatches: typeof MAX_RECENT_PLAYER_MATCHES;
  inputMatchCount: number;
  analyzedRecentMatchCount: number;
  excludedBeyondRecent20Count: number;
  positionalMatchCountInRecent20: number;
  excludedNonPositionalMatchesInRecent20: number;
}

export interface PlayerRoleSummaryOption {
  role: ProRoleKey;
  roleDisplay: string;
  playerRecent20Games: number;
  playerLoadedTimelineGames: number;
  playerChampions: string[];
  proDatasetGames: number;
  selectableProPlayers: SelectableProPlayerOption[];
}

export interface PlayerRoleSelectionSummary {
  detectedPrimaryRole: ProRoleKey | null;
  selectedRole: ProRoleFilter;
  isRolePreselectedByDefault: boolean;
  playerGamesInSelectedRole: number;
  availableRoles: PlayerRoleSummaryOption[];
}

export interface ProPlayerSelectionSummary {
  selectedProPlayerId: "ALL" | string;
  resolvedProPlayer: SelectableProPlayerOption | null;
  isProPlayerFoundInDataset: boolean;
  matchingProGamesAfterFilters: number;
  proReferenceAvailableAfterFilters: boolean;
  unavailableReason: string | null;
  selectableProPlayersForPair: SelectableProPlayerOption[];
  selectableProPlayersForRole: SelectableProPlayerOption[];
  allSelectableProPlayersInDataset: SelectableProPlayerOption[];
}

export interface PlayerSliceDeathAttributionSummary {
  soloDeathsStatus: "UNAVAILABLE_NOT_PROVEN_1V1_AND_NO_PRO_DATA";
  soloDeathsPerGame: null;
  proSoloDeathsPerGame: null;
  deltaSoloDeathsPerGame: null;
  matchHistoryDisplayAudit: {
    playerStatsCardLine166And269: string;
    recentChampionStatsLine130: string;
    matchDetailsTabLine138: string;
    backendTimelineAnalysisServiceLine139: string;
  };
  zeroAssistDeathsNotProvenSolo: {
    status:
      | "available"
      | "no_active_matches"
      | "timeline_not_loaded"
      | "incomplete_or_missing_assist_data";
    totalActiveMatches: number;
    eligibleCompleteTimelineGames: number;
    excludedUnloadedTimelineGames: number;
    excludedIncompleteAssistGames: number;
    totalTimelineDeathsInCompleteGames: number | null;
    knownZeroAssistDeathsInCompleteGames: number | null;
    knownAssistedDeathsInCompleteGames: number | null;
    zeroAssistDeathsPerGameNotProvenSolo: number | null;
    zeroAssistDeathShareNotProvenSolo: number | null;
    proReference: null;
    deltaVsPro: null;
    semanticCaveat: string;
  };
}

export interface PairedCheckpointComparison {
  minute: ProCheckpointMinute;
  label: `${ProCheckpointMinute}m`;
  // Searched player CS metrics
  playerStatus:
    | "available"
    | "all_ended_before_checkpoint"
    | "timeline_not_loaded"
    | "missing_frame_or_counter";
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
  // Pro reference CS metrics (same champion + role only)
  proReferenceAvailable: boolean;
  proStatus:
    | "available"
    | "not_in_sample_export"
    | "all_games_ended_prior"
    | "unsupported_pair";
  proMeanTotalCs: number | null;
  proMeanCsPerMin: number | null;
  proMinTotalCs: number | null;
  proMaxTotalCs: number | null;
  proGamesReached: number;
  proTotalGames: number;
  proGamesReachingDuration: number;
  // CS Delta (Player minus Pro reference, only when both are available)
  deltaTotalCs: number | null;

  // Total Gold @ Checkpoint
  playerGoldGamesReached: number;
  playerMeanTotalGold: number | null;
  playerMinTotalGold: number | null;
  playerMaxTotalGold: number | null;
  proGoldGamesReached: number;
  proMeanTotalGold: number | null;
  proMinTotalGold: number | null;
  proMaxTotalGold: number | null;
  deltaTotalGold: number | null;

  // Champion Level @ Checkpoint
  playerLevelGamesReached: number;
  playerMeanLevel: number | null;
  playerMinLevel: number | null;
  playerMaxLevel: number | null;
  proLevelGamesReached: number;
  proMeanLevel: number | null;
  proMinLevel: number | null;
  proMaxLevel: number | null;
  deltaLevel: number | null;

  // Champion-Role CS Diff vs Role Opponent (CSD@m)
  playerCsDiffGamesReached: number;
  playerMeanCsDiffVsRoleOpponent: number | null;
  playerMinCsDiffVsRoleOpponent: number | null;
  playerMaxCsDiffVsRoleOpponent: number | null;
  proCsDiffGamesReached: number;
  proMeanCsDiffVsRoleOpponent: number | null;
  proMinCsDiffVsRoleOpponent: number | null;
  proMaxCsDiffVsRoleOpponent: number | null;
  deltaCsDiffVsRoleOpponent: number | null;

  // Champion-Role Gold Diff vs Role Opponent (GD@m)
  playerGoldDiffGamesReached: number;
  playerMeanGoldDiffVsRoleOpponent: number | null;
  playerMinGoldDiffVsRoleOpponent: number | null;
  playerMaxGoldDiffVsRoleOpponent: number | null;
  proGoldDiffGamesReached: number;
  proMeanGoldDiffVsRoleOpponent: number | null;
  proMinGoldDiffVsRoleOpponent: number | null;
  proMaxGoldDiffVsRoleOpponent: number | null;
  deltaGoldDiffVsRoleOpponent: number | null;

  // Early Total Deaths @ Checkpoint (Pro paused games excluded)
  playerEarlyDeathsGamesReached: number;
  playerMeanEarlyTotalDeaths: number | null;
  playerMinEarlyTotalDeaths: number | null;
  playerMaxEarlyTotalDeaths: number | null;
  proEarlyTotalDeathsStatus:
    | "available"
    | "not_in_sample_export"
    | "all_games_ended_prior"
    | "all_reached_games_paused"
    | "unsupported_pair";
  proEarlyTotalDeathsPausedGamesExcluded: number;
  proEarlyDeathsGamesReached: number;
  proMeanEarlyTotalDeaths: number | null;
  proMinEarlyTotalDeaths: number | null;
  proMaxEarlyTotalDeaths: number | null;
  deltaEarlyTotalDeaths: number | null;
}

export interface PairedWholeGameMetricComparison {
  metricKey:
    | "killParticipation"
    | "championDamageShare"
    | "wardsPlacedPerMin"
    | "wardsDestroyedPerMin";
  label: string;
  playerAvailableGames: number;
  playerTotalGames: number;
  playerMean: number | null;
  playerMin: number | null;
  playerMax: number | null;
  proAvailableGames: number;
  proTotalGames: number;
  proMean: number | null;
  proMin: number | null;
  proMax: number | null;
  deltaMean: number | null;
}

export interface PairedWholeGameComparison {
  killParticipation: PairedWholeGameMetricComparison;
  championDamageShare: PairedWholeGameMetricComparison;
  wardsPlacedPerMin: PairedWholeGameMetricComparison;
  wardsDestroyedPerMin: PairedWholeGameMetricComparison;
}

export interface SearchedPlayerProComparisonView {
  identity: {
    puuid: string;
    region: string;
    gameName: string;
    tagLine: string;
  };
  recentMatchWindow: RecentPlayerMatchWindowSummary;
  roleSelection: PlayerRoleSelectionSummary;
  proPlayerSelection: ProPlayerSelectionSummary;
  allPairOptionsInRecent20: SearchedPlayerPairOption[];
  pairOptions: SearchedPlayerPairOption[];
  selectedPair: SearchedPlayerPairOption | null;
  selectedMatchId: "ALL" | string;
  activeMatches: SearchedPlayerMatchSummary[];
  proSlice: ProSliceComputationResult | null;
  checkpoints: PairedCheckpointComparison[];
  wholeGameComparison: PairedWholeGameComparison;
  playerDeathAttribution: PlayerSliceDeathAttributionSummary;
  unavailableRequestedMetrics: Record<
    RequestedUnavailableMetricKey,
    ExplicitUnavailableMetricDescriptor
  >;
  unloadedMatchIdsForSelectedPair: string[];
  excludedNonPositionalMatches: number;
}

const round1 = (val: number): number => roundToDecimals(val, 1);

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function extractPatchMajorMinor(gameVersion?: string | null): string {
  if (!gameVersion || typeof gameVersion !== "string") return "Unknown";
  const parts = gameVersion.trim().split(".");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}.${parts[1]}`;
  }
  return gameVersion.trim();
}

export function formatQueueLabel(
  queueId?: number | null,
  gameMode?: string | null,
): string {
  if (queueId === 420) return "Ranked Solo";
  if (queueId === 440) return "Ranked Flex";
  if (queueId === 400) return "Normal Draft";
  if (queueId === 430) return "Normal Blind";
  if (queueId === 490) return "Quickplay";
  if (queueId === 700) return "Clash";
  if (gameMode) return gameMode;
  return "Matchmade";
}

/**
 * Normalizes Riot Match-v5 `teamPosition` / `individualPosition` strings to canonical `ProRoleKey`.
 * Returns `null` for non-positional or unknown roles (`NONE`, `INVALID`, ARAM, etc.).
 */
export function normalizeRiotRoleToProRole(
  rawPosition?: string | null,
): ProRoleKey | null {
  if (!rawPosition || typeof rawPosition !== "string") return null;
  const upper = rawPosition.trim().toUpperCase();
  switch (upper) {
    case "TOP":
      return "top";
    case "JUNGLE":
      return "jungle";
    case "MIDDLE":
    case "MID":
      return "mid";
    case "BOTTOM":
    case "BOT":
    case "ADC":
      return "bottom";
    case "UTILITY":
    case "SUPPORT":
    case "SUP":
      return "support";
    default:
      return null;
  }
}

const CHAMPION_ALIAS_MAP: Record<string, string> = {
  monkeyking: "Wukong",
  wukong: "Wukong",
  kaisa: "Kaisa",
  ksante: "KSante",
  jarvaniv: "JarvanIV",
  xinzhao: "XinZhao",
  leesin: "LeeSin",
  reksai: "RekSai",
  missfortune: "MissFortune",
  twistedfate: "TwistedFate",
  drmundo: "DrMundo",
  tahmkench: "TahmKench",
  masteryi: "MasterYi",
  kogmaw: "KogMaw",
  chogath: "ChoGath",
  khazix: "KhaZix",
  velkoz: "VelKoz",
  belveth: "BelVeth",
  aurelionsol: "AurelionSol",
  nunu: "Nunu",
  renata: "Renata",
};

/**
 * Normalizes a Riot `championName` to match the canonical `championId` in the pro dataset
 * (case-insensitive match first, alias table second, trimmed original name third).
 */
export function normalizeChampionIdForProDataset(
  rawChampionName: string | null | undefined,
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
): string {
  if (!rawChampionName || typeof rawChampionName !== "string") return "Unknown";
  const trimmed = rawChampionName.trim();
  if (!trimmed) return "Unknown";

  const compactLower = trimmed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

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
  puuid: string,
): ParticipantDto | null {
  if (!puuid || typeof puuid !== "string") return null;
  const participants = matchDto.info?.participants;
  if (!Array.isArray(participants)) return null;
  return participants.find((p) => p.puuid === puuid) ?? null;
}

/**
 * Resolves the unique opposing-team participant sharing the same normalized role in `MatchDto`.
 * Requires explicit numeric `teamId` on both player and candidate and requires exactly 1 match
 * on the enemy team so ambiguous or missing role assignments never guess an opponent.
 */
export function resolveUniqueRoleOpponentParticipant(
  matchDto: MatchDto,
  playerParticipant: ParticipantDto,
  playerRole: ProRoleKey,
): ParticipantDto | null {
  const playerTeamId = playerParticipant.teamId;
  if (typeof playerTeamId !== "number" || !Number.isFinite(playerTeamId)) {
    return null;
  }
  const participants = matchDto.info?.participants;
  if (!Array.isArray(participants)) return null;

  const candidates = participants.filter((p) => {
    if (!p || p.puuid === playerParticipant.puuid) return false;
    if (typeof p.teamId !== "number" || !Number.isFinite(p.teamId))
      return false;
    if (p.teamId === playerTeamId) return false;
    const oppRole = normalizeRiotRoleToProRole(
      p.teamPosition || p.individualPosition,
    );
    return oppRole === playerRole;
  });

  if (candidates.length !== 1) return null;
  return candidates[0];
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
  matchParticipant: ParticipantDto,
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
      typeof matched.participantId !== "number" ||
      !Number.isFinite(matched.participantId)
    ) {
      return null;
    }
    return matched.participantId;
  }

  if (
    typeof matchParticipant.participantId === "number" &&
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
  gameDurationSeconds: number,
): TimelineFrameDto | null {
  const targetMs = targetMinute * 60_000;
  const maxAllowedMs = (gameDurationSeconds + 30) * 1000;

  let bestFrame: TimelineFrameDto | null = null;
  let bestDiff = Infinity;

  for (const frame of frames) {
    const ts = frame?.timestamp;
    if (
      typeof ts !== "number" ||
      !Number.isFinite(ts) ||
      ts < 0 ||
      ts > maxAllowedMs
    ) {
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
  typeof val === "number" && Number.isFinite(val) && val >= 0;

const isStrictPositiveLevel = (val: unknown): val is number =>
  typeof val === "number" && Number.isFinite(val) && val >= 1;

/**
 * Extracts whole-game KP, Champion Damage Share, and Ward Rates from `MatchDto`.
 *
 * Strict completeness rules:
 * - Team-share metrics (`killParticipation`, `championDamageShare`) require all 5 teammates
 *   (`teammates.length === 5` sharing a finite `teamId`) with finite non-negative counters and
 *   a positive team denominator (`> 0`). Partial participant lists in synthetic fixtures
 *   never produce fake 100% shares.
 * - Ward rate metrics (`wardsPlacedPerMin`, `wardsDestroyedPerMin`) require finite non-negative
 *   `wardsPlaced` / `wardsKilled` on `playerParticipant` and `gameDurationSeconds >= 300`.
 */
export function extractPlayerWholeGameMetrics(
  matchDto: MatchDto,
  playerParticipant: ParticipantDto,
  gameDurationSeconds: number,
): PlayerWholeGameMetrics {
  const allParticipants = Array.isArray(matchDto.info?.participants)
    ? matchDto.info.participants
    : [];
  const playerTeamId = playerParticipant.teamId;
  const hasValidTeamId =
    typeof playerTeamId === "number" && Number.isFinite(playerTeamId);
  const teammates = hasValidTeamId
    ? allParticipants.filter((p) => p && p.teamId === playerTeamId)
    : [];
  const hasCompleteFivePlayerTeam = teammates.length === 5;

  let killParticipationStatus: PlayerTeamShareMetricStatus =
    "incomplete_team_participants";
  let killParticipation: number | null = null;

  if (hasCompleteFivePlayerTeam) {
    const playerKillsValid = isStrictNonNegativeCounter(
      playerParticipant.kills,
    );
    const playerAssistsValid = isStrictNonNegativeCounter(
      playerParticipant.assists,
    );
    const allTeamKillsValid = teammates.every((t) =>
      isStrictNonNegativeCounter(t.kills),
    );
    if (!playerKillsValid || !playerAssistsValid || !allTeamKillsValid) {
      killParticipationStatus = "missing_counter";
    } else {
      const teamTotalKills = teammates.reduce(
        (sum, t) => sum + (t.kills as number),
        0,
      );
      if (teamTotalKills <= 0) {
        killParticipationStatus = "zero_team_denominator";
      } else {
        killParticipationStatus = "available";
        killParticipation = roundToDecimals(
          ((playerParticipant.kills as number) +
            (playerParticipant.assists as number)) /
            teamTotalKills,
          4,
        );
      }
    }
  }

  let championDamageShareStatus: PlayerTeamShareMetricStatus =
    "incomplete_team_participants";
  let championDamageShare: number | null = null;

  if (hasCompleteFivePlayerTeam) {
    const playerDmgValid = isStrictNonNegativeCounter(
      playerParticipant.totalDamageDealtToChampions,
    );
    const allTeamDmgValid = teammates.every((t) =>
      isStrictNonNegativeCounter(t.totalDamageDealtToChampions),
    );
    if (!playerDmgValid || !allTeamDmgValid) {
      championDamageShareStatus = "missing_counter";
    } else {
      const teamTotalDamage = teammates.reduce(
        (sum, t) => sum + (t.totalDamageDealtToChampions as number),
        0,
      );
      if (teamTotalDamage <= 0) {
        championDamageShareStatus = "zero_team_denominator";
      } else {
        championDamageShareStatus = "available";
        championDamageShare = roundToDecimals(
          (playerParticipant.totalDamageDealtToChampions as number) /
            teamTotalDamage,
          4,
        );
      }
    }
  }

  const durationMinutes = gameDurationSeconds / 60;
  const wardsPlaced = isStrictNonNegativeCounter(playerParticipant.wardsPlaced)
    ? playerParticipant.wardsPlaced
    : null;
  const wardsPlacedPerMinStatus: PlayerWardRateMetricStatus =
    wardsPlaced !== null && durationMinutes > 0
      ? "available"
      : "missing_counter";
  const wardsPlacedPerMin =
    wardsPlacedPerMinStatus === "available" && wardsPlaced !== null
      ? roundToDecimals(wardsPlaced / durationMinutes, 2)
      : null;

  const wardsDestroyed = isStrictNonNegativeCounter(
    playerParticipant.wardsKilled,
  )
    ? playerParticipant.wardsKilled
    : null;
  const wardsDestroyedPerMinStatus: PlayerWardRateMetricStatus =
    wardsDestroyed !== null && durationMinutes > 0
      ? "available"
      : "missing_counter";
  const wardsDestroyedPerMin =
    wardsDestroyedPerMinStatus === "available" && wardsDestroyed !== null
      ? roundToDecimals(wardsDestroyed / durationMinutes, 2)
      : null;

  return {
    killParticipationStatus,
    killParticipation,
    championDamageShareStatus,
    championDamageShare,
    wardsPlacedPerMinStatus,
    wardsPlaced,
    wardsPlacedPerMin,
    wardsDestroyedPerMinStatus,
    wardsDestroyed,
    wardsDestroyedPerMin,
  };
}

/**
 * Counts cumulative total deaths (`CHAMPION_KILL` with `victimId === resolvedParticipantId`)
 * up to `targetMinute * 60_000` ms directly from `MatchTimelineDto.info.frames`.
 *
 * Never reuses `TimelineAnalysisService.kt` (which conflates `assistingParticipantIds == null`
 * with `emptyList()`) and requires every frame up to the checkpoint to carry a valid `events` array.
 */
function extractPlayerEarlyTotalDeathsAtCheckpoint(
  validFrames: TimelineFrameDto[],
  checkpointFrame: TimelineFrameDto,
  targetMinute: ProCheckpointMinute,
  resolvedParticipantId: number,
): {
  status: PlayerEarlyDeathsCheckpointStatus;
  deaths: number | null;
} {
  const targetMs = targetMinute * 60_000;
  const maxCheckTimestamp = Math.max(
    targetMs,
    checkpointFrame.timestamp ?? targetMs,
  );

  let deaths = 0;
  for (const frame of validFrames) {
    const fTs = frame?.timestamp;
    if (typeof fTs !== "number" || !Number.isFinite(fTs)) {
      continue;
    }
    if (fTs <= maxCheckTimestamp) {
      if (!Array.isArray(frame.events)) {
        return { status: "missing_events_array", deaths: null };
      }
    }
    if (!Array.isArray(frame.events)) {
      continue;
    }
    for (const ev of frame.events) {
      if (!ev || ev.type !== "CHAMPION_KILL") continue;
      if (
        typeof ev.timestamp !== "number" ||
        !Number.isFinite(ev.timestamp) ||
        ev.timestamp < 0
      ) {
        return { status: "malformed_kill_event", deaths: null };
      }
      if (ev.timestamp <= targetMs) {
        if (typeof ev.victimId !== "number" || !Number.isFinite(ev.victimId)) {
          return { status: "malformed_kill_event", deaths: null };
        }
        if (ev.victimId === resolvedParticipantId) {
          deaths += 1;
        }
      }
    }
  }

  return { status: "available", deaths };
}

/**
 * Audits per-match player deaths from `MatchDto` and `MatchTimelineDto` (`CHAMPION_KILL` events
 * where `victimId === resolvedParticipantId`).
 *
 * Strict rules:
 * - Never reuses backend `TimelineAnalysisService.kt` (which maps `assistingParticipantIds ?: emptyList()`
 *   and miscounts missing `null` assists as unassisted deaths) or `MatchDetailsTab.tsx` line 138
 *   (`(event.assistingParticipantIds || [])`).
 * - Missing `assistingParticipantIds` (`null` or `undefined`) is recorded in `unknownAssistDeathsCount`
 *   and sets `timelineAssistStatus = "incomplete_missing_assist_array"` and
 *   `zeroAssistDeathsNotProvenSolo = null` (`unknown`) — NEVER `0`.
 * - Explicit empty `assistingParticipantIds: []` is counted in `zeroAssistDeathsNotProvenSolo`
 *   (unassisted death within Riot's assist timer, NOT a proven 1v1 solo death), while `soloDeaths`
 *   remains strictly `null`.
 */
export function extractPlayerDeathAttributionForMatch(params: {
  playerParticipant: ParticipantDto;
  roleOpponentParticipant: ParticipantDto | null;
  timelineStatus: MatchTimelineResolutionStatus;
  validFrames: TimelineFrameDto[] | null;
  resolvedParticipantId: number | null;
  gameDurationSeconds: number;
}): PlayerMatchDeathAttribution {
  const {
    playerParticipant,
    roleOpponentParticipant,
    timelineStatus,
    validFrames,
    resolvedParticipantId,
    gameDurationSeconds,
  } = params;

  const totalDeathsFromMatchDto = isStrictNonNegativeCounter(
    playerParticipant.deaths,
  )
    ? playerParticipant.deaths
    : null;

  const opponentOwnSoloKillsChallengeNotPlayerSoloDeaths =
    roleOpponentParticipant &&
    isStrictNonNegativeCounter(roleOpponentParticipant.challenges?.soloKills)
      ? roleOpponentParticipant.challenges!.soloKills!
      : null;

  if (
    timelineStatus !== "loaded" ||
    !validFrames ||
    resolvedParticipantId === null
  ) {
    return {
      timelineAssistStatus: "timeline_not_loaded",
      totalDeathsFromMatchDto,
      totalTimelineDeaths: null,
      knownAssistedDeaths: null,
      zeroAssistDeathsNotProvenSolo: null,
      zeroAssistDeathShareNotProvenSolo: null,
      unknownAssistDeathsCount: null,
      opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
      soloDeaths: null,
    };
  }

  const maxAllowedMs = (gameDurationSeconds + 30) * 1000;
  let totalTimelineDeaths = 0;
  let knownAssisted = 0;
  let knownZeroAssist = 0;
  let unknownAssist = 0;

  for (const frame of validFrames) {
    const fTs = frame?.timestamp;
    if (typeof fTs !== "number" || !Number.isFinite(fTs) || fTs < 0) {
      continue;
    }
    if (fTs > maxAllowedMs) {
      continue;
    }
    if (!Array.isArray(frame.events)) {
      return {
        timelineAssistStatus: "missing_events_array",
        totalDeathsFromMatchDto,
        totalTimelineDeaths: null,
        knownAssistedDeaths: null,
        zeroAssistDeathsNotProvenSolo: null,
        zeroAssistDeathShareNotProvenSolo: null,
        unknownAssistDeathsCount: null,
        opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
        soloDeaths: null,
      };
    }

    for (const ev of frame.events) {
      if (!ev || ev.type !== "CHAMPION_KILL") continue;
      if (
        typeof ev.timestamp !== "number" ||
        !Number.isFinite(ev.timestamp) ||
        ev.timestamp < 0 ||
        ev.timestamp > maxAllowedMs
      ) {
        return {
          timelineAssistStatus: "malformed_kill_event",
          totalDeathsFromMatchDto,
          totalTimelineDeaths: null,
          knownAssistedDeaths: null,
          zeroAssistDeathsNotProvenSolo: null,
          zeroAssistDeathShareNotProvenSolo: null,
          unknownAssistDeathsCount: null,
          opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
          soloDeaths: null,
        };
      }
      if (
        typeof ev.victimId !== "number" ||
        !Number.isInteger(ev.victimId) ||
        ev.victimId < 1 ||
        ev.victimId > 10
      ) {
        return {
          timelineAssistStatus: "malformed_kill_event",
          totalDeathsFromMatchDto,
          totalTimelineDeaths: null,
          knownAssistedDeaths: null,
          zeroAssistDeathsNotProvenSolo: null,
          zeroAssistDeathShareNotProvenSolo: null,
          unknownAssistDeathsCount: null,
          opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
          soloDeaths: null,
        };
      }

      if (ev.victimId !== resolvedParticipantId) {
        continue;
      }

      totalTimelineDeaths += 1;
      const rawAssists = (ev as { assistingParticipantIds?: unknown })
        .assistingParticipantIds;
      if (rawAssists === undefined || rawAssists === null) {
        unknownAssist += 1;
      } else if (!Array.isArray(rawAssists)) {
        return {
          timelineAssistStatus: "malformed_kill_event",
          totalDeathsFromMatchDto,
          totalTimelineDeaths: null,
          knownAssistedDeaths: null,
          zeroAssistDeathsNotProvenSolo: null,
          zeroAssistDeathShareNotProvenSolo: null,
          unknownAssistDeathsCount: null,
          opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
          soloDeaths: null,
        };
      } else {
        const validAssistIds = rawAssists.every(
          (id) =>
            typeof id === "number" &&
            Number.isInteger(id) &&
            id >= 1 &&
            id <= 10,
        );
        if (!validAssistIds) {
          return {
            timelineAssistStatus: "malformed_kill_event",
            totalDeathsFromMatchDto,
            totalTimelineDeaths: null,
            knownAssistedDeaths: null,
            zeroAssistDeathsNotProvenSolo: null,
            zeroAssistDeathShareNotProvenSolo: null,
            unknownAssistDeathsCount: null,
            opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
            soloDeaths: null,
          };
        }
        if (rawAssists.length === 0) {
          knownZeroAssist += 1;
        } else {
          knownAssisted += 1;
        }
      }
    }
  }

  if (unknownAssist > 0) {
    return {
      timelineAssistStatus: "incomplete_missing_assist_array",
      totalDeathsFromMatchDto,
      totalTimelineDeaths,
      knownAssistedDeaths: null,
      zeroAssistDeathsNotProvenSolo: null,
      zeroAssistDeathShareNotProvenSolo: null,
      unknownAssistDeathsCount: unknownAssist,
      opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
      soloDeaths: null,
    };
  }

  return {
    timelineAssistStatus: "available",
    totalDeathsFromMatchDto,
    totalTimelineDeaths,
    knownAssistedDeaths: knownAssisted,
    zeroAssistDeathsNotProvenSolo: knownZeroAssist,
    zeroAssistDeathShareNotProvenSolo:
      totalTimelineDeaths > 0
        ? roundToDecimals(knownZeroAssist / totalTimelineDeaths, 4)
        : null,
    unknownAssistDeathsCount: 0,
    opponentOwnSoloKillsChallengeNotPlayerSoloDeaths,
    soloDeaths: null,
  };
}

/**
 * Extracts `5m / 10m / 15m / 20m / 25m / 30m` CS, Gold, Level, Role-Opponent GD/CSD,
 * Early Total Deaths, Whole-Game metrics, and Death Attribution for a single match of the searched player.
 *
 * Rules enforced:
 * - Never uses `powerSpikeTimelines` (which floors timestamps and defaults missing counters to 0).
 * - Never uses `TimelineAnalysisService` (which maps null `assistingParticipantIds` to `emptyList()`).
 * - Games ending before `M * 60` seconds get `'game_ended_before_checkpoint'` and `null` (never 0).
 * - Frame must be within ±30s (`CHECKPOINT_TOLERANCE_MS`) of `M * 60_000` ms.
 * - Counters must be finite non-negative numbers (`>= 1` for level); missing counters return `null`.
 */
export function extractPlayerMatchSummary(
  matchDto: MatchDto,
  puuid: string,
  timelinesByMatchId: Record<string, MatchTimelineDto | null | undefined>,
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
): SearchedPlayerMatchSummary | null {
  const matchId = matchDto.metadata?.matchId?.trim();
  if (!matchId || !puuid) return null;

  const matchInfo = matchDto.info;
  const gameDurationSeconds = matchInfo?.gameDuration ?? 0;
  if (
    !matchInfo ||
    typeof gameDurationSeconds !== "number" ||
    !Number.isFinite(gameDurationSeconds) ||
    gameDurationSeconds <= 0
  ) {
    return null;
  }

  const playerParticipant = resolvePlayerMatchParticipant(matchDto, puuid);
  if (!playerParticipant) return null;

  // Skip remakes / early surrenders under 5 minutes
  if (
    playerParticipant.gameEndedInEarlySurrender === true ||
    gameDurationSeconds < 300
  ) {
    return null;
  }

  const role = normalizeRiotRoleToProRole(
    playerParticipant.teamPosition || playerParticipant.individualPosition,
  );
  if (!role) return null;

  const rawChampionName = playerParticipant.championName?.trim() || "Unknown";
  const championId = normalizeChampionIdForProDataset(rawChampionName, dataset);

  const endLane = isStrictNonNegativeCounter(
    playerParticipant.totalMinionsKilled,
  )
    ? playerParticipant.totalMinionsKilled
    : null;
  const endJungle = isStrictNonNegativeCounter(
    playerParticipant.neutralMinionsKilled,
  )
    ? playerParticipant.neutralMinionsKilled
    : null;
  const endTotalCsFromMatchDto =
    endLane !== null && endJungle !== null ? endLane + endJungle : null;

  const wholeGame = extractPlayerWholeGameMetrics(
    matchDto,
    playerParticipant,
    gameDurationSeconds,
  );

  const roleOpponentParticipant = resolveUniqueRoleOpponentParticipant(
    matchDto,
    playerParticipant,
    role,
  );
  const roleOpponentPuuid = roleOpponentParticipant?.puuid?.trim() || null;
  const roleOpponentChampionId = roleOpponentParticipant?.championName
    ? normalizeChampionIdForProDataset(
        roleOpponentParticipant.championName,
        dataset,
      )
    : null;

  const rawTimeline = timelinesByMatchId[matchId];
  let timelineStatus: MatchTimelineResolutionStatus = "not_loaded";
  let resolvedParticipantId: number | null = null;
  let resolvedRoleOpponentParticipantId: number | null = null;
  let validFrames: TimelineFrameDto[] | null = null;

  if (rawTimeline) {
    const timelineMatchId = rawTimeline.metadata?.matchId?.trim();
    if (timelineMatchId && timelineMatchId !== matchId) {
      timelineStatus = "mismatched_match_id";
    } else {
      resolvedParticipantId = resolveTimelineParticipantIdByPuuid(
        rawTimeline,
        puuid,
        playerParticipant,
      );
      if (resolvedParticipantId === null) {
        timelineStatus = "participant_not_found";
      } else if (
        !Array.isArray(rawTimeline.info?.frames) ||
        rawTimeline.info.frames.length === 0
      ) {
        timelineStatus = "empty_frames";
      } else {
        timelineStatus = "loaded";
        validFrames = rawTimeline.info.frames;
        if (roleOpponentParticipant && roleOpponentPuuid) {
          const oppPid = resolveTimelineParticipantIdByPuuid(
            rawTimeline,
            roleOpponentPuuid,
            roleOpponentParticipant,
          );
          if (oppPid !== null && oppPid !== resolvedParticipantId) {
            resolvedRoleOpponentParticipantId = oppPid;
          }
        }
      }
    }
  }

  const deathAttribution = extractPlayerDeathAttributionForMatch({
    playerParticipant,
    roleOpponentParticipant,
    timelineStatus,
    validFrames,
    resolvedParticipantId,
    gameDurationSeconds,
  });

  const checkpoints = {} as Record<
    ProCheckpointMinute,
    PlayerMatchCheckpointValue
  >;

  for (const minute of PRO_CHECKPOINT_MINUTES) {
    const label = `${minute}m` as const;
    const checkpointSeconds = minute * 60;

    if (gameDurationSeconds < checkpointSeconds) {
      checkpoints[minute] = {
        minute,
        label,
        status: "game_ended_before_checkpoint",
        totalCs: null,
        laneCs: null,
        jungleCs: null,
        csPerMin: null,
        goldStatus: "game_ended_before_checkpoint",
        totalGold: null,
        levelStatus: "game_ended_before_checkpoint",
        level: null,
        csDiffStatus: "game_ended_before_checkpoint",
        opponentTotalCs: null,
        csDiffVsRoleOpponent: null,
        goldDiffStatus: "game_ended_before_checkpoint",
        opponentTotalGold: null,
        goldDiffVsRoleOpponent: null,
        earlyDeathsStatus: "game_ended_before_checkpoint",
        earlyTotalDeaths: null,
        frameTimestampMs: null,
      };
      continue;
    }

    if (
      timelineStatus !== "loaded" ||
      !validFrames ||
      resolvedParticipantId === null
    ) {
      checkpoints[minute] = {
        minute,
        label,
        status: "timeline_not_loaded",
        totalCs: null,
        laneCs: null,
        jungleCs: null,
        csPerMin: null,
        goldStatus: "timeline_not_loaded",
        totalGold: null,
        levelStatus: "timeline_not_loaded",
        level: null,
        csDiffStatus: "timeline_not_loaded",
        opponentTotalCs: null,
        csDiffVsRoleOpponent: null,
        goldDiffStatus: "timeline_not_loaded",
        opponentTotalGold: null,
        goldDiffVsRoleOpponent: null,
        earlyDeathsStatus: "timeline_not_loaded",
        earlyTotalDeaths: null,
        frameTimestampMs: null,
      };
      continue;
    }

    const frame = findTimestampedCheckpointFrame(
      validFrames,
      minute,
      gameDurationSeconds,
    );
    if (!frame) {
      checkpoints[minute] = {
        minute,
        label,
        status: "missing_frame",
        totalCs: null,
        laneCs: null,
        jungleCs: null,
        csPerMin: null,
        goldStatus: "missing_frame",
        totalGold: null,
        levelStatus: "missing_frame",
        level: null,
        csDiffStatus: "missing_frame",
        opponentTotalCs: null,
        csDiffVsRoleOpponent: null,
        goldDiffStatus: "missing_frame",
        opponentTotalGold: null,
        goldDiffVsRoleOpponent: null,
        earlyDeathsStatus: "missing_frame",
        earlyTotalDeaths: null,
        frameTimestampMs: null,
      };
      continue;
    }

    const pf = frame.participantFrames?.[String(resolvedParticipantId)];
    const laneCs = pf?.minionsKilled;
    const jungleCs = pf?.jungleMinionsKilled;

    const csValid =
      isStrictNonNegativeCounter(laneCs) &&
      isStrictNonNegativeCounter(jungleCs);
    const totalCs = csValid ? laneCs + jungleCs : null;
    const csStatus: PlayerCheckpointStatus = csValid
      ? "available"
      : "missing_counter";

    const rawGold = pf?.totalGold;
    const goldValid = isStrictNonNegativeCounter(rawGold);
    const totalGold = goldValid ? rawGold : null;
    const goldStatus: PlayerCheckpointStatus = goldValid
      ? "available"
      : "missing_counter";

    const rawLevel = pf?.level;
    const levelValid = isStrictPositiveLevel(rawLevel);
    const level = levelValid ? rawLevel : null;
    const levelStatus: PlayerCheckpointStatus = levelValid
      ? "available"
      : "missing_counter";

    // Role-opponent CS Diff (CSD) & Gold Diff (GD)
    let csDiffStatus: PlayerRoleOpponentCheckpointStatus =
      "opponent_not_resolved";
    let opponentTotalCs: number | null = null;
    let csDiffVsRoleOpponent: number | null = null;

    let goldDiffStatus: PlayerRoleOpponentCheckpointStatus =
      "opponent_not_resolved";
    let opponentTotalGold: number | null = null;
    let goldDiffVsRoleOpponent: number | null = null;

    if (resolvedRoleOpponentParticipantId !== null) {
      const oppPf =
        frame.participantFrames?.[String(resolvedRoleOpponentParticipantId)];
      const oppLane = oppPf?.minionsKilled;
      const oppJungle = oppPf?.jungleMinionsKilled;
      if (
        isStrictNonNegativeCounter(oppLane) &&
        isStrictNonNegativeCounter(oppJungle)
      ) {
        opponentTotalCs = oppLane + oppJungle;
      }
      if (totalCs !== null && opponentTotalCs !== null) {
        csDiffStatus = "available";
        csDiffVsRoleOpponent = totalCs - opponentTotalCs;
      } else {
        csDiffStatus = "missing_counter";
      }

      const oppGold = oppPf?.totalGold;
      if (isStrictNonNegativeCounter(oppGold)) {
        opponentTotalGold = oppGold;
      }
      if (totalGold !== null && opponentTotalGold !== null) {
        goldDiffStatus = "available";
        goldDiffVsRoleOpponent = totalGold - opponentTotalGold;
      } else {
        goldDiffStatus = "missing_counter";
      }
    }

    const earlyDeathsResult = extractPlayerEarlyTotalDeathsAtCheckpoint(
      validFrames,
      frame,
      minute,
      resolvedParticipantId,
    );

    checkpoints[minute] = {
      minute,
      label,
      status: csStatus,
      totalCs,
      laneCs: csValid ? laneCs : null,
      jungleCs: csValid ? jungleCs : null,
      csPerMin: totalCs !== null ? round1(totalCs / minute) : null,
      goldStatus,
      totalGold,
      levelStatus,
      level,
      csDiffStatus,
      opponentTotalCs,
      csDiffVsRoleOpponent,
      goldDiffStatus,
      opponentTotalGold,
      goldDiffVsRoleOpponent,
      earlyDeathsStatus: earlyDeathsResult.status,
      earlyTotalDeaths: earlyDeathsResult.deaths,
      frameTimestampMs: frame.timestamp ?? null,
    };
  }

  return {
    matchId,
    puuid,
    participantId: resolvedParticipantId,
    roleOpponentPuuid,
    roleOpponentParticipantId: resolvedRoleOpponentParticipantId,
    roleOpponentChampionId,
    championId,
    rawChampionName,
    role,
    roleDisplay: formatRoleDisplay(role),
    win: Boolean(playerParticipant.win),
    gameDurationSeconds,
    gameDurationFormatted: formatDurationSeconds(gameDurationSeconds),
    patch: extractPatchMajorMinor(matchInfo.gameVersion),
    queueId: typeof matchInfo.queueId === "number" ? matchInfo.queueId : null,
    queueLabel: formatQueueLabel(matchInfo.queueId, matchInfo.gameMode),
    endTotalCsFromMatchDto,
    wholeGame,
    deathAttribution,
    timelineStatus,
    checkpoints,
  };
}

function buildWholeGameMetricComparison(params: {
  metricKey: PairedWholeGameMetricComparison["metricKey"];
  label: string;
  playerValues: number[];
  playerTotalGames: number;
  proAvailableCount: number;
  proTotalGames: number;
  proMean: number | null;
  proMin: number | null;
  proMax: number | null;
  decimals: number;
}): PairedWholeGameMetricComparison {
  const {
    metricKey,
    label,
    playerValues,
    playerTotalGames,
    proAvailableCount,
    proTotalGames,
    proMean,
    proMin,
    proMax,
    decimals,
  } = params;

  const playerAvailableGames = playerValues.length;
  const playerMean =
    playerAvailableGames > 0
      ? roundToDecimals(
          playerValues.reduce((a, b) => a + b, 0) / playerAvailableGames,
          decimals,
        )
      : null;
  const playerMin =
    playerAvailableGames > 0
      ? roundToDecimals(Math.min(...playerValues), decimals)
      : null;
  const playerMax =
    playerAvailableGames > 0
      ? roundToDecimals(Math.max(...playerValues), decimals)
      : null;

  const deltaMean =
    playerMean !== null && proMean !== null
      ? roundToDecimals(playerMean - proMean, decimals)
      : null;

  return {
    metricKey,
    label,
    playerAvailableGames,
    playerTotalGames,
    playerMean,
    playerMin,
    playerMax,
    proAvailableGames: proAvailableCount,
    proTotalGames,
    proMean,
    proMin,
    proMax,
    deltaMean,
  };
}

function createEmptyWholeGameComparison(): PairedWholeGameComparison {
  return {
    killParticipation: buildWholeGameMetricComparison({
      metricKey: "killParticipation",
      label: "Kill Participation",
      playerValues: [],
      playerTotalGames: 0,
      proAvailableCount: 0,
      proTotalGames: 0,
      proMean: null,
      proMin: null,
      proMax: null,
      decimals: 4,
    }),
    championDamageShare: buildWholeGameMetricComparison({
      metricKey: "championDamageShare",
      label: "Champion Damage Share",
      playerValues: [],
      playerTotalGames: 0,
      proAvailableCount: 0,
      proTotalGames: 0,
      proMean: null,
      proMin: null,
      proMax: null,
      decimals: 4,
    }),
    wardsPlacedPerMin: buildWholeGameMetricComparison({
      metricKey: "wardsPlacedPerMin",
      label: "Wards Placed / Min",
      playerValues: [],
      playerTotalGames: 0,
      proAvailableCount: 0,
      proTotalGames: 0,
      proMean: null,
      proMin: null,
      proMax: null,
      decimals: 2,
    }),
    wardsDestroyedPerMin: buildWholeGameMetricComparison({
      metricKey: "wardsDestroyedPerMin",
      label: "Wards Destroyed / Min",
      playerValues: [],
      playerTotalGames: 0,
      proAvailableCount: 0,
      proTotalGames: 0,
      proMean: null,
      proMin: null,
      proMax: null,
      decimals: 2,
    }),
  };
}

const MATCH_HISTORY_DISPLAY_AUDIT_NOTES = {
  playerStatsCardLine166And269:
    "src/components/PlayerStats.tsx lines 166 and 269 render `Solo Kills: {challenges?.soloKills}` for the searched player (L166) and for the lane opponent (L269, `isOpponent = true`). The opponent's `challenges.soloKills` is the lane opponent's whole-game solo kills against ANY member of the player's 5-man team (and excludes solo deaths to other enemies) — it is NOT player `soloDeaths`.",
  recentChampionStatsLine130:
    "src/components/RecentChampionStats.tsx lines 63 and 130-136 render `Avg Solokills: {overallStats.avgSoloKills} ({overallStats.oppAvgSoloKills})`, where `src/utils/statsCalculator.ts` line 701 (`opponent.challenges?.soloKills || 0`) averages opponent `challenges.soloKills` and coerces missing values to 0.",
  matchDetailsTabLine138:
    "src/components/MatchDetailsTab.tsx lines 111-142 and 382-398 render `CHAMPION_KILL` timeline deaths (`victimId === playerPid`) in the expanded Match History `Details` tab (`Key Events` table) and omit `with <assistants>` when `(event.assistingParticipantIds || []).length === 0`. That expression coerces missing `null`/`undefined` `assistingParticipantIds` to `[]` (making unknown assists look unassisted), and even an explicit `[]` only means 0 recorded assists within Riot's assist timer — NOT a proven 1v1 solo death.",
  backendTimelineAnalysisServiceLine139:
    "Backend `TimelineAnalysisService.kt` (pinned build line 139 / `8ea9206` lines 181-214) maps `event.assistingParticipantIds ?: emptyList()` and counts `assistingChamps.isEmpty()` as `unassistedDeaths`; this comparison adapter never reuses that service.",
} as const;

export function summarizeSliceDeathAttribution(
  activeMatches: SearchedPlayerMatchSummary[],
): PlayerSliceDeathAttributionSummary {
  const semanticCaveat =
    "Zero-assist timeline deaths (`assistingParticipantIds: []`) only indicate 0 enemy assists were credited within Riot's assist timer — they are NOT proven 1v1 solo deaths. Any match where a player death has `assistingParticipantIds == null/undefined` is excluded as `incomplete_or_missing_assist_data` (`unknown`), never 0. Pro dataset has no `CHAMPION_KILL` assist arrays (`proReference: null`).";

  if (activeMatches.length === 0) {
    return {
      soloDeathsStatus: "UNAVAILABLE_NOT_PROVEN_1V1_AND_NO_PRO_DATA",
      soloDeathsPerGame: null,
      proSoloDeathsPerGame: null,
      deltaSoloDeathsPerGame: null,
      matchHistoryDisplayAudit: { ...MATCH_HISTORY_DISPLAY_AUDIT_NOTES },
      zeroAssistDeathsNotProvenSolo: {
        status: "no_active_matches",
        totalActiveMatches: 0,
        eligibleCompleteTimelineGames: 0,
        excludedUnloadedTimelineGames: 0,
        excludedIncompleteAssistGames: 0,
        totalTimelineDeathsInCompleteGames: null,
        knownZeroAssistDeathsInCompleteGames: null,
        knownAssistedDeathsInCompleteGames: null,
        zeroAssistDeathsPerGameNotProvenSolo: null,
        zeroAssistDeathShareNotProvenSolo: null,
        proReference: null,
        deltaVsPro: null,
        semanticCaveat,
      },
    };
  }

  let eligibleCompleteTimelineGames = 0;
  let excludedUnloadedTimelineGames = 0;
  let excludedIncompleteAssistGames = 0;
  let totalDeathsSum = 0;
  let zeroAssistDeathsSum = 0;
  let assistedDeathsSum = 0;

  for (const m of activeMatches) {
    const da = m.deathAttribution;
    if (
      da.timelineAssistStatus === "available" &&
      da.totalTimelineDeaths !== null &&
      da.zeroAssistDeathsNotProvenSolo !== null &&
      da.knownAssistedDeaths !== null
    ) {
      eligibleCompleteTimelineGames += 1;
      totalDeathsSum += da.totalTimelineDeaths;
      zeroAssistDeathsSum += da.zeroAssistDeathsNotProvenSolo;
      assistedDeathsSum += da.knownAssistedDeaths;
    } else if (da.timelineAssistStatus === "timeline_not_loaded") {
      excludedUnloadedTimelineGames += 1;
    } else {
      excludedIncompleteAssistGames += 1;
    }
  }

  if (eligibleCompleteTimelineGames === 0) {
    const status =
      excludedIncompleteAssistGames > 0
        ? "incomplete_or_missing_assist_data"
        : "timeline_not_loaded";
    return {
      soloDeathsStatus: "UNAVAILABLE_NOT_PROVEN_1V1_AND_NO_PRO_DATA",
      soloDeathsPerGame: null,
      proSoloDeathsPerGame: null,
      deltaSoloDeathsPerGame: null,
      matchHistoryDisplayAudit: { ...MATCH_HISTORY_DISPLAY_AUDIT_NOTES },
      zeroAssistDeathsNotProvenSolo: {
        status,
        totalActiveMatches: activeMatches.length,
        eligibleCompleteTimelineGames: 0,
        excludedUnloadedTimelineGames,
        excludedIncompleteAssistGames,
        totalTimelineDeathsInCompleteGames: null,
        knownZeroAssistDeathsInCompleteGames: null,
        knownAssistedDeathsInCompleteGames: null,
        zeroAssistDeathsPerGameNotProvenSolo: null,
        zeroAssistDeathShareNotProvenSolo: null,
        proReference: null,
        deltaVsPro: null,
        semanticCaveat,
      },
    };
  }

  const zeroAssistDeathsPerGameNotProvenSolo = roundToDecimals(
    zeroAssistDeathsSum / eligibleCompleteTimelineGames,
    2,
  );
  const zeroAssistDeathShareNotProvenSolo =
    totalDeathsSum > 0
      ? roundToDecimals(zeroAssistDeathsSum / totalDeathsSum, 4)
      : null;

  return {
    soloDeathsStatus: "UNAVAILABLE_NOT_PROVEN_1V1_AND_NO_PRO_DATA",
    soloDeathsPerGame: null,
    proSoloDeathsPerGame: null,
    deltaSoloDeathsPerGame: null,
    matchHistoryDisplayAudit: { ...MATCH_HISTORY_DISPLAY_AUDIT_NOTES },
    zeroAssistDeathsNotProvenSolo: {
      status: "available",
      totalActiveMatches: activeMatches.length,
      eligibleCompleteTimelineGames,
      excludedUnloadedTimelineGames,
      excludedIncompleteAssistGames,
      totalTimelineDeathsInCompleteGames: totalDeathsSum,
      knownZeroAssistDeathsInCompleteGames: zeroAssistDeathsSum,
      knownAssistedDeathsInCompleteGames: assistedDeathsSum,
      zeroAssistDeathsPerGameNotProvenSolo,
      zeroAssistDeathShareNotProvenSolo,
      proReference: null,
      deltaVsPro: null,
      semanticCaveat,
    },
  };
}

/**
 * Builds the complete searched-player vs pro-reference comparison view bound to the searched player's
 * `{ puuid, region, gameName, tagLine }`.
 *
 * Product direction enforced:
 * 1. Uses the player's most recent 20 matches ONLY (`MAX_RECENT_PLAYER_MATCHES = 20`).
 * 2. Preselects the player's primary role from those 20 matches by default (`detectedPrimaryRole`),
 *    while allowing the caller to switch to any role (`selectedRole`).
 * 3. Supports optional narrowing of the pro reference to a specific pro player (`selectedProPlayerId`,
 *    matched by stable `esportsPlayerId`, full `summonerName`, or unique handle). Never fabricates
 *    availability: vision examples not in the dataset (such as `"Chovy"` or `"Faker"`) resolve to
 *    `isProPlayerFoundInDataset: false`, `matchingProGamesAfterFilters: 0`, and `proReferenceAvailable: false`.
 * 4. Exposes `playerDeathAttribution` with `zeroAssistDeathsNotProvenSolo` frequency/share, keeps
 *    missing `assistingParticipantIds` as `unknown` (`null`, never `0`), and keeps `soloDeaths`
 *    explicitly `null` (`UNAVAILABLE`).
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
  selectedRole?: ProRoleFilter | null;
  selectedPairKey?: string | null;
  selectedMatchId?: "ALL" | string;
  selectedProPlayerId?: "ALL" | string | null;
}): SearchedPlayerProComparisonView {
  const {
    identity,
    visibleMatches,
    timelinesByMatchId,
    dataset = DEFAULT_PRO_BENCHMARK_DATASET,
    selectedRole,
    selectedPairKey,
    selectedMatchId = "ALL",
    selectedProPlayerId,
  } = params;

  const rawProPlayerQuery = (selectedProPlayerId ?? "ALL").trim();
  const normalizedProPlayerQuery =
    rawProPlayerQuery === "" || rawProPlayerQuery.toUpperCase() === "ALL"
      ? "ALL"
      : rawProPlayerQuery;

  // 1. Deduplicate input matches in chronological/input order and cap to MAX_RECENT_PLAYER_MATCHES (20)
  const deduplicatedMatches: MatchDto[] = [];
  const seenMatchIds = new Set<string>();
  for (const matchDto of visibleMatches || []) {
    const mid = matchDto?.metadata?.matchId?.trim();
    if (!mid || seenMatchIds.has(mid)) continue;
    seenMatchIds.add(mid);
    deduplicatedMatches.push(matchDto);
  }

  const inputMatchCount = deduplicatedMatches.length;
  const recent20Matches = deduplicatedMatches.slice(
    0,
    MAX_RECENT_PLAYER_MATCHES,
  );
  const excludedBeyondRecent20Count = Math.max(
    0,
    inputMatchCount - recent20Matches.length,
  );

  const parsedMatches: SearchedPlayerMatchSummary[] = [];
  let excludedNonPositionalMatches = 0;

  for (const matchDto of recent20Matches) {
    const summary = extractPlayerMatchSummary(
      matchDto,
      identity.puuid,
      timelinesByMatchId,
      dataset,
    );
    if (summary) {
      parsedMatches.push(summary);
    } else {
      excludedNonPositionalMatches++;
    }
  }

  const recentMatchWindow: RecentPlayerMatchWindowSummary = {
    maxRecentMatches: MAX_RECENT_PLAYER_MATCHES,
    inputMatchCount,
    analyzedRecentMatchCount: recent20Matches.length,
    excludedBeyondRecent20Count,
    positionalMatchCountInRecent20: parsedMatches.length,
    excludedNonPositionalMatchesInRecent20: excludedNonPositionalMatches,
  };

  // 2. Compute role summaries & detectedPrimaryRole across the 20-match window
  const roleMatchesMap = new Map<ProRoleKey, SearchedPlayerMatchSummary[]>();
  const roleFirstSeenIndex = new Map<ProRoleKey, number>();
  for (const r of PRO_ROLE_ORDER) {
    roleMatchesMap.set(r, []);
  }
  parsedMatches.forEach((m, idx) => {
    roleMatchesMap.get(m.role)?.push(m);
    if (!roleFirstSeenIndex.has(m.role)) {
      roleFirstSeenIndex.set(m.role, idx);
    }
  });

  const availableRoles: PlayerRoleSummaryOption[] = PRO_ROLE_ORDER.map(
    (role) => {
      const rMatches = roleMatchesMap.get(role) ?? [];
      const selectableProsForRole = listSelectableProPlayers(dataset, {
        role,
        championId: "ALL",
        onlyWithMatchingGames: false,
      });
      const proDatasetGames = selectableProsForRole.reduce(
        (sum, p) => sum + p.matchingGamesAfterRoleAndChampionFilter,
        0,
      );
      return {
        role,
        roleDisplay: formatRoleDisplay(role),
        playerRecent20Games: rMatches.length,
        playerLoadedTimelineGames: rMatches.filter(
          (m) => m.timelineStatus === "loaded",
        ).length,
        playerChampions: Array.from(
          new Set(rMatches.map((m) => m.championId)),
        ),
        proDatasetGames,
        selectableProPlayers: selectableProsForRole,
      };
    },
  );

  let detectedPrimaryRole: ProRoleKey | null = null;
  let bestRoleCount = 0;
  let bestFirstIndex = Infinity;
  for (const r of PRO_ROLE_ORDER) {
    const count = roleMatchesMap.get(r)?.length ?? 0;
    const firstIdx = roleFirstSeenIndex.get(r) ?? Infinity;
    if (
      count > bestRoleCount ||
      (count > 0 && count === bestRoleCount && firstIdx < bestFirstIndex)
    ) {
      bestRoleCount = count;
      bestFirstIndex = firstIdx;
      detectedPrimaryRole = r;
    }
  }

  // Group all parsedMatches in recent 20 by (role, championId)
  const pairMap = new Map<string, SearchedPlayerMatchSummary[]>();
  for (const m of parsedMatches) {
    const key = `${m.role}::${m.championId}`;
    const list = pairMap.get(key) ?? [];
    list.push(m);
    pairMap.set(key, list);
  }

  const allPairOptionsInRecent20: SearchedPlayerPairOption[] = Array.from(
    pairMap.entries(),
  )
    .map(([pairKey, matches]) => {
      const { championId, role, roleDisplay } = matches[0];
      const proSlice = computeProComparisonSlice(dataset, {
        role,
        championId,
        proPlayerId: normalizedProPlayerQuery,
      });
      const proReferenceAvailable =
        proSlice.isSupportedSelection && proSlice.matchingObservationCount > 0;
      const loadedTimelineCount = matches.filter(
        (m) => m.timelineStatus === "loaded",
      ).length;
      const patches = Array.from(
        new Set(matches.map((m) => m.patch).filter((p) => p !== "Unknown")),
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
        proSampleGameCount: proReferenceAvailable
          ? proSlice.matchingObservationCount
          : 0,
        proPlayers: proReferenceAvailable ? proSlice.playersInSlice : [],
        selectableProPlayers: proSlice.selectableProPlayersForSlice,
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

  // 3. Resolve active role (preselected from detectedPrimaryRole when selectedRole is omitted, changeable via selectedRole)
  const isRolePreselectedByDefault =
    selectedRole === undefined || selectedRole === null;
  const pairRequestedByKey = selectedPairKey
    ? allPairOptionsInRecent20.find((p) => p.pairKey === selectedPairKey) ?? null
    : null;

  const activeRole: ProRoleFilter = !isRolePreselectedByDefault
    ? selectedRole
    : (pairRequestedByKey?.role ?? detectedPrimaryRole ?? "ALL");

  // When selectedRole is explicitly passed (and not "ALL"), filter pairOptions to that role.
  // When selectedRole is omitted (default), keep all pairOptions in recent 20 sorted with detectedPrimaryRole first.
  const pairOptions: SearchedPlayerPairOption[] = !isRolePreselectedByDefault
    ? activeRole === "ALL"
      ? allPairOptionsInRecent20
      : allPairOptionsInRecent20.filter((p) => p.role === activeRole)
    : [...allPairOptionsInRecent20].sort((a, b) => {
        const aPrimary = a.role === detectedPrimaryRole ? 0 : 1;
        const bPrimary = b.role === detectedPrimaryRole ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
        if (b.playerGameCount !== a.playerGameCount) {
          return b.playerGameCount - a.playerGameCount;
        }
        if (a.proReferenceAvailable !== b.proReferenceAvailable) {
          return a.proReferenceAvailable ? -1 : 1;
        }
        return a.championId.localeCompare(b.championId);
      });

  const selectedPair =
    (selectedPairKey
      ? pairOptions.find((p) => p.pairKey === selectedPairKey)
      : null) ??
    pairOptions[0] ??
    null;

  const effectiveRoleForSelection: ProRoleFilter = selectedPair
    ? (selectedPair.role as ProRoleFilter)
    : activeRole;
  const playerGamesInSelectedRole =
    effectiveRoleForSelection === "ALL"
      ? parsedMatches.length
      : (roleMatchesMap.get(effectiveRoleForSelection)?.length ?? 0);

  const roleSelection: PlayerRoleSelectionSummary = {
    detectedPrimaryRole,
    selectedRole: effectiveRoleForSelection,
    isRolePreselectedByDefault,
    playerGamesInSelectedRole,
    availableRoles,
  };

  const allSelectableProPlayersInDataset = listSelectableProPlayers(dataset, {
    role: "ALL",
    championId: "ALL",
    onlyWithMatchingGames: false,
  });

  if (!selectedPair) {
    const roleProSlice = computeProComparisonSlice(dataset, {
      role: effectiveRoleForSelection,
      championId: "ALL",
      proPlayerId: normalizedProPlayerQuery,
    });
    const resolvedPro = resolveSelectableProPlayer(
      dataset,
      normalizedProPlayerQuery,
      {
        role: effectiveRoleForSelection,
        championId: "ALL",
      },
    );
    const proPlayerSelection: ProPlayerSelectionSummary = {
      selectedProPlayerId: roleProSlice.selectedProPlayerId,
      resolvedProPlayer: resolvedPro,
      isProPlayerFoundInDataset: roleProSlice.isProPlayerFoundInDataset,
      matchingProGamesAfterFilters: roleProSlice.matchingObservationCount,
      proReferenceAvailableAfterFilters: false,
      unavailableReason:
        parsedMatches.length === 0
          ? "Searched player has 0 positional matches in the 20 most recent matches."
          : `Searched player has 0 matches in ${formatRoleDisplay(
              effectiveRoleForSelection,
            )} within the 20 most recent matches.`,
      selectableProPlayersForPair: [],
      selectableProPlayersForRole: roleProSlice.selectableProPlayersForRole,
      allSelectableProPlayersInDataset,
    };

    return {
      identity,
      recentMatchWindow,
      roleSelection,
      proPlayerSelection,
      allPairOptionsInRecent20,
      pairOptions: [],
      selectedPair: null,
      selectedMatchId: "ALL",
      activeMatches: [],
      proSlice: null,
      checkpoints: [],
      wholeGameComparison: createEmptyWholeGameComparison(),
      playerDeathAttribution: summarizeSliceDeathAttribution([]),
      unavailableRequestedMetrics: getUnavailableRequestedMetrics(),
      unloadedMatchIdsForSelectedPair: [],
      excludedNonPositionalMatches,
    };
  }

  const resolvedMatchId =
    selectedMatchId !== "ALL" &&
    selectedPair.matches.some((m) => m.matchId === selectedMatchId)
      ? selectedMatchId
      : "ALL";

  const activeMatches =
    resolvedMatchId === "ALL"
      ? selectedPair.matches
      : selectedPair.matches.filter((m) => m.matchId === resolvedMatchId);

  const proSlice = computeProComparisonSlice(dataset, {
    role: selectedPair.role,
    championId: selectedPair.championId,
    proPlayerId: normalizedProPlayerQuery,
  });
  const proReferenceAvailable =
    proSlice.isSupportedSelection && proSlice.matchingObservationCount > 0;

  const proPlayerSelection: ProPlayerSelectionSummary = {
    selectedProPlayerId: proSlice.selectedProPlayerId,
    resolvedProPlayer: proSlice.resolvedProPlayer,
    isProPlayerFoundInDataset: proSlice.isProPlayerFoundInDataset,
    matchingProGamesAfterFilters: proSlice.matchingObservationCount,
    proReferenceAvailableAfterFilters: proReferenceAvailable,
    unavailableReason: proReferenceAvailable
      ? null
      : (proSlice.unsupportedReason ??
        "No matching pro games after applying role, champion, and pro-player filters."),
    selectableProPlayersForPair: proSlice.selectableProPlayersForSlice,
    selectableProPlayersForRole: listSelectableProPlayers(dataset, {
      role: selectedPair.role,
      championId: "ALL",
      onlyWithMatchingGames: false,
    }),
    allSelectableProPlayersInDataset,
  };

  const checkpoints: PairedCheckpointComparison[] = PRO_CHECKPOINT_MINUTES.map(
    (minute) => {
      const label = `${minute}m` as const;
      const proCp = proSlice.checkpoints[minute];

      const totalGames = activeMatches.length;
      const gamesWithTimeline = activeMatches.filter(
        (m) => m.timelineStatus === "loaded",
      ).length;
      let shortGamesExcluded = 0;
      let missingCounterExcluded = 0;

      const availableValues: PlayerMatchCheckpointValue[] = [];
      const availableGolds: number[] = [];
      const availableLevels: number[] = [];
      const availableCsDiffs: number[] = [];
      const availableGoldDiffs: number[] = [];
      const availableEarlyDeaths: number[] = [];

      for (const m of activeMatches) {
        const cp = m.checkpoints[minute];
        if (cp.status === "game_ended_before_checkpoint") {
          shortGamesExcluded++;
        } else if (cp.status === "available" && cp.totalCs !== null) {
          availableValues.push(cp);
        } else if (
          cp.status === "missing_counter" ||
          cp.status === "missing_frame"
        ) {
          missingCounterExcluded++;
        }

        if (cp.goldStatus === "available" && cp.totalGold !== null) {
          availableGolds.push(cp.totalGold);
        }
        if (cp.levelStatus === "available" && cp.level !== null) {
          availableLevels.push(cp.level);
        }
        if (
          cp.csDiffStatus === "available" &&
          cp.csDiffVsRoleOpponent !== null
        ) {
          availableCsDiffs.push(cp.csDiffVsRoleOpponent);
        }
        if (
          cp.goldDiffStatus === "available" &&
          cp.goldDiffVsRoleOpponent !== null
        ) {
          availableGoldDiffs.push(cp.goldDiffVsRoleOpponent);
        }
        if (
          cp.earlyDeathsStatus === "available" &&
          cp.earlyTotalDeaths !== null
        ) {
          availableEarlyDeaths.push(cp.earlyTotalDeaths);
        }
      }

      let playerStatus: PairedCheckpointComparison["playerStatus"];
      let playerMeanTotalCs: number | null = null;
      let playerMeanLaneCs: number | null = null;
      let playerMeanJungleCs: number | null = null;
      let playerMeanCsPerMin: number | null = null;
      let playerMinTotalCs: number | null = null;
      let playerMaxTotalCs: number | null = null;

      if (availableValues.length > 0) {
        playerStatus = "available";
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
        playerStatus = "all_ended_before_checkpoint";
      } else if (gamesWithTimeline === 0) {
        playerStatus = "timeline_not_loaded";
      } else {
        playerStatus = "missing_frame_or_counter";
      }

      const proStatus: PairedCheckpointComparison["proStatus"] =
        proReferenceAvailable
          ? proCp.status === "AVAILABLE"
            ? "available"
            : proCp.unavailableReason === "SNAPSHOT_NOT_EXPORTED_AT_MARK"
              ? "not_in_sample_export"
              : "all_games_ended_prior"
          : "unsupported_pair";

      const proMeanTotalCs =
        proReferenceAvailable && proCp.status === "AVAILABLE"
          ? proCp.meanTotalCs
          : null;
      const proMeanCsPerMin =
        proReferenceAvailable && proCp.status === "AVAILABLE"
          ? proCp.meanTotalCsPerMin
          : null;
      const proMinTotalCs =
        proReferenceAvailable && proCp.status === "AVAILABLE"
          ? proCp.minTotalCs
          : null;
      const proMaxTotalCs =
        proReferenceAvailable && proCp.status === "AVAILABLE"
          ? proCp.maxTotalCs
          : null;

      const deltaTotalCs =
        playerMeanTotalCs !== null && proMeanTotalCs !== null
          ? round1(playerMeanTotalCs - proMeanTotalCs)
          : null;

      // Total Gold @ Checkpoint
      const playerGoldGamesReached = availableGolds.length;
      const playerMeanTotalGold =
        playerGoldGamesReached > 0
          ? round1(
              availableGolds.reduce((a, b) => a + b, 0) /
                playerGoldGamesReached,
            )
          : null;
      const playerMinTotalGold =
        playerGoldGamesReached > 0 ? Math.min(...availableGolds) : null;
      const playerMaxTotalGold =
        playerGoldGamesReached > 0 ? Math.max(...availableGolds) : null;

      const proGoldGamesReached = proReferenceAvailable
        ? proCp.availableGoldSnapshotCount
        : 0;
      const proMeanTotalGold =
        proReferenceAvailable && proGoldGamesReached > 0
          ? proCp.meanTotalGold
          : null;
      const proMinTotalGold =
        proReferenceAvailable && proGoldGamesReached > 0
          ? proCp.minTotalGold
          : null;
      const proMaxTotalGold =
        proReferenceAvailable && proGoldGamesReached > 0
          ? proCp.maxTotalGold
          : null;
      const deltaTotalGold =
        playerMeanTotalGold !== null && proMeanTotalGold !== null
          ? round1(playerMeanTotalGold - proMeanTotalGold)
          : null;

      // Champion Level @ Checkpoint
      const playerLevelGamesReached = availableLevels.length;
      const playerMeanLevel =
        playerLevelGamesReached > 0
          ? round1(
              availableLevels.reduce((a, b) => a + b, 0) /
                playerLevelGamesReached,
            )
          : null;
      const playerMinLevel =
        playerLevelGamesReached > 0 ? Math.min(...availableLevels) : null;
      const playerMaxLevel =
        playerLevelGamesReached > 0 ? Math.max(...availableLevels) : null;

      const proLevelGamesReached = proReferenceAvailable
        ? proCp.availableLevelSnapshotCount
        : 0;
      const proMeanLevel =
        proReferenceAvailable && proLevelGamesReached > 0
          ? proCp.meanLevel
          : null;
      const proMinLevel =
        proReferenceAvailable && proLevelGamesReached > 0
          ? proCp.minLevel
          : null;
      const proMaxLevel =
        proReferenceAvailable && proLevelGamesReached > 0
          ? proCp.maxLevel
          : null;
      const deltaLevel =
        playerMeanLevel !== null && proMeanLevel !== null
          ? round1(playerMeanLevel - proMeanLevel)
          : null;

      // Champion-Role CS Diff vs Role Opponent (CSD@m)
      const playerCsDiffGamesReached = availableCsDiffs.length;
      const playerMeanCsDiffVsRoleOpponent =
        playerCsDiffGamesReached > 0
          ? round1(
              availableCsDiffs.reduce((a, b) => a + b, 0) /
                playerCsDiffGamesReached,
            )
          : null;
      const playerMinCsDiffVsRoleOpponent =
        playerCsDiffGamesReached > 0 ? Math.min(...availableCsDiffs) : null;
      const playerMaxCsDiffVsRoleOpponent =
        playerCsDiffGamesReached > 0 ? Math.max(...availableCsDiffs) : null;

      const proCsDiffGamesReached = proReferenceAvailable
        ? proCp.availableCsDiffCount
        : 0;
      const proMeanCsDiffVsRoleOpponent =
        proReferenceAvailable && proCsDiffGamesReached > 0
          ? proCp.meanCsDiffVsRoleOpponent
          : null;
      const proMinCsDiffVsRoleOpponent =
        proReferenceAvailable && proCsDiffGamesReached > 0
          ? proCp.minCsDiffVsRoleOpponent
          : null;
      const proMaxCsDiffVsRoleOpponent =
        proReferenceAvailable && proCsDiffGamesReached > 0
          ? proCp.maxCsDiffVsRoleOpponent
          : null;
      const deltaCsDiffVsRoleOpponent =
        playerMeanCsDiffVsRoleOpponent !== null &&
        proMeanCsDiffVsRoleOpponent !== null
          ? round1(playerMeanCsDiffVsRoleOpponent - proMeanCsDiffVsRoleOpponent)
          : null;

      // Champion-Role Gold Diff vs Role Opponent (GD@m)
      const playerGoldDiffGamesReached = availableGoldDiffs.length;
      const playerMeanGoldDiffVsRoleOpponent =
        playerGoldDiffGamesReached > 0
          ? round1(
              availableGoldDiffs.reduce((a, b) => a + b, 0) /
                playerGoldDiffGamesReached,
            )
          : null;
      const playerMinGoldDiffVsRoleOpponent =
        playerGoldDiffGamesReached > 0 ? Math.min(...availableGoldDiffs) : null;
      const playerMaxGoldDiffVsRoleOpponent =
        playerGoldDiffGamesReached > 0 ? Math.max(...availableGoldDiffs) : null;

      const proGoldDiffGamesReached = proReferenceAvailable
        ? proCp.availableGoldDiffCount
        : 0;
      const proMeanGoldDiffVsRoleOpponent =
        proReferenceAvailable && proGoldDiffGamesReached > 0
          ? proCp.meanGoldDiffVsRoleOpponent
          : null;
      const proMinGoldDiffVsRoleOpponent =
        proReferenceAvailable && proGoldDiffGamesReached > 0
          ? proCp.minGoldDiffVsRoleOpponent
          : null;
      const proMaxGoldDiffVsRoleOpponent =
        proReferenceAvailable && proGoldDiffGamesReached > 0
          ? proCp.maxGoldDiffVsRoleOpponent
          : null;
      const deltaGoldDiffVsRoleOpponent =
        playerMeanGoldDiffVsRoleOpponent !== null &&
        proMeanGoldDiffVsRoleOpponent !== null
          ? round1(
              playerMeanGoldDiffVsRoleOpponent - proMeanGoldDiffVsRoleOpponent,
            )
          : null;

      // Early Total Deaths @ Checkpoint (Pro paused games excluded)
      const playerEarlyDeathsGamesReached = availableEarlyDeaths.length;
      const playerMeanEarlyTotalDeaths =
        playerEarlyDeathsGamesReached > 0
          ? roundToDecimals(
              availableEarlyDeaths.reduce((a, b) => a + b, 0) /
                playerEarlyDeathsGamesReached,
              2,
            )
          : null;
      const playerMinEarlyTotalDeaths =
        playerEarlyDeathsGamesReached > 0
          ? Math.min(...availableEarlyDeaths)
          : null;
      const playerMaxEarlyTotalDeaths =
        playerEarlyDeathsGamesReached > 0
          ? Math.max(...availableEarlyDeaths)
          : null;

      let proEarlyTotalDeathsStatus: PairedCheckpointComparison["proEarlyTotalDeathsStatus"];
      if (!proReferenceAvailable) {
        proEarlyTotalDeathsStatus = "unsupported_pair";
      } else if (proCp.earlyTotalDeathsStatus === "AVAILABLE") {
        proEarlyTotalDeathsStatus = "available";
      } else if (
        proCp.earlyTotalDeathsUnavailableReason === "ALL_REACHED_GAMES_PAUSED"
      ) {
        proEarlyTotalDeathsStatus = "all_reached_games_paused";
      } else if (
        proCp.earlyTotalDeathsUnavailableReason ===
        "SNAPSHOT_NOT_EXPORTED_AT_MARK"
      ) {
        proEarlyTotalDeathsStatus = "not_in_sample_export";
      } else {
        proEarlyTotalDeathsStatus = "all_games_ended_prior";
      }

      const proEarlyTotalDeathsPausedGamesExcluded = proReferenceAvailable
        ? proCp.earlyTotalDeathsPausedGamesExcludedCount
        : 0;
      const proEarlyDeathsGamesReached = proReferenceAvailable
        ? proCp.earlyTotalDeathsAvailableCount
        : 0;
      const proMeanEarlyTotalDeaths =
        proReferenceAvailable && proCp.earlyTotalDeathsStatus === "AVAILABLE"
          ? proCp.meanEarlyTotalDeaths
          : null;
      const proMinEarlyTotalDeaths =
        proReferenceAvailable && proCp.earlyTotalDeathsStatus === "AVAILABLE"
          ? proCp.minEarlyTotalDeaths
          : null;
      const proMaxEarlyTotalDeaths =
        proReferenceAvailable && proCp.earlyTotalDeathsStatus === "AVAILABLE"
          ? proCp.maxEarlyTotalDeaths
          : null;
      const deltaEarlyTotalDeaths =
        playerMeanEarlyTotalDeaths !== null && proMeanEarlyTotalDeaths !== null
          ? roundToDecimals(
              playerMeanEarlyTotalDeaths - proMeanEarlyTotalDeaths,
              2,
            )
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
        proGamesReached: proReferenceAvailable
          ? proCp.availableSnapshotCount
          : 0,
        proTotalGames: proReferenceAvailable ? proCp.totalSliceGames : 0,
        proGamesReachingDuration: proReferenceAvailable
          ? proCp.gamesReachedDurationCount
          : 0,
        deltaTotalCs,
        playerGoldGamesReached,
        playerMeanTotalGold,
        playerMinTotalGold,
        playerMaxTotalGold,
        proGoldGamesReached,
        proMeanTotalGold,
        proMinTotalGold,
        proMaxTotalGold,
        deltaTotalGold,
        playerLevelGamesReached,
        playerMeanLevel,
        playerMinLevel,
        playerMaxLevel,
        proLevelGamesReached,
        proMeanLevel,
        proMinLevel,
        proMaxLevel,
        deltaLevel,
        playerCsDiffGamesReached,
        playerMeanCsDiffVsRoleOpponent,
        playerMinCsDiffVsRoleOpponent,
        playerMaxCsDiffVsRoleOpponent,
        proCsDiffGamesReached,
        proMeanCsDiffVsRoleOpponent,
        proMinCsDiffVsRoleOpponent,
        proMaxCsDiffVsRoleOpponent,
        deltaCsDiffVsRoleOpponent,
        playerGoldDiffGamesReached,
        playerMeanGoldDiffVsRoleOpponent,
        playerMinGoldDiffVsRoleOpponent,
        playerMaxGoldDiffVsRoleOpponent,
        proGoldDiffGamesReached,
        proMeanGoldDiffVsRoleOpponent,
        proMinGoldDiffVsRoleOpponent,
        proMaxGoldDiffVsRoleOpponent,
        deltaGoldDiffVsRoleOpponent,
        playerEarlyDeathsGamesReached,
        playerMeanEarlyTotalDeaths,
        playerMinEarlyTotalDeaths,
        playerMaxEarlyTotalDeaths,
        proEarlyTotalDeathsStatus,
        proEarlyTotalDeathsPausedGamesExcluded,
        proEarlyDeathsGamesReached,
        proMeanEarlyTotalDeaths,
        proMinEarlyTotalDeaths,
        proMaxEarlyTotalDeaths,
        deltaEarlyTotalDeaths,
      };
    },
  );

  // Whole-game paired comparison across activeMatches vs proSlice.wholeGameSummary
  const playerKpValues = activeMatches
    .filter(
      (m) =>
        m.wholeGame.killParticipationStatus === "available" &&
        m.wholeGame.killParticipation !== null,
    )
    .map((m) => m.wholeGame.killParticipation as number);
  const playerDmgValues = activeMatches
    .filter(
      (m) =>
        m.wholeGame.championDamageShareStatus === "available" &&
        m.wholeGame.championDamageShare !== null,
    )
    .map((m) => m.wholeGame.championDamageShare as number);
  const playerWpmValues = activeMatches
    .filter(
      (m) =>
        m.wholeGame.wardsPlacedPerMinStatus === "available" &&
        m.wholeGame.wardsPlacedPerMin !== null,
    )
    .map((m) => m.wholeGame.wardsPlacedPerMin as number);
  const playerWcpmValues = activeMatches
    .filter(
      (m) =>
        m.wholeGame.wardsDestroyedPerMinStatus === "available" &&
        m.wholeGame.wardsDestroyedPerMin !== null,
    )
    .map((m) => m.wholeGame.wardsDestroyedPerMin as number);

  const proWg = proReferenceAvailable ? proSlice.wholeGameSummary : null;
  const wholeGameComparison: PairedWholeGameComparison = {
    killParticipation: buildWholeGameMetricComparison({
      metricKey: "killParticipation",
      label: "Kill Participation",
      playerValues: playerKpValues,
      playerTotalGames: activeMatches.length,
      proAvailableCount: proWg ? proWg.killParticipation.availableCount : 0,
      proTotalGames: proWg ? proWg.totalSliceGames : 0,
      proMean: proWg ? proWg.killParticipation.mean : null,
      proMin: proWg ? proWg.killParticipation.min : null,
      proMax: proWg ? proWg.killParticipation.max : null,
      decimals: 4,
    }),
    championDamageShare: buildWholeGameMetricComparison({
      metricKey: "championDamageShare",
      label: "Champion Damage Share",
      playerValues: playerDmgValues,
      playerTotalGames: activeMatches.length,
      proAvailableCount: proWg ? proWg.championDamageShare.availableCount : 0,
      proTotalGames: proWg ? proWg.totalSliceGames : 0,
      proMean: proWg ? proWg.championDamageShare.mean : null,
      proMin: proWg ? proWg.championDamageShare.min : null,
      proMax: proWg ? proWg.championDamageShare.max : null,
      decimals: 4,
    }),
    wardsPlacedPerMin: buildWholeGameMetricComparison({
      metricKey: "wardsPlacedPerMin",
      label: "Wards Placed / Min",
      playerValues: playerWpmValues,
      playerTotalGames: activeMatches.length,
      proAvailableCount: proWg ? proWg.wardsPlacedPerMin.availableCount : 0,
      proTotalGames: proWg ? proWg.totalSliceGames : 0,
      proMean: proWg ? proWg.wardsPlacedPerMin.mean : null,
      proMin: proWg ? proWg.wardsPlacedPerMin.min : null,
      proMax: proWg ? proWg.wardsPlacedPerMin.max : null,
      decimals: 2,
    }),
    wardsDestroyedPerMin: buildWholeGameMetricComparison({
      metricKey: "wardsDestroyedPerMin",
      label: "Wards Destroyed / Min",
      playerValues: playerWcpmValues,
      playerTotalGames: activeMatches.length,
      proAvailableCount: proWg ? proWg.wardsDestroyedPerMin.availableCount : 0,
      proTotalGames: proWg ? proWg.totalSliceGames : 0,
      proMean: proWg ? proWg.wardsDestroyedPerMin.mean : null,
      proMin: proWg ? proWg.wardsDestroyedPerMin.min : null,
      proMax: proWg ? proWg.wardsDestroyedPerMin.max : null,
      decimals: 2,
    }),
  };

  const playerDeathAttribution = summarizeSliceDeathAttribution(activeMatches);

  const unloadedMatchIdsForSelectedPair = activeMatches
    .filter((m) => m.timelineStatus === "not_loaded")
    .map((m) => m.matchId)
    .slice(0, MAX_BOUNDED_TIMELINE_FETCHES);

  return {
    identity,
    recentMatchWindow,
    roleSelection,
    proPlayerSelection,
    allPairOptionsInRecent20,
    pairOptions,
    selectedPair,
    selectedMatchId: resolvedMatchId,
    activeMatches,
    proSlice: proReferenceAvailable ? proSlice : null,
    checkpoints,
    wholeGameComparison,
    playerDeathAttribution,
    unavailableRequestedMetrics: getUnavailableRequestedMetrics(),
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
