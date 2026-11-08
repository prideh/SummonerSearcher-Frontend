export type ProRoleKey = "top" | "jungle" | "mid" | "bottom" | "support";

export type ProRoleFilter = "ALL" | ProRoleKey;

export const PRO_CHECKPOINT_MINUTES = [5, 10, 15, 20, 25, 30] as const;
export type ProCheckpointMinute = (typeof PRO_CHECKPOINT_MINUTES)[number];

export type ComparisonMode = "REFERENCE_ONLY" | "DEMO_INPUT";

export type RequestedUnavailableMetricKey =
  "soloKills" | "soloDeaths" | "turretPlates";

export interface ExplicitUnavailableMetricDescriptor {
  metricKey: RequestedUnavailableMetricKey;
  label: string;
  status: "UNAVAILABLE";
  playerValue: null;
  proValue: null;
  deltaValue: null;
  reasonCode:
    | "MISSING_IN_PRO_EXPORT_AND_LIVESTATS_FEED"
    | "SEMANTIC_MISMATCH_AND_MISSING_IN_PRO_FEED";
  explanation: string;
}

export interface RawClockAnchoredSnapshot {
  wall_ts: string;
  sample_err_s: number;
  clock_bias_vs_true_s: number;
  pCs: number[];
  pGolds: number[];
  pLevels: number[];
}

export interface RawAlignedCheckpointEntry {
  naive_first_frame: RawClockAnchoredSnapshot;
  spawn_unadjusted: RawClockAnchoredSnapshot;
  true_in_game_clock: RawClockAnchoredSnapshot;
}

export interface RawSpawnCheckpointParticipant {
  cs: number;
  gold: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  wardsPlaced: number;
  wardsDestroyed: number;
}

export interface RawSpawnCheckpointFrame {
  frame_ts: string;
  sample_err_s: number;
  participants: Record<string, RawSpawnCheckpointParticipant | undefined>;
}

export interface RawUnalignedCheckpointEntry {
  from_first_frame?: RawSpawnCheckpointFrame;
  from_spawn?: RawSpawnCheckpointFrame;
}

export interface RawPauseEvent {
  start: string;
  end: string;
  duration_s: number;
  type: string;
}

export interface RawItemTiming {
  itemId: number;
  itemName: string;
  totalGoldCost: number;
  elapsed_from_spawn_s: number;
  elapsed_from_first_frame_s: number;
  in_game_clock_s: number;
  is_boots: boolean;
  is_completed_item: boolean;
}

export interface RawGameParticipant {
  participantId: number;
  side: "blue" | "red";
  teamId: string;
  esportsPlayerId: string;
  summonerName: string;
  championId: string;
  role: ProRoleKey;
  finalLevel: number;
  finalKills: number;
  finalDeaths: number;
  finalAssists: number;
  finalGold: number;
  finalCs: number;
  killParticipation: number;
  championDamageShare: number;
  wardsPlaced: number;
  wardsDestroyed: number;
  finalItems: number[];
  abilities: string[];
  bootsTiming?: RawItemTiming | null;
  completedItemTimings?: RawItemTiming[];
}

export interface RawVodInfo {
  eventId?: string;
  blockName?: string;
  eventStartTime?: string;
  gameNumber?: number;
  vodFirstFrameTime?: string;
  vodStartMillis?: number;
  vodEndMillis?: number;
  vodParameter?: string;
  vod_start_iso?: string;
  vod_end_iso?: string;
  spawn_minus_vod_start_s?: number;
  vod_end_minus_finished_s?: number;
}

export interface RawPauseVerified {
  pause_start: string;
  pause_end: string;
  duration_s: number;
  elapsed_from_spawn_at_start_s: number;
  detected_by: string;
}

export interface RawProBenchmarkGame {
  gameId: string;
  label: string;
  patch: string;
  t_first_frame: string;
  t_spawn: string;
  t_passive_gold: string;
  t_first_mid_cs: string;
  t_first_side_cs: string;
  t_first_jg_cs: string;
  t_finished: string;
  pre_spawn_offset_s: number;
  passive_gold_from_first_frame_s: number;
  passive_gold_from_spawn_s: number;
  first_mid_cs_from_spawn_s: number;
  first_side_cs_from_spawn_s: number;
  first_jg_cs_from_spawn_s: number;
  game_duration_from_first_frame_s: number;
  game_duration_from_spawn_s: number;
  true_in_game_duration_s: number;
  total_pause_s: number;
  pause_events?: RawPauseEvent[];
  pauses_verified: RawPauseVerified[];
  vod: RawVodInfo;
  checkpoints?: Record<string, RawUnalignedCheckpointEntry | undefined>;
  aligned_checkpoints: Record<string, RawAlignedCheckpointEntry | undefined>;
  participants: Record<string, RawGameParticipant>;
}

