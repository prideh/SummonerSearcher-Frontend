import type { MatchDto, ParticipantDto } from "../../types/match";
import type { MatchTimelineDto } from "../../types/timeline";
import {
  PRO_CHECKPOINT_MINUTES,
  type ExplicitUnavailableMetricDescriptor,
  type ProCheckpointMinute,
  type ProRoleFilter,
  type ProRoleKey,
  type RawProBenchmarkDataset,
  type RequestedUnavailableMetricKey,
  type SelectableProPlayerOption,
} from "./proBenchmarkTypes";
import {
  DEFAULT_PRO_BENCHMARK_DATASET,
  getUnavailableRequestedMetrics,
  roundToDecimals,
} from "./proBenchmarkEngine";
import {
  buildSearchedPlayerProComparison,
  extractPatchMajorMinor,
  extractPlayerWholeGameMetrics,
  normalizeChampionIdForProDataset,
  normalizeRiotRoleToProRole,
  resolvePlayerMatchParticipant,
  resolveTimelineParticipantIdByPuuid,
  resolveUniqueRoleOpponentParticipant,
  type MatchTimelineResolutionStatus,
  type PairedCheckpointComparison,
  type PairedWholeGameMetricComparison,
  type PlayerMatchCheckpointValue,
  type PlayerMatchDeathAttribution,
  type PlayerRoleSelectionSummary,
  type PlayerSliceDeathAttributionSummary,
  type PlayerWholeGameMetrics,
  type ProPlayerSelectionSummary,
  type RecentPlayerMatchWindowSummary,
} from "./searchedPlayerProAdapter";

const isStrictNonNegativeCounter = (val: unknown): val is number =>
  typeof val === "number" && Number.isFinite(val) && val >= 0;

export type ChallengeAvailabilityStatus =
  | "available"
  | "unknown_missing_challenge";

/**
 * Player-only challenge metrics from `MatchDto.info.participants[].challenges`.
 *
 * Strict nullability contract:
 * - Missing, `null`, `undefined`, `NaN`, or negative challenge fields MUST remain `null`
 *   with status `"unknown_missing_challenge"` — NEVER coerced to `0` (unlike legacy
 *   `aiContextBuilder.ts` lines 692/722/761 `|| 0`).
 * - `proReference` is explicitly `null` because the retained derived pro export
 *   (`src/prototype/pro-benchmark/data/pro_benchmark_sample_baselines.json`,
 *   git blob `00148c2d3f665559da1a98e9de4afa4bdb41d813`) does not carry Riot `challenges` fields
 *   (and raw upstream HTTP `livestats` payloads are not retained locally).
 */
export interface StrictPlayerChallengeMetrics {
  soloKillsStatus: ChallengeAvailabilityStatus;
  soloKills: number | null;
  turretPlatesTakenStatus: ChallengeAvailabilityStatus;
  turretPlatesTaken: number | null;
  opponentTurretPlatesTakenStatus:
    | ChallengeAvailabilityStatus
    | "opponent_not_resolved";
  opponentTurretPlatesTaken: number | null;
  laneMinionsFirst10MinutesStatus: ChallengeAvailabilityStatus;
  laneMinionsFirst10Minutes: number | null;
  jungleCsBefore10MinutesStatus: ChallengeAvailabilityStatus;
  jungleCsBefore10Minutes: number | null;
  controlWardsPlacedStatus: ChallengeAvailabilityStatus;
  controlWardsPlaced: number | null;
  proReference: null;
}

export type RawTimelineAssistAuditStatus =
  | "available"
  | "timeline_not_loaded"
  | "missing_events_array"
  | "malformed_kill_event";

/**
 * Audit of raw `MatchTimelineDto` `CHAMPION_KILL` assist arrays for a single match.
 *
 * Strict semantic & nullability contract:
 * - Never reuses backend `TimelineAnalysisService.kt` (line 139 in pinned build / lines 181–214
 *   in `8ea9206`), which maps `event.assistingParticipantIds ?: emptyList()` and miscounts
 *   missing `null` assists as `unassistedDeaths`.
 * - Missing `assistingParticipantIds` (`null` or `undefined`) is counted in
 *   `unknownAssistDeathsCount` / `unknownAssistKillsCount` and causes the match-level
 *   `assistedDeaths` / `zeroAssistDeathsNotProvenSolo` (or kill equivalents) to be `null`
 *   (`unknown`) — NEVER `0` and NEVER a deflated partial count.
 * - Even when `assistingParticipantIds` is an explicit empty array `[]`, zero recorded
 *   assists is NOT a proven 1v1 solo kill or solo death (`soloKillsFromTimeline: null`,
 *   `soloDeathsFromTimeline: null`).
 */
export interface RawTimelineAssistAudit {
  status: RawTimelineAssistAuditStatus;
  totalDeaths: number | null;
  /**
    * Count of player deaths with `>= 1` assisting enemy when all player deaths in the match
    * have an explicit `assistingParticipantIds` array; `null` (`unknown`) if timeline is
    * unloaded or any player death is missing `assistingParticipantIds`.
    */
  assistedDeaths: number | null;
  /**
    * Count of player deaths with `assistingParticipantIds: []` (0 recorded assists, NOT proven
    * 1v1 solo death) when all player deaths in the match have an explicit `assistingParticipantIds`
    * array; `null` (`unknown`) if timeline is unloaded or any player death is missing
    * `assistingParticipantIds`.
    */
  zeroAssistDeathsNotProvenSolo: number | null;
  knownAssistedDeathsPartialCount: number | null;
  knownZeroAssistDeathsPartialCount: number | null;
  unknownAssistDeathsCount: number | null;
  totalKills: number | null;
  /**
    * Count of player kills with `>= 1` assisting teammate when all player kills in the match
    * have an explicit `assistingParticipantIds` array; `null` (`unknown`) if timeline is
    * unloaded or any player kill is missing `assistingParticipantIds`.
    */
  assistedKills: number | null;
  /**
    * Count of player kills with `assistingParticipantIds: []` (0 recorded assists, NOT proven
    * 1v1 solo kill) when all player kills in the match have an explicit `assistingParticipantIds`
    * array; `null` (`unknown`) if timeline is unloaded or any player kill is missing
    * `assistingParticipantIds`.
    */
  zeroAssistKillsNotProvenSolo: number | null;
  knownAssistedKillsPartialCount: number | null;
  knownZeroAssistKillsPartialCount: number | null;
  unknownAssistKillsCount: number | null;
  soloKillsFromTimeline: null;
  soloDeathsFromTimeline: null;
  soloSemanticsNote: string;
}

