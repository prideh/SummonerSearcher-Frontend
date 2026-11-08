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
  getSupportedRoleChampionOptions,
} from './proBenchmarkEngine';
import {
  PRO_CHECKPOINT_MINUTES,
  type DemoCsInputMap,
  type ProCheckpointMinute,
  type ProRoleFilter,
  type RawProBenchmarkDataset,
} from './proBenchmarkTypes';
import {
  CHECKPOINT_TOLERANCE_MS,
  MAX_BOUNDED_TIMELINE_FETCHES,
  buildSearchedPlayerProComparison,
  sharedTimelineCache,
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
  selectedPairKey: string | null;
  selectedMatchId: 'ALL' | string;
  loadedTimelines: Record<string, MatchTimelineDto | null | undefined>;
  loadingTimelines: boolean;
  timelineFetchError: string | null;
  surfaceMode: TabSurfaceMode;
  showMatchBreakdown: boolean;
}

const createInitialPlayerUiState = (targetIdentityKey: string): PlayerScopedUiState => ({
  identityKey: targetIdentityKey,
  selectedPairKey: null,
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
  fetchTimeline = defaultFetchTimeline,
  dataset = DEFAULT_PRO_BENCHMARK_DATASET,
}) => {
  const allSupportedProPairs = useMemo(
    () => getSupportedRoleChampionOptions(dataset, 'ALL'),
    [dataset]
  );

  const identityKey = `${region.toLowerCase()}::${puuid}`;

  // Track mounted lifecycle, current player identity, and request generation in refs
  // so async timeline loaders never compare against a stale render closure.
  const isMountedRef = useRef<boolean>(true);
  const activeIdentityKeyRef = useRef<string>(identityKey);
  const requestGenerationRef = useRef<number>(0);

  const [playerUiState, setPlayerUiState] = useState<PlayerScopedUiState>(() =>
    createInitialPlayerUiState(identityKey)
  );
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  // Catalog / Manual Demo fallback state
  const [catalogRole, setCatalogRole] = useState<ProRoleFilter>('top');
  const [catalogChampion, setCatalogChampion] = useState<string>('KSante');
  const [demoInputs, setDemoInputs] = useState<DemoCsInputMap>({});

  // Invalidate any in-flight timeline requests on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  // Invalidate in-flight requests and reset player-scoped UI state when searched player identity changes
  useEffect(() => {
    if (activeIdentityKeyRef.current !== identityKey) {
      activeIdentityKeyRef.current = identityKey;
      requestGenerationRef.current += 1;
    }
    setPlayerUiState((prev) =>
      prev.identityKey === identityKey ? prev : createInitialPlayerUiState(identityKey)
    );
  }, [identityKey]);

  // Derive active UI values strictly for the current identityKey (prevents 1-frame stale leaks on switch)
  const isCurrentIdentityState = playerUiState.identityKey === identityKey;
  const selectedPairKey = isCurrentIdentityState ? playerUiState.selectedPairKey : null;
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
        prev.identityKey === identityKey ? prev : createInitialPlayerUiState(identityKey);
      return {
        ...base,
        ...updater(base),
        identityKey,
      };
    });
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

  // Merge shared cache entries for visible matches of this region
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
        selectedPairKey,
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
      selectedPairKey,
      selectedMatchId,
    ]
  );

  const selectedPair = comparison.selectedPair;

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
          : createInitialPlayerUiState(requestIdentityKey);
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

  // Catalog / Demo slice when browsing all 53 pro pairs or Manual Demo fallback
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

  return (
    <section
      aria-label="Pro CS Comparison"
      data-testid="profile-pro-comparison-tab"
      data-bound-puuid={puuid}
      data-bound-region={region}
      data-bound-identity={`${gameName}#${tagLine} (${region.toUpperCase()})`}
      data-source-mode={dataSourceMode}
      className="mt-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0b101d] p-2.5 text-slate-900 dark:text-slate-100 telemetry-nums"
    >
      {/* MODE 1: SEARCHED PLAYER VS PRO REFERENCE (Default Essentials View) */}
      {surfaceMode === 'player_vs_pro' && (
        <div className="space-y-2">
          {comparison.pairOptions.length === 0 ? (
            <div
              data-testid="no-positional-matches-state"
              className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 text-xs text-slate-600 dark:text-slate-300"
            >
              No positional Summoner&apos;s Rift matches found in loaded match history for{' '}
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
              {/* Compact 2-Column Essentials Filter Row: Champion·Role + Match Scope */}
              <div className="grid grid-cols-2 gap-1.5 items-end">
                <div className="min-w-0">
                  <label
                    htmlFor="player-pair-select"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 truncate"
                  >
                    Champion · Role
                  </label>
                  <select
                    id="player-pair-select"
                    data-testid="player-pair-select"
                    value={selectedPair?.pairKey ?? ''}
                    onChange={(e) => {
                      setSelectedPairKey(e.target.value);
                    }}
                    className="w-full min-w-0 truncate rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
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
                    htmlFor="player-match-scope-select"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5 truncate"
                  >
                    Match Scope
                  </label>
                  <select
                    id="player-match-scope-select"
                    data-testid="player-match-scope-select"
                    value={comparison.selectedMatchId}
                    onChange={(e) => setSelectedMatchId(e.target.value)}
                    className="w-full min-w-0 truncate rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="ALL">
                      All {selectedPair?.championId} · {selectedPair?.roleDisplay} (
                      {selectedPair?.playerGameCount ?? 0}G Mean)
                    </option>
                    {selectedPair?.matches.map((m) => (
                      <option key={m.matchId} value={m.matchId}>
                        {m.matchId} ({m.gameDurationFormatted} · {m.win ? 'W' : 'L'} · {m.patch})
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

              {/* Single-Line Context Strip */}
              {selectedPair && (
                <div
                  data-testid="comparison-context-bar"
                  className="flex flex-wrap items-center justify-between gap-1 text-[11px]"
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      data-testid="paired-selection-title"
                      className="font-extrabold text-xs text-slate-900 dark:text-white mr-0.5"
                    >
                      {selectedPair.roleDisplay} · {selectedPair.championId}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-cyan-300 border border-sky-500/30 font-semibold text-[10px]">
                      Player {comparison.activeMatches.length}G (
                      {selectedPair.queueLabels.join(', ') || 'Matchmade'} ·{' '}
                      {selectedPair.patches.join(', ') || 'Unknown'})
                    </span>
                    {selectedPair.proReferenceAvailable && comparison.proSlice ? (
                      <span
                        data-testid="pro-reference-context-badge"
                        className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-[10px]"
                      >
                        Pro {comparison.proSlice.matchingObservationCount}G Worlds 2026 (
                        {comparison.proSlice.playersInSlice.join(', ')} ·{' '}
                        {comparison.proSlice.patchShort})
                      </span>
                    ) : (
                      <span
                        data-testid="unsupported-pro-pair-badge"
                        className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold text-[10px]"
                      >
                        No Pro Reference in 8-Game Sample (0G for {selectedPair.championId} ·{' '}
                        {selectedPair.roleDisplay})
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
                        className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 transition-colors disabled:opacity-60"
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
                        {selectedPair.loadedTimelineCount}/{selectedPair.playerGameCount}G timelines
                        · L+J (±{CHECKPOINT_TOLERANCE_MS / 1000}s)
                      </span>
                    )}
                  </div>
                </div>
              )}


              {/* Unsupported Champion+Role Notice (when 0G in pro sample) */}
              {selectedPair && !selectedPair.proReferenceAvailable && (
                <div
                  data-testid="unsupported-pair-banner"
                  className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200"
                >
                  <span className="font-bold">
                    No Pro Reference for {selectedPair.championId} · {selectedPair.roleDisplay}:
                  </span>{' '}
                  0 games in the 8-game Worlds 2026 sample ({allSupportedProPairs.length} pairs
                  total). Player checkpoints are shown without unrelated fallback.
                </div>
              )}

              {/* 6 Paired Checkpoint Cards (5m / 10m / 15m / 20m / 25m / 30m) */}
              <div
                data-testid="paired-checkpoint-grid"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
              >
                {comparison.checkpoints.map((cp) => (
                  <div
                    key={cp.label}
                    data-testid={`paired-checkpoint-card-${cp.label}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2.5 flex flex-col justify-between"
                  >
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

                    {/* Player Value Block */}
                    <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                        <span className="font-bold uppercase">Player</span>
                        <span data-testid={`player-denom-${cp.label}`} className="font-semibold">
                          {cp.playerGamesReached}/{cp.playerTotalGames}G
                        </span>
                      </div>

                      {cp.playerStatus === 'available' && cp.playerMeanTotalCs !== null ? (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span
                              data-testid={`player-mean-cs-${cp.label}`}
                              className="text-lg font-extrabold text-slate-900 dark:text-white leading-none"
                            >
                              {cp.playerMeanTotalCs.toFixed(1)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">CS</span>
                            <span className="text-[10px] text-slate-500 ml-auto">
                              {cp.playerMeanCsPerMin?.toFixed(1)}/m
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            L:{cp.playerMeanLaneCs?.toFixed(1)} + J:{cp.playerMeanJungleCs?.toFixed(1)}
                          </div>
                        </div>
                      ) : cp.playerStatus === 'all_ended_before_checkpoint' ? (
                        <p
                          data-testid={`player-unavailable-${cp.label}`}
                          className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 py-1"
                        >
                          Ended &lt;{cp.label}
                        </p>
                      ) : cp.playerStatus === 'timeline_not_loaded' ? (
                        <p
                          data-testid={`player-unavailable-${cp.label}`}
                          className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 py-1"
                        >
                          Load Timeline
                        </p>
                      ) : (
                        <p
                          data-testid={`player-unavailable-${cp.label}`}
                          className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 py-1"
                        >
                          Counter Missing
                        </p>
                      )}
                    </div>

                    {/* Pro Reference Value Block */}
                    <div className="pt-2">
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
                              className="text-base font-extrabold text-indigo-700 dark:text-indigo-300 leading-none"
                            >
                              {cp.proMeanTotalCs.toFixed(1)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">CS</span>
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
                ))}
              </div>
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
              ← Back to Player vs Pro ({comparison.pairOptions.length})
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
          <strong className="text-amber-600 dark:text-amber-300 font-semibold">Note:</strong>{' '}
          Raw timeline CS (lane + jungle, ±30s; ended games &amp; missing counters excluded, never 0
          CS). Pro ref: 8 Worlds 2026 games (80 player-games, {allSupportedProPairs.length} pairs,
          patch 16.20; many n=1; 30m not exported; CS@10 HUD-checked in 2/8 games)—reference only,
          not a solo-queue percentile or grade.
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

      {/* Expandable Per-Match Breakdown (Player Matches + Pro Reference Matches) */}
      {showMatchBreakdown && selectedPair && surfaceMode === 'player_vs_pro' && (
        <div
          data-testid="profile-match-breakdown"
          className="mt-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-2.5 space-y-2.5 overflow-x-auto"
        >
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mb-1">
              Searched Player Matches ({gameName}#{tagLine} · {selectedPair.championId} ·{' '}
              {selectedPair.roleDisplay})
            </h4>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500">
                  <th className="py-1 pr-2">Match ID</th>
                  <th className="py-1 px-2">Context</th>
                  {PRO_CHECKPOINT_MINUTES.map((m) => (
                    <th key={m} className="py-1 px-2 text-right">
                      {m}m
                    </th>
                  ))}
                  <th className="py-1 pl-2 text-right">End CS</th>
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
                      {m.win ? 'Win' : 'Loss'} · {m.queueLabel} · Patch {m.patch}
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
                    <td className="py-1.5 pl-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                      {m.endTotalCsFromMatchDto ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedPair.proReferenceAvailable && comparison.proSlice && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h4 className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                  Worlds 2026 Pro Reference Games ({selectedPair.championId} ·{' '}
                  {selectedPair.roleDisplay} · Patch {comparison.proSlice.patchShort})
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
                        {m}m
                      </th>
                    ))}
                    <th className="py-1 pl-2 text-right">End CS</th>
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
                        {row.summonerName}
                      </td>
                      {PRO_CHECKPOINT_MINUTES.map((min) => {
                        const cell = row.checkpoints[min];
                        return (
                          <td key={min} className="py-1.5 px-2 text-right whitespace-nowrap">
                            {cell.hasExportedSnapshot && cell.totalCs !== null ? (
                              <span className="font-bold text-indigo-700 dark:text-indigo-300">
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
                      <td className="py-1.5 pl-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                        {row.finalCsAtGameEnd}
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
              Raw Counter Extraction (Why PowerSpike Points Are Excluded):
            </strong>{' '}
            Player CS checkpoints are computed directly from raw `MatchTimelineDto` participant
            frames (`minionsKilled + jungleMinionsKilled`) matched within ±30s of each target
            minute (`5m..30m`) and bound by explicit `matchId` and `puuid` participant resolution.
            Lossy `powerSpikeTimelines` points (which floor timestamps and default missing counters
            to `0`) are never used.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-white">Pro Sample Coverage:</strong> 8
            Worlds 2026 games (80 player-games, {allSupportedProPairs.length} unique champion-role
            pairs in JSON; 37 pairs have n=1; prior report heading listed 57) on patch 16.20.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-white">
              Partial HUD Verification &amp; Pause Heuristic:
            </strong>{' '}
            Independent broadcast HUD verification covered only `CS@10` for 20 players in `IG vs TES
            G1+G2` (corrected 10:00 VOD timestamps: `t=3695s` and `t=6759s`; dataset VOD locator was
            ~73–74s early). Pause subtraction uses a zero-gold freeze heuristic in `/details`, not
            an authenticated `gameState` clock across all endpoints. Item build timings are excluded
            due to Data Dragon `16.22.1` vs tournament `16.20` metadata mismatch.
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