export interface RawRoleChampionBaseline {
  role: ProRoleKey;
  championId: string;
  sampleCount: number;
  players: string[];
  checkpoints: Record<
    string,
    {
      avgCs: number;
      rangeCs: [number, number];
      avgGold: number;
      rangeGold: [number, number];
      avgLevel: number;
      avgNaiveCs: number;
      avgNaiveGold: number;
    }
  >;
}

export interface RawProBenchmarkDataset {
  prototypeVersion: string;
  generatedAt: string;
  patchVersion: string;
  ddragonVersion: string;
  gamesIngestedCount: number;
  playerObservationsCount: number;
  roleChampionBaselines: RawRoleChampionBaseline[];
  games: RawProBenchmarkGame[];
}

export interface VerifiedHudVodInfo {
  gameId: string;
  gameLabel: string;
  correctedHud10mUrl: string;
  correctedHud10mSeconds: number;
  rawDatasetLocatorSeconds: number;
  earlyOffsetSeconds: number;
  verificationScopeNote: string;
}

export type CheckpointUnavailableReason =
  | "NO_GAMES_IN_SLICE"
  | "ALL_GAMES_ENDED_BEFORE_MARK"
  | "SNAPSHOT_NOT_EXPORTED_AT_MARK";

export type EarlyDeathsUnavailableReason =
  CheckpointUnavailableReason | "ALL_REACHED_GAMES_PAUSED";

export type ProRoleOpponentDiffStatus =
  "AVAILABLE" | "REQUIRES_CHAMPION_AND_ROLE_SLICE" | "UNAVAILABLE";

export interface ProCheckpointSummary {
  minuteMark: ProCheckpointMinute;
  targetSeconds: number;
  status: "AVAILABLE" | "UNAVAILABLE";
  unavailableReason: CheckpointUnavailableReason | null;
  totalSliceGames: number;
  gamesReachedDurationCount: number;
  shortGamesEndedBeforeMarkCount: number;
  availableSnapshotCount: number;
  missingSnapshotAfterReachingDurationCount: number;
  hudVerifiedObservationCount: number;
  // Total CS @ Checkpoint
  meanTotalCs: number | null;
  meanTotalCsPerMin: number | null;
  minTotalCs: number | null;
  maxTotalCs: number | null;
  // Total Gold @ Checkpoint (pause-adjusted true_in_game_clock)
  availableGoldSnapshotCount: number;
  meanTotalGold: number | null;
  minTotalGold: number | null;
  maxTotalGold: number | null;
  // Champion Level @ Checkpoint (pause-adjusted true_in_game_clock)
  availableLevelSnapshotCount: number;
  meanLevel: number | null;
  minLevel: number | null;
  maxLevel: number | null;
  // Role-Opponent CS Diff (CSD) & Gold Diff (GD) @ Checkpoint (Champion+Role slices only)
  roleOpponentDiffStatus: ProRoleOpponentDiffStatus;
  availableCsDiffCount: number;
  meanCsDiffVsRoleOpponent: number | null;
  minCsDiffVsRoleOpponent: number | null;
  maxCsDiffVsRoleOpponent: number | null;
  availableGoldDiffCount: number;
  meanGoldDiffVsRoleOpponent: number | null;
  minGoldDiffVsRoleOpponent: number | null;
  maxGoldDiffVsRoleOpponent: number | null;
  // Early Total Deaths @ Checkpoint (from_spawn checkpoints with paused games excluded)
  earlyTotalDeathsStatus: "AVAILABLE" | "UNAVAILABLE";
  earlyTotalDeathsUnavailableReason: EarlyDeathsUnavailableReason | null;
  earlyTotalDeathsPausedGamesExcludedCount: number;
  earlyTotalDeathsAvailableCount: number;
  meanEarlyTotalDeaths: number | null;
  minEarlyTotalDeaths: number | null;
  maxEarlyTotalDeaths: number | null;
}

export interface ProObservationCheckpointCell {
  minuteMark: ProCheckpointMinute;
  reachedDuration: boolean;
  hasExportedSnapshot: boolean;
  totalCs: number | null;
  naiveTotalCs: number | null;
  totalGold: number | null;
  level: number | null;
  csDiffVsRoleOpponent: number | null;
  goldDiffVsRoleOpponent: number | null;
  earlyTotalDeaths: number | null;
  earlyTotalDeathsExcludedByPause: boolean;
  statusLabel: string;
}

export interface ProGameEvidenceRow {
  observationKey: string;
  gameId: string;
  gameLabel: string;
  patch: string;
  participantId: number;
  esportsPlayerId: string;
  summonerName: string;
  championId: string;
  role: ProRoleKey;
  side: "blue" | "red";
  roleOpponentSummonerName: string | null;
  roleOpponentChampionId: string | null;
  trueInGameDurationSeconds: number;
  trueInGameDurationFormatted: string;
  totalPauseSeconds: number;
  pauseHeuristicNote: string | null;
  checkpoints: Record<ProCheckpointMinute, ProObservationCheckpointCell>;
  csAt14m: number | null;
  goldAt14m: number | null;
  levelAt14m: number | null;
  csDiffAt14m: number | null;
  goldDiffAt14m: number | null;
  earlyTotalDeathsAt14m: number | null;
  finalCsAtGameEnd: number;
  finalGoldAtGameEnd: number;
  finalLevelAtGameEnd: number;
  finalKills: number;
  finalDeaths: number;
  finalAssists: number;
  killParticipation: number | null;
  championDamageShare: number | null;
  wardsPlaced: number | null;
  wardsDestroyed: number | null;
  wardsPlacedPerMin: number | null;
  wardsDestroyedPerMin: number | null;
  hudVerification: {
    isCs10HudVerified: boolean;
    correctedHud10mUrl: string | null;
    verificationBadgeText: string;
    vodOffsetCaveatText: string;
  };
}