export interface CoachMatchGroundTruthEntry {
  matchId: string;
  championId: string;
  rawChampionName: string;
  role: ProRoleKey;
  roleDisplay: string;
  roleOpponentChampionId: string | null;
  playerPatch: string;
  gameDurationSeconds: number;
  win: boolean;
  timelineStatus: MatchTimelineResolutionStatus;
  playerOwnChallenges: StrictPlayerChallengeMetrics;
  playerTimelineAssistAudit: RawTimelineAssistAudit;
  playerDeathAttribution: PlayerMatchDeathAttribution;
  playerWholeGame: PlayerWholeGameMetrics;
  playerCheckpointCurves: Record<ProCheckpointMinute, PlayerMatchCheckpointValue>;
}

export type CoachCheckpointMetricKey =
  | "totalCs"
  | "totalGold"
  | "level"
  | "csDiffVsRoleOpponent"
  | "goldDiffVsRoleOpponent"
  | "earlyTotalDeaths";

export interface CoachCheckpointMetricComparison {
  metricKey: CoachCheckpointMetricKey;
  window: `${ProCheckpointMinute}m`;
  minute: ProCheckpointMinute;
  championId: string;
  role: ProRoleKey;
  playerPatches: string[];
  proPatch: string;
  player: {
    status: string;
    mean: number | null;
    min: number | null;
    max: number | null;
    gamesReached: number;
    totalGames: number;
  };
  proReference: {
    status: string;
    mean: number | null;
    min: number | null;
    max: number | null;
    gamesReached: number;
    totalGames: number;
    pausedGamesExcluded: number;
  };
  deltaPlayerMinusPro: number | null;
}

export type CoachCheckpointMetricMap = Record<
  CoachCheckpointMetricKey,
  CoachCheckpointMetricComparison
>;

export type CoachWholeGameMetricKey =
  | "killParticipation"
  | "championDamageShare"
  | "wardsPlacedPerMin"
  | "wardsDestroyedPerMin";

export interface CoachWholeGameMetricComparison {
  metricKey: CoachWholeGameMetricKey;
  label: string;
  window: "whole_game";
  unit: "ratio_0_to_1" | "per_minute";
  championId: string;
  role: ProRoleKey;
  playerPatches: string[];
  proPatch: string;
  player: {
    mean: number | null;
    min: number | null;
    max: number | null;
    availableGames: number;
    totalGames: number;
  };
  proReference: {
    mean: number | null;
    min: number | null;
    max: number | null;
    availableGames: number;
    totalGames: number;
  };
  deltaPlayerMinusPro: number | null;
}

export type CoachPlayerOnlyChallengeKey =
  | "soloKills"
  | "turretPlatesTaken"
  | "laneMinionsFirst10Minutes"
  | "jungleCsBefore10Minutes"
  | "controlWardsPlaced";

export interface CoachPlayerOnlyChallengeSummaryEntry {
  metricKey: CoachPlayerOnlyChallengeKey;
  label: string;
  window: "10m" | "whole_game";
  championId: string;
  role: ProRoleKey;
  playerPatches: string[];
  /**
   * Mean across matches where the challenge field was present and finite.
   * `null` when missing in all matches in the slice — NEVER defaulted to `0`.
   */
  playerMean: number | null;
  playerMin: number | null;
  playerMax: number | null;
  playerAvailableGames: number;
  playerMissingUnknownGames: number;
  playerTotalGames: number;
  proReference: null;
  deltaPlayerMinusPro: null;
  comparisonStatus: "PLAYER_ONLY_NO_PRO_REFERENCE";
  note: string;
}

export interface CoachUnsupportedProMetricEntry {
  metricKey: RequestedUnavailableMetricKey;
  label: string;
  status: "UNSUPPORTED_FOR_PRO_COMPARISON";
  playerVsProComparable: false;
  playerOwnChallengeValueAvailableInSlice: boolean;
  proReference: null;
  deltaPlayerMinusPro: null;
  reasonCode: ExplicitUnavailableMetricDescriptor["reasonCode"];
  explanation: string;
  coachDirective: string;
}

export interface CoachChampionRoleProComparisonSlice {
  pairKey: string;
  scope: {
    championId: string;
    role: ProRoleKey;
    roleDisplay: string;
    playerPatches: string[];
    proPatch: string;
    isCrossPatchComparison: boolean;
    patchNote: string;
    proPlayerFilter: {
      selectedProPlayerId: "ALL" | string;
      resolvedProPlayer: SelectableProPlayerOption | null;
      isProPlayerFoundInDataset: boolean;
      selectableProPlayersForSlice: SelectableProPlayerOption[];
    };
    timeWindows: {
      checkpointMinutes: readonly ProCheckpointMinute[];
      checkpointLabels: Array<`${ProCheckpointMinute}m`>;
      wholeGameWindow: "whole_game";
    };
    counts: {
      playerTotalGames: number;
      playerLoadedTimelineGames: number;
      proReferenceAvailable: boolean;
      proTotalGames: number;
      proPausedGamesInSlice: number;
      proPlayers: string[];
    };
  };
  checkpointComparisons: Record<ProCheckpointMinute, CoachCheckpointMetricMap>;
  wholeGameComparisons: Record<
    CoachWholeGameMetricKey,
    CoachWholeGameMetricComparison
  >;
  playerDeathAttribution: PlayerSliceDeathAttributionSummary;
  playerOnlyChallengesSummary: Record<
    CoachPlayerOnlyChallengeKey,
    CoachPlayerOnlyChallengeSummaryEntry
  >;
  unsupportedProComparisonMetrics: Record<
    RequestedUnavailableMetricKey,
    CoachUnsupportedProMetricEntry
  >;
}

