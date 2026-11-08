import sampleDatasetJson from './data/pro_benchmark_sample_baselines.json';
import {
  PRO_CHECKPOINT_MINUTES,
  type CheckpointUnavailableReason,
  type DemoCheckpointComparison,
  type DemoCsInputMap,
  type ProCheckpointMinute,
  type ProCheckpointSummary,
  type ProComparisonFilter,
  type ProGameEvidenceRow,
  type ProObservationCheckpointCell,
  type ProRoleFilter,
  type ProRoleKey,
  type ProSliceComputationResult,
  type RawProBenchmarkDataset,
  type RawProBenchmarkGame,
  type SupportedRoleChampionOption,
  type VerifiedHudVodInfo,
} from './proBenchmarkTypes';

export const DEFAULT_PRO_BENCHMARK_DATASET: RawProBenchmarkDataset =
  sampleDatasetJson as unknown as RawProBenchmarkDataset;

export const PRO_ROLE_ORDER: readonly ProRoleKey[] = [
  'top',
  'jungle',
  'mid',
  'bottom',
  'support',
] as const;

export const PRO_ROLE_LABELS: Record<ProRoleFilter, string> = {
  ALL: 'All Roles',
  top: 'Top',
  jungle: 'Jungle',
  mid: 'Mid',
  bottom: 'Bottom',
  support: 'Support',
};

/**
 * Independent broadcast HUD verification was completed ONLY for CS@10 across
 * the 20 player-observations in IG vs TES Game 1 and Game 2.
 * The dataset's automated VOD locator formula was ~73-74s early on those two games.
 */
export const VERIFIED_HUD_10M_VOD_BY_GAME_ID: Record<string, VerifiedHudVodInfo> = {
  '115660540726095110': {
    gameId: '115660540726095110',
    gameLabel: 'IG vs TES G1',
    correctedHud10mUrl: 'https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=3695s',
    correctedHud10mSeconds: 3695,
    rawDatasetLocatorSeconds: 3622,
    earlyOffsetSeconds: 73,
    verificationScopeNote:
      'Independent HUD check verified CS@10 for all 10 players at t=3695s (dataset VOD locator was ~73s early at 3622s; pause adjustment uses 105.02s zero-gold freeze heuristic).',
  },
  '115660540726095111': {
    gameId: '115660540726095111',
    gameLabel: 'IG vs TES G2',
    correctedHud10mUrl: 'https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=6759s',
    correctedHud10mSeconds: 6759,
    rawDatasetLocatorSeconds: 6685,
    earlyOffsetSeconds: 74,
    verificationScopeNote:
      'Independent HUD check verified CS@10 for all 10 players at t=6759s (dataset VOD locator was ~74s early at 6685s).',
  },
};

