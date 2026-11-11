import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchDto } from '../../types/match';
import type { MatchTimelineDto } from '../../types/timeline';
import * as timelineApi from '../../api/timeline';
import {
  DEFAULT_PRO_BENCHMARK_DATASET,
  PRO_ROLE_LABELS,
  PRO_ROLE_ORDER,
  VERIFIED_HUD_10M_VOD_BY_GAME_ID,
  computeProComparisonSlice,
  evaluateDemoCsComparisons,
  formatRoleDisplay,
  getSupportedRoleChampionOptions,
} from './proBenchmarkEngine';
import {
  PRO_CHECKPOINT_MINUTES,
  type DemoCsInputMap,
  type ProCheckpointMinute,
  type ProRoleFilter,
  type RawProBenchmarkDataset,
  type RequestedUnavailableMetricKey,
} from './proBenchmarkTypes';
import {
  CHECKPOINT_TOLERANCE_MS,
  MAX_BOUNDED_TIMELINE_FETCHES,
  buildSearchedPlayerProComparison,
  sharedTimelineCache,
  type PairedWholeGameMetricComparison,
} from './searchedPlayerProAdapter';

export interface ProfileProComparisonTabProps {
  puuid: string;
  region: string;
  gameName: string;
  tagLine: string;
  visibleMatches: MatchDto[];
  /**
   * Optional pre-populated raw timelines keyed by `matchId`.
   * Used when timelines have already been fetched or in deterministic contract tests / review sandbox.
   */
  initialTimelinesByMatchId?: Record<string, MatchTimelineDto | null | undefined>;
  /**
   * Distinguishes live profile integration from synthetic test profiles or local JSON in review preview.
   * Synthetic test profiles are never labelled as real player data or a live connected backend.
   */
  dataSourceMode?: 'live_profile' | 'synthetic_test_profile' | 'local_json';
  /**
   * Default comparison scope: `'role_first'` (`ROLE_ALL` across `recent20` in primary role)
   * or `'champion_pair'` (most-played `Champion · Role` in primary role).
   */
  initialScope?: 'role_first' | 'champion_pair';
  /**
   * Optional timeline fetcher override (defaults to `getMatchTimeline(region, matchId)`).
   */
  fetchTimeline?: (region: string, matchId: string) => Promise<MatchTimelineDto | null>;
  /**
   * Optional dataset override for tests.
   */
  dataset?: RawProBenchmarkDataset;
}

type TabSurfaceMode = 'player_vs_pro' | 'pro_catalog' | 'manual_demo';

interface PlayerScopedUiState {
  identityKey: string;
  selectedRole: ProRoleFilter | undefined;
  selectedPairKey: string | null;
  selectedProPlayerId: 'ALL' | string;
  selectedMatchId: 'ALL' | string;
  loadedTimelines: Record<string, MatchTimelineDto | null | undefined>;
  loadingTimelines: boolean;
  timelineFetchError: string | null;
  surfaceMode: TabSurfaceMode;
  showMatchBreakdown: boolean;
}

const createInitialPlayerUiState = (
  targetIdentityKey: string,
  defaultScope: 'role_first' | 'champion_pair'
): PlayerScopedUiState => ({
  identityKey: targetIdentityKey,
  selectedRole: undefined,
  selectedPairKey: defaultScope === 'role_first' ? 'ROLE_ALL' : null,
  selectedProPlayerId: 'ALL',
  selectedMatchId: 'ALL',
  loadedTimelines: {},
  loadingTimelines: false,
  timelineFetchError: null,
  surfaceMode: 'player_vs_pro',
  showMatchBreakdown: false,
});

const DEFAULT_DEMO_INPUTS: DemoCsInputMap = {
  5: '38',
  10: '86',
  15: '136',
  20: '182',
  25: '224',
  30: '260',
};

const formatSignedDelta = (delta: number): string => {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} CS`;
};

const formatSignedNumber = (
  delta: number,
  decimals: number,
  suffix = ''
): string => {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(decimals)}${suffix}`;
};

const formatSignedPoints = (deltaRatio: number): string => {
  const pts = deltaRatio * 100;
  const sign = pts > 0 ? '+' : '';
  return `${sign}${pts.toFixed(1)}pp`;
};

const defaultFetchTimeline = async (
  region: string,
  matchId: string
): Promise<MatchTimelineDto | null> => {
  if (typeof timelineApi.getMatchTimeline === 'function') {
    return timelineApi.getMatchTimeline(region, matchId);
  }
  return null;
};