export interface CoachProComparisonContext {
  schemaVersion: "coach-pro-comparison-v1";
  identity: {
    puuid: string;
    region: string;
    gameName: string;
    tagLine: string;
  };
  recentMatchWindow: RecentPlayerMatchWindowSummary;
  roleSelection: PlayerRoleSelectionSummary;
  proPlayerSelection: ProPlayerSelectionSummary;
  proDatasetMetadata: {
    patchVersion: string;
    gamesIngestedCount: number;
    playerObservationsCount: number;
    supportedChampionRolePairsCount: number;
  };
  dataIntegrityRules: {
    recentMatchWindowPolicy: "most_recent_20_deduplicated_matches_only";
    missingChallengesPolicy: "preserve_null_unknown_never_zero";
    missingTimelineAssistsPolicy: "preserve_null_unknown_never_zero_or_solo";
    unassistedKillDeathPolicy: "zero_recorded_assists_is_not_proven_1v1_solo";
    proEarlyDeathsPausePolicy: "exclude_paused_pro_games_with_total_pause_gt_0";
    proPlayerFilterPolicy: "never_fabricate_pro_player_availability";
  };
  matches: CoachMatchGroundTruthEntry[];
  championRoleComparisons: CoachChampionRoleProComparisonSlice[];
  unsupportedProComparisonMetrics: Record<
    RequestedUnavailableMetricKey,
    ExplicitUnavailableMetricDescriptor
  >;
  excludedNonPositionalMatches: number;
}

/**
 * Extracts strict nullable player challenge metrics from `ParticipantDto` without ever
 * coercing missing/null/undefined fields to `0`.
 */
export function extractStrictPlayerChallengeMetrics(
  playerParticipant: ParticipantDto | null | undefined,
  opponentParticipant?: ParticipantDto | null,
): StrictPlayerChallengeMetrics {
  const rawSoloKills = playerParticipant?.challenges?.soloKills;
  const soloKillsValid = isStrictNonNegativeCounter(rawSoloKills);

  const rawTurretPlates = playerParticipant?.challenges?.turretPlatesTaken;
  const turretPlatesValid = isStrictNonNegativeCounter(rawTurretPlates);

  let opponentTurretPlatesTakenStatus: StrictPlayerChallengeMetrics["opponentTurretPlatesTakenStatus"];
  let opponentTurretPlatesTaken: number | null = null;
  if (!opponentParticipant) {
    opponentTurretPlatesTakenStatus = "opponent_not_resolved";
  } else if (
    isStrictNonNegativeCounter(opponentParticipant.challenges?.turretPlatesTaken)
  ) {
    opponentTurretPlatesTakenStatus = "available";
    opponentTurretPlatesTaken =
      opponentParticipant.challenges!.turretPlatesTaken!;
  } else {
    opponentTurretPlatesTakenStatus = "unknown_missing_challenge";
  }

  const rawLaneCs10 =
    playerParticipant?.challenges?.laneMinionsFirst10Minutes;
  const laneCs10Valid = isStrictNonNegativeCounter(rawLaneCs10);

  const rawJungleCs10 =
    playerParticipant?.challenges?.jungleCsBefore10Minutes;
  const jungleCs10Valid = isStrictNonNegativeCounter(rawJungleCs10);

  const rawControlWards =
    playerParticipant?.challenges?.controlWardsPlaced ??
    playerParticipant?.detectorWardsPlaced ??
    playerParticipant?.visionWardsBoughtInGame;
  const controlWardsValid = isStrictNonNegativeCounter(rawControlWards);

  return {
    soloKillsStatus: soloKillsValid ? "available" : "unknown_missing_challenge",
    soloKills: soloKillsValid ? rawSoloKills : null,
    turretPlatesTakenStatus: turretPlatesValid
      ? "available"
      : "unknown_missing_challenge",
    turretPlatesTaken: turretPlatesValid ? rawTurretPlates : null,
    opponentTurretPlatesTakenStatus,
    opponentTurretPlatesTaken,
    laneMinionsFirst10MinutesStatus: laneCs10Valid
      ? "available"
      : "unknown_missing_challenge",
    laneMinionsFirst10Minutes: laneCs10Valid ? rawLaneCs10 : null,
    jungleCsBefore10MinutesStatus: jungleCs10Valid
      ? "available"
      : "unknown_missing_challenge",
    jungleCsBefore10Minutes: jungleCs10Valid ? rawJungleCs10 : null,
    controlWardsPlacedStatus: controlWardsValid
      ? "available"
      : "unknown_missing_challenge",
    controlWardsPlaced: controlWardsValid ? rawControlWards : null,
    proReference: null,
  };
}

/**
 * Audits raw `MatchTimelineDto` `CHAMPION_KILL` events for the searched player without
 * reusing `TimelineAnalysisService.kt`.
 *
 * Missing `assistingParticipantIds` (`null` / `undefined`) is NEVER mapped to `[]` or `0`.
 */
