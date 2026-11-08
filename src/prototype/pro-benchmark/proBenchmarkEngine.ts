import sampleDatasetJson from "./data/pro_benchmark_sample_baselines.json";
import {
  PRO_CHECKPOINT_MINUTES,
  type CheckpointUnavailableReason,
  type DemoCheckpointComparison,
  type DemoCsInputMap,
  type EarlyDeathsUnavailableReason,
  type ExplicitUnavailableMetricDescriptor,
  type ProCheckpointMinute,
  type ProCheckpointSummary,
  type ProComparisonFilter,
  type ProGameEvidenceRow,
  type ProObservationCheckpointCell,
  type ProRoleFilter,
  type ProRoleKey,
  type ProRoleOpponentDiffStatus,
  type ProSliceComputationResult,
  type ProWholeGameMetricSummary,
  type RawGameParticipant,
  type RawProBenchmarkDataset,
  type RawProBenchmarkGame,
  type RequestedUnavailableMetricKey,
  type SelectableProPlayerChampionEntry,
  type SelectableProPlayerOption,
  type SupportedRoleChampionOption,
  type VerifiedHudVodInfo,
} from "./proBenchmarkTypes";

export const DEFAULT_PRO_BENCHMARK_DATASET: RawProBenchmarkDataset =
  sampleDatasetJson as unknown as RawProBenchmarkDataset;

export const PRO_ROLE_ORDER: readonly ProRoleKey[] = [
  "top",
  "jungle",
  "mid",
  "bottom",
  "support",
] as const;

export const PRO_ROLE_LABELS: Record<ProRoleFilter, string> = {
  ALL: "All Roles",
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  bottom: "Bottom",
  support: "Support",
};

/**
 * Explicit registry of requested metrics (`soloKills`, `soloDeaths`, `turretPlates`) that
 * remain strictly UNAVAILABLE (`null`) because they are absent from the retained derived pro export
 * (`pro_benchmark_sample_baselines.json`, git blob `00148c2d3f665559da1a98e9de4afa4bdb41d813`,
 * sha256 `4d3e0d631eaf0f337e957cd80fbead311a6dad526cb02a14fe588d23da10c253`), and raw upstream
 * HTTP `livestats` feed payloads are not retained locally (upstream field presence/absence cannot
 * be proven from the derived export or local DTO/parser definitions alone without a raw HTTP fetch).
 * Never silently replaced by proxies.
 */
export const UNAVAILABLE_REQUESTED_METRICS: Record<
  RequestedUnavailableMetricKey,
  ExplicitUnavailableMetricDescriptor
> = {
  soloKills: {
    metricKey: "soloKills",
    label: "Solo Kills",
    status: "UNAVAILABLE",
    playerValue: null,
    proValue: null,
    deltaValue: null,
    reasonCode: "SEMANTIC_MISMATCH_AND_MISSING_IN_PRO_FEED",
    explanation:
      "Unavailable: Riot MatchDto.challenges.soloKills is an opaque server-computed challenge field whose internal credit rules are not documented in payload metadata, timeline CHAMPION_KILL with empty assistingParticipantIds ([]) is an unassisted kill rather than a proven 1v1 solo kill (and null assistingParticipantIds is missing data, not empty assists), and neither challenge counters nor kill-assist event arrays exist in the retained derived export pro_benchmark_sample_baselines.json (raw upstream HTTP livestats payloads are not retained locally, so upstream field absence cannot be proven from local DTO/parser definitions alone).",
  },
  soloDeaths: {
    metricKey: "soloDeaths",
    label: "Solo Deaths",
    status: "UNAVAILABLE",
    playerValue: null,
    proValue: null,
    deltaValue: null,
    reasonCode: "SEMANTIC_MISMATCH_AND_MISSING_IN_PRO_FEED",
    explanation:
      "Unavailable: Riot ChallengesDto has no soloDeaths field, timeline CHAMPION_KILL with empty assistingParticipantIds ([]) is an unassisted death rather than a proven 1v1 death (Backend TimelineAnalysisService.kt lines 181-214 maps null assistingParticipantIds to emptyList() and counts it as unassisted, which this comparison must not reuse), and the retained derived export pro_benchmark_sample_baselines.json has only cumulative total deaths without per-death assist attribution (raw upstream HTTP livestats payloads are not retained locally). Early Total Deaths is exposed separately and never replaces Solo Deaths.",
  },
  turretPlates: {
    metricKey: "turretPlates",
    label: "Turret Plates",
    status: "UNAVAILABLE",
    playerValue: null,
    proValue: null,
    deltaValue: null,
    reasonCode: "MISSING_IN_PRO_EXPORT_AND_LIVESTATS_FEED",
    explanation:
      "Unavailable: Official Riot Patch 26.1 notes make turret plates permanent on all non-Nexus turrets (not pre-14m only), exact credit semantics between MatchDto.challenges.turretPlatesTaken and timeline TURRET_PLATE_DESTROYED killerId/assistingParticipantIds are unverified, and plate counters/events are absent from the retained derived export pro_benchmark_sample_baselines.json (raw upstream HTTP livestats payloads are not retained locally, so upstream field absence cannot be proven from local DTO/parser definitions alone).",
  },
};

export function getUnavailableRequestedMetrics(): Record<
  RequestedUnavailableMetricKey,
  ExplicitUnavailableMetricDescriptor
> {
  return {
    soloKills: { ...UNAVAILABLE_REQUESTED_METRICS.soloKills },
    soloDeaths: { ...UNAVAILABLE_REQUESTED_METRICS.soloDeaths },
    turretPlates: { ...UNAVAILABLE_REQUESTED_METRICS.turretPlates },
  };
}

/**
 * Independent broadcast HUD verification was completed ONLY for CS@10 across
 * the 20 player-observations in IG vs TES Game 1 and Game 2.
 * The dataset's automated VOD locator formula was ~73-74s early on those two games.
 */
export const VERIFIED_HUD_10M_VOD_BY_GAME_ID: Record<
  string,
  VerifiedHudVodInfo
> = {
  "115660540726095110": {
    gameId: "115660540726095110",
    gameLabel: "IG vs TES G1",
    correctedHud10mUrl: "https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=3695s",
    correctedHud10mSeconds: 3695,
    rawDatasetLocatorSeconds: 3622,
    earlyOffsetSeconds: 73,
    verificationScopeNote:
      "Independent HUD check verified CS@10 for all 10 players at t=3695s (dataset VOD locator was ~73s early at 3622s; pause adjustment uses 105.02s zero-gold freeze heuristic).",
  },
  "115660540726095111": {
    gameId: "115660540726095111",
    gameLabel: "IG vs TES G2",
    correctedHud10mUrl: "https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=6759s",
    correctedHud10mSeconds: 6759,
    rawDatasetLocatorSeconds: 6685,
    earlyOffsetSeconds: 74,
    verificationScopeNote:
      "Independent HUD check verified CS@10 for all 10 players at t=6759s (dataset VOD locator was ~74s early at 6685s).",
  },
};

export function formatDurationMmSs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unavailable";
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const floorVal = Math.floor(scaled);
  const diff = scaled - floorVal;
  const eps = 1e-9;
  if (Math.abs(diff - 0.5) < eps) {
    const even = floorVal % 2 === 0 ? floorVal : floorVal + 1;
    return even / factor;
  }
  return Math.round(scaled) / factor;
}

export function formatRoleDisplay(role: ProRoleFilter): string {
  return PRO_ROLE_LABELS[role] ?? role;
}

/**
 * Extracts all supported (role, championId) pairs directly from the dataset's
 * actual game observations so counts and player lists are guaranteed faithful
 * to the underlying 8-game / 80-observation sample.
 */