export interface ProWholeGameMetricSummary {
  availableCount: number;
  mean: number | null;
  min: number | null;
  max: number | null;
}

export interface ProWholeGameSummary {
  totalSliceGames: number;
  killParticipation: ProWholeGameMetricSummary;
  championDamageShare: ProWholeGameMetricSummary;
  wardsPlacedPerMin: ProWholeGameMetricSummary;
  wardsDestroyedPerMin: ProWholeGameMetricSummary;
}

export interface SupportedRoleChampionOption {
  role: ProRoleKey;
  championId: string;
  sampleCount: number;
  players: string[];
}

export interface SelectableProPlayerChampionEntry {
  championId: string;
  games: number;
}

export interface SelectableProPlayerOption {
  esportsPlayerId: string;
  summonerName: string;
  playerHandle: string;
  teamTag: string;
  teamId: string;
  role: ProRoleKey;
  totalGamesInDataset: number;
  matchingGamesAfterRoleAndChampionFilter: number;
  championsPlayed: SelectableProPlayerChampionEntry[];
}

export interface ProComparisonFilter {
  role: ProRoleFilter;
  championId: string; // 'ALL' or champion name
  proPlayerId?: "ALL" | string; // 'ALL', stable esportsPlayerId, or summonerName/handle
}

export interface ProSliceComputationResult {
  filter: ProComparisonFilter;
  selectedProPlayerId: "ALL" | string;
  resolvedProPlayer: SelectableProPlayerOption | null;
  isProPlayerFoundInDataset: boolean;
  selectableProPlayersForSlice: SelectableProPlayerOption[];
  selectableProPlayersForRole: SelectableProPlayerOption[];
  isSupportedSelection: boolean;
  unsupportedReason: string | null;
  alternateRolesForChampion: SupportedRoleChampionOption[];
  selectionTitle: string;
  selectionSubtitle: string;
  totalGamesInDataset: number;
  totalObservationsInDataset: number;
  totalRoleChampionPairsInDataset: number;
  reportClaimedRoleChampionPairs: number;
  patchVersion: string;
  patchShort: string;
  ddragonVersionUsedInIngest: string;
  matchingObservationCount: number;
  uniqueGamesInSliceCount: number;
  hudVerifiedGamesInSliceCount: number;
  hudVerifiedObservationsInSliceCount: number;
  playersInSlice: string[];
  checkpoints: Record<ProCheckpointMinute, ProCheckpointSummary>;
  optional14mSummary: {
    availableSnapshotCount: number;
    meanTotalCs: number | null;
    minTotalCs: number | null;
    maxTotalCs: number | null;
    availableGoldSnapshotCount: number;
    meanTotalGold: number | null;
    minTotalGold: number | null;
    maxTotalGold: number | null;
    availableLevelSnapshotCount: number;
    meanLevel: number | null;
    minLevel: number | null;
    maxLevel: number | null;
    roleOpponentDiffStatus: ProRoleOpponentDiffStatus;
    availableCsDiffCount: number;
    meanCsDiffVsRoleOpponent: number | null;
    minCsDiffVsRoleOpponent: number | null;
    maxCsDiffVsRoleOpponent: number | null;
    availableGoldDiffCount: number;
    meanGoldDiffVsRoleOpponent: number | null;
    minGoldDiffVsRoleOpponent: number | null;
    maxGoldDiffVsRoleOpponent: number | null;
    earlyTotalDeathsPausedGamesExcludedCount: number;
    earlyTotalDeathsAvailableCount: number;
    meanEarlyTotalDeaths: number | null;
    minEarlyTotalDeaths: number | null;
    maxEarlyTotalDeaths: number | null;
  };
  wholeGameSummary: ProWholeGameSummary;
  unavailableRequestedMetrics: Record<
    RequestedUnavailableMetricKey,
    ExplicitUnavailableMetricDescriptor
  >;
  evidenceRows: ProGameEvidenceRow[];
}

export type DemoCsInputMap = Partial<Record<ProCheckpointMinute, string>>;

export interface DemoCheckpointComparison {
  minuteMark: ProCheckpointMinute;
  rawInput: string;
  parsedDemoCs: number | null;
  canCompare: boolean;
  deltaCs: number | null;
  formattedDelta: string;
  statusMessage: string;
  isDemoOnly: true;
}