export function extractRawTimelineAssistAudit(
  timeline: MatchTimelineDto | null | undefined,
  participantId: number | null,
  gameDurationSeconds: number,
): RawTimelineAssistAudit {
  const soloSemanticsNote =
    "Timeline CHAMPION_KILL events only record assist credit (assistingParticipantIds); 0 recorded assists is not a proven 1v1 solo kill/death, and missing assistingParticipantIds is unknown (null), never 0.";

  if (
    !timeline ||
    participantId === null ||
    !Array.isArray(timeline.info?.frames) ||
    timeline.info.frames.length === 0
  ) {
    return {
      status: "timeline_not_loaded",
      totalDeaths: null,
      assistedDeaths: null,
      zeroAssistDeathsNotProvenSolo: null,
      knownAssistedDeathsPartialCount: null,
      knownZeroAssistDeathsPartialCount: null,
      unknownAssistDeathsCount: null,
      totalKills: null,
      assistedKills: null,
      zeroAssistKillsNotProvenSolo: null,
      knownAssistedKillsPartialCount: null,
      knownZeroAssistKillsPartialCount: null,
      unknownAssistKillsCount: null,
      soloKillsFromTimeline: null,
      soloDeathsFromTimeline: null,
      soloSemanticsNote,
    };
  }

  const maxAllowedMs = (gameDurationSeconds + 30) * 1000;
  let totalDeaths = 0;
  let knownAssistedDeaths = 0;
  let knownZeroAssistDeaths = 0;
  let unknownAssistDeaths = 0;

  let totalKills = 0;
  let knownAssistedKills = 0;
  let knownZeroAssistKills = 0;
  let unknownAssistKills = 0;

  for (const frame of timeline.info.frames) {
    const frameTs = frame?.timestamp;
    if (typeof frameTs !== "number" || !Number.isFinite(frameTs) || frameTs < 0) {
      continue;
    }
    if (frameTs > maxAllowedMs) {
      continue;
    }
    if (!Array.isArray(frame.events)) {
      return {
        status: "missing_events_array",
        totalDeaths: null,
        assistedDeaths: null,
        zeroAssistDeathsNotProvenSolo: null,
        knownAssistedDeathsPartialCount: null,
        knownZeroAssistDeathsPartialCount: null,
        unknownAssistDeathsCount: null,
        totalKills: null,
        assistedKills: null,
        zeroAssistKillsNotProvenSolo: null,
        knownAssistedKillsPartialCount: null,
        knownZeroAssistKillsPartialCount: null,
        unknownAssistKillsCount: null,
        soloKillsFromTimeline: null,
        soloDeathsFromTimeline: null,
        soloSemanticsNote,
      };
    }

    for (const ev of frame.events) {
      if (!ev || ev.type !== "CHAMPION_KILL") continue;
      const evTs = ev.timestamp;
      if (
        typeof evTs !== "number" ||
        !Number.isFinite(evTs) ||
        evTs < 0 ||
        evTs > maxAllowedMs
      ) {
        return {
          status: "malformed_kill_event",
          totalDeaths: null,
          assistedDeaths: null,
          zeroAssistDeathsNotProvenSolo: null,
          knownAssistedDeathsPartialCount: null,
          knownZeroAssistDeathsPartialCount: null,
          unknownAssistDeathsCount: null,
          totalKills: null,
          assistedKills: null,
          zeroAssistKillsNotProvenSolo: null,
          knownAssistedKillsPartialCount: null,
          knownZeroAssistKillsPartialCount: null,
          unknownAssistKillsCount: null,
          soloKillsFromTimeline: null,
          soloDeathsFromTimeline: null,
          soloSemanticsNote,
        };
      }

      const victimId = ev.victimId;
      if (
        typeof victimId !== "number" ||
        !Number.isInteger(victimId) ||
        victimId < 1 ||
        victimId > 10
      ) {
        return {
          status: "malformed_kill_event",
          totalDeaths: null,
          assistedDeaths: null,
          zeroAssistDeathsNotProvenSolo: null,
          knownAssistedDeathsPartialCount: null,
          knownZeroAssistDeathsPartialCount: null,
          unknownAssistDeathsCount: null,
          totalKills: null,
          assistedKills: null,
          zeroAssistKillsNotProvenSolo: null,
          knownAssistedKillsPartialCount: null,
          knownZeroAssistKillsPartialCount: null,
          unknownAssistKillsCount: null,
          soloKillsFromTimeline: null,
          soloDeathsFromTimeline: null,
          soloSemanticsNote,
        };
      }

      const killerId = ev.killerId;
      const isPlayerVictim = victimId === participantId;
      const isPlayerKiller = killerId === participantId;
      if (!isPlayerVictim && !isPlayerKiller) {
        continue;
      }

      const rawAssists = (ev as { assistingParticipantIds?: unknown })
        .assistingParticipantIds;
      let assistState: "assisted" | "zero_assists" | "unknown_missing";
      if (rawAssists === undefined || rawAssists === null) {
        assistState = "unknown_missing";
      } else if (!Array.isArray(rawAssists)) {
        return {
          status: "malformed_kill_event",
          totalDeaths: null,
          assistedDeaths: null,
          zeroAssistDeathsNotProvenSolo: null,
          knownAssistedDeathsPartialCount: null,
          knownZeroAssistDeathsPartialCount: null,
          unknownAssistDeathsCount: null,
          totalKills: null,
          assistedKills: null,
          zeroAssistKillsNotProvenSolo: null,
          knownAssistedKillsPartialCount: null,
          knownZeroAssistKillsPartialCount: null,
          unknownAssistKillsCount: null,
          soloKillsFromTimeline: null,
          soloDeathsFromTimeline: null,
          soloSemanticsNote,
        };
      } else {
        const allValidIds = rawAssists.every(
          (id) =>
            typeof id === "number" &&
            Number.isInteger(id) &&
            id >= 1 &&
            id <= 10,
        );
        if (!allValidIds) {
          return {
            status: "malformed_kill_event",
            totalDeaths: null,
            assistedDeaths: null,
            zeroAssistDeathsNotProvenSolo: null,
            knownAssistedDeathsPartialCount: null,
            knownZeroAssistDeathsPartialCount: null,
            unknownAssistDeathsCount: null,
            totalKills: null,
            assistedKills: null,
            zeroAssistKillsNotProvenSolo: null,
            knownAssistedKillsPartialCount: null,
            knownZeroAssistKillsPartialCount: null,
            unknownAssistKillsCount: null,
            soloKillsFromTimeline: null,
            soloDeathsFromTimeline: null,
            soloSemanticsNote,
          };
        }
        assistState = rawAssists.length > 0 ? "assisted" : "zero_assists";
      }

      if (isPlayerVictim) {
        totalDeaths += 1;
        if (assistState === "assisted") {
          knownAssistedDeaths += 1;
        } else if (assistState === "zero_assists") {
          knownZeroAssistDeaths += 1;
        } else {
          unknownAssistDeaths += 1;
        }
      }

      if (isPlayerKiller) {
        totalKills += 1;
        if (assistState === "assisted") {
          knownAssistedKills += 1;
        } else if (assistState === "zero_assists") {
          knownZeroAssistKills += 1;
        } else {
          unknownAssistKills += 1;
        }
      }
    }
  }

  // If ANY player death in the match has missing `assistingParticipantIds`, the match-level
  // assisted/zero-assist death totals are incomplete (`null`), NEVER `0` or a partial count
  // mistaken for complete unassisted deaths.
  const assistedDeaths: number | null =
    unknownAssistDeaths === 0 ? knownAssistedDeaths : null;
  const zeroAssistDeathsNotProvenSolo: number | null =
    unknownAssistDeaths === 0 ? knownZeroAssistDeaths : null;

  const assistedKills: number | null =
    unknownAssistKills === 0 ? knownAssistedKills : null;
  const zeroAssistKillsNotProvenSolo: number | null =
    unknownAssistKills === 0 ? knownZeroAssistKills : null;

  return {
    status: "available",
    totalDeaths,
    assistedDeaths,
    zeroAssistDeathsNotProvenSolo,
    knownAssistedDeathsPartialCount: knownAssistedDeaths,
    knownZeroAssistDeathsPartialCount: knownZeroAssistDeaths,
    unknownAssistDeathsCount: unknownAssistDeaths,
    totalKills,
    assistedKills,
    zeroAssistKillsNotProvenSolo,
    knownAssistedKillsPartialCount: knownAssistedKills,
    knownZeroAssistKillsPartialCount: knownZeroAssistKills,
    unknownAssistKillsCount: unknownAssistKills,
    soloKillsFromTimeline: null,
    soloDeathsFromTimeline: null,
    soloSemanticsNote,
  };
}