export function getSupportedRoleChampionOptions(
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
  roleFilter: ProRoleFilter = "ALL",
): SupportedRoleChampionOption[] {
  const map = new Map<
    string,
    {
      role: ProRoleKey;
      championId: string;
      count: number;
      players: Set<string>;
    }
  >();

  for (const game of dataset.games ?? []) {
    for (const pidKey of Object.keys(game.participants ?? {})) {
      const p = game.participants[pidKey];
      if (!p) continue;
      if (roleFilter !== "ALL" && p.role !== roleFilter) continue;
      const key = `${p.role}::${p.championId}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.players.add(p.summonerName);
      } else {
        map.set(key, {
          role: p.role,
          championId: p.championId,
          count: 1,
          players: new Set([p.summonerName]),
        });
      }
    }
  }

  const roleRank: Record<ProRoleKey, number> = {
    top: 0,
    jungle: 1,
    mid: 2,
    bottom: 3,
    support: 4,
  };

  return Array.from(map.values())
    .map((entry) => ({
      role: entry.role,
      championId: entry.championId,
      sampleCount: entry.count,
      players: Array.from(entry.players).sort((a, b) => a.localeCompare(b)),
    }))
    .sort(
      (a, b) =>
        roleRank[a.role] - roleRank[b.role] ||
        b.sampleCount - a.sampleCount ||
        a.championId.localeCompare(b.championId),
    );
}

export function getAllUniqueChampionsInDataset(
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
): string[] {
  const set = new Set<string>();
  for (const game of dataset.games ?? []) {
    for (const pidKey of Object.keys(game.participants ?? {})) {
      const p = game.participants[pidKey];
      if (p?.championId) set.add(p.championId);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function splitSummonerNameToTeamAndHandle(summonerName: string): {
  teamTag: string;
  playerHandle: string;
} {
  const trimmed = (summonerName ?? "").trim();
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace <= 0) {
    return { teamTag: "", playerHandle: trimmed };
  }
  return {
    teamTag: trimmed.slice(0, firstSpace).trim(),
    playerHandle: trimmed.slice(firstSpace + 1).trim() || trimmed,
  };
}

/**
 * Lists all selectable pro players in the retained dataset with their stable `esportsPlayerId`,
 * `summonerName`, `playerHandle`, `teamTag`, `teamId`, `role`, `totalGamesInDataset`,
 * `matchingGamesAfterRoleAndChampionFilter`, and `championsPlayed`.
 *
 * Never fabricates players not present in the dataset.
 */
export function listSelectableProPlayers(
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
  filter?: {
    role?: ProRoleFilter;
    championId?: string;
    onlyWithMatchingGames?: boolean;
  },
): SelectableProPlayerOption[] {
  const roleFilter: ProRoleFilter = filter?.role ?? "ALL";
  const rawChamp = filter?.championId?.trim() ?? "ALL";
  const normalizedChamp =
    rawChamp === "" || rawChamp.toUpperCase() === "ALL" ? "ALL" : rawChamp;

  const byEsportsId = new Map<
    string,
    {
      esportsPlayerId: string;
      summonerName: string;
      playerHandle: string;
      teamTag: string;
      teamId: string;
      role: ProRoleKey;
      totalGamesInDataset: number;
      matchingGamesAfterRoleAndChampionFilter: number;
      championCounts: Map<string, number>;
    }
  >();

  for (const game of dataset.games ?? []) {
    for (const pidKey of Object.keys(game.participants ?? {})) {
      const p = game.participants[pidKey];
      if (!p || !p.esportsPlayerId) continue;
      const roleMatch = roleFilter === "ALL" || p.role === roleFilter;
      const champMatch =
        normalizedChamp === "ALL" ||
        p.championId.toLowerCase() === normalizedChamp.toLowerCase();

      let entry = byEsportsId.get(p.esportsPlayerId);
      if (!entry) {
        const { teamTag, playerHandle } = splitSummonerNameToTeamAndHandle(
          p.summonerName,
        );
        entry = {
          esportsPlayerId: p.esportsPlayerId,
          summonerName: p.summonerName,
          playerHandle,
          teamTag,
          teamId: p.teamId,
          role: p.role,
          totalGamesInDataset: 0,
          matchingGamesAfterRoleAndChampionFilter: 0,
          championCounts: new Map<string, number>(),
        };
        byEsportsId.set(p.esportsPlayerId, entry);
      }

      entry.totalGamesInDataset += 1;
      entry.championCounts.set(
        p.championId,
        (entry.championCounts.get(p.championId) ?? 0) + 1,
      );
      if (roleMatch && champMatch) {
        entry.matchingGamesAfterRoleAndChampionFilter += 1;
      }
    }
  }

  const roleRank: Record<ProRoleKey, number> = {
    top: 0,
    jungle: 1,
    mid: 2,
    bottom: 3,
    support: 4,
  };

  const onlyWithMatchingGames = filter?.onlyWithMatchingGames ?? true;

  return Array.from(byEsportsId.values())
    .filter((entry) => {
      if (roleFilter !== "ALL" && entry.role !== roleFilter) {
        return false;
      }
      if (
        onlyWithMatchingGames &&
        entry.matchingGamesAfterRoleAndChampionFilter <= 0
      ) {
        return false;
      }
      return true;
    })
    .map((entry) => {
      const championsPlayed: SelectableProPlayerChampionEntry[] = Array.from(
        entry.championCounts.entries(),
      )
        .map(([championId, games]) => ({ championId, games }))
        .sort(
          (a, b) =>
            b.games - a.games || a.championId.localeCompare(b.championId),
        );
      return {
        esportsPlayerId: entry.esportsPlayerId,
        summonerName: entry.summonerName,
        playerHandle: entry.playerHandle,
        teamTag: entry.teamTag,
        teamId: entry.teamId,
        role: entry.role,
        totalGamesInDataset: entry.totalGamesInDataset,
        matchingGamesAfterRoleAndChampionFilter:
          entry.matchingGamesAfterRoleAndChampionFilter,
        championsPlayed,
      };
    })
    .sort(
      (a, b) =>
        roleRank[a.role] - roleRank[b.role] ||
        b.matchingGamesAfterRoleAndChampionFilter -
          a.matchingGamesAfterRoleAndChampionFilter ||
        b.totalGamesInDataset - a.totalGamesInDataset ||
        a.summonerName.localeCompare(b.summonerName),
    );
}

/**
 * Resolves a pro player query (`esportsPlayerId`, full `summonerName` such as `"HLE Zeka"`,
 * or unique `playerHandle` such as `"Zeka"`) against the actual dataset.
 *
 * Returns `null` when `"ALL"` / empty is passed OR when the requested pro (such as vision
 * examples `"Chovy"` or `"Faker"`) does not exist in the dataset. Never fabricates availability.
 */
export function resolveSelectableProPlayer(
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
  proPlayerQuery?: string | null,
  contextFilter?: {
    role?: ProRoleFilter;
    championId?: string;
  },
): SelectableProPlayerOption | null {
  const trimmed = (proPlayerQuery ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "ALL") {
    return null;
  }

  const allPros = listSelectableProPlayers(dataset, {
    role: "ALL",
    championId: contextFilter?.championId ?? "ALL",
    onlyWithMatchingGames: false,
  });

  const recomputeMatchingCount = (
    option: SelectableProPlayerOption,
  ): SelectableProPlayerOption => {
    const roleFilter = contextFilter?.role ?? "ALL";
    if (roleFilter !== "ALL" && option.role !== roleFilter) {
      return {
        ...option,
        matchingGamesAfterRoleAndChampionFilter: 0,
      };
    }
    return option;
  };

  // 1. Exact esportsPlayerId match
  const byId = allPros.find((p) => p.esportsPlayerId === trimmed);
  if (byId) return recomputeMatchingCount(byId);

  const lower = trimmed.toLowerCase();
  // 2. Case-insensitive full summonerName match (e.g., "HLE Zeka", "IG TheShy")
  const bySummonerName = allPros.find(
    (p) => p.summonerName.toLowerCase() === lower,
  );
  if (bySummonerName) return recomputeMatchingCount(bySummonerName);

  // 3. Case-insensitive unique playerHandle match (e.g., "Zeka", "TheShy", "Caps")
  const byHandle = allPros.filter(
    (p) => p.playerHandle.toLowerCase() === lower,
  );
  if (byHandle.length === 1) return recomputeMatchingCount(byHandle[0]);

  return null;
}

interface MatchedParticipantObservation {
  game: RawProBenchmarkGame;
  participant: RawGameParticipant;
  participantId: number;
  participantIndex: number; // 0..9 in pCs / pGolds / pLevels arrays
  roleOpponent: RawGameParticipant | null;
  roleOpponentIndex: number | null;
  summonerName: string;
  championId: string;
  role: ProRoleKey;
  side: "blue" | "red";
  finalCs: number;
  finalGold: number;
  finalLevel: number;
  finalKills: number;
  finalDeaths: number;
  finalAssists: number;
}

const isFiniteNonNegative = (val: unknown): val is number =>
  typeof val === "number" && Number.isFinite(val) && val >= 0;

const isFinitePositiveLevel = (val: unknown): val is number =>
  typeof val === "number" && Number.isFinite(val) && val >= 1;

export function isProGamePaused(game: RawProBenchmarkGame): boolean {
  if (typeof game.total_pause_s === "number" && game.total_pause_s > 0) {
    return true;
  }
  if (Array.isArray(game.pauses_verified) && game.pauses_verified.length > 0) {
    return true;
  }
  if (Array.isArray(game.pause_events) && game.pause_events.length > 0) {
    return true;
  }
  return false;
}

function resolveUniqueProRoleOpponent(
  game: RawProBenchmarkGame,
  participant: RawGameParticipant,
): RawGameParticipant | null {
  const candidates: RawGameParticipant[] = [];
  for (const pidKey of Object.keys(game.participants ?? {})) {
    const other = game.participants[pidKey];
    if (!other) continue;
    if (other.participantId === participant.participantId) continue;
    if (other.side !== participant.side && other.role === participant.role) {
      candidates.push(other);
    }
  }
  if (candidates.length !== 1) return null;
  const opp = candidates[0];
  if (
    typeof opp.participantId !== "number" ||
    !Number.isInteger(opp.participantId) ||
    opp.participantId < 1 ||
    opp.participantId > 10
  ) {
    return null;
  }
  return opp;
}

function readParticipantCsAtMark(
  game: RawProBenchmarkGame,
  markKey: string,
  participantIndex: number,
  clockMode: "true_in_game_clock" | "naive_first_frame" = "true_in_game_clock",
): number | null {
  const checkpoint = game.aligned_checkpoints?.[markKey];
  if (!checkpoint) return null;
  const arr = checkpoint[clockMode]?.pCs;
  if (
    !Array.isArray(arr) ||
    participantIndex < 0 ||
    participantIndex >= arr.length
  ) {
    return null;
  }
  const val = arr[participantIndex];
  return isFiniteNonNegative(val) ? val : null;
}

function readParticipantGoldAtMark(
  game: RawProBenchmarkGame,
  markKey: string,
  participantIndex: number,
  clockMode: "true_in_game_clock" | "naive_first_frame" = "true_in_game_clock",
): number | null {
  const checkpoint = game.aligned_checkpoints?.[markKey];
  if (!checkpoint) return null;
  const arr = checkpoint[clockMode]?.pGolds;
  if (
    !Array.isArray(arr) ||
    participantIndex < 0 ||
    participantIndex >= arr.length
  ) {
    return null;
  }
  const val = arr[participantIndex];
  return isFiniteNonNegative(val) ? val : null;
}

function readParticipantLevelAtMark(
  game: RawProBenchmarkGame,
  markKey: string,
  participantIndex: number,
  clockMode: "true_in_game_clock" | "naive_first_frame" = "true_in_game_clock",
): number | null {
  const checkpoint = game.aligned_checkpoints?.[markKey];
  if (!checkpoint) return null;
  const arr = checkpoint[clockMode]?.pLevels;
  if (
    !Array.isArray(arr) ||
    participantIndex < 0 ||
    participantIndex >= arr.length
  ) {
    return null;
  }
  const val = arr[participantIndex];
  return isFinitePositiveLevel(val) ? val : null;
}

/**
 * Reads cumulative total deaths at a checkpoint from `game.checkpoints[markKey].from_spawn`.
 * Paused games (`isProGamePaused(game) === true`) are strictly excluded by caller because
 * `game.checkpoints` in the retained export is not pause-adjusted.
 */
function readUnpausedParticipantEarlyDeathsAtMark(
  game: RawProBenchmarkGame,
  markKey: string,
  participantId: number,
): { hasSnapshotInExport: boolean; deaths: number | null } {
  const unaligned = game.checkpoints?.[markKey]?.from_spawn;
  if (!unaligned || !unaligned.participants) {
    return { hasSnapshotInExport: false, deaths: null };
  }
  const entry = unaligned.participants[String(participantId)];
  if (!entry || !isFiniteNonNegative(entry.deaths)) {
    return { hasSnapshotInExport: false, deaths: null };
  }
  return { hasSnapshotInExport: true, deaths: entry.deaths };
}

function summarizeNumericValues(
  values: number[],
  decimals: number,
): ProWholeGameMetricSummary {
  if (values.length === 0) {
    return {
      availableCount: 0,
      mean: null,
      min: null,
      max: null,
    };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    availableCount: values.length,
    mean: roundToDecimals(sum / values.length, decimals),
    min: roundToDecimals(Math.min(...values), decimals),
    max: roundToDecimals(Math.max(...values), decimals),
  };
}

/**
 * Computes the pro-comparison slice for a given role, champion, and optional specific pro player filter.
 * Strictly enforces:
 * - Only actual games reaching a minute checkpoint and having an exported snapshot
 *   contribute to that checkpoint's mean and denominator.
 * - Never substitutes 0 after a game ends.
 * - Clearly distinguishes between games that ended before a checkpoint vs
 *   checkpoints not exported in the sample dataset (such as 30m).
 * - Computes Champion-Role GD/CSD only when a specific Champion + Role slice is selected.
 * - Excludes paused games from early total deaths (`game.checkpoints[m].from_spawn`).
 * - Keeps requested `soloKills`, `soloDeaths`, and `turretPlates` explicitly UNAVAILABLE (`null`).
 * - Supports optional specific pro narrowing (`proPlayerId`): when a requested pro (e.g., `"Chovy"`
 *   or `"Faker"`) is not in the dataset or has `0` matching games after role/champion filters,
 *   returns `isSupportedSelection: false`, `matchingObservationCount: 0`, and `null` metrics.
 */
export function computeProComparisonSlice(
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
  filter: ProComparisonFilter = { role: "top", championId: "KSante" },
): ProSliceComputationResult {
  const normalizedRole: ProRoleFilter = filter.role;
  const trimmedChamp = filter.championId.trim();
  const normalizedChamp =
    trimmedChamp === "" || trimmedChamp.toUpperCase() === "ALL"
      ? "ALL"
      : trimmedChamp;

  const rawProPlayerQuery = (filter.proPlayerId ?? "ALL").trim();
  const normalizedProPlayerQuery =
    rawProPlayerQuery === "" || rawProPlayerQuery.toUpperCase() === "ALL"
      ? "ALL"
      : rawProPlayerQuery;

  const selectableProPlayersForRole = listSelectableProPlayers(dataset, {
    role: normalizedRole,
    championId: normalizedChamp,
    onlyWithMatchingGames: false,
  });
  const selectableProPlayersForSlice = selectableProPlayersForRole.filter(
    (p) => p.matchingGamesAfterRoleAndChampionFilter > 0,
  );

  const resolvedProPlayer =
    normalizedProPlayerQuery === "ALL"
      ? null
      : resolveSelectableProPlayer(dataset, normalizedProPlayerQuery, {
          role: normalizedRole,
          championId: normalizedChamp,
        });
  const isProPlayerFoundInDataset =
    normalizedProPlayerQuery === "ALL" ? true : resolvedProPlayer !== null;
  const selectedProPlayerId: "ALL" | string =
    normalizedProPlayerQuery === "ALL"
      ? "ALL"
      : (resolvedProPlayer?.esportsPlayerId ?? normalizedProPlayerQuery);

  const isChampionAndRoleSpecific =
    normalizedRole !== "ALL" && normalizedChamp !== "ALL";

  const allOptions = getSupportedRoleChampionOptions(dataset, "ALL");
  const matched: MatchedParticipantObservation[] = [];

  for (const game of dataset.games ?? []) {
    const sortedPids = Object.keys(game.participants ?? {})
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    for (const pid of sortedPids) {
      const p = game.participants[String(pid)];
      if (!p) continue;
      const roleMatch = normalizedRole === "ALL" || p.role === normalizedRole;
      const champMatch =
        normalizedChamp === "ALL" ||
        p.championId.toLowerCase() === normalizedChamp.toLowerCase();
      const proPlayerMatch =
        normalizedProPlayerQuery === "ALL"
          ? true
          : resolvedProPlayer !== null &&
            p.esportsPlayerId === resolvedProPlayer.esportsPlayerId;

      if (roleMatch && champMatch && proPlayerMatch) {
        const opp = resolveUniqueProRoleOpponent(game, p);
        matched.push({
          game,
          participant: p,
          participantId: p.participantId,
          participantIndex: p.participantId - 1,
          roleOpponent: opp,
          roleOpponentIndex: opp ? opp.participantId - 1 : null,
          summonerName: p.summonerName,
          championId: p.championId,
          role: p.role,
          side: p.side,
          finalCs: p.finalCs,
          finalGold: p.finalGold,
          finalLevel: p.finalLevel,
          finalKills: p.finalKills,
          finalDeaths: p.finalDeaths,
          finalAssists: p.finalAssists,
        });
      }
    }
  }

  const alternateRolesForChampion =
    normalizedChamp === "ALL"
      ? []
      : allOptions.filter(
          (opt) =>
            opt.championId.toLowerCase() === normalizedChamp.toLowerCase() &&
            (normalizedRole === "ALL" || opt.role !== normalizedRole),
        );

  const canonicalChampName =
    matched[0]?.championId ??
    alternateRolesForChampion[0]?.championId ??
    allOptions.find(
      (opt) => opt.championId.toLowerCase() === normalizedChamp.toLowerCase(),
    )?.championId ??
    normalizedChamp;

  const isSupportedSelection = matched.length > 0;
  let unsupportedReason: string | null = null;

  if (!isSupportedSelection) {
    if (normalizedProPlayerQuery !== "ALL" && !resolvedProPlayer) {
      unsupportedReason = `Pro player "${normalizedProPlayerQuery}" is not present in this 8-game (80-observation, 25-player) Worlds 2026 sample dataset.`;
    } else if (normalizedProPlayerQuery !== "ALL" && resolvedProPlayer) {
      const playedSummary =
        resolvedProPlayer.championsPlayed
          .map((c) => `${c.championId} (${c.games})`)
          .join(", ") || "none";
      const targetDesc =
        normalizedChamp === "ALL"
          ? formatRoleDisplay(normalizedRole)
          : `${canonicalChampName} (${formatRoleDisplay(normalizedRole)})`;
      unsupportedReason = `${resolvedProPlayer.summonerName} (${resolvedProPlayer.esportsPlayerId}) has 0 games on ${targetDesc} in this 8-game sample (played ${formatRoleDisplay(
        resolvedProPlayer.role,
      )}: ${playedSummary}).`;
    } else if (
      normalizedChamp !== "ALL" &&
      alternateRolesForChampion.length > 0
    ) {
      const rolesList = alternateRolesForChampion
        .map((opt) => `${formatRoleDisplay(opt.role)} (n=${opt.sampleCount})`)
        .join(", ");
      unsupportedReason = `${canonicalChampName} has 0 games in ${formatRoleDisplay(
        normalizedRole,
      )} in this 8-game Worlds 2026 sample, but is present in: ${rolesList}.`;
    } else if (normalizedChamp !== "ALL") {
      unsupportedReason = `"${normalizedChamp}" is not among the ${allOptions.length} champion-role pairs in this 8-game (80 player-game) Worlds 2026 sample dataset.`;
    } else {
      unsupportedReason = `No player-game observations match ${formatRoleDisplay(
        normalizedRole,
      )} in this sample dataset.`;
    }
  }

  const checkpoints = {} as Record<ProCheckpointMinute, ProCheckpointSummary>;

  for (const minuteMark of PRO_CHECKPOINT_MINUTES) {
    const targetSeconds = minuteMark * 60;
    const markKey = `${minuteMark}m`;

    const totalSliceGames = matched.length;
    const gamesReached = matched.filter(
      (obs) => obs.game.true_in_game_duration_s >= targetSeconds,
    );
    const shortGamesEndedBeforeMarkCount =
      totalSliceGames - gamesReached.length;

    const validCsEntries: Array<{
      obs: MatchedParticipantObservation;
      cs: number;
    }> = [];
    const validGoldValues: number[] = [];
    const validLevelValues: number[] = [];
    const validCsDiffValues: number[] = [];
    const validGoldDiffValues: number[] = [];
    const validEarlyDeathsValues: number[] = [];
    let earlyDeathsPausedExcludedCount = 0;
    let unpausedReachedWithExportCount = 0;

    for (const obs of gamesReached) {
      const cs = readParticipantCsAtMark(
        obs.game,
        markKey,
        obs.participantIndex,
        "true_in_game_clock",
      );
      if (cs !== null) {
        validCsEntries.push({ obs, cs });
      }

      const gold = readParticipantGoldAtMark(
        obs.game,
        markKey,
        obs.participantIndex,
        "true_in_game_clock",
      );
      if (gold !== null) {
        validGoldValues.push(gold);
      }

      const level = readParticipantLevelAtMark(
        obs.game,
        markKey,
        obs.participantIndex,
        "true_in_game_clock",
      );
      if (level !== null) {
        validLevelValues.push(level);
      }

      if (isChampionAndRoleSpecific && obs.roleOpponentIndex !== null) {
        const oppCs = readParticipantCsAtMark(
          obs.game,
          markKey,
          obs.roleOpponentIndex,
          "true_in_game_clock",
        );
        if (cs !== null && oppCs !== null) {
          validCsDiffValues.push(cs - oppCs);
        }

        const oppGold = readParticipantGoldAtMark(
          obs.game,
          markKey,
          obs.roleOpponentIndex,
          "true_in_game_clock",
        );
        if (gold !== null && oppGold !== null) {
          validGoldDiffValues.push(gold - oppGold);
        }
      }

      // Early Total Deaths: strictly exclude paused games
      if (isProGamePaused(obs.game)) {
        earlyDeathsPausedExcludedCount++;
      } else {
        const earlyDeathRead = readUnpausedParticipantEarlyDeathsAtMark(
          obs.game,
          markKey,
          obs.participantId,
        );
        if (
          earlyDeathRead.hasSnapshotInExport &&
          earlyDeathRead.deaths !== null
        ) {
          unpausedReachedWithExportCount++;
          validEarlyDeathsValues.push(earlyDeathRead.deaths);
        }
      }
    }

    const availableSnapshotCount = validCsEntries.length;
    const missingSnapshotAfterReachingDurationCount =
      gamesReached.length - availableSnapshotCount;

    const hudVerifiedObservationCount = validCsEntries.filter((entry) =>
      Boolean(VERIFIED_HUD_10M_VOD_BY_GAME_ID[entry.obs.game.gameId]),
    ).length;

    const availableGoldSnapshotCount = validGoldValues.length;
    const meanTotalGold =
      availableGoldSnapshotCount > 0
        ? roundToDecimals(
            validGoldValues.reduce((a, b) => a + b, 0) /
              availableGoldSnapshotCount,
            1,
          )
        : null;
    const minTotalGold =
      availableGoldSnapshotCount > 0 ? Math.min(...validGoldValues) : null;
    const maxTotalGold =
      availableGoldSnapshotCount > 0 ? Math.max(...validGoldValues) : null;

    const availableLevelSnapshotCount = validLevelValues.length;
    const meanLevel =
      availableLevelSnapshotCount > 0
        ? roundToDecimals(
            validLevelValues.reduce((a, b) => a + b, 0) /
              availableLevelSnapshotCount,
            1,
          )
        : null;
    const minLevel =
      availableLevelSnapshotCount > 0 ? Math.min(...validLevelValues) : null;
    const maxLevel =
      availableLevelSnapshotCount > 0 ? Math.max(...validLevelValues) : null;

    let roleOpponentDiffStatus: ProRoleOpponentDiffStatus;
    if (!isChampionAndRoleSpecific) {
      roleOpponentDiffStatus = "REQUIRES_CHAMPION_AND_ROLE_SLICE";
    } else if (validCsDiffValues.length > 0 || validGoldDiffValues.length > 0) {
      roleOpponentDiffStatus = "AVAILABLE";
    } else {
      roleOpponentDiffStatus = "UNAVAILABLE";
    }

    const availableCsDiffCount = isChampionAndRoleSpecific
      ? validCsDiffValues.length
      : 0;
    const meanCsDiffVsRoleOpponent =
      availableCsDiffCount > 0
        ? roundToDecimals(
            validCsDiffValues.reduce((a, b) => a + b, 0) / availableCsDiffCount,
            1,
          )
        : null;
    const minCsDiffVsRoleOpponent =
      availableCsDiffCount > 0 ? Math.min(...validCsDiffValues) : null;
    const maxCsDiffVsRoleOpponent =
      availableCsDiffCount > 0 ? Math.max(...validCsDiffValues) : null;

    const availableGoldDiffCount = isChampionAndRoleSpecific
      ? validGoldDiffValues.length
      : 0;
    const meanGoldDiffVsRoleOpponent =
      availableGoldDiffCount > 0
        ? roundToDecimals(
            validGoldDiffValues.reduce((a, b) => a + b, 0) /
              availableGoldDiffCount,
            1,
          )
        : null;
    const minGoldDiffVsRoleOpponent =
      availableGoldDiffCount > 0 ? Math.min(...validGoldDiffValues) : null;
    const maxGoldDiffVsRoleOpponent =
      availableGoldDiffCount > 0 ? Math.max(...validGoldDiffValues) : null;

    const earlyTotalDeathsAvailableCount = validEarlyDeathsValues.length;
    let earlyTotalDeathsStatus: "AVAILABLE" | "UNAVAILABLE" = "UNAVAILABLE";
    let earlyTotalDeathsUnavailableReason: EarlyDeathsUnavailableReason | null =
      null;
    let meanEarlyTotalDeaths: number | null = null;
    let minEarlyTotalDeaths: number | null = null;
    let maxEarlyTotalDeaths: number | null = null;

    if (earlyTotalDeathsAvailableCount > 0) {
      earlyTotalDeathsStatus = "AVAILABLE";
      meanEarlyTotalDeaths = roundToDecimals(
        validEarlyDeathsValues.reduce((a, b) => a + b, 0) /
          earlyTotalDeathsAvailableCount,
        2,
      );
      minEarlyTotalDeaths = Math.min(...validEarlyDeathsValues);
      maxEarlyTotalDeaths = Math.max(...validEarlyDeathsValues);
    } else if (totalSliceGames === 0) {
      earlyTotalDeathsUnavailableReason = "NO_GAMES_IN_SLICE";
    } else if (gamesReached.length === 0) {
      earlyTotalDeathsUnavailableReason = "ALL_GAMES_ENDED_BEFORE_MARK";
    } else if (
      earlyDeathsPausedExcludedCount === gamesReached.length &&
      gamesReached.length > 0
    ) {
      earlyTotalDeathsUnavailableReason = "ALL_REACHED_GAMES_PAUSED";
    } else if (unpausedReachedWithExportCount === 0) {
      earlyTotalDeathsUnavailableReason = "SNAPSHOT_NOT_EXPORTED_AT_MARK";
    }

    if (availableSnapshotCount > 0) {
      const csValues = validCsEntries.map((e) => e.cs);
      const sumCs = csValues.reduce((acc, v) => acc + v, 0);
      const meanTotalCs = roundToDecimals(sumCs / availableSnapshotCount, 1);
      const meanTotalCsPerMin = roundToDecimals(
        sumCs / availableSnapshotCount / minuteMark,
        2,
      );
      checkpoints[minuteMark] = {
        minuteMark,
        targetSeconds,
        status: "AVAILABLE",
        unavailableReason: null,
        totalSliceGames,
        gamesReachedDurationCount: gamesReached.length,
        shortGamesEndedBeforeMarkCount,
        availableSnapshotCount,
        missingSnapshotAfterReachingDurationCount,
        hudVerifiedObservationCount,
        meanTotalCs,
        meanTotalCsPerMin,
        minTotalCs: Math.min(...csValues),
        maxTotalCs: Math.max(...csValues),
        availableGoldSnapshotCount,
        meanTotalGold,
        minTotalGold,
        maxTotalGold,
        availableLevelSnapshotCount,
        meanLevel,
        minLevel,
        maxLevel,
        roleOpponentDiffStatus,
        availableCsDiffCount,
        meanCsDiffVsRoleOpponent,
        minCsDiffVsRoleOpponent,
        maxCsDiffVsRoleOpponent,
        availableGoldDiffCount,
        meanGoldDiffVsRoleOpponent,
        minGoldDiffVsRoleOpponent,
        maxGoldDiffVsRoleOpponent,
        earlyTotalDeathsStatus,
        earlyTotalDeathsUnavailableReason,
        earlyTotalDeathsPausedGamesExcludedCount:
          earlyDeathsPausedExcludedCount,
        earlyTotalDeathsAvailableCount,
        meanEarlyTotalDeaths,
        minEarlyTotalDeaths,
        maxEarlyTotalDeaths,
      };
    } else {
      let unavailableReason: CheckpointUnavailableReason = "NO_GAMES_IN_SLICE";
      if (totalSliceGames > 0) {
        unavailableReason =
          gamesReached.length === 0
            ? "ALL_GAMES_ENDED_BEFORE_MARK"
            : "SNAPSHOT_NOT_EXPORTED_AT_MARK";
      }
      checkpoints[minuteMark] = {
        minuteMark,
        targetSeconds,
        status: "UNAVAILABLE",
        unavailableReason,
        totalSliceGames,
        gamesReachedDurationCount: gamesReached.length,
        shortGamesEndedBeforeMarkCount,
        availableSnapshotCount: 0,
        missingSnapshotAfterReachingDurationCount,
        hudVerifiedObservationCount: 0,
        meanTotalCs: null,
        meanTotalCsPerMin: null,
        minTotalCs: null,
        maxTotalCs: null,
        availableGoldSnapshotCount,
        meanTotalGold,
        minTotalGold,
        maxTotalGold,
        availableLevelSnapshotCount,
        meanLevel,
        minLevel,
        maxLevel,
        roleOpponentDiffStatus,
        availableCsDiffCount,
        meanCsDiffVsRoleOpponent,
        minCsDiffVsRoleOpponent,
        maxCsDiffVsRoleOpponent,
        availableGoldDiffCount,
        meanGoldDiffVsRoleOpponent,
        minGoldDiffVsRoleOpponent,
        maxGoldDiffVsRoleOpponent,
        earlyTotalDeathsStatus,
        earlyTotalDeathsUnavailableReason,
        earlyTotalDeathsPausedGamesExcludedCount:
          earlyDeathsPausedExcludedCount,
        earlyTotalDeathsAvailableCount,
        meanEarlyTotalDeaths,
        minEarlyTotalDeaths,
        maxEarlyTotalDeaths,
      };
    }
  }

  // Secondary 14m summary (present in dataset)
  const valid14mCs: number[] = [];
  const valid14mGold: number[] = [];
  const valid14mLevel: number[] = [];
  const valid14mCsDiff: number[] = [];
  const valid14mGoldDiff: number[] = [];
  const valid14mEarlyDeaths: number[] = [];
  let paused14mExcluded = 0;

  for (const obs of matched) {
    if (obs.game.true_in_game_duration_s >= 14 * 60) {
      const cs14 = readParticipantCsAtMark(
        obs.game,
        "14m",
        obs.participantIndex,
        "true_in_game_clock",
      );
      if (cs14 !== null) valid14mCs.push(cs14);

      const gold14 = readParticipantGoldAtMark(
        obs.game,
        "14m",
        obs.participantIndex,
        "true_in_game_clock",
      );
      if (gold14 !== null) valid14mGold.push(gold14);

      const level14 = readParticipantLevelAtMark(
        obs.game,
        "14m",
        obs.participantIndex,
        "true_in_game_clock",
      );
      if (level14 !== null) valid14mLevel.push(level14);

      if (isChampionAndRoleSpecific && obs.roleOpponentIndex !== null) {
        const oppCs14 = readParticipantCsAtMark(
          obs.game,
          "14m",
          obs.roleOpponentIndex,
          "true_in_game_clock",
        );
        if (cs14 !== null && oppCs14 !== null) {
          valid14mCsDiff.push(cs14 - oppCs14);
        }
        const oppGold14 = readParticipantGoldAtMark(
          obs.game,
          "14m",
          obs.roleOpponentIndex,
          "true_in_game_clock",
        );
        if (gold14 !== null && oppGold14 !== null) {
          valid14mGoldDiff.push(gold14 - oppGold14);
        }
      }

      if (isProGamePaused(obs.game)) {
        paused14mExcluded++;
      } else {
        const d14 = readUnpausedParticipantEarlyDeathsAtMark(
          obs.game,
          "14m",
          obs.participantId,
        );
        if (d14.hasSnapshotInExport && d14.deaths !== null) {
          valid14mEarlyDeaths.push(d14.deaths);
        }
      }
    }
  }

  // Whole-game metrics summary across matched observations
  const kpValues: number[] = [];
  const dmgShareValues: number[] = [];
  const wpmValues: number[] = [];
  const wcpmValues: number[] = [];

  for (const obs of matched) {
    const p = obs.participant;
    if (
      typeof p.killParticipation === "number" &&
      Number.isFinite(p.killParticipation) &&
      p.killParticipation >= 0 &&
      p.killParticipation <= 1
    ) {
      kpValues.push(p.killParticipation);
    }
    if (
      typeof p.championDamageShare === "number" &&
      Number.isFinite(p.championDamageShare) &&
      p.championDamageShare >= 0 &&
      p.championDamageShare <= 1
    ) {
      dmgShareValues.push(p.championDamageShare);
    }
    const durMin = obs.game.true_in_game_duration_s / 60;
    if (Number.isFinite(durMin) && durMin > 0) {
      if (isFiniteNonNegative(p.wardsPlaced)) {
        wpmValues.push(p.wardsPlaced / durMin);
      }
      if (isFiniteNonNegative(p.wardsDestroyed)) {
        wcpmValues.push(p.wardsDestroyed / durMin);
      }
    }
  }

  const wholeGameSummary = {
    totalSliceGames: matched.length,
    killParticipation: summarizeNumericValues(kpValues, 4),
    championDamageShare: summarizeNumericValues(dmgShareValues, 4),
    wardsPlacedPerMin: summarizeNumericValues(wpmValues, 2),
    wardsDestroyedPerMin: summarizeNumericValues(wcpmValues, 2),
  };

  const evidenceRows: ProGameEvidenceRow[] = matched.map((obs) => {
    const gamePaused = isProGamePaused(obs.game);
    const rowCheckpoints = {} as Record<
      ProCheckpointMinute,
      ProObservationCheckpointCell
    >;
    for (const minuteMark of PRO_CHECKPOINT_MINUTES) {
      const targetSeconds = minuteMark * 60;
      const markKey = `${minuteMark}m`;
      const reachedDuration = obs.game.true_in_game_duration_s >= targetSeconds;
      const totalCs = reachedDuration
        ? readParticipantCsAtMark(
            obs.game,
            markKey,
            obs.participantIndex,
            "true_in_game_clock",
          )
        : null;
      const naiveTotalCs = reachedDuration
        ? readParticipantCsAtMark(
            obs.game,
            markKey,
            obs.participantIndex,
            "naive_first_frame",
          )
        : null;
      const totalGold = reachedDuration
        ? readParticipantGoldAtMark(
            obs.game,
            markKey,
            obs.participantIndex,
            "true_in_game_clock",
          )
        : null;
      const level = reachedDuration
        ? readParticipantLevelAtMark(
            obs.game,
            markKey,
            obs.participantIndex,
            "true_in_game_clock",
          )
        : null;

      let csDiffVsRoleOpponent: number | null = null;
      let goldDiffVsRoleOpponent: number | null = null;
      if (reachedDuration && obs.roleOpponentIndex !== null) {
        const oppCs = readParticipantCsAtMark(
          obs.game,
          markKey,
          obs.roleOpponentIndex,
          "true_in_game_clock",
        );
        if (totalCs !== null && oppCs !== null) {
          csDiffVsRoleOpponent = totalCs - oppCs;
        }
        const oppGold = readParticipantGoldAtMark(
          obs.game,
          markKey,
          obs.roleOpponentIndex,
          "true_in_game_clock",
        );
        if (totalGold !== null && oppGold !== null) {
          goldDiffVsRoleOpponent = totalGold - oppGold;
        }
      }

      let earlyTotalDeaths: number | null = null;
      const earlyTotalDeathsExcludedByPause = reachedDuration && gamePaused;
      if (reachedDuration && !gamePaused) {
        const earlyDeathRead = readUnpausedParticipantEarlyDeathsAtMark(
          obs.game,
          markKey,
          obs.participantId,
        );
        if (earlyDeathRead.hasSnapshotInExport) {
          earlyTotalDeaths = earlyDeathRead.deaths;
        }
      }

      const hasExportedSnapshot = totalCs !== null;

      let statusLabel: string;
      if (hasExportedSnapshot) {
        statusLabel = `${totalCs} CS`;
      } else if (!reachedDuration) {
        statusLabel = `Ended at ${formatDurationMmSs(
          obs.game.true_in_game_duration_s,
        )} (<${minuteMark}m)`;
      } else {
        statusLabel = "Unavailable (not in JSON export)";
      }

      rowCheckpoints[minuteMark] = {
        minuteMark,
        reachedDuration,
        hasExportedSnapshot,
        totalCs,
        naiveTotalCs,
        totalGold,
        level,
        csDiffVsRoleOpponent,
        goldDiffVsRoleOpponent,
        earlyTotalDeaths,
        earlyTotalDeathsExcludedByPause,
        statusLabel,
      };
    }

    const reached14m = obs.game.true_in_game_duration_s >= 14 * 60;
    const csAt14m = reached14m
      ? readParticipantCsAtMark(
          obs.game,
          "14m",
          obs.participantIndex,
          "true_in_game_clock",
        )
      : null;
    const goldAt14m = reached14m
      ? readParticipantGoldAtMark(
          obs.game,
          "14m",
          obs.participantIndex,
          "true_in_game_clock",
        )
      : null;
    const levelAt14m = reached14m
      ? readParticipantLevelAtMark(
          obs.game,
          "14m",
          obs.participantIndex,
          "true_in_game_clock",
        )
      : null;
    let csDiffAt14m: number | null = null;
    let goldDiffAt14m: number | null = null;
    if (reached14m && obs.roleOpponentIndex !== null) {
      const oppCs14 = readParticipantCsAtMark(
        obs.game,
        "14m",
        obs.roleOpponentIndex,
        "true_in_game_clock",
      );
      if (csAt14m !== null && oppCs14 !== null) {
        csDiffAt14m = csAt14m - oppCs14;
      }
      const oppGold14 = readParticipantGoldAtMark(
        obs.game,
        "14m",
        obs.roleOpponentIndex,
        "true_in_game_clock",
      );
      if (goldAt14m !== null && oppGold14 !== null) {
        goldDiffAt14m = goldAt14m - oppGold14;
      }
    }
    const earlyTotalDeathsAt14m =
      reached14m && !gamePaused
        ? readUnpausedParticipantEarlyDeathsAtMark(
            obs.game,
            "14m",
            obs.participantId,
          ).deaths
        : null;

    const durMin = obs.game.true_in_game_duration_s / 60;
    const wardsPlaced = isFiniteNonNegative(obs.participant.wardsPlaced)
      ? obs.participant.wardsPlaced
      : null;
    const wardsDestroyed = isFiniteNonNegative(obs.participant.wardsDestroyed)
      ? obs.participant.wardsDestroyed
      : null;
    const wardsPlacedPerMin =
      wardsPlaced !== null && durMin > 0
        ? roundToDecimals(wardsPlaced / durMin, 2)
        : null;
    const wardsDestroyedPerMin =
      wardsDestroyed !== null && durMin > 0
        ? roundToDecimals(wardsDestroyed / durMin, 2)
        : null;

    const verifiedHud = VERIFIED_HUD_10M_VOD_BY_GAME_ID[obs.game.gameId];

    return {
      observationKey: `${obs.game.gameId}-P${obs.participantId}`,
      gameId: obs.game.gameId,
      gameLabel: obs.game.label,
      patch: obs.game.patch,
      participantId: obs.participantId,
      esportsPlayerId: obs.participant.esportsPlayerId,
      summonerName: obs.summonerName,
      championId: obs.championId,
      role: obs.role,
      side: obs.side,
      roleOpponentSummonerName: obs.roleOpponent?.summonerName ?? null,
      roleOpponentChampionId: obs.roleOpponent?.championId ?? null,
      trueInGameDurationSeconds: obs.game.true_in_game_duration_s,
      trueInGameDurationFormatted: formatDurationMmSs(
        obs.game.true_in_game_duration_s,
      ),
      totalPauseSeconds: obs.game.total_pause_s,
      pauseHeuristicNote:
        obs.game.total_pause_s > 0
          ? `${obs.game.total_pause_s.toFixed(2)}s pause subtracted (zero-gold freeze heuristic)`
          : null,
      checkpoints: rowCheckpoints,
      csAt14m,
      goldAt14m,
      levelAt14m,
      csDiffAt14m,
      goldDiffAt14m,
      earlyTotalDeathsAt14m,
      finalCsAtGameEnd: obs.finalCs,
      finalGoldAtGameEnd: obs.finalGold,
      finalLevelAtGameEnd: obs.finalLevel,
      finalKills: obs.finalKills,
      finalDeaths: obs.finalDeaths,
      finalAssists: obs.finalAssists,
      killParticipation:
        typeof obs.participant.killParticipation === "number" &&
        Number.isFinite(obs.participant.killParticipation)
          ? obs.participant.killParticipation
          : null,
      championDamageShare:
        typeof obs.participant.championDamageShare === "number" &&
        Number.isFinite(obs.participant.championDamageShare)
          ? obs.participant.championDamageShare
          : null,
      wardsPlaced,
      wardsDestroyed,
      wardsPlacedPerMin,
      wardsDestroyedPerMin,
      hudVerification: verifiedHud
        ? {
            isCs10HudVerified: true,
            correctedHud10mUrl: verifiedHud.correctedHud10mUrl,
            verificationBadgeText: "CS@10 HUD Verified (IG vs TES)",
            vodOffsetCaveatText: verifiedHud.verificationScopeNote,
          }
        : {
            isCs10HudVerified: false,
            correctedHud10mUrl: null,
            verificationBadgeText: "Not HUD Verified (Feed-Derived Only)",
            vodOffsetCaveatText:
              "Independent broadcast HUD check covered only IG vs TES G1+G2 CS@10; raw dataset VOD locator is uncalibrated (~73–74s early in G1+G2).",
          },
    };
  });

  const uniqueGameIds = new Set(matched.map((m) => m.game.gameId));
  const hudVerifiedGamesInSliceCount = Array.from(uniqueGameIds).filter((gid) =>
    Boolean(VERIFIED_HUD_10M_VOD_BY_GAME_ID[gid]),
  ).length;
  const hudVerifiedObservationsInSliceCount = matched.filter((m) =>
    Boolean(VERIFIED_HUD_10M_VOD_BY_GAME_ID[m.game.gameId]),
  ).length;

  const playersInSlice = Array.from(
    new Set(matched.map((m) => m.summonerName)),
  ).sort((a, b) => a.localeCompare(b));

  const roleTitle = formatRoleDisplay(normalizedRole);
  const proFilterLabel =
    normalizedProPlayerQuery === "ALL"
      ? ""
      : ` · ${resolvedProPlayer?.summonerName ?? normalizedProPlayerQuery}`;
  const selectionTitle =
    normalizedChamp === "ALL"
      ? `${roleTitle} · All Supported Champions in Sample${proFilterLabel}`
      : `${roleTitle} · ${canonicalChampName}${proFilterLabel}`;

  const selectionSubtitle = isSupportedSelection
    ? `${matched.length} pro player-game${matched.length === 1 ? "" : "s"} across ${
        uniqueGameIds.size
      } Worlds 2026 match${uniqueGameIds.size === 1 ? "" : "es"} (${playersInSlice.join(
        ", ",
      )})`
    : (unsupportedReason ?? "No matching sample observations.");

  const patchVersion = dataset.patchVersion ?? "16.20.826.3891";
  const patchShort = patchVersion.split(".").slice(0, 2).join(".");

  return {
    filter: {
      role: normalizedRole,
      championId: normalizedChamp === "ALL" ? "ALL" : canonicalChampName,
      ...(filter.proPlayerId !== undefined
        ? { proPlayerId: selectedProPlayerId }
        : {}),
    },
    selectedProPlayerId,
    resolvedProPlayer,
    isProPlayerFoundInDataset,
    selectableProPlayersForSlice,
    selectableProPlayersForRole,
    isSupportedSelection,
    unsupportedReason,
    alternateRolesForChampion,
    selectionTitle,
    selectionSubtitle,
    totalGamesInDataset: dataset.games?.length ?? 0,
    totalObservationsInDataset: (dataset.games ?? []).reduce(
      (acc, g) => acc + Object.keys(g.participants ?? {}).length,
      0,
    ),
    totalRoleChampionPairsInDataset: allOptions.length,
    reportClaimedRoleChampionPairs: 57,
    patchVersion,
    patchShort,
    ddragonVersionUsedInIngest: dataset.ddragonVersion ?? "16.22.1",
    matchingObservationCount: matched.length,
    uniqueGamesInSliceCount: uniqueGameIds.size,
    hudVerifiedGamesInSliceCount,
    hudVerifiedObservationsInSliceCount,
    playersInSlice,
    checkpoints,
    optional14mSummary: {
      availableSnapshotCount: valid14mCs.length,
      meanTotalCs:
        valid14mCs.length > 0
          ? roundToDecimals(
              valid14mCs.reduce((a, b) => a + b, 0) / valid14mCs.length,
              1,
            )
          : null,
      minTotalCs: valid14mCs.length > 0 ? Math.min(...valid14mCs) : null,
      maxTotalCs: valid14mCs.length > 0 ? Math.max(...valid14mCs) : null,
      availableGoldSnapshotCount: valid14mGold.length,
      meanTotalGold:
        valid14mGold.length > 0
          ? roundToDecimals(
              valid14mGold.reduce((a, b) => a + b, 0) / valid14mGold.length,
              1,
            )
          : null,
      minTotalGold: valid14mGold.length > 0 ? Math.min(...valid14mGold) : null,
      maxTotalGold: valid14mGold.length > 0 ? Math.max(...valid14mGold) : null,
      availableLevelSnapshotCount: valid14mLevel.length,
      meanLevel:
        valid14mLevel.length > 0
          ? roundToDecimals(
              valid14mLevel.reduce((a, b) => a + b, 0) / valid14mLevel.length,
              1,
            )
          : null,
      minLevel: valid14mLevel.length > 0 ? Math.min(...valid14mLevel) : null,
      maxLevel: valid14mLevel.length > 0 ? Math.max(...valid14mLevel) : null,
      roleOpponentDiffStatus: !isChampionAndRoleSpecific
        ? "REQUIRES_CHAMPION_AND_ROLE_SLICE"
        : valid14mCsDiff.length > 0 || valid14mGoldDiff.length > 0
          ? "AVAILABLE"
          : "UNAVAILABLE",
      availableCsDiffCount: isChampionAndRoleSpecific
        ? valid14mCsDiff.length
        : 0,
      meanCsDiffVsRoleOpponent:
        isChampionAndRoleSpecific && valid14mCsDiff.length > 0
          ? roundToDecimals(
              valid14mCsDiff.reduce((a, b) => a + b, 0) / valid14mCsDiff.length,
              1,
            )
          : null,
      minCsDiffVsRoleOpponent:
        isChampionAndRoleSpecific && valid14mCsDiff.length > 0
          ? Math.min(...valid14mCsDiff)
          : null,
      maxCsDiffVsRoleOpponent:
        isChampionAndRoleSpecific && valid14mCsDiff.length > 0
          ? Math.max(...valid14mCsDiff)
          : null,
      availableGoldDiffCount: isChampionAndRoleSpecific
        ? valid14mGoldDiff.length
        : 0,
      meanGoldDiffVsRoleOpponent:
        isChampionAndRoleSpecific && valid14mGoldDiff.length > 0
          ? roundToDecimals(
              valid14mGoldDiff.reduce((a, b) => a + b, 0) /
                valid14mGoldDiff.length,
              1,
            )
          : null,
      minGoldDiffVsRoleOpponent:
        isChampionAndRoleSpecific && valid14mGoldDiff.length > 0
          ? Math.min(...valid14mGoldDiff)
          : null,
      maxGoldDiffVsRoleOpponent:
        isChampionAndRoleSpecific && valid14mGoldDiff.length > 0
          ? Math.max(...valid14mGoldDiff)
          : null,
      earlyTotalDeathsPausedGamesExcludedCount: paused14mExcluded,
      earlyTotalDeathsAvailableCount: valid14mEarlyDeaths.length,
      meanEarlyTotalDeaths:
        valid14mEarlyDeaths.length > 0
          ? roundToDecimals(
              valid14mEarlyDeaths.reduce((a, b) => a + b, 0) /
                valid14mEarlyDeaths.length,
              2,
            )
          : null,
      minEarlyTotalDeaths:
        valid14mEarlyDeaths.length > 0
          ? Math.min(...valid14mEarlyDeaths)
          : null,
      maxEarlyTotalDeaths:
        valid14mEarlyDeaths.length > 0
          ? Math.max(...valid14mEarlyDeaths)
          : null,
    },
    wholeGameSummary,
    unavailableRequestedMetrics: getUnavailableRequestedMetrics(),
    evidenceRows,
  };
}

/**
 * Evaluates optional synthetic/manual Demo CS inputs against the pro sample slice.
 * Never produces percentiles, confidence intervals, or rank claims, and clearly labels
 * every output as Demo-Only.
 */
export function evaluateDemoCsComparisons(
  slice: ProSliceComputationResult,
  demoInputs: DemoCsInputMap,
): Record<ProCheckpointMinute, DemoCheckpointComparison> {
  const result = {} as Record<ProCheckpointMinute, DemoCheckpointComparison>;

  for (const minuteMark of PRO_CHECKPOINT_MINUTES) {
    const rawInput = (demoInputs[minuteMark] ?? "").trim();
    const checkpoint = slice.checkpoints[minuteMark];

    if (rawInput === "") {
      result[minuteMark] = {
        minuteMark,
        rawInput: "",
        parsedDemoCs: null,
        canCompare: false,
        deltaCs: null,
        formattedDelta: "No demo value entered",
        statusMessage:
          checkpoint.status === "AVAILABLE"
            ? "Enter a manual demo CS value to see raw arithmetic difference vs sample mean."
            : "Pro sample snapshot unavailable at this minute mark.",
        isDemoOnly: true,
      };
      continue;
    }

    const parsed = Number(rawInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      result[minuteMark] = {
        minuteMark,
        rawInput,
        parsedDemoCs: null,
        canCompare: false,
        deltaCs: null,
        formattedDelta: "Invalid demo input",
        statusMessage: "Enter a non-negative CS number (Demo Only).",
        isDemoOnly: true,
      };
      continue;
    }

    if (checkpoint.status !== "AVAILABLE" || checkpoint.meanTotalCs === null) {
      result[minuteMark] = {
        minuteMark,
        rawInput,
        parsedDemoCs: parsed,
        canCompare: false,
        deltaCs: null,
        formattedDelta: "Comparison Unavailable",
        statusMessage:
          checkpoint.unavailableReason === "SNAPSHOT_NOT_EXPORTED_AT_MARK"
            ? `Cannot compare at ${minuteMark}m: pro sample dataset does not include a ${minuteMark}m snapshot.`
            : `Cannot compare at ${minuteMark}m: 0 pro sample games reached ${minuteMark}:00.`,
        isDemoOnly: true,
      };
      continue;
    }

    const delta = roundToDecimals(parsed - checkpoint.meanTotalCs, 1);
    const sign = delta > 0 ? "+" : "";
    result[minuteMark] = {
      minuteMark,
      rawInput,
      parsedDemoCs: parsed,
      canCompare: true,
      deltaCs: delta,
      formattedDelta: `${sign}${delta.toFixed(1)} CS vs pro sample mean`,
      statusMessage: `Demo CS (${parsed}) minus ${checkpoint.availableSnapshotCount}-game pro sample mean (${checkpoint.meanTotalCs.toFixed(
        1,
      )}) — Demo Only, not live player data.`,
      isDemoOnly: true,
    };
  }

  return result;
}