export function formatDurationMmSs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unavailable';
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  roleFilter: ProRoleFilter = 'ALL'
): SupportedRoleChampionOption[] {
  const map = new Map<
    string,
    { role: ProRoleKey; championId: string; count: number; players: Set<string> }
  >();

  for (const game of dataset.games ?? []) {
    for (const pidKey of Object.keys(game.participants ?? {})) {
      const p = game.participants[pidKey];
      if (!p) continue;
      if (roleFilter !== 'ALL' && p.role !== roleFilter) continue;
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
        a.championId.localeCompare(b.championId)
    );
}

export function getAllUniqueChampionsInDataset(
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET
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

interface MatchedParticipantObservation {
  game: RawProBenchmarkGame;
  participantId: number;
  participantIndex: number; // 0..9 in pCs array
  summonerName: string;
  championId: string;
  role: ProRoleKey;
  side: 'blue' | 'red';
  finalCs: number;
  finalKills: number;
  finalDeaths: number;
  finalAssists: number;
}

function readParticipantCsAtMark(
  game: RawProBenchmarkGame,
  markKey: string,
  participantIndex: number,
  clockMode: 'true_in_game_clock' | 'naive_first_frame' = 'true_in_game_clock'
): number | null {
  const checkpoint = game.aligned_checkpoints?.[markKey];
  if (!checkpoint) return null;
  const arr = checkpoint[clockMode]?.pCs;
  if (!Array.isArray(arr) || participantIndex < 0 || participantIndex >= arr.length) {
    return null;
  }
  const val = arr[participantIndex];
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

/**
 * Computes the pro-comparison slice for a given role & champion filter.
 * Strictly enforces:
 * - Only actual games reaching a minute checkpoint and having an exported snapshot
 *   contribute to that checkpoint's mean and denominator.
 * - Never substitutes 0 after a game ends.
 * - Clearly distinguishes between games that ended before a checkpoint vs
 *   checkpoints not exported in the sample dataset (such as 30m).
 */
export function computeProComparisonSlice(
  dataset: RawProBenchmarkDataset = DEFAULT_PRO_BENCHMARK_DATASET,
  filter: ProComparisonFilter = { role: 'top', championId: 'KSante' }
): ProSliceComputationResult {
  const normalizedRole: ProRoleFilter = filter.role;
  const trimmedChamp = filter.championId.trim();
  const normalizedChamp =
    trimmedChamp === '' || trimmedChamp.toUpperCase() === 'ALL' ? 'ALL' : trimmedChamp;

  const allOptions = getSupportedRoleChampionOptions(dataset, 'ALL');
  const matched: MatchedParticipantObservation[] = [];

  for (const game of dataset.games ?? []) {
    const sortedPids = Object.keys(game.participants ?? {})
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    for (const pid of sortedPids) {
      const p = game.participants[String(pid)];
      if (!p) continue;
      const roleMatch = normalizedRole === 'ALL' || p.role === normalizedRole;
      const champMatch =
        normalizedChamp === 'ALL' ||
        p.championId.toLowerCase() === normalizedChamp.toLowerCase();

      if (roleMatch && champMatch) {
        matched.push({
          game,
          participantId: p.participantId,
          participantIndex: p.participantId - 1,
          summonerName: p.summonerName,
          championId: p.championId,
          role: p.role,
          side: p.side,
          finalCs: p.finalCs,
          finalKills: p.finalKills,
          finalDeaths: p.finalDeaths,
          finalAssists: p.finalAssists,
        });
      }
    }
  }

  const alternateRolesForChampion =
    normalizedChamp === 'ALL'
      ? []
      : allOptions.filter(
          (opt) =>
            opt.championId.toLowerCase() === normalizedChamp.toLowerCase() &&
            (normalizedRole === 'ALL' || opt.role !== normalizedRole)
        );

  const canonicalChampName =
    matched[0]?.championId ??
    alternateRolesForChampion[0]?.championId ??
    normalizedChamp;

  const isSupportedSelection = matched.length > 0;
  let unsupportedReason: string | null = null;

  if (!isSupportedSelection) {
    if (normalizedChamp !== 'ALL' && alternateRolesForChampion.length > 0) {
      const rolesList = alternateRolesForChampion
        .map((opt) => `${formatRoleDisplay(opt.role)} (n=${opt.sampleCount})`)
        .join(', ');
      unsupportedReason = `${canonicalChampName} has 0 games in ${formatRoleDisplay(
        normalizedRole
      )} in this 8-game Worlds 2026 sample, but is present in: ${rolesList}.`;
    } else if (normalizedChamp !== 'ALL') {
      unsupportedReason = `"${normalizedChamp}" is not among the ${allOptions.length} champion-role pairs in this 8-game (80 player-game) Worlds 2026 sample dataset.`;
    } else {
      unsupportedReason = `No player-game observations match ${formatRoleDisplay(
        normalizedRole
      )} in this sample dataset.`;
    }
  }

  const checkpoints = {} as Record<ProCheckpointMinute, ProCheckpointSummary>;

  for (const minuteMark of PRO_CHECKPOINT_MINUTES) {
    const targetSeconds = minuteMark * 60;
    const markKey = `${minuteMark}m`;

    const totalSliceGames = matched.length;
    const gamesReached = matched.filter(
      (obs) => obs.game.true_in_game_duration_s >= targetSeconds
    );
    const shortGamesEndedBeforeMarkCount = totalSliceGames - gamesReached.length;

    const validCsEntries: Array<{ obs: MatchedParticipantObservation; cs: number }> = [];
    for (const obs of gamesReached) {
      const cs = readParticipantCsAtMark(
        obs.game,
        markKey,
        obs.participantIndex,
        'true_in_game_clock'
      );
      if (cs !== null) {
        validCsEntries.push({ obs, cs });
      }
    }

    const availableSnapshotCount = validCsEntries.length;
    const missingSnapshotAfterReachingDurationCount =
      gamesReached.length - availableSnapshotCount;

    const hudVerifiedObservationCount = validCsEntries.filter((entry) =>
      Boolean(VERIFIED_HUD_10M_VOD_BY_GAME_ID[entry.obs.game.gameId])
    ).length;

    if (availableSnapshotCount > 0) {
      const csValues = validCsEntries.map((e) => e.cs);
      const sumCs = csValues.reduce((acc, v) => acc + v, 0);
      const meanTotalCs = roundToDecimals(sumCs / availableSnapshotCount, 1);
      const meanTotalCsPerMin = roundToDecimals(
        sumCs / availableSnapshotCount / minuteMark,
        2
      );
      checkpoints[minuteMark] = {
        minuteMark,
        targetSeconds,
        status: 'AVAILABLE',
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
      };
    } else {
      let unavailableReason: CheckpointUnavailableReason = 'NO_GAMES_IN_SLICE';
      if (totalSliceGames > 0) {
        unavailableReason =
          gamesReached.length === 0
            ? 'ALL_GAMES_ENDED_BEFORE_MARK'
            : 'SNAPSHOT_NOT_EXPORTED_AT_MARK';
      }
      checkpoints[minuteMark] = {
        minuteMark,
        targetSeconds,
        status: 'UNAVAILABLE',
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
      };
    }
  }

  // Secondary 14m summary (present in dataset)
  const valid14m: number[] = [];
  for (const obs of matched) {
    if (obs.game.true_in_game_duration_s >= 14 * 60) {
      const cs14 = readParticipantCsAtMark(
        obs.game,
        '14m',
        obs.participantIndex,
        'true_in_game_clock'
      );
      if (cs14 !== null) valid14m.push(cs14);
    }
  }

  const evidenceRows: ProGameEvidenceRow[] = matched.map((obs) => {
    const rowCheckpoints = {} as Record<ProCheckpointMinute, ProObservationCheckpointCell>;
    for (const minuteMark of PRO_CHECKPOINT_MINUTES) {
      const targetSeconds = minuteMark * 60;
      const markKey = `${minuteMark}m`;
      const reachedDuration = obs.game.true_in_game_duration_s >= targetSeconds;
      const totalCs = reachedDuration
        ? readParticipantCsAtMark(
            obs.game,
            markKey,
            obs.participantIndex,
            'true_in_game_clock'
          )
        : null;
      const naiveTotalCs = reachedDuration
        ? readParticipantCsAtMark(
            obs.game,
            markKey,
            obs.participantIndex,
            'naive_first_frame'
          )
        : null;
      const hasExportedSnapshot = totalCs !== null;

      let statusLabel: string;
      if (hasExportedSnapshot) {
        statusLabel = `${totalCs} CS`;
      } else if (!reachedDuration) {
        statusLabel = `Ended at ${formatDurationMmSs(
          obs.game.true_in_game_duration_s
        )} (<${minuteMark}m)`;
      } else {
        statusLabel = 'Unavailable (not in JSON export)';
      }

      rowCheckpoints[minuteMark] = {
        minuteMark,
        reachedDuration,
        hasExportedSnapshot,
        totalCs,
        naiveTotalCs,
        statusLabel,
      };
    }

    const csAt14m =
      obs.game.true_in_game_duration_s >= 14 * 60
        ? readParticipantCsAtMark(
            obs.game,
            '14m',
            obs.participantIndex,
            'true_in_game_clock'
          )
        : null;

    const verifiedHud = VERIFIED_HUD_10M_VOD_BY_GAME_ID[obs.game.gameId];

    return {
      observationKey: `${obs.game.gameId}-P${obs.participantId}`,
      gameId: obs.game.gameId,
      gameLabel: obs.game.label,
      patch: obs.game.patch,
      participantId: obs.participantId,
      summonerName: obs.summonerName,
      championId: obs.championId,
      role: obs.role,
      side: obs.side,
      trueInGameDurationSeconds: obs.game.true_in_game_duration_s,
      trueInGameDurationFormatted: formatDurationMmSs(obs.game.true_in_game_duration_s),
      totalPauseSeconds: obs.game.total_pause_s,
      pauseHeuristicNote:
        obs.game.total_pause_s > 0
          ? `${obs.game.total_pause_s.toFixed(2)}s pause subtracted (zero-gold freeze heuristic)`
          : null,
      checkpoints: rowCheckpoints,
      csAt14m,
      finalCsAtGameEnd: obs.finalCs,
      finalKills: obs.finalKills,
      finalDeaths: obs.finalDeaths,
      finalAssists: obs.finalAssists,
      hudVerification: verifiedHud
        ? {
            isCs10HudVerified: true,
            correctedHud10mUrl: verifiedHud.correctedHud10mUrl,
            verificationBadgeText: 'CS@10 HUD Verified (IG vs TES)',
            vodOffsetCaveatText: verifiedHud.verificationScopeNote,
          }
        : {
            isCs10HudVerified: false,
            correctedHud10mUrl: null,
            verificationBadgeText: 'Not HUD Verified (Feed-Derived Only)',
            vodOffsetCaveatText:
              'Independent broadcast HUD check covered only IG vs TES G1+G2 CS@10; raw dataset VOD locator is uncalibrated (~73–74s early in G1+G2).',
          },
    };
  });

  const uniqueGameIds = new Set(matched.map((m) => m.game.gameId));
  const hudVerifiedGamesInSliceCount = Array.from(uniqueGameIds).filter((gid) =>
    Boolean(VERIFIED_HUD_10M_VOD_BY_GAME_ID[gid])
  ).length;
  const hudVerifiedObservationsInSliceCount = matched.filter((m) =>
    Boolean(VERIFIED_HUD_10M_VOD_BY_GAME_ID[m.game.gameId])
  ).length;

  const playersInSlice = Array.from(new Set(matched.map((m) => m.summonerName))).sort(
    (a, b) => a.localeCompare(b)
  );

  const roleTitle = formatRoleDisplay(normalizedRole);
  const selectionTitle =
    normalizedChamp === 'ALL'
      ? `${roleTitle} · All Supported Champions in Sample`
      : `${roleTitle} · ${canonicalChampName}`;

  const selectionSubtitle = isSupportedSelection
    ? `${matched.length} pro player-game${matched.length === 1 ? '' : 's'} across ${
        uniqueGameIds.size
      } Worlds 2026 match${uniqueGameIds.size === 1 ? '' : 'es'} (${playersInSlice.join(
        ', '
      )})`
    : unsupportedReason ?? 'No matching sample observations.';

  const patchVersion = dataset.patchVersion ?? '16.20.826.3891';
  const patchShort = patchVersion.split('.').slice(0, 2).join('.');

  return {
    filter: {
      role: normalizedRole,
      championId: normalizedChamp === 'ALL' ? 'ALL' : canonicalChampName,
    },
    isSupportedSelection,
    unsupportedReason,
    alternateRolesForChampion,
    selectionTitle,
    selectionSubtitle,
    totalGamesInDataset: dataset.games?.length ?? 0,
    totalObservationsInDataset: (dataset.games ?? []).reduce(
      (acc, g) => acc + Object.keys(g.participants ?? {}).length,
      0
    ),
    totalRoleChampionPairsInDataset: allOptions.length,
    reportClaimedRoleChampionPairs: 57,
    patchVersion,
    patchShort,
    ddragonVersionUsedInIngest: dataset.ddragonVersion ?? '16.22.1',
    matchingObservationCount: matched.length,
    uniqueGamesInSliceCount: uniqueGameIds.size,
    hudVerifiedGamesInSliceCount,
    hudVerifiedObservationsInSliceCount,
    playersInSlice,
    checkpoints,
    optional14mSummary: {
      availableSnapshotCount: valid14m.length,
      meanTotalCs:
        valid14m.length > 0
          ? roundToDecimals(
              valid14m.reduce((a, b) => a + b, 0) / valid14m.length,
              1
            )
          : null,
      minTotalCs: valid14m.length > 0 ? Math.min(...valid14m) : null,
      maxTotalCs: valid14m.length > 0 ? Math.max(...valid14m) : null,
    },
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
  demoInputs: DemoCsInputMap
): Record<ProCheckpointMinute, DemoCheckpointComparison> {
  const result = {} as Record<ProCheckpointMinute, DemoCheckpointComparison>;

  for (const minuteMark of PRO_CHECKPOINT_MINUTES) {
    const rawInput = (demoInputs[minuteMark] ?? '').trim();
    const checkpoint = slice.checkpoints[minuteMark];

    if (rawInput === '') {
      result[minuteMark] = {
        minuteMark,
        rawInput: '',
        parsedDemoCs: null,
        canCompare: false,
        deltaCs: null,
        formattedDelta: 'No demo value entered',
        statusMessage:
          checkpoint.status === 'AVAILABLE'
            ? 'Enter a manual demo CS value to see raw arithmetic difference vs sample mean.'
            : 'Pro sample snapshot unavailable at this minute mark.',
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
        formattedDelta: 'Invalid demo input',
        statusMessage: 'Enter a non-negative CS number (Demo Only).',
        isDemoOnly: true,
      };
      continue;
    }

    if (checkpoint.status !== 'AVAILABLE' || checkpoint.meanTotalCs === null) {
      result[minuteMark] = {
        minuteMark,
        rawInput,
        parsedDemoCs: parsed,
        canCompare: false,
        deltaCs: null,
        formattedDelta: 'Comparison Unavailable',
        statusMessage:
          checkpoint.unavailableReason === 'SNAPSHOT_NOT_EXPORTED_AT_MARK'
            ? `Cannot compare at ${minuteMark}m: pro sample dataset does not include a ${minuteMark}m snapshot.`
            : `Cannot compare at ${minuteMark}m: 0 pro sample games reached ${minuteMark}:00.`,
        isDemoOnly: true,
      };
      continue;
    }

    const delta = roundToDecimals(parsed - checkpoint.meanTotalCs, 1);
    const sign = delta > 0 ? '+' : '';
    result[minuteMark] = {
      minuteMark,
      rawInput,
      parsedDemoCs: parsed,
      canCompare: true,
      deltaCs: delta,
      formattedDelta: `${sign}${delta.toFixed(1)} CS vs pro sample mean`,
      statusMessage: `Demo CS (${parsed}) minus ${checkpoint.availableSnapshotCount}-game pro sample mean (${checkpoint.meanTotalCs.toFixed(
        1
      )}) — Demo Only, not live player data.`,
      isDemoOnly: true,
    };
  }

  return result;
}