function buildCheckpointMetricMapForCoach(params: {
  cp: PairedCheckpointComparison;
  championId: string;
  role: ProRoleKey;
  playerPatches: string[];
  proPatch: string;
}): CoachCheckpointMetricMap {
  const { cp, championId, role, playerPatches, proPatch } = params;
  const window = cp.label;
  const minute = cp.minute;

  const playerGeneralStatus = cp.playerStatus;
  const proGeneralStatus = cp.proStatus;

  return {
    totalCs: {
      metricKey: "totalCs",
      window,
      minute,
      championId,
      role,
      playerPatches,
      proPatch,
      player: {
        status: playerGeneralStatus,
        mean: cp.playerMeanTotalCs,
        min: cp.playerMinTotalCs,
        max: cp.playerMaxTotalCs,
        gamesReached: cp.playerGamesReached,
        totalGames: cp.playerTotalGames,
      },
      proReference: {
        status: proGeneralStatus,
        mean: cp.proMeanTotalCs,
        min: cp.proMinTotalCs,
        max: cp.proMaxTotalCs,
        gamesReached: cp.proGamesReached,
        totalGames: cp.proTotalGames,
        pausedGamesExcluded: 0,
      },
      deltaPlayerMinusPro: cp.deltaTotalCs,
    },
    totalGold: {
      metricKey: "totalGold",
      window,
      minute,
      championId,
      role,
      playerPatches,
      proPatch,
      player: {
        status:
          cp.playerGoldGamesReached > 0 ? "available" : playerGeneralStatus,
        mean: cp.playerMeanTotalGold,
        min: cp.playerMinTotalGold,
        max: cp.playerMaxTotalGold,
        gamesReached: cp.playerGoldGamesReached,
        totalGames: cp.playerTotalGames,
      },
      proReference: {
        status: cp.proGoldGamesReached > 0 ? "available" : proGeneralStatus,
        mean: cp.proMeanTotalGold,
        min: cp.proMinTotalGold,
        max: cp.proMaxTotalGold,
        gamesReached: cp.proGoldGamesReached,
        totalGames: cp.proTotalGames,
        pausedGamesExcluded: 0,
      },
      deltaPlayerMinusPro: cp.deltaTotalGold,
    },
    level: {
      metricKey: "level",
      window,
      minute,
      championId,
      role,
      playerPatches,
      proPatch,
      player: {
        status:
          cp.playerLevelGamesReached > 0 ? "available" : playerGeneralStatus,
        mean: cp.playerMeanLevel,
        min: cp.playerMinLevel,
        max: cp.playerMaxLevel,
        gamesReached: cp.playerLevelGamesReached,
        totalGames: cp.playerTotalGames,
      },
      proReference: {
        status: cp.proLevelGamesReached > 0 ? "available" : proGeneralStatus,
        mean: cp.proMeanLevel,
        min: cp.proMinLevel,
        max: cp.proMaxLevel,
        gamesReached: cp.proLevelGamesReached,
        totalGames: cp.proTotalGames,
        pausedGamesExcluded: 0,
      },
      deltaPlayerMinusPro: cp.deltaLevel,
    },
    csDiffVsRoleOpponent: {
      metricKey: "csDiffVsRoleOpponent",
      window,
      minute,
      championId,
      role,
      playerPatches,
      proPatch,
      player: {
        status:
          cp.playerCsDiffGamesReached > 0 ? "available" : playerGeneralStatus,
        mean: cp.playerMeanCsDiffVsRoleOpponent,
        min: cp.playerMinCsDiffVsRoleOpponent,
        max: cp.playerMaxCsDiffVsRoleOpponent,
        gamesReached: cp.playerCsDiffGamesReached,
        totalGames: cp.playerTotalGames,
      },
      proReference: {
        status: cp.proCsDiffGamesReached > 0 ? "available" : proGeneralStatus,
        mean: cp.proMeanCsDiffVsRoleOpponent,
        min: cp.proMinCsDiffVsRoleOpponent,
        max: cp.proMaxCsDiffVsRoleOpponent,
        gamesReached: cp.proCsDiffGamesReached,
        totalGames: cp.proTotalGames,
        pausedGamesExcluded: 0,
      },
      deltaPlayerMinusPro: cp.deltaCsDiffVsRoleOpponent,
    },
    goldDiffVsRoleOpponent: {
      metricKey: "goldDiffVsRoleOpponent",
      window,
      minute,
      championId,
      role,
      playerPatches,
      proPatch,
      player: {
        status:
          cp.playerGoldDiffGamesReached > 0 ? "available" : playerGeneralStatus,
        mean: cp.playerMeanGoldDiffVsRoleOpponent,
        min: cp.playerMinGoldDiffVsRoleOpponent,
        max: cp.playerMaxGoldDiffVsRoleOpponent,
        gamesReached: cp.playerGoldDiffGamesReached,
        totalGames: cp.playerTotalGames,
      },
      proReference: {
        status: cp.proGoldDiffGamesReached > 0 ? "available" : proGeneralStatus,
        mean: cp.proMeanGoldDiffVsRoleOpponent,
        min: cp.proMinGoldDiffVsRoleOpponent,
        max: cp.proMaxGoldDiffVsRoleOpponent,
        gamesReached: cp.proGoldDiffGamesReached,
        totalGames: cp.proTotalGames,
        pausedGamesExcluded: 0,
      },
      deltaPlayerMinusPro: cp.deltaGoldDiffVsRoleOpponent,
    },
    earlyTotalDeaths: {
      metricKey: "earlyTotalDeaths",
      window,
      minute,
      championId,
      role,
      playerPatches,
      proPatch,
      player: {
        status:
          cp.playerEarlyDeathsGamesReached > 0
            ? "available"
            : playerGeneralStatus,
        mean: cp.playerMeanEarlyTotalDeaths,
        min: cp.playerMinEarlyTotalDeaths,
        max: cp.playerMaxEarlyTotalDeaths,
        gamesReached: cp.playerEarlyDeathsGamesReached,
        totalGames: cp.playerTotalGames,
      },
      proReference: {
        status: cp.proEarlyTotalDeathsStatus,
        mean: cp.proMeanEarlyTotalDeaths,
        min: cp.proMinEarlyTotalDeaths,
        max: cp.proMaxEarlyTotalDeaths,
        gamesReached: cp.proEarlyDeathsGamesReached,
        totalGames: cp.proTotalGames,
        pausedGamesExcluded: cp.proEarlyTotalDeathsPausedGamesExcluded,
      },
      deltaPlayerMinusPro: cp.deltaEarlyTotalDeaths,
    },
  };
}