export const ProfileProComparisonTab: React.FC<ProfileProComparisonTabProps> = ({
  puuid,
  region,
  gameName,
  tagLine,
  visibleMatches,
  initialTimelinesByMatchId,
  dataSourceMode = 'live_profile',
  initialScope = 'role_first',
  fetchTimeline = defaultFetchTimeline,
  dataset = DEFAULT_PRO_BENCHMARK_DATASET,
}) => {
  const allSupportedProPairs = useMemo(
    () => getSupportedRoleChampionOptions(dataset, 'ALL'),
    [dataset]
  );

  const identityKey = `${region.toLowerCase()}::${puuid}`;

  const isMountedRef = useRef<boolean>(true);
  const activeIdentityKeyRef = useRef<string>(identityKey);
  const requestGenerationRef = useRef<number>(0);

  const [playerUiState, setPlayerUiState] = useState<PlayerScopedUiState>(() =>
    createInitialPlayerUiState(identityKey, initialScope)
  );
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  const [catalogRole, setCatalogRole] = useState<ProRoleFilter>('top');
  const [catalogChampion, setCatalogChampion] = useState<string>('KSante');
  const [demoInputs, setDemoInputs] = useState<DemoCsInputMap>({});

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (activeIdentityKeyRef.current !== identityKey) {
      activeIdentityKeyRef.current = identityKey;
      requestGenerationRef.current += 1;
    }
    setPlayerUiState((prev) =>
      prev.identityKey === identityKey
        ? prev
        : createInitialPlayerUiState(identityKey, initialScope)
    );
  }, [identityKey, initialScope]);

  const isCurrentIdentityState = playerUiState.identityKey === identityKey;
  const selectedRole = isCurrentIdentityState ? playerUiState.selectedRole : undefined;
  const selectedPairKey = isCurrentIdentityState
    ? playerUiState.selectedPairKey
    : initialScope === 'role_first'
      ? 'ROLE_ALL'
      : null;
  const selectedProPlayerId = isCurrentIdentityState
    ? playerUiState.selectedProPlayerId
    : 'ALL';
  const selectedMatchId = isCurrentIdentityState ? playerUiState.selectedMatchId : 'ALL';
  const loadedTimelines = useMemo(
    () => (isCurrentIdentityState ? playerUiState.loadedTimelines : {}),
    [isCurrentIdentityState, playerUiState.loadedTimelines]
  );
  const loadingTimelines = isCurrentIdentityState ? playerUiState.loadingTimelines : false;
  const timelineFetchError = isCurrentIdentityState ? playerUiState.timelineFetchError : null;
  const surfaceMode: TabSurfaceMode = isCurrentIdentityState
    ? playerUiState.surfaceMode
    : 'player_vs_pro';
  const showMatchBreakdown = isCurrentIdentityState ? playerUiState.showMatchBreakdown : false;

  const updateCurrentPlayerUiState = (
    updater: (base: PlayerScopedUiState) => Partial<PlayerScopedUiState>
  ) => {
    setPlayerUiState((prev) => {
      const base =
        prev.identityKey === identityKey
          ? prev
          : createInitialPlayerUiState(identityKey, initialScope);
      return {
        ...base,
        ...updater(base),
        identityKey,
      };
    });
  };

  const setSelectedRole = (nextRole: ProRoleFilter) => {
    requestGenerationRef.current += 1;
    updateCurrentPlayerUiState(() => ({
      selectedRole: nextRole,
      selectedPairKey: 'ROLE_ALL',
      selectedProPlayerId: 'ALL',
      selectedMatchId: 'ALL',
      loadingTimelines: false,
      timelineFetchError: null,
    }));
  };

  const setSelectedPairKey = (nextPairKey: string | null) => {
    requestGenerationRef.current += 1;
    updateCurrentPlayerUiState(() => ({
      selectedPairKey: nextPairKey,
      selectedMatchId: 'ALL',
      loadingTimelines: false,
      timelineFetchError: null,
    }));
  };

  const setSelectedProPlayerId = (nextProId: 'ALL' | string) => {
    updateCurrentPlayerUiState(() => ({
      selectedProPlayerId: nextProId,
    }));
  };

  const setSelectedMatchId = (nextMatchId: 'ALL' | string) => {
    updateCurrentPlayerUiState(() => ({
      selectedMatchId: nextMatchId,
      timelineFetchError: null,
    }));
  };

  const setSurfaceMode = (nextMode: TabSurfaceMode) => {
    updateCurrentPlayerUiState(() => ({ surfaceMode: nextMode }));
  };

  const setShowMatchBreakdown = (
    nextVal: boolean | ((prevBreakdown: boolean) => boolean)
  ) => {
    updateCurrentPlayerUiState((base) => ({
      showMatchBreakdown:
        typeof nextVal === 'function' ? nextVal(base.showMatchBreakdown) : nextVal,
    }));
  };

  const effectiveTimelinesByMatchId = useMemo(() => {
    const merged: Record<string, MatchTimelineDto | null | undefined> = {
      ...(initialTimelinesByMatchId ?? {}),
      ...loadedTimelines,
    };
    const normRegion = region.toLowerCase();
    for (const match of visibleMatches || []) {
      const mid = match?.metadata?.matchId;
      if (mid && !merged[mid]) {
        const cached = sharedTimelineCache.get(`${normRegion}::${mid}`);
        if (cached) {
          merged[mid] = cached;
        }
      }
    }
    return merged;
  }, [initialTimelinesByMatchId, loadedTimelines, region, visibleMatches]);

  const comparison = useMemo(
    () =>
      buildSearchedPlayerProComparison({
        identity: { puuid, region, gameName, tagLine },
        visibleMatches,
        timelinesByMatchId: effectiveTimelinesByMatchId,
        dataset,
        selectedRole,
        selectedPairKey,
        selectedProPlayerId,
        selectedMatchId,
      }),
    [
      puuid,
      region,
      gameName,
      tagLine,
      visibleMatches,
      effectiveTimelinesByMatchId,
      dataset,
      selectedRole,
      selectedPairKey,
      selectedProPlayerId,
      selectedMatchId,
    ]
  );

  const selectedPair = comparison.selectedPair;
  const activeRoleSummary = useMemo(
    () =>
      comparison.roleSelection.availableRoles.find(
        (r) => r.role === comparison.roleSelection.selectedRole
      ) ?? null,
    [comparison.roleSelection]
  );

  const handleLoadTimelinesForSelectedPair = async () => {
    if (!selectedPair || loadingTimelines) return;
    const matchIdsToFetch = comparison.unloadedMatchIdsForSelectedPair.slice(
      0,
      MAX_BOUNDED_TIMELINE_FETCHES
    );
    if (matchIdsToFetch.length === 0) return;

    const requestIdentityKey = identityKey;
    const requestRegion = region;
    const normRegion = requestRegion.toLowerCase();
    activeIdentityKeyRef.current = requestIdentityKey;
    requestGenerationRef.current += 1;
    const requestGeneration = requestGenerationRef.current;

    const isRequestCurrent = (): boolean =>
      isMountedRef.current &&
      activeIdentityKeyRef.current === requestIdentityKey &&
      requestGenerationRef.current === requestGeneration;

    setPlayerUiState((prev) => {
      const base =
        prev.identityKey === requestIdentityKey
          ? prev
          : createInitialPlayerUiState(requestIdentityKey, initialScope);
      return {
        ...base,
        loadingTimelines: true,
        timelineFetchError: null,
      };
    });

    const newlyLoaded: Record<string, MatchTimelineDto> = {};
    let failedCount = 0;

    try {
      for (const matchId of matchIdsToFetch) {
        if (!isRequestCurrent()) {
          return;
        }
        try {
          const dto = await fetchTimeline(requestRegion, matchId);
          if (!isRequestCurrent()) {
            return;
          }
          if (dto && dto.info?.frames) {
            sharedTimelineCache.set(`${normRegion}::${matchId}`, dto);
            newlyLoaded[matchId] = dto;
          } else {
            failedCount++;
          }
        } catch {
          if (!isRequestCurrent()) {
            return;
          }
          failedCount++;
        }
      }

      if (!isRequestCurrent()) {
        return;
      }

      setPlayerUiState((prev) => {
        if (prev.identityKey !== requestIdentityKey) {
          return prev;
        }
        return {
          ...prev,
          loadedTimelines:
            Object.keys(newlyLoaded).length > 0
              ? { ...prev.loadedTimelines, ...newlyLoaded }
              : prev.loadedTimelines,
          timelineFetchError:
            failedCount > 0
              ? `Could not load ${failedCount} of ${matchIdsToFetch.length} match timeline(s) from the timeline endpoint.`
              : null,
        };
      });
    } finally {
      if (isRequestCurrent()) {
        setPlayerUiState((prev) =>
          prev.identityKey === requestIdentityKey
            ? { ...prev, loadingTimelines: false }
            : prev
        );
      }
    }
  };

  const catalogRoleOptions = useMemo(
    () => getSupportedRoleChampionOptions(dataset, catalogRole),
    [dataset, catalogRole]
  );
  const catalogSlice = useMemo(
    () =>
      computeProComparisonSlice(dataset, {
        role: catalogRole,
        championId: catalogChampion,
      }),
    [dataset, catalogRole, catalogChampion]
  );
  const demoEvaluations = useMemo(
    () => evaluateDemoCsComparisons(catalogSlice, demoInputs),
    [catalogSlice, demoInputs]
  );

  const verifiedVods = Object.values(VERIFIED_HUD_10M_VOD_BY_GAME_ID);
  const excludedMetricEntries = (
    ['soloKills', 'turretPlates', 'soloDeaths'] as RequestedUnavailableMetricKey[]
  ).map((key) => comparison.unavailableRequestedMetrics[key]);

  const wholeGameCards: Array<{
    key: string;
    shortTitle: string;
    subtitle: string;
    metric: PairedWholeGameMetricComparison;
    formatValue: (val: number) => string;
    formatDelta: (delta: number) => string;
    lowerIsBetter?: boolean;
  }> = [
    {
      key: 'killParticipation',
      shortTitle: 'Kill Participation',
      subtitle: '(K + A) / Same-5 Team Kills',
      metric: comparison.wholeGameComparison.killParticipation,
      formatValue: (v) => `${(v * 100).toFixed(1)}%`,
      formatDelta: formatSignedPoints,
    },
    {
      key: 'championDamageShare',
      shortTitle: 'Damage Share',
      subtitle: 'Champ Dmg / Same-5 Team Dmg',
      metric: comparison.wholeGameComparison.championDamageShare,
      formatValue: (v) => `${(v * 100).toFixed(1)}%`,
      formatDelta: formatSignedPoints,
    },
    {
      key: 'totalDeaths',
      shortTitle: 'Full-Game Deaths',
      subtitle: 'MatchDto.deaths vs finalDeaths',
      metric: comparison.wholeGameComparison.totalDeaths,
      formatValue: (v) => `${v.toFixed(2)}`,
      formatDelta: (d) => formatSignedNumber(d, 2, '/G'),
      lowerIsBetter: true,
    },
    {
      key: 'csPerMin',
      shortTitle: 'Whole-Game CS / Min',
      subtitle: '(Lane + Jungle) / Game Mins',
      metric: comparison.wholeGameComparison.csPerMin,
      formatValue: (v) => `${v.toFixed(2)}/m`,
      formatDelta: (d) => formatSignedNumber(d, 2, '/m'),
    },
  ];

  const activePairSelectValue =
    comparison.comparisonScope === 'role_first'
      ? 'ROLE_ALL'
      : selectedPair?.pairKey ?? '';

  const selectablePros =
    comparison.proPlayerSelection.selectableProPlayersForPair.length > 0
      ? comparison.proPlayerSelection.selectableProPlayersForPair
      : comparison.proPlayerSelection.selectableProPlayersForRole;

  return (
    <section
      aria-label="Pro Benchmark Comparison"
      data-testid="profile-pro-comparison-tab"
      data-bound-puuid={puuid}
      data-bound-region={region}
      data-bound-identity={`${gameName}#${tagLine} (${region.toUpperCase()})`}
      data-source-mode={dataSourceMode}
      data-comparison-scope={comparison.comparisonScope}
      className="mt-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0b101d] p-2.5 text-slate-900 dark:text-slate-100 telemetry-nums"
    >
      {surfaceMode === 'player_vs_pro' && (
        <div className="space-y-2.5">
          {comparison.recentMatchWindow.positionalMatchCountInRecent20 === 0 ? (
            <div
              data-testid="no-positional-matches-state"
              className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 text-xs text-slate-600 dark:text-slate-300"
            >
              No positional Summoner&apos;s Rift matches found in recent 20 match window for{' '}
              <span className="font-bold">
                {gameName}#{tagLine}
              </span>
              . Browse the{' '}
              <button
                type="button"
                onClick={() => setSurfaceMode('pro_catalog')}
                className="underline font-bold text-sky-600 dark:text-cyan-400"
              >
                Pro Catalog ({allSupportedProPairs.length} pairs)
              </button>{' '}
              or load more matches.
            </div>
          ) : (
            <>
              {/* Recent-20 + Data-Source Integrity Strip */}
              <div
                data-testid="recent20-window-strip"
                className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 px-2.5 py-1.5 text-[11px]"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-sky-800 dark:text-cyan-300 border border-cyan-500/30 font-extrabold text-[10px] uppercase tracking-wide">
                    {comparison.comparisonScope === 'role_first'
                      ? 'Role-First Default'
                      : 'Champion · Role Slice'}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Recent {comparison.recentMatchWindow.analyzedRecentMatchCount}/
                    {comparison.recentMatchWindow.maxRecentMatches} Matches
                    {comparison.recentMatchWindow.excludedBeyondRecent20Count > 0 && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}
                        ({comparison.recentMatchWindow.excludedBeyondRecent20Count} older excluded)
                      </span>
                    )}
                  </span>
                </div>
                <span
                  data-testid="tab-datasource-pill"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    dataSourceMode === 'live_profile'
                      ? 'bg-sky-500/10 text-sky-700 dark:text-cyan-300 border-sky-500/30'
                      : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40'
                  }`}
                >
                  {dataSourceMode === 'synthetic_test_profile'
                    ? 'Prototype Synthetic Fixture · Not Real Player Data'
                    : dataSourceMode === 'local_json'
                      ? 'Client Local JSON · Zero Live API Calls'
                      : 'Searched Player MatchDto + Bounded Timeline Contract'}
                </span>
              </div>

              {/* 4-Control Filter Row: Role + Scope/Champion + Optional Named Pro + Match Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 items-end">
                <div className="min-w-0">
                  <label
                    htmlFor="player-role-select"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 truncate"
                  >
                    1. Primary Role (Recent 20)
                  </label>
                  <select
                    id="player-role-select"
                    data-testid="player-role-select"
                    value={comparison.roleSelection.selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as ProRoleFilter)}
                    className="w-full min-w-0 truncate rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    {comparison.roleSelection.availableRoles.map((rOpt) => (
                      <option key={rOpt.role} value={rOpt.role}>
                        {rOpt.roleDisplay} ({rOpt.playerRecent20Games}G Player ·{' '}
                        {rOpt.proDatasetGames}G Pro)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="player-pair-select"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 truncate"
                  >
                    2. Role Baseline / Optional Champion
                  </label>
                  <select
                    id="player-pair-select"
                    data-testid="player-pair-select"
                    value={activePairSelectValue}
                    onChange={(e) => setSelectedPairKey(e.target.value)}
                    className="w-full min-w-0 truncate rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    {activeRoleSummary && activeRoleSummary.playerRecent20Games > 0 && (
                      <option value="ROLE_ALL">
                        All {activeRoleSummary.roleDisplay} Champions · Role-First (
                        {activeRoleSummary.playerRecent20Games}G Player ·{' '}
                        {activeRoleSummary.proDatasetGames}G Pro)
                      </option>
                    )}
                    {comparison.pairOptions.map((opt) => (
                      <option key={opt.pairKey} value={opt.pairKey}>
                        {opt.championId} · {opt.roleDisplay} ({opt.playerGameCount}G Player ·{' '}
                        {opt.proReferenceAvailable
                          ? `${opt.proSampleGameCount}G Pro Ref`
                          : 'No Pro Ref in Sample'}
                        )
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="player-pro-select"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 truncate"
                  >
                    3. Optional Named Pro
                  </label>
                  <select
                    id="player-pro-select"
                    data-testid="player-pro-select"
                    value={comparison.proPlayerSelection.selectedProPlayerId}
                    onChange={(e) => setSelectedProPlayerId(e.target.value)}
                    className="w-full min-w-0 truncate rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="ALL">
                      All {formatRoleDisplay(comparison.roleSelection.selectedRole)} Pros (Role
                      Baseline)
                    </option>
                    {selectablePros.map((pro) => (
                      <option key={pro.esportsPlayerId} value={pro.esportsPlayerId}>
                        {pro.summonerName} ({pro.matchingGamesAfterRoleAndChampionFilter}G match /{' '}
                        {pro.totalGamesInDataset}G total)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="player-match-scope-select"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 truncate"
                  >
                    4. Match Window
                  </label>
                  <select
                    id="player-match-scope-select"
                    data-testid="player-match-scope-select"
                    value={comparison.selectedMatchId}
                    onChange={(e) => setSelectedMatchId(e.target.value)}
                    className="w-full min-w-0 truncate rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="ALL">
                      All Selected ({selectedPair?.playerGameCount ?? 0}G Mean)
                    </option>
                    {selectedPair?.matches.map((m) => (
                      <option key={m.matchId} value={m.matchId}>
                        {m.matchId} ({m.championId} · {m.gameDurationFormatted} ·{' '}
                        {m.win ? 'W' : 'L'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {timelineFetchError && (
                <div
                  role="alert"
                  data-testid="timeline-fetch-error"
                  className="rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-700 dark:text-rose-200"
                >
                  {timelineFetchError}
                </div>
              )}

              {!selectedPair ? (
                <div
                  data-testid="empty-role-matches-banner"
                  className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200"
                >
                  0 matches in the recent 20 window for{' '}
                  <strong>{formatRoleDisplay(comparison.roleSelection.selectedRole)}</strong>.
                  Select another role above.
                </div>
              ) : (
                <>
                  {/* Context Bar */}
                  <div
                    data-testid="comparison-context-bar"
                    className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        data-testid="paired-selection-title"
                        className="font-extrabold text-xs text-slate-900 dark:text-white mr-0.5"
                      >
                        {selectedPair.championId === 'ALL'
                          ? `${selectedPair.roleDisplay} · All ${selectedPair.roleDisplay} Champions`
                          : `${selectedPair.roleDisplay} · ${selectedPair.championId}`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-cyan-300 border border-sky-500/30 font-semibold text-[10px]">
                        Player {comparison.activeMatches.length}G (
                        {selectedPair.queueLabels.join(', ') || 'Matchmade'} ·{' '}
                        {selectedPair.patches.join(', ') || 'Unknown'})
                      </span>
                      {comparison.proPlayerSelection.proReferenceAvailableAfterFilters &&
                      comparison.proSlice ? (
                        <span
                          data-testid="pro-reference-context-badge"
                          className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-sky-800 dark:text-cyan-200 border border-cyan-500/30 font-semibold text-[10px]"
                        >
                          Pro {comparison.proSlice.matchingObservationCount}G Finite 8-Game Sample (
                          {comparison.proSlice.playersInSlice.join(', ')} · Patch{' '}
                          {comparison.proSlice.patchShort})
                        </span>
                      ) : (
                        <span
                          data-testid="unsupported-pro-pair-badge"
                          className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold text-[10px]"
                        >
                          No Pro Reference in 8-Game Sample (0G for{' '}
                          {selectedPair.championId === 'ALL'
                            ? selectedPair.roleDisplay
                            : `${selectedPair.championId} · ${selectedPair.roleDisplay}`}
                          )
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {comparison.unloadedMatchIdsForSelectedPair.length > 0 ? (
                        <button
                          type="button"
                          data-testid="load-pair-timelines-btn"
                          disabled={loadingTimelines}
                          onClick={handleLoadTimelinesForSelectedPair}
                          className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-sky-600 hover:bg-sky-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 border border-sky-500 dark:border-cyan-400 transition-colors disabled:opacity-60"
                        >
                          {loadingTimelines
                            ? 'Loading...'
                            : `Load Timelines (${comparison.unloadedMatchIdsForSelectedPair.length}G)`}
                        </button>
                      ) : (
                        <span
                          data-testid="timelines-loaded-indicator"
                          className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                        >
                          {selectedPair.loadedTimelineCount}/{selectedPair.playerGameCount}G
                          timelines · ±{CHECKPOINT_TOLERANCE_MS / 1000}s
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unsupported Pro Slice Banner */}
                  {!comparison.proPlayerSelection.proReferenceAvailableAfterFilters && (
                    <div
                      data-testid="unsupported-pair-banner"
                      className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200"
                    >
                      <span className="font-bold">
                        No Pro Reference for{' '}
                        {selectedPair.championId === 'ALL'
                          ? selectedPair.roleDisplay
                          : `${selectedPair.championId} · ${selectedPair.roleDisplay}`}
                        :
                      </span>{' '}
                      {comparison.proPlayerSelection.unavailableReason ??
                        `0 games in the finite 8-game Worlds 2026 sample (${allSupportedProPairs.length} pairs total).`}{' '}
                      Player metrics remain visible without unrelated fallback.
                    </div>
                  )}

                  {/* WHOLE-GAME COMPARABLE METRICS (KP, Damage Share, Full-Game Deaths, CS/Min) */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                      <span>Whole-Game Same-Formula Metrics (MatchDto vs Pro Final Summary)</span>
                      <span className="normal-case font-normal text-slate-500 dark:text-slate-400">
                        Gold compared at 5m–25m timeline frames (whole-game goldEarned vs finalGold
                        not assumed identical)
                      </span>
                    </div>
                    <div
                      data-testid="whole-game-comparison-grid"
                      className="grid grid-cols-2 lg:grid-cols-4 gap-2"
                    >
                      {wholeGameCards.map((card) => {
                        const m = card.metric;
                        const deltaGood =
                          m.deltaMean !== null
                            ? card.lowerIsBetter
                              ? m.deltaMean <= 0
                              : m.deltaMean >= 0
                            : null;
                        return (
                          <div
                            key={card.key}
                            data-testid={`whole-game-card-${card.key}`}
                            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2 flex flex-col justify-between"
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <div className="min-w-0">
                                <div className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                                  {card.shortTitle}
                                </div>
                                <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                                  {card.subtitle}
                                </div>
                              </div>
                              {m.deltaMean !== null ? (
                                <span
                                  data-testid={`whole-game-delta-${card.key}`}
                                  className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                                    deltaGood
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  }`}
                                >
                                  {card.formatDelta(m.deltaMean)}
                                </span>
                              ) : (
                                <span
                                  data-testid={`whole-game-delta-${card.key}`}
                                  className="shrink-0 text-[10px] font-semibold text-slate-400 dark:text-slate-500"
                                >
                                  Unknown
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-800 text-[11px]">
                              <div>
                                <div className="text-[9px] uppercase font-bold text-slate-500">
                                  Player ({m.playerAvailableGames}/{m.playerTotalGames}G)
                                </div>
                                <div
                                  data-testid={`whole-game-player-${card.key}`}
                                  className="font-extrabold text-slate-900 dark:text-white"
                                >
                                  {m.playerMean !== null ? card.formatValue(m.playerMean) : 'Unknown'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[9px] uppercase font-bold text-slate-500">
                                  Pro ({m.proAvailableGames}/{m.proTotalGames}G)
                                </div>
                                <div
                                  data-testid={`whole-game-pro-${card.key}`}
                                  className="font-extrabold text-sky-700 dark:text-cyan-300"
                                >
                                  {m.proMean !== null ? card.formatValue(m.proMean) : 'Unavailable'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 6 PAIRED CHECKPOINT CARDS: CS, GOLD, LEVEL, EARLY UNPAUSED DEATHS */}
                  <div
                    data-testid="paired-checkpoint-grid"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2"
                  >
                    {comparison.checkpoints.map((cp) => (
                      <div
                        key={cp.label}
                        data-testid={`paired-checkpoint-card-${cp.label}`}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-xs font-extrabold text-sky-600 dark:text-cyan-400">
                              {cp.label}
                            </span>
                            {cp.deltaTotalCs !== null ? (
                              <span
                                data-testid={`paired-delta-${cp.label}`}
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                  cp.deltaTotalCs >= 0
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {formatSignedDelta(cp.deltaTotalCs)}
                              </span>
                            ) : (
                              <span
                                data-testid={`paired-delta-${cp.label}`}
                                className="text-[10px] font-semibold text-slate-400 dark:text-slate-500"
                              >
                                No Delta
                              </span>
                            )}
                          </div>

                          {/* Player CS Block */}
                          <div className="pb-1.5 border-b border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                              <span className="font-bold uppercase">Player</span>
                              <span
                                data-testid={`player-denom-${cp.label}`}
                                className="font-semibold"
                              >
                                {cp.playerGamesReached}/{cp.playerTotalGames}G
                              </span>
                            </div>

                            {cp.playerStatus === 'available' && cp.playerMeanTotalCs !== null ? (
                              <div>
                                <div className="flex items-baseline gap-1">
                                  <span
                                    data-testid={`player-mean-cs-${cp.label}`}
                                    className="text-base font-extrabold text-slate-900 dark:text-white leading-none"
                                  >
                                    {cp.playerMeanTotalCs.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    CS
                                  </span>
                                  <span className="text-[10px] text-slate-500 ml-auto">
                                    {cp.playerMeanCsPerMin?.toFixed(1)}/m
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  L:{cp.playerMeanLaneCs?.toFixed(1)} + J:
                                  {cp.playerMeanJungleCs?.toFixed(1)}
                                </div>
                              </div>
                            ) : cp.playerStatus === 'all_ended_before_checkpoint' ? (
                              <p
                                data-testid={`player-unavailable-${cp.label}`}
                                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 py-0.5"
                              >
                                Ended &lt;{cp.label}
                              </p>
                            ) : cp.playerStatus === 'timeline_not_loaded' ? (
                              <p
                                data-testid={`player-unavailable-${cp.label}`}
                                className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 py-0.5"
                              >
                                Load Timeline
                              </p>
                            ) : (
                              <p
                                data-testid={`player-unavailable-${cp.label}`}
                                className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 py-0.5"
                              >
                                Counter Missing
                              </p>
                            )}
                          </div>

                          {/* Pro CS Block */}
                          <div className="py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                              <span className="font-bold uppercase">Pro Ref</span>
                              <span data-testid={`pro-denom-${cp.label}`} className="font-semibold">
                                {cp.proReferenceAvailable
                                  ? `${cp.proGamesReached}/${cp.proTotalGames}G`
                                  : '0G'}
                              </span>
                            </div>

                            {cp.proStatus === 'available' && cp.proMeanTotalCs !== null ? (
                              <div>
                                <div className="flex items-baseline gap-1">
                                  <span
                                    data-testid={`pro-mean-cs-${cp.label}`}
                                    className="text-sm font-extrabold text-sky-700 dark:text-cyan-300 leading-none"
                                  >
                                    {cp.proMeanTotalCs.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    CS
                                  </span>
                                  <span className="text-[10px] text-slate-500 ml-auto">
                                    {cp.proMeanCsPerMin?.toFixed(1)}/m
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Range {cp.proMinTotalCs}–{cp.proMaxTotalCs}
                                </div>
                              </div>
                            ) : cp.proStatus === 'not_in_sample_export' ? (
                              <p
                                data-testid={`pro-unavailable-${cp.label}`}
                                className="text-[11px] font-semibold text-amber-600 dark:text-amber-300"
                              >
                                Not in 25m export
                              </p>
                            ) : cp.proStatus === 'unsupported_pair' ? (
                              <p
                                data-testid={`pro-unavailable-${cp.label}`}
                                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                              >
                                No Pro Sample
                              </p>
                            ) : (
                              <p
                                data-testid={`pro-unavailable-${cp.label}`}
                                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                              >
                                Ended &lt;{cp.label}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Expanded Checkpoint Telemetry: Gold, Level, Unpaused Early Deaths */}
                        <div className="pt-1.5 space-y-1 text-[10px]">
                          <div
                            data-testid={`paired-gold-row-${cp.label}`}
                            className="flex items-center justify-between gap-1"
                          >
                            <span className="font-bold text-slate-500">Gold</span>
                            <span className="text-slate-800 dark:text-slate-200 truncate">
                              {cp.playerMeanTotalGold !== null
                                ? `${Math.round(cp.playerMeanTotalGold)}`
                                : '—'}{' '}
                              /{' '}
                              <span className="text-sky-700 dark:text-cyan-300">
                                {cp.proMeanTotalGold !== null
                                  ? `${Math.round(cp.proMeanTotalGold)}`
                                  : '—'}
                              </span>
                            </span>
                            <span
                              className={`font-bold ${
                                cp.deltaTotalGold === null
                                  ? 'text-slate-400'
                                  : cp.deltaTotalGold >= 0
                                    ? 'text-emerald-600 dark:text-emerald-300'
                                    : 'text-amber-600 dark:text-amber-300'
                              }`}
                            >
                              {cp.deltaTotalGold !== null
                                ? formatSignedNumber(Math.round(cp.deltaTotalGold), 0, 'g')
                                : '—'}
                            </span>
                          </div>

                          <div
                            data-testid={`paired-level-row-${cp.label}`}
                            className="flex items-center justify-between gap-1"
                          >
                            <span className="font-bold text-slate-500">Level</span>
                            <span className="text-slate-800 dark:text-slate-200">
                              {cp.playerMeanLevel !== null ? cp.playerMeanLevel.toFixed(1) : '—'} /{' '}
                              <span className="text-sky-700 dark:text-cyan-300">
                                {cp.proMeanLevel !== null ? cp.proMeanLevel.toFixed(1) : '—'}
                              </span>
                            </span>
                            <span
                              className={`font-bold ${
                                cp.deltaLevel === null
                                  ? 'text-slate-400'
                                  : cp.deltaLevel >= 0
                                    ? 'text-emerald-600 dark:text-emerald-300'
                                    : 'text-amber-600 dark:text-amber-300'
                              }`}
                            >
                              {cp.deltaLevel !== null ? formatSignedNumber(cp.deltaLevel, 1) : '—'}
                            </span>
                          </div>

                          <div
                            data-testid={`paired-deaths-row-${cp.label}`}
                            className="flex items-center justify-between gap-1"
                          >
                            <span className="font-bold text-slate-500">Deaths</span>
                            {cp.proEarlyTotalDeathsStatus === 'available' &&
                            cp.proMeanEarlyTotalDeaths !== null ? (
                              <>
                                <span className="text-slate-800 dark:text-slate-200">
                                  {cp.playerMeanEarlyTotalDeaths !== null
                                    ? cp.playerMeanEarlyTotalDeaths.toFixed(2)
                                    : '—'}{' '}
                                  /{' '}
                                  <span className="text-sky-700 dark:text-cyan-300">
                                    {cp.proMeanEarlyTotalDeaths.toFixed(2)}
                                  </span>
                                  {cp.proEarlyTotalDeathsPausedGamesExcluded > 0 && (
                                    <span
                                      title={`${cp.proEarlyTotalDeathsPausedGamesExcluded} paused pro game(s) excluded`}
                                      className="text-amber-500 ml-0.5"
                                    >
                                      *
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={`font-bold ${
                                    cp.deltaEarlyTotalDeaths === null
                                      ? 'text-slate-400'
                                      : cp.deltaEarlyTotalDeaths <= 0
                                        ? 'text-emerald-600 dark:text-emerald-300'
                                        : 'text-amber-600 dark:text-amber-300'
                                  }`}
                                >
                                  {cp.deltaEarlyTotalDeaths !== null
                                    ? formatSignedNumber(cp.deltaEarlyTotalDeaths, 2)
                                    : '—'}
                                </span>
                              </>
                            ) : (
                              <span
                                data-testid={`pro-early-deaths-unavailable-${cp.label}`}
                                className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 ml-auto"
                              >
                                {cp.proEarlyTotalDeathsStatus === 'all_reached_games_paused'
                                  ? 'Paused G1 excl.'
                                  : cp.proEarlyTotalDeathsStatus === 'not_in_sample_export'
                                    ? 'Not exported'
                                    : 'Unavailable'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* EXCLUDED / UNAVAILABLE METRICS STRIP (Solo Kills, Turret Plates, Solo Deaths = NULL, NOT 0) */}
                  <div
                    data-testid="excluded-metrics-strip"
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/75 p-2 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                      <span className="font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        Excluded / Unavailable Pro Metrics (Preserved as Unknown / null — Never 0)
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Excluded unless both sources cover the exact same formula and time window
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                      {excludedMetricEntries.map((item) => (
                        <div
                          key={item.metricKey}
                          data-testid={`excluded-metric-${item.metricKey}`}
                          className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-2 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {item.label}
                            </span>
                            <span
                              data-testid={`excluded-metric-status-${item.metricKey}`}
                              className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                            >
                              UNAVAILABLE · null
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
                            {item.metricKey === 'soloKills'
                              ? 'Not in retained 8-game pro export; Riot challenges.soloKills window is undocumented and 0-assist timeline kills are not proven 1v1.'
                              : item.metricKey === 'turretPlates'
                                ? 'Not in retained 8-game pro export; Patch 26.1+ plates exist permanently on inner/inhibitor turrets beyond 14:00 with unverified assist credit.'
                                : 'No soloDeaths field in Riot ChallengesDto or pro export; opponent soloKills includes teammates and backend null-assist fallback is never reused.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* MODE 2 & 3: PRO CATALOG OR MANUAL DEMO FALLBACK */}
      {(surfaceMode === 'pro_catalog' || surfaceMode === 'manual_demo') && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
              {surfaceMode === 'pro_catalog'
                ? `Worlds 2026 Pro Catalog (${allSupportedProPairs.length} Pairs)`
                : 'Manual Demo Scratchpad (Not Searched Player Stats)'}
            </span>
            <button
              type="button"
              data-testid="surface-mode-player-btn"
              onClick={() => setSurfaceMode('player_vs_pro')}
              className="px-2 py-0.5 rounded text-xs font-bold bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950"
            >
              &larr; Back to Player vs Pro ({comparison.pairOptions.length})
            </button>
          </div>

          {surfaceMode === 'manual_demo' && (
            <div
              data-testid="manual-demo-fallback-banner"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                <strong className="font-bold">Manual Demo Input (Not Searched Player Stats):</strong>{' '}
                Optional manual scratchpad against the 8-game Worlds 2026 sample.
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDemoInputs(DEFAULT_DEMO_INPUTS)}
                  className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 font-bold text-[11px]"
                >
                  Fill Demo
                </button>
                <button
                  type="button"
                  onClick={() => setDemoInputs({})}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold text-[11px]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', ...PRO_ROLE_ORDER] as ProRoleFilter[]).map((roleVal) => (
              <button
                key={roleVal}
                type="button"
                onClick={() => {
                  setCatalogRole(roleVal);
                  const opts = getSupportedRoleChampionOptions(dataset, roleVal);
                  if (opts.length > 0 && !opts.some((o) => o.championId === catalogChampion)) {
                    setCatalogChampion(opts[0].championId);
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold border ${
                  catalogRole === roleVal
                    ? 'bg-sky-600 text-white border-sky-500 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-400'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {PRO_ROLE_LABELS[roleVal]}
              </button>
            ))}

            <select
              aria-label="Catalog Champion"
              data-testid="catalog-champion-select"
              value={catalogChampion}
              onChange={(e) => setCatalogChampion(e.target.value)}
              className="ml-auto rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              {catalogRoleOptions.map((opt) => (
                <option key={`${opt.role}-${opt.championId}`} value={opt.championId}>
                  {opt.championId} ({PRO_ROLE_LABELS[opt.role]} · {opt.sampleCount}G)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PRO_CHECKPOINT_MINUTES.map((minute) => {
              const cp = catalogSlice.checkpoints[minute];
              const demoEval = demoEvaluations[minute];

              return (
                <div
                  key={minute}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-sky-600 dark:text-cyan-400">
                      {minute}m
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {cp.availableSnapshotCount}/{cp.totalSliceGames}G
                    </span>
                  </div>
                  {cp.status === 'AVAILABLE' && cp.meanTotalCs !== null ? (
                    <div>
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {cp.meanTotalCs.toFixed(1)}
                      </span>{' '}
                      <span className="text-[10px] text-slate-500">
                        CS ({cp.meanTotalCsPerMin?.toFixed(1)}/m)
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-300">
                      Unavailable
                    </p>
                  )}

                  {surfaceMode === 'manual_demo' && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <input
                        type="number"
                        min={0}
                        max={600}
                        aria-label={`Manual Demo CS at ${minute}m`}
                        value={demoInputs[minute] ?? ''}
                        onChange={(e) =>
                          setDemoInputs((prev) => ({
                            ...prev,
                            [minute as ProCheckpointMinute]: e.target.value,
                          }))
                        }
                        placeholder="Demo CS"
                        className="w-full rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
                      />
                      {demoEval.canCompare && demoEval.deltaCs !== null && (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-300 mt-1">
                          {demoEval.formattedDelta}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Essential Caveat + On-Demand Disclosure Buttons */}
      <div
        data-testid="profile-comparison-caveat"
        className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
          <strong className="text-amber-600 dark:text-amber-300 font-semibold">Caveats:</strong>{' '}
          Finite 8-game Worlds 2026 sample (80 player-games, {allSupportedProPairs.length} pairs,
          Patch 16.20; n=16/role, n=1–4/pro)—not broad proof and not a solo-queue percentile.
          Public esports feed permission/ToS unresolved (private offline preview only). Clock
          alignment uses spawn anchor + zero-gold pause heuristic (±0.50s; CS@10 HUD-checked in 2/8
          games; *paused G1 excluded from early deaths = 70/80 unpaused rows; 30m not exported;
          missing/ended = null, never 0).
        </p>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {selectedPair && surfaceMode === 'player_vs_pro' && (
            <button
              type="button"
              data-testid="toggle-profile-match-breakdown"
              aria-expanded={showMatchBreakdown}
              onClick={() => setShowMatchBreakdown((prev) => !prev)}
              className="px-2 py-1 rounded text-[11px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
            >
              {showMatchBreakdown
                ? 'Hide Breakdown'
                : `Match Breakdown (${selectedPair.playerGameCount}G / ${selectedPair.proSampleGameCount}G)`}
            </button>
          )}
          <button
            type="button"
            data-testid="toggle-profile-methodology"
            aria-expanded={showMethodology}
            onClick={() => setShowMethodology((prev) => !prev)}
            className="px-2 py-1 rounded text-[11px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-700"
          >
            {showMethodology ? 'Hide Methodology' : 'Methodology & Limits'}
          </button>
        </div>
      </div>

      {/* Expandable Per-Match Breakdown */}
      {showMatchBreakdown && selectedPair && surfaceMode === 'player_vs_pro' && (
        <div
          data-testid="profile-match-breakdown"
          className="mt-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-2.5 space-y-2.5 overflow-x-auto"
        >
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mb-1">
              Searched Player Matches ({gameName}#{tagLine} ·{' '}
              {selectedPair.championId === 'ALL'
                ? `All ${selectedPair.roleDisplay}`
                : `${selectedPair.championId} · ${selectedPair.roleDisplay}`}
              )
            </h4>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500">
                  <th className="py-1 pr-2">Match ID</th>
                  <th className="py-1 px-2">Champ / Context</th>
                  {PRO_CHECKPOINT_MINUTES.map((m) => (
                    <th key={m} className="py-1 px-2 text-right">
                      {m}m CS
                    </th>
                  ))}
                  <th className="py-1 px-2 text-right">Deaths</th>
                  <th className="py-1 px-2 text-right">KP</th>
                  <th className="py-1 pl-2 text-right">DMG%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {selectedPair.matches.map((m) => (
                  <tr key={m.matchId} data-testid={`player-match-row-${m.matchId}`}>
                    <td className="py-1.5 pr-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {m.matchId}{' '}
                      <span className="text-[11px] font-normal text-slate-500">
                        ({m.gameDurationFormatted})
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {m.championId} · {m.win ? 'W' : 'L'} · Patch {m.patch}
                    </td>
                    {PRO_CHECKPOINT_MINUTES.map((min) => {
                      const cell = m.checkpoints[min];
                      return (
                        <td key={min} className="py-1.5 px-2 text-right whitespace-nowrap">
                          {cell.status === 'available' && cell.totalCs !== null ? (
                            <span
                              title={`Lane ${cell.laneCs} + Jungle ${cell.jungleCs}`}
                              className="font-bold text-slate-900 dark:text-white"
                            >
                              {cell.totalCs}
                            </span>
                          ) : cell.status === 'game_ended_before_checkpoint' ? (
                            <span className="text-[10px] text-slate-400">
                              Ended ({m.gameDurationFormatted})
                            </span>
                          ) : cell.status === 'timeline_not_loaded' ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-300">
                              Not Loaded
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-300">
                              Missing
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {m.wholeGame.totalDeaths ?? '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {m.wholeGame.killParticipation !== null
                        ? `${(m.wholeGame.killParticipation * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="py-1.5 pl-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {m.wholeGame.championDamageShare !== null
                        ? `${(m.wholeGame.championDamageShare * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {comparison.proPlayerSelection.proReferenceAvailableAfterFilters &&
            comparison.proSlice && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-extrabold text-sky-700 dark:text-cyan-300">
                    Worlds 2026 Pro Reference Games ({comparison.proSlice.selectionTitle} · Patch{' '}
                    {comparison.proSlice.patchShort})
                  </h4>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {verifiedVods.map((vod) => (
                      <a
                        key={vod.gameId}
                        href={vod.correctedHud10mUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 dark:text-cyan-400 underline font-semibold"
                      >
                        {vod.gameLabel} @10:00 (t={vod.correctedHud10mSeconds}s)
                      </a>
                    ))}
                  </div>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500">
                      <th className="py-1 pr-2">Pro Match</th>
                      <th className="py-1 px-2">Player</th>
                      {PRO_CHECKPOINT_MINUTES.map((m) => (
                        <th key={m} className="py-1 px-2 text-right">
                          {m}m CS
                        </th>
                      ))}
                      <th className="py-1 px-2 text-right">Deaths</th>
                      <th className="py-1 px-2 text-right">Team KP</th>
                      <th className="py-1 pl-2 text-right">DMG%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {comparison.proSlice.evidenceRows.map((row) => (
                      <tr key={row.observationKey}>
                        <td className="py-1.5 pr-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {row.gameLabel}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            ({row.trueInGameDurationFormatted})
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {row.summonerName} ({row.championId})
                        </td>
                        {PRO_CHECKPOINT_MINUTES.map((min) => {
                          const cell = row.checkpoints[min];
                          return (
                            <td key={min} className="py-1.5 px-2 text-right whitespace-nowrap">
                              {cell.hasExportedSnapshot && cell.totalCs !== null ? (
                                <span className="font-bold text-sky-700 dark:text-cyan-300">
                                  {cell.totalCs}
                                </span>
                              ) : !cell.reachedDuration ? (
                                <span className="text-[10px] text-slate-400">
                                  Ended ({row.trueInGameDurationFormatted})
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Unavailable</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                          {row.finalDeaths}
                        </td>
                        <td className="py-1.5 px-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                          {row.killParticipation !== null
                            ? `${(row.killParticipation * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="py-1.5 pl-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                          {row.championDamageShare !== null
                            ? `${(row.championDamageShare * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* Expandable Methodology & Sample Verification Limits */}
      {showMethodology && (
        <div
          data-testid="profile-methodology-details"
          className="mt-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-2.5 text-xs text-slate-700 dark:text-slate-300 space-y-1.5"
        >
          <p>
            <strong className="text-slate-900 dark:text-white">
              Same-Formula Verification (Finite 8-Game Sample):
            </strong>{' '}
            Checkpoint CS (`minionsKilled + jungleMinionsKilled`), Gold (`participantFrames.totalGold`
            vs `aligned_checkpoints.pGolds`, checked at 5m = 500 spawn base in the 8-game sample),
            and Level (`participantFrames.level` vs `pLevels`) are matched within ±30s on loaded
            `MatchTimelineDto` frames. Whole-game KP is computed from the exact 5 same-team players
            (`(K + A) / sum(teamKills)`) on both sides, correcting raw `livestats` KP when executions
            occur (`G2 vs HLE G2` Red side). Whole-game `MatchDto.goldEarned` vs `finalGold` is not
            assumed starting-gold/sellback equivalent and is omitted from whole-game deltas.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-white">
              Finite Sample &amp; Permission Caveats:
            </strong>{' '}
            8 Worlds 2026 games (80 player-games, {allSupportedProPairs.length} unique champion-role
            pairs; 37 pairs have n=1) on Patch 16.20—not a broad proof or solo-queue percentile.
            Public `lolesports`/`livestats` permission/ToS remains unresolved; this preview uses only
            the static offline sample.
          </p>
          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500">Alternate Views:</span>
            <button
              type="button"
              data-testid="surface-mode-catalog-btn"
              onClick={() => setSurfaceMode('pro_catalog')}
              className="px-2 py-0.5 rounded text-[11px] font-bold border bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
            >
              Pro Catalog ({allSupportedProPairs.length})
            </button>
            <button
              type="button"
              data-testid="surface-mode-demo-btn"
              onClick={() => {
                setSurfaceMode('manual_demo');
                if (Object.keys(demoInputs).length === 0) {
                  setDemoInputs(DEFAULT_DEMO_INPUTS);
                }
              }}
              className="px-2 py-0.5 rounded text-[11px] font-bold border bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
            >
              Demo Fallback
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProfileProComparisonTab;