function buildWholeGameMetricForCoach(params: {
  wg: PairedWholeGameMetricComparison;
  unit: "ratio_0_to_1" | "per_minute";
  championId: string;
  role: ProRoleKey;
  playerPatches: string[];
  proPatch: string;
}): CoachWholeGameMetricComparison {
  const { wg, unit, championId, role, playerPatches, proPatch } = params;
  return {
    metricKey: wg.metricKey,
    label: wg.label,
    window: "whole_game",
    unit,
    championId,
    role,
    playerPatches,
    proPatch,
    player: {
      mean: wg.playerMean,
      min: wg.playerMin,
      max: wg.playerMax,
      availableGames: wg.playerAvailableGames,
      totalGames: wg.playerTotalGames,
    },
    proReference: {
      mean: wg.proMean,
      min: wg.proMin,
      max: wg.proMax,
      availableGames: wg.proAvailableGames,
      totalGames: wg.proTotalGames,
    },
    deltaPlayerMinusPro: wg.deltaMean,
  };
}

function summarizePlayerOnlyChallenge(params: {
  metricKey: CoachPlayerOnlyChallengeKey;
  label: string;
  window: "10m" | "whole_game";
  championId: string;
  role: ProRoleKey;
  playerPatches: string[];
  values: Array<number | null>;
}): CoachPlayerOnlyChallengeSummaryEntry {
  const {
    metricKey,
    label,
    window,
    championId,
    role,
    playerPatches,
    values,
  } = params;
  const available = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const playerTotalGames = values.length;
  const playerAvailableGames = available.length;
  const playerMissingUnknownGames = playerTotalGames - playerAvailableGames;

  return {
    metricKey,
    label,
    window,
    championId,
    role,
    playerPatches,
    playerMean:
      playerAvailableGames > 0
        ? roundToDecimals(
            available.reduce((a, b) => a + b, 0) / playerAvailableGames,
            2,
          )
        : null,
    playerMin: playerAvailableGames > 0 ? Math.min(...available) : null,
    playerMax: playerAvailableGames > 0 ? Math.max(...available) : null,
    playerAvailableGames,
    playerMissingUnknownGames,
    playerTotalGames,
    proReference: null,
    deltaPlayerMinusPro: null,
    comparisonStatus: "PLAYER_ONLY_NO_PRO_REFERENCE",
    note: "Available on player MatchDto.challenges only when populated by Riot; missing values remain null (unknown), never 0, and no pro benchmark reference exists.",
  };
}

/**
 * Builds the complete, token-conscious Coach Pro-Comparison & Ground-Truth Context
 * for the searched player's recent 20 matches.
 *
 * Key guarantees:
 * 1. Uses the player's most recent 20 deduplicated matches ONLY (`MAX_RECENT_PLAYER_MATCHES = 20`).
 * 2. Preselects the player's primary role from those 20 matches by default (`detectedPrimaryRole`),
 *    while allowing role switching via `selectedRole`.
 * 3. Supports optional narrowing of the pro reference to a specific pro player (`selectedProPlayerId`,
 *    matched by stable `esportsPlayerId`, full `summonerName`, or unique handle) without ever
 *    fabricating availability (e.g., `"Chovy"` / `"Faker"` resolve to `isProPlayerFoundInDataset: false`,
 *    `matchingProGamesAfterFilters: 0`, `proReferenceAvailable: false`).
 * 4. Missing `MatchDto.challenges` fields (`soloKills`, `turretPlatesTaken`, `laneMinionsFirst10Minutes`,
 *    `jungleCsBefore10Minutes`, `controlWardsPlaced`) stay `null` (`unknown`), NEVER `0`.
 * 5. Missing `MatchTimelineDto` `assistingParticipantIds` (`null`/`undefined`) stays `null` (`unknown`),
 *    NEVER `0` or solo/unassisted, and never reuses `TimelineAnalysisService.kt`.
 * 6. Includes `playerDeathAttribution` (`zeroAssistDeathsNotProvenSolo` per-game frequency and share,
 *    plus Match History display audit notes) while keeping `soloDeaths` explicitly `null`.
 */
export function buildCoachProComparisonContext(input: {
  puuid: string;
  region: string;
  gameName: string;
  tagLine: string;
  matches: MatchDto[];
  timelinesByMatchId?: Record<string, MatchTimelineDto | undefined>;
  selectedRole?: ProRoleFilter | null;
  selectedProPlayerId?: "ALL" | string | null;
  dataset?: RawProBenchmarkDataset;
}): CoachProComparisonContext {
  const dataset = input.dataset ?? DEFAULT_PRO_BENCHMARK_DATASET;
  const timelinesByMatchId = input.timelinesByMatchId ?? {};
  const unavailableDescriptors = getUnavailableRequestedMetrics();

  // First build base searched-player view (which enforces the 20-match cap, role selection, and pro filter)
  const identity = {
    puuid: input.puuid,
    region: input.region,
    gameName: input.gameName,
    tagLine: input.tagLine,
  };
  const baseView = buildSearchedPlayerProComparison({
    identity,
    visibleMatches: input.matches,
    timelinesByMatchId,
    selectedRole: input.selectedRole,
    selectedProPlayerId: input.selectedProPlayerId,
    dataset,
  });

  // Index raw MatchDto by matchId so we can attach strict challenge & raw timeline assist audits
  const rawMatchById = new Map<string, MatchDto>();
  for (const m of input.matches ?? []) {
    const mid = m?.metadata?.matchId?.trim();
    if (mid && !rawMatchById.has(mid)) {
      rawMatchById.set(mid, m);
    }
  }

  // Build per-match ground truth entries in deterministic order across pairOptions in the active role selection
  const matchEntriesById = new Map<string, CoachMatchGroundTruthEntry>();
  for (const pair of baseView.pairOptions) {
    for (const summary of pair.matches) {
      if (matchEntriesById.has(summary.matchId)) continue;
      const rawMatch = rawMatchById.get(summary.matchId);
      const playerParticipant = rawMatch
        ? resolvePlayerMatchParticipant(rawMatch, input.puuid)
        : null;
      const opponentParticipant =
        rawMatch && playerParticipant
          ? resolveUniqueRoleOpponentParticipant(
              rawMatch,
              playerParticipant,
              summary.role,
            )
          : null;

      const playerOwnChallenges = extractStrictPlayerChallengeMetrics(
        playerParticipant,
        opponentParticipant,
      );

      const rawTimeline = timelinesByMatchId[summary.matchId];
      const timelineParticipantId =
        rawTimeline &&
        playerParticipant &&
        summary.timelineStatus === "loaded"
          ? resolveTimelineParticipantIdByPuuid(
              rawTimeline,
              input.puuid,
              playerParticipant,
            )
          : null;

      const playerTimelineAssistAudit =
        summary.timelineStatus === "loaded" && timelineParticipantId !== null
          ? extractRawTimelineAssistAudit(
              rawTimeline,
              timelineParticipantId,
              summary.gameDurationSeconds,
            )
          : extractRawTimelineAssistAudit(
              null,
              null,
              summary.gameDurationSeconds,
            );

      const playerWholeGame =
        rawMatch && playerParticipant
          ? extractPlayerWholeGameMetrics(
              rawMatch,
              playerParticipant,
              summary.gameDurationSeconds,
            )
          : summary.wholeGame;

      const patch = rawMatch
        ? extractPatchMajorMinor(rawMatch.info?.gameVersion)
        : summary.patch;
      const rawChamp =
        playerParticipant?.championName?.trim() || summary.rawChampionName;
      const normChamp = normalizeChampionIdForProDataset(rawChamp, dataset);
      const normRole =
        (playerParticipant
          ? normalizeRiotRoleToProRole(
              playerParticipant.teamPosition ||
                playerParticipant.individualPosition,
            )
          : null) ?? summary.role;

      matchEntriesById.set(summary.matchId, {
        matchId: summary.matchId,
        championId: normChamp,
        rawChampionName: rawChamp,
        role: normRole,
        roleDisplay: summary.roleDisplay,
        roleOpponentChampionId: summary.roleOpponentChampionId,
        playerPatch: patch,
        gameDurationSeconds: summary.gameDurationSeconds,
        win: summary.win,
        timelineStatus: summary.timelineStatus,
        playerOwnChallenges,
        playerTimelineAssistAudit,
        playerDeathAttribution: summary.deathAttribution,
        playerWholeGame,
        playerCheckpointCurves: summary.checkpoints,
      });
    }
  }

  // Build champion+role comparison slices
  const championRoleComparisons: CoachChampionRoleProComparisonSlice[] =
    baseView.pairOptions.map((pairOption) => {
      const pairView = buildSearchedPlayerProComparison({
        identity,
        visibleMatches: input.matches,
        timelinesByMatchId,
        selectedRole: input.selectedRole,
        selectedPairKey: pairOption.pairKey,
        selectedMatchId: "ALL",
        selectedProPlayerId: input.selectedProPlayerId,
        dataset,
      });

      const proPatch = extractPatchMajorMinor(dataset.patchVersion || "16.20");
      const playerPatches = pairOption.patches;
      const isCrossPatchComparison = playerPatches.some(
        (p) => p !== proPatch,
      );
      const patchNote = isCrossPatchComparison
        ? `Player matches on patch [${playerPatches.join(", ")}] vs Pro reference on patch ${proPatch}.`
        : `Player and Pro reference both on patch ${proPatch}.`;

      const proPausedGamesInSlice = pairView.proSlice
        ? pairView.proSlice.evidenceRows.filter(
            (r) => r.totalPauseSeconds > 0,
          ).length
        : 0;

      const checkpointComparisons = {} as Record<
        ProCheckpointMinute,
        CoachCheckpointMetricMap
      >;
      for (const cp of pairView.checkpoints) {
        checkpointComparisons[cp.minute] = buildCheckpointMetricMapForCoach({
          cp,
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          proPatch,
        });
      }

      const wg = pairView.wholeGameComparison;
      const wholeGameComparisons: Record<
        CoachWholeGameMetricKey,
        CoachWholeGameMetricComparison
      > = {
        killParticipation: buildWholeGameMetricForCoach({
          wg: wg.killParticipation,
          unit: "ratio_0_to_1",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          proPatch,
        }),
        championDamageShare: buildWholeGameMetricForCoach({
          wg: wg.championDamageShare,
          unit: "ratio_0_to_1",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          proPatch,
        }),
        wardsPlacedPerMin: buildWholeGameMetricForCoach({
          wg: wg.wardsPlacedPerMin,
          unit: "per_minute",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          proPatch,
        }),
        wardsDestroyedPerMin: buildWholeGameMetricForCoach({
          wg: wg.wardsDestroyedPerMin,
          unit: "per_minute",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          proPatch,
        }),
      };

      const pairMatchEntries = pairOption.matches
        .map((m) => matchEntriesById.get(m.matchId))
        .filter((e): e is CoachMatchGroundTruthEntry => Boolean(e));

      const playerOnlyChallengesSummary: Record<
        CoachPlayerOnlyChallengeKey,
        CoachPlayerOnlyChallengeSummaryEntry
      > = {
        soloKills: summarizePlayerOnlyChallenge({
          metricKey: "soloKills",
          label: "Player Solo Kills (MatchDto.challenges.soloKills)",
          window: "whole_game",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          values: pairMatchEntries.map(
            (e) => e.playerOwnChallenges.soloKills,
          ),
        }),
        turretPlatesTaken: summarizePlayerOnlyChallenge({
          metricKey: "turretPlatesTaken",
          label:
            "Player Turret Plates Taken (MatchDto.challenges.turretPlatesTaken, whole-game on Patch 26.1+)",
          window: "whole_game",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          values: pairMatchEntries.map(
            (e) => e.playerOwnChallenges.turretPlatesTaken,
          ),
        }),
        laneMinionsFirst10Minutes: summarizePlayerOnlyChallenge({
          metricKey: "laneMinionsFirst10Minutes",
          label:
            "Player Lane Minions First 10m (MatchDto.challenges.laneMinionsFirst10Minutes)",
          window: "10m",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          values: pairMatchEntries.map(
            (e) => e.playerOwnChallenges.laneMinionsFirst10Minutes,
          ),
        }),
        jungleCsBefore10Minutes: summarizePlayerOnlyChallenge({
          metricKey: "jungleCsBefore10Minutes",
          label:
            "Player Jungle CS Before 10m (MatchDto.challenges.jungleCsBefore10Minutes)",
          window: "10m",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          values: pairMatchEntries.map(
            (e) => e.playerOwnChallenges.jungleCsBefore10Minutes,
          ),
        }),
        controlWardsPlaced: summarizePlayerOnlyChallenge({
          metricKey: "controlWardsPlaced",
          label: "Player Control Wards Placed",
          window: "whole_game",
          championId: pairOption.championId,
          role: pairOption.role,
          playerPatches,
          values: pairMatchEntries.map(
            (e) => e.playerOwnChallenges.controlWardsPlaced,
          ),
        }),
      };

      const unsupportedProComparisonMetrics: Record<
        RequestedUnavailableMetricKey,
        CoachUnsupportedProMetricEntry
      > = {
        soloKills: {
          metricKey: "soloKills",
          label: unavailableDescriptors.soloKills.label,
          status: "UNSUPPORTED_FOR_PRO_COMPARISON",
          playerVsProComparable: false,
          playerOwnChallengeValueAvailableInSlice:
            playerOnlyChallengesSummary.soloKills.playerAvailableGames > 0,
          proReference: null,
          deltaPlayerMinusPro: null,
          reasonCode: unavailableDescriptors.soloKills.reasonCode,
          explanation: unavailableDescriptors.soloKills.explanation,
          coachDirective:
            "Never claim a pro benchmark value or delta for soloKills; use playerOnlyChallengesSummary.soloKills for the player's own MatchDto.challenges.soloKills when available, keep null as unknown (not 0), and never equate unassisted timeline kills with 1v1 soloKills.",
        },
        soloDeaths: {
          metricKey: "soloDeaths",
          label: unavailableDescriptors.soloDeaths.label,
          status: "UNSUPPORTED_FOR_PRO_COMPARISON",
          playerVsProComparable: false,
          playerOwnChallengeValueAvailableInSlice: false,
          proReference: null,
          deltaPlayerMinusPro: null,
          reasonCode: unavailableDescriptors.soloDeaths.reasonCode,
          explanation: unavailableDescriptors.soloDeaths.explanation,
          coachDirective:
            "Never claim soloDeaths for either player or pro; Riot challenges has no soloDeaths counter, timeline zeroAssistDeathsNotProvenSolo only means 0 recorded assists (not proven 1v1), and missing assistingParticipantIds is null (unknown), never 0 or solo.",
        },
        turretPlates: {
          metricKey: "turretPlates",
          label: unavailableDescriptors.turretPlates.label,
          status: "UNSUPPORTED_FOR_PRO_COMPARISON",
          playerVsProComparable: false,
          playerOwnChallengeValueAvailableInSlice:
            playerOnlyChallengesSummary.turretPlatesTaken
              .playerAvailableGames > 0,
          proReference: null,
          deltaPlayerMinusPro: null,
          reasonCode: unavailableDescriptors.turretPlates.reasonCode,
          explanation: unavailableDescriptors.turretPlates.explanation,
          coachDirective:
            "Never claim a pro benchmark value or delta for turretPlates; on Patch 26.1+ turret plates are permanent whole-game objectives on outer/inner/inhibitor turrets (not pre-14m only), and missing challenges.turretPlatesTaken is null (unknown), never 0.",
        },
      };

      return {
        pairKey: pairOption.pairKey,
        scope: {
          championId: pairOption.championId,
          role: pairOption.role,
          roleDisplay: pairOption.roleDisplay,
          playerPatches,
          proPatch,
          isCrossPatchComparison,
          patchNote,
          proPlayerFilter: {
            selectedProPlayerId: pairView.proPlayerSelection.selectedProPlayerId,
            resolvedProPlayer: pairView.proPlayerSelection.resolvedProPlayer,
            isProPlayerFoundInDataset:
              pairView.proPlayerSelection.isProPlayerFoundInDataset,
            selectableProPlayersForSlice:
              pairView.proPlayerSelection.selectableProPlayersForPair,
          },
          timeWindows: {
            checkpointMinutes: PRO_CHECKPOINT_MINUTES,
            checkpointLabels: PRO_CHECKPOINT_MINUTES.map(
              (m) => `${m}m` as const,
            ),
            wholeGameWindow: "whole_game",
          },
          counts: {
            playerTotalGames: pairOption.playerGameCount,
            playerLoadedTimelineGames: pairOption.loadedTimelineCount,
            proReferenceAvailable: pairOption.proReferenceAvailable,
            proTotalGames: pairOption.proSampleGameCount,
            proPausedGamesInSlice,
            proPlayers: pairOption.proPlayers,
          },
        },
        checkpointComparisons,
        wholeGameComparisons,
        playerDeathAttribution: pairView.playerDeathAttribution,
        playerOnlyChallengesSummary,
        unsupportedProComparisonMetrics,
      };
    });

  return {
    schemaVersion: "coach-pro-comparison-v1",
    identity: baseView.identity,
    recentMatchWindow: baseView.recentMatchWindow,
    roleSelection: baseView.roleSelection,
    proPlayerSelection: baseView.proPlayerSelection,
    proDatasetMetadata: {
      patchVersion: dataset.patchVersion || "16.20",
      gamesIngestedCount: dataset.gamesIngestedCount,
      playerObservationsCount: dataset.playerObservationsCount,
      supportedChampionRolePairsCount: (dataset.roleChampionBaselines ?? [])
        .length,
    },
    dataIntegrityRules: {
      recentMatchWindowPolicy: "most_recent_20_deduplicated_matches_only",
      missingChallengesPolicy: "preserve_null_unknown_never_zero",
      missingTimelineAssistsPolicy: "preserve_null_unknown_never_zero_or_solo",
      unassistedKillDeathPolicy: "zero_recorded_assists_is_not_proven_1v1_solo",
      proEarlyDeathsPausePolicy:
        "exclude_paused_pro_games_with_total_pause_gt_0",
      proPlayerFilterPolicy: "never_fabricate_pro_player_availability",
    },
    matches: Array.from(matchEntriesById.values()),
    championRoleComparisons,
    unsupportedProComparisonMetrics: unavailableDescriptors,
    excludedNonPositionalMatches: baseView.excludedNonPositionalMatches,
  };
}
