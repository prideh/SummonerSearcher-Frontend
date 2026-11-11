import React, { useMemo, useState } from 'react';
import {
  DEFAULT_PRO_BENCHMARK_DATASET,
  PRO_ROLE_LABELS,
  PRO_ROLE_ORDER,
  VERIFIED_HUD_10M_VOD_BY_GAME_ID,
  computeProComparisonSlice,
  evaluateDemoCsComparisons,
  formatRoleDisplay,
  getAllUniqueChampionsInDataset,
  getSupportedRoleChampionOptions,
} from './proBenchmarkEngine';
import {
  PRO_CHECKPOINT_MINUTES,
  type ComparisonMode,
  type DemoCsInputMap,
  type ProCheckpointMinute,
  type ProCheckpointSummary,
  type ProRoleFilter,
  type RawProBenchmarkDataset,
} from './proBenchmarkTypes';
import ProfileProComparisonTab from './ProfileProComparisonTab';
import {
  RECORDED_REVIEW_PROFILES,
  type RecordedReviewPlayerProfile,
} from './recordedPlayerContractSample';
import type { MatchDto } from '../../types/match';
import type { MatchTimelineDto } from '../../types/timeline';

export type PreviewSurface = 'standalone' | 'profile';

export interface ProComparisonPreviewProps {
  dataset?: RawProBenchmarkDataset;
  initialRole?: ProRoleFilter;
  initialChampionId?: string;
  initialMode?: ComparisonMode;
  initialSurface?: PreviewSurface;
}

const SYNTHETIC_DEMO_PRESETS: Record<ProRoleFilter, DemoCsInputMap> = {
  ALL: { 5: '35', 10: '78', 15: '122', 20: '165', 25: '205', 30: '240' },
  top: { 5: '34', 10: '79', 15: '121', 20: '164', 25: '202', 30: '238' },
  jungle: { 5: '36', 10: '72', 15: '112', 20: '148', 25: '180', 30: '210' },
  mid: { 5: '38', 10: '86', 15: '136', 20: '182', 25: '224', 30: '260' },
  bottom: { 5: '37', 10: '84', 15: '134', 20: '188', 25: '238', 30: '275' },
  support: { 5: '6', 10: '14', 15: '21', 20: '26', 25: '30', 30: '34' },
};

function resolveDefaultSurface(propSurface?: PreviewSurface): PreviewSurface {
  if (propSurface) return propSurface;
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('surface') === 'profile') {
      return 'profile';
    }
  }
  return 'standalone';
}

function resolveDefaultProfileKey(): string {
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const fixture = params.get('fixture');
    if (fixture && RECORDED_REVIEW_PROFILES[fixture]) {
      return fixture;
    }
  }
  return 'euw_full_contract_sample';
}

export const ProComparisonPreview: React.FC<ProComparisonPreviewProps> = ({
  dataset = DEFAULT_PRO_BENCHMARK_DATASET,
  initialRole = 'top',
  initialChampionId = 'KSante',
  initialMode = 'REFERENCE_ONLY',
  initialSurface,
}) => {
  const [activeSurface, setActiveSurface] = useState<PreviewSurface>(() =>
    resolveDefaultSurface(initialSurface)
  );
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>(() =>
    resolveDefaultProfileKey()
  );
  const [activeMockProfileTab, setActiveMockProfileTab] = useState<'overview' | 'pro_comparison'>(
    'pro_comparison'
  );
  const [showReviewControls, setShowReviewControls] = useState<boolean>(false);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);
  const [customJsonInput, setCustomJsonInput] = useState<string>('');
  const [customJsonError, setCustomJsonError] = useState<string | null>(null);
  const [customProfile, setCustomProfile] = useState<RecordedReviewPlayerProfile | null>(null);

  const [selectedRole, setSelectedRole] = useState<ProRoleFilter>(initialRole);
  const [selectedChampionId, setSelectedChampionId] = useState<string>(initialChampionId);
  const [championSearchText, setChampionSearchText] = useState<string>('');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(initialMode);
  const [demoInputs, setDemoInputs] = useState<DemoCsInputMap>({});
  const [showEvidence, setShowEvidence] = useState<boolean>(false);
  const [showMethodologyDetails, setShowMethodologyDetails] = useState<boolean>(false);

  const roleFilteredOptions = useMemo(
    () => getSupportedRoleChampionOptions(dataset, selectedRole),
    [dataset, selectedRole]
  );

  const allUniqueChampions = useMemo(
    () => getAllUniqueChampionsInDataset(dataset),
    [dataset]
  );

  const activeChampionFilter = useMemo(() => {
    const trimmedSearch = championSearchText.trim();
    if (trimmedSearch.length > 0) {
      return trimmedSearch;
    }
    return selectedChampionId;
  }, [championSearchText, selectedChampionId]);

  const slice = useMemo(
    () =>
      computeProComparisonSlice(dataset, {
        role: selectedRole,
        championId: activeChampionFilter,
      }),
    [dataset, selectedRole, activeChampionFilter]
  );

  const demoComparisons = useMemo(
    () => evaluateDemoCsComparisons(slice, demoInputs),
    [slice, demoInputs]
  );

  const handleRoleChange = (newRole: ProRoleFilter) => {
    setSelectedRole(newRole);
  };

  const handleChampionDropdownChange = (value: string) => {
    setChampionSearchText('');
    if (value.includes('::')) {
      const [pairRole, pairChamp] = value.split('::') as [ProRoleFilter, string];
      setSelectedRole(pairRole);
      setSelectedChampionId(pairChamp);
    } else {
      setSelectedChampionId(value);
    }
  };

  const handleQuickSelectPair = (role: ProRoleFilter, championId: string) => {
    setChampionSearchText('');
    setSelectedRole(role);
    setSelectedChampionId(championId);
  };

  const handleDemoInputChange = (minute: ProCheckpointMinute, val: string) => {
    setDemoInputs((prev) => ({
      ...prev,
      [minute]: val,
    }));
  };

  const handleFillSyntheticDemo = () => {
    setComparisonMode('DEMO_INPUT');
    setDemoInputs(SYNTHETIC_DEMO_PRESETS[selectedRole] ?? SYNTHETIC_DEMO_PRESETS.ALL);
  };

  const handleClearDemoInputs = () => {
    setDemoInputs({});
  };

  const igTesG1 = useMemo(
    () => (dataset.games ?? []).find((g) => g.gameId === '115660540726095110') ?? null,
    [dataset]
  );

  const renderCheckpointDenominatorBadge = (cp: ProCheckpointSummary) => {
    if (cp.totalSliceGames === 0) return '0/0G';
    if (cp.status === 'AVAILABLE') {
      if (cp.shortGamesEndedBeforeMarkCount > 0) {
        return `${cp.availableSnapshotCount}/${cp.totalSliceGames}G (${cp.shortGamesEndedBeforeMarkCount} ended <${cp.minuteMark}m)`;
      }
      return `${cp.availableSnapshotCount}/${cp.totalSliceGames}G`;
    }
    if (cp.unavailableReason === 'ALL_GAMES_ENDED_BEFORE_MARK') {
      return `0/${cp.totalSliceGames}G reached`;
    }
    return `0/${cp.totalSliceGames}G (${cp.gamesReachedDurationCount} reached 30m)`;
  };

  const renderCheckpointCard = (minuteMark: ProCheckpointMinute) => {
    const cp = slice.checkpoints[minuteMark];
    const demoComp = demoComparisons[minuteMark];
    const isAvailable = cp.status === 'AVAILABLE' && cp.meanTotalCs !== null;

    return (
      <article
        key={minuteMark}
        data-testid={`checkpoint-card-${minuteMark}m`}
        aria-label={`Total CS at ${minuteMark} minutes`}
        className={`rounded-lg border p-2.5 flex flex-col justify-between telemetry-nums ${
          isAvailable
            ? 'bg-slate-900/90 border-slate-700/80 text-slate-100'
            : 'bg-slate-950/70 border-slate-800/80 text-slate-400'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800/90">
            <span className="text-xs font-extrabold text-sky-300">{minuteMark}m</span>
            <span
              data-testid={`checkpoint-denom-${minuteMark}m`}
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                isAvailable
                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                  : 'bg-amber-950/40 text-amber-200 border-amber-800/60'
              }`}
            >
              {renderCheckpointDenominatorBadge(cp)}
            </span>
          </div>

          {isAvailable && cp.meanTotalCs !== null ? (
            <div className="mt-2 space-y-1">
              <div
                data-testid={`checkpoint-mean-cs-${minuteMark}m`}
                className="text-xl sm:text-2xl font-black text-white tracking-tight whitespace-nowrap"
              >
                {cp.meanTotalCs.toFixed(1)}{' '}
                <span className="text-xs font-bold text-slate-400">CS</span>
              </div>

              <div className="flex items-center justify-between gap-1 text-[11px] text-slate-300">
                <span>{cp.meanTotalCsPerMin?.toFixed(1)}/m</span>
                <span
                  data-testid={`checkpoint-range-cs-${minuteMark}m`}
                  className="text-slate-400 whitespace-nowrap"
                >
                  {cp.minTotalCs === cp.maxTotalCs
                    ? `${cp.minTotalCs} CS`
                    : `${cp.minTotalCs}–${cp.maxTotalCs}`}
                </span>
              </div>

              <div className="pt-1 border-t border-slate-800/80 space-y-0.5 text-[10px] text-slate-300">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400">Gold</span>
                  <span data-testid={`checkpoint-mean-gold-${minuteMark}m`} className="font-semibold">
                    {cp.meanTotalGold !== null ? `${Math.round(cp.meanTotalGold).toLocaleString('en-US')}g` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400">Level</span>
                  <span data-testid={`checkpoint-mean-level-${minuteMark}m`} className="font-semibold">
                    {cp.meanLevel !== null ? cp.meanLevel.toFixed(1) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-400">Deaths</span>
                  <span
                    data-testid={`checkpoint-mean-deaths-${minuteMark}m`}
                    className="font-semibold"
                  >
                    {cp.earlyTotalDeathsStatus === 'AVAILABLE' && cp.meanEarlyTotalDeaths !== null
                      ? `${cp.meanEarlyTotalDeaths.toFixed(2)}${
                          cp.earlyTotalDeathsPausedGamesExcludedCount > 0
                            ? ` (${cp.earlyTotalDeathsAvailableCount}G unpaused)`
                            : ''
                        }`
                      : cp.earlyTotalDeathsUnavailableReason === 'ALL_REACHED_GAMES_PAUSED'
                        ? 'Paused excl.'
                        : 'Not exported'}
                  </span>
                </div>
              </div>

              {cp.shortGamesEndedBeforeMarkCount > 0 && (
                <p
                  data-testid={`checkpoint-short-note-${minuteMark}m`}
                  className="text-[10px] text-amber-300 leading-tight pt-0.5"
                >
                  {cp.shortGamesEndedBeforeMarkCount} ended &lt;{minuteMark}m excluded (no 0 CS)
                </p>
              )}
            </div>
          ) : (
            <div
              data-testid={`checkpoint-unavailable-${minuteMark}m`}
              className="mt-2 space-y-0.5"
            >
              <div className="text-sm font-extrabold text-amber-300">Unavailable</div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {cp.unavailableReason === 'ALL_GAMES_ENDED_BEFORE_MARK'
                  ? `0/${cp.totalSliceGames}G reached ${minuteMark}:00 (no post-game zeros)`
                  : 'Not in 25m sample export'}
              </p>
            </div>
          )}
        </div>

        {comparisonMode === 'DEMO_INPUT' && (
          <div
            data-testid={`demo-comparison-box-${minuteMark}m`}
            className="mt-2 pt-2 border-t border-slate-800 space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <label
                htmlFor={`demo-cs-input-${minuteMark}m`}
                className="text-[10px] font-bold uppercase text-amber-300"
              >
                Demo @{minuteMark}m
              </label>
              <span className="text-[10px] text-amber-200/90">Demo</span>
            </div>
            <input
              id={`demo-cs-input-${minuteMark}m`}
              data-testid={`demo-cs-input-${minuteMark}m`}
              type="number"
              min={0}
              max={600}
              step={1}
              inputMode="numeric"
              disabled={!isAvailable}
              placeholder={isAvailable ? `${Math.round(cp.meanTotalCs ?? 80)}` : 'N/A'}
              value={demoInputs[minuteMark] ?? ''}
              onChange={(e) => handleDemoInputChange(minuteMark, e.target.value)}
              className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div
              data-testid={`demo-delta-${minuteMark}m`}
              className="text-[11px] leading-tight"
            >
              {demoComp.canCompare && demoComp.deltaCs !== null ? (
                <span
                  className={`font-bold ${
                    demoComp.deltaCs >= 0 ? 'text-emerald-300' : 'text-amber-200'
                  }`}
                >
                  {demoComp.deltaCs > 0 ? '+' : ''}
                  {demoComp.deltaCs.toFixed(1)} CS (Demo)
                </span>
              ) : (
                <span className="text-slate-500">
                  {isAvailable ? 'Enter demo CS' : 'Unavailable'}
                </span>
              )}
            </div>
          </div>
        )}
      </article>
    );
  };

  const activeReviewProfile: RecordedReviewPlayerProfile =
    customProfile ??
    RECORDED_REVIEW_PROFILES[selectedProfileKey] ??
    RECORDED_REVIEW_PROFILES.euw_full_contract_sample;

  const handleLoadCustomJson = () => {
    setCustomJsonError(null);
    try {
      const parsed = JSON.parse(customJsonInput) as {
        puuid?: string;
        region?: string;
        gameName?: string;
        tagLine?: string;
        visibleMatches?: MatchDto[];
        timelinesByMatchId?: Record<string, MatchTimelineDto>;
      };
      if (!parsed.puuid || !Array.isArray(parsed.visibleMatches)) {
        setCustomJsonError(
          'JSON must include "puuid" (string) and "visibleMatches" (MatchDto[]), plus optional "timelinesByMatchId".'
        );
        return;
      }
      setCustomProfile({
        key: 'custom_local_json',
        puuid: parsed.puuid,
        region: parsed.region || 'EUW1',
        gameName: parsed.gameName || 'LocalPlayer',
        tagLine: parsed.tagLine || 'JSON',
        summonerLevel: 300,
        profileIconId: 29,
        tier: 'DIAMOND',
        rank: 'I',
        leaguePoints: 75,
        wins: 50,
        losses: 45,
        visibleMatches: parsed.visibleMatches,
        timelinesByMatchId: parsed.timelinesByMatchId ?? {},
      });
      setShowJsonInspector(false);
    } catch (err) {
      setCustomJsonError(
        err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON payload.'
      );
    }
  };

  return (
    <div
      data-testid="pro-comparison-preview-root"
      className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-sky-500/20 selection:text-sky-300"
    >
      {/* Standalone Header (only shown when in standalone Reference / Demo surface) */}
      {activeSurface === 'standalone' && (
        <header className="border-b border-slate-800 bg-slate-950">
          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="pro-preview-heading"
                className="text-sm sm:text-base font-extrabold tracking-tight text-white"
              >
                Pro CS Reference
              </h1>
              <span
                data-testid="dataset-scope-strip"
                className="text-xs text-slate-300 telemetry-nums"
              >
                Worlds 2026 Sample · {slice.totalGamesInDataset} Games (
                {slice.totalObservationsInDataset} Player-Games ·{' '}
                {slice.totalRoleChampionPairsInDataset} Pairs · Patch {slice.patchShort})
              </span>
            </div>

            <div
              data-testid="comparison-mode-banner"
              className="flex flex-wrap items-center gap-1.5"
            >
              <span
                data-testid="mode-status-badge"
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  comparisonMode === 'REFERENCE_ONLY'
                    ? 'bg-slate-900 text-slate-200 border-slate-700'
                    : 'bg-amber-950/90 text-amber-200 border-amber-700/80'
                }`}
              >
                {comparisonMode === 'REFERENCE_ONLY'
                  ? 'Reference Only (No User Data)'
                  : 'Demo Input Mode (Not Live User Stats)'}
              </span>
              <button
                type="button"
                data-testid="mode-btn-profile-tab"
                aria-pressed={false}
                onClick={() => setActiveSurface('profile')}
                className="px-2 py-1 rounded text-xs font-bold border bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Profile Tab
              </button>
              <button
                type="button"
                data-testid="mode-btn-reference-only"
                aria-pressed={comparisonMode === 'REFERENCE_ONLY'}
                onClick={() => {
                  setActiveSurface('standalone');
                  setComparisonMode('REFERENCE_ONLY');
                }}
                className={`px-2 py-1 rounded text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  comparisonMode === 'REFERENCE_ONLY'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                Reference
              </button>
              <button
                type="button"
                data-testid="mode-btn-demo-input"
                aria-pressed={comparisonMode === 'DEMO_INPUT'}
                onClick={() => {
                  setActiveSurface('standalone');
                  setComparisonMode('DEMO_INPUT');
                }}
                className={`px-2 py-1 rounded text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  comparisonMode === 'DEMO_INPUT'
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                Demo CS Input
              </button>
              {comparisonMode === 'DEMO_INPUT' && (
                <>
                  <button
                    type="button"
                    data-testid="btn-fill-synthetic-demo"
                    onClick={handleFillSyntheticDemo}
                    className="px-2 py-1 rounded text-xs font-semibold bg-slate-800 text-amber-200 border border-amber-700/60 hover:bg-slate-700"
                  >
                    Fill Demo
                  </button>
                  <button
                    type="button"
                    data-testid="btn-clear-demo"
                    onClick={handleClearDemoInputs}
                    className="px-2 py-1 rounded text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 space-y-2.5">
        {activeSurface === 'profile' ? (
          <div data-testid="profile-tab-review-surface" className="space-y-2">
            {/* Simulated SummonerInfo Profile Card with [ Profile Overview | Pro CS Comparison ] Tabs */}
            <div
              data-testid="mock-summoner-profile-card"
              className="dark bg-[#111827] border border-slate-800 p-2.5 sm:p-3.5 rounded-lg shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-cyan-500/60 text-[11px] font-extrabold text-cyan-300 shrink-0">
                    Lv.{activeReviewProfile.summonerLevel}
                  </span>
                  <h1
                    data-testid="review-profile-riot-id"
                    className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate"
                  >
                    <span data-testid="pro-comparison-identity-badge">
                      {activeReviewProfile.gameName}#{activeReviewProfile.tagLine} (
                      {activeReviewProfile.region})
                    </span>
                  </h1>
                  <span
                    data-testid="pro-comparison-datasource-badge"
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40"
                  >
                    {customProfile
                      ? 'Local JSON Data (Not Live API)'
                      : 'Synthetic test profile / Not real player data'}
                  </span>
                </div>

                {/* Profile-Level Tabs + Review Controls Toggle */}
                <div
                  role="tablist"
                  aria-label="Searched Player Profile Sections"
                  data-testid="review-summoner-profile-tabs"
                  className="flex flex-wrap items-center gap-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMockProfileTab === 'overview'}
                    data-testid="review-profile-tab-overview"
                    onClick={() => setActiveMockProfileTab('overview')}
                    className={`px-2 py-1 rounded text-xs font-extrabold transition-colors border ${
                      activeMockProfileTab === 'overview'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMockProfileTab === 'pro_comparison'}
                    data-testid="review-profile-tab-pro-comparison"
                    onClick={() => setActiveMockProfileTab('pro_comparison')}
                    className={`px-2 py-1 rounded text-xs font-extrabold transition-colors border ${
                      activeMockProfileTab === 'pro_comparison'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Pro Comparison (Preview)
                  </button>
                  <button
                    type="button"
                    data-testid="toggle-review-controls"
                    aria-expanded={showReviewControls}
                    onClick={() => setShowReviewControls((prev) => !prev)}
                    className="px-2 py-1 rounded text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                  >
                    {showReviewControls ? 'Hide Review Controls' : 'Review Controls'}
                  </button>
                </div>
              </div>

              {/* Collapsible Review Controls (Fixture Picker + Local JSON + Standalone Surface Switcher) */}
              {showReviewControls && (
                <section
                  aria-label="Review Controls"
                  data-testid="profile-review-sandbox-bar"
                  className="mt-2 rounded border border-slate-800 bg-slate-950/90 p-2.5 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-300">Test Profile:</span>
                      <button
                        type="button"
                        data-testid="switch-review-player-full"
                        onClick={() => {
                          setCustomProfile(null);
                          setSelectedProfileKey('euw_full_contract_sample');
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          !customProfile && selectedProfileKey === 'euw_full_contract_sample'
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        Synthetic: FullContract#EUW (22G / Recent-20 Default)
                      </button>
                      <button
                        type="button"
                        data-testid="switch-review-player-euw"
                        onClick={() => {
                          setCustomProfile(null);
                          setSelectedProfileKey('euw_top_specialist');
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          !customProfile && selectedProfileKey === 'euw_top_specialist'
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        Synthetic: BladeRunner#EUW (3G Partial · Unknown KP/DMG)
                      </button>
                      <button
                        type="button"
                        data-testid="switch-review-player-kr"
                        onClick={() => {
                          setCustomProfile(null);
                          setSelectedProfileKey('kr_mid_specialist');
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          !customProfile && selectedProfileKey === 'kr_mid_specialist'
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        Synthetic: ArcaneWave#KR1 (1G Mid Partial)
                      </button>
                      <button
                        type="button"
                        data-testid="toggle-local-json-inspector"
                        onClick={() => setShowJsonInspector((prev) => !prev)}
                        className="px-2 py-0.5 rounded text-xs font-bold bg-slate-900 text-amber-300 border border-amber-700/60 hover:bg-slate-800"
                      >
                        {showJsonInspector ? 'Hide JSON Loader' : 'Load Local JSON'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-400">Standalone:</span>
                      <button
                        type="button"
                        data-testid="mode-btn-reference-only"
                        onClick={() => {
                          setActiveSurface('standalone');
                          setComparisonMode('REFERENCE_ONLY');
                        }}
                        className="px-2 py-0.5 rounded text-xs font-bold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800"
                      >
                        Reference (53 Pairs)
                      </button>
                      <button
                        type="button"
                        data-testid="mode-btn-demo-input"
                        onClick={() => {
                          setActiveSurface('standalone');
                          setComparisonMode('DEMO_INPUT');
                        }}
                        className="px-2 py-0.5 rounded text-xs font-bold bg-slate-900 text-amber-300 border border-amber-700/60 hover:bg-slate-800"
                      >
                        Demo CS Input
                      </button>
                    </div>
                  </div>

                  {showJsonInspector && (
                    <div
                      data-testid="local-json-inspector-panel"
                      className="rounded border border-slate-800 bg-slate-900/90 p-2 space-y-1.5"
                    >
                      <div className="text-[11px] font-bold text-slate-200">
                        Client-Side Local JSON Inspector (Paste real exported MatchDto[] + MatchTimelineDto JSON — 100% in-browser)
                      </div>
                      <textarea
                        aria-label="Paste local MatchDto and MatchTimelineDto JSON"
                        data-testid="local-json-textarea"
                        rows={3}
                        value={customJsonInput}
                        onChange={(e) => setCustomJsonInput(e.target.value)}
                        placeholder='{"puuid":"...","region":"EUW1","gameName":"Player","tagLine":"EUW","visibleMatches":[...],"timelinesByMatchId":{...}}'
                        className="w-full rounded bg-slate-950 border border-slate-700 p-1.5 text-xs font-mono text-slate-200"
                      />
                      {customJsonError && (
                        <p className="text-xs text-rose-400" role="alert">
                          {customJsonError}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="apply-local-json-btn"
                          onClick={handleLoadCustomJson}
                          className="px-2.5 py-1 rounded text-xs font-bold bg-sky-500 text-slate-950"
                        >
                          Apply Local JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowJsonInspector(false)}
                          className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {activeMockProfileTab === 'overview' ? (
                <div
                  data-testid="review-profile-overview-placeholder"
                  className="mt-2.5 rounded-lg border border-slate-800 bg-[#0b101d] p-3 text-xs text-slate-300"
                >
                  Standard <code className="text-cyan-300">SummonerInfo</code> Overview tab (renders{' '}
                  <code className="text-slate-200">RankedInfo</code> &amp;{' '}
                  <code className="text-slate-200">ImprovementStatsSection</code>). Switch to the{' '}
                  <button
                    type="button"
                    onClick={() => setActiveMockProfileTab('pro_comparison')}
                    className="underline font-bold text-cyan-400"
                  >
                    Pro CS Comparison
                  </button>{' '}
                  tab to view searched-player CS vs same champion/role Worlds 2026 pro reference.
                </div>
              ) : (
                <ProfileProComparisonTab
                  key={`${activeReviewProfile.region}::${activeReviewProfile.puuid}`}
                  puuid={activeReviewProfile.puuid}
                  region={activeReviewProfile.region}
                  gameName={activeReviewProfile.gameName}
                  tagLine={activeReviewProfile.tagLine}
                  visibleMatches={activeReviewProfile.visibleMatches}
                  initialTimelinesByMatchId={activeReviewProfile.timelinesByMatchId}
                  dataSourceMode={customProfile ? 'local_json' : 'synthetic_test_profile'}
                  dataset={dataset}
                />
              )}
            </div>
          </div>
        ) : (
          <>
        {/* Controls Bar: Role Pills + Champion Dropdown + Quick Filter */}
        <section
          aria-label="Role and Champion Filter"
          className="rounded-lg border border-slate-800 bg-slate-900/75 p-3 space-y-2.5"
        >
          <div
            role="group"
            aria-label="Filter by Role"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(['ALL', ...PRO_ROLE_ORDER] as ProRoleFilter[]).map((roleKey) => {
              const isActive = selectedRole === roleKey;
              const roleCount = roleKey === 'ALL' ? 80 : 16;
              return (
                <button
                  key={roleKey}
                  type="button"
                  data-testid={`role-pill-${roleKey}`}
                  aria-pressed={isActive}
                  onClick={() => handleRoleChange(roleKey)}
                  className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors telemetry-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-950 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {PRO_ROLE_LABELS[roleKey]} ({roleCount}G)
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="pro-champion-select"
                className="block text-[11px] font-bold text-slate-300 mb-1"
              >
                Champion ({roleFilteredOptions.length} in {formatRoleDisplay(selectedRole)})
              </label>
              <select
                id="pro-champion-select"
                data-testid="pro-champion-select"
                value={
                  selectedChampionId === 'ALL'
                    ? 'ALL'
                    : roleFilteredOptions.some(
                        (o) =>
                          o.championId.toLowerCase() === selectedChampionId.toLowerCase()
                      )
                    ? `${
                        roleFilteredOptions.find(
                          (o) =>
                            o.championId.toLowerCase() === selectedChampionId.toLowerCase()
                        )!.role
                      }::${
                        roleFilteredOptions.find(
                          (o) =>
                            o.championId.toLowerCase() === selectedChampionId.toLowerCase()
                        )!.championId
                      }`
                    : selectedChampionId
                }
                onChange={(e) => handleChampionDropdownChange(e.target.value)}
                className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="ALL">
                  All {formatRoleDisplay(selectedRole)} Champions (
                  {selectedRole === 'ALL' ? '80G' : '16G'})
                </option>
                {roleFilteredOptions.map((opt) => (
                  <option
                    key={`${opt.role}::${opt.championId}`}
                    value={`${opt.role}::${opt.championId}`}
                  >
                    {opt.championId} ({formatRoleDisplay(opt.role)} · {opt.sampleCount}G —{' '}
                    {opt.players.join(', ')})
                  </option>
                ))}
                {selectedRole !== 'ALL' && (
                  <optgroup label="Other Sample Champions (0G in selected role)">
                    {allUniqueChampions
                      .filter(
                        (c) =>
                          !roleFilteredOptions.some(
                            (o) => o.championId.toLowerCase() === c.toLowerCase()
                          )
                      )
                      .map((c) => (
                        <option key={`other-${c}`} value={c}>
                          {c} (0G in {formatRoleDisplay(selectedRole)})
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="pro-champion-search"
                className="block text-[11px] font-bold text-slate-300 mb-1"
              >
                Quick Champion Filter
              </label>
              <div className="flex gap-1.5">
                <input
                  id="pro-champion-search"
                  data-testid="pro-champion-search"
                  type="text"
                  value={championSearchText}
                  onChange={(e) => setChampionSearchText(e.target.value)}
                  placeholder="Filter champion (e.g. Syndra, Qiyana)..."
                  className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                {championSearchText.trim().length > 0 && (
                  <button
                    type="button"
                    data-testid="btn-clear-champion-search"
                    onClick={() => setChampionSearchText('')}
                    className="shrink-0 px-2 py-1.5 rounded text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Main View: Selected Reference + 6 Checkpoints + Essential Caveat Line */}
        <section
          aria-labelledby="checkpoint-section-heading"
          className="rounded-lg border border-slate-800 bg-slate-900/75 p-3 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="checkpoint-section-heading"
                data-testid="active-selection-title"
                className="text-sm sm:text-base font-extrabold text-white"
              >
                {slice.selectionTitle}
              </h2>
              <span
                data-testid="active-selection-sample-badge"
                className={`px-2 py-0.5 rounded text-xs font-bold border telemetry-nums ${
                  slice.isSupportedSelection
                    ? 'bg-sky-950 text-sky-200 border-sky-700/80'
                    : 'bg-amber-950 text-amber-200 border-amber-700/80'
                }`}
              >
                {slice.isSupportedSelection
                  ? `${slice.matchingObservationCount}G Sample (${slice.playersInSlice.join(', ')})`
                  : '0G in Sample'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300 telemetry-nums">
              <span className="text-slate-400">Mean CS · Gold · Level · Early Deaths</span>
              {slice.isSupportedSelection && (
                <span
                  data-testid="standalone-whole-game-summary"
                  className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-200"
                >
                  Whole-Game: KP{' '}
                  {slice.wholeGameSummary.killParticipation.mean !== null
                    ? `${(slice.wholeGameSummary.killParticipation.mean * 100).toFixed(1)}%`
                    : 'N/A'}{' '}
                  · DMG{' '}
                  {slice.wholeGameSummary.championDamageShare.mean !== null
                    ? `${(slice.wholeGameSummary.championDamageShare.mean * 100).toFixed(1)}%`
                    : 'N/A'}{' '}
                  · Deaths{' '}
                  {slice.wholeGameSummary.totalDeaths.mean !== null
                    ? slice.wholeGameSummary.totalDeaths.mean.toFixed(1)
                    : 'N/A'}{' '}
                  · CS/m{' '}
                  {slice.wholeGameSummary.csPerMin.mean !== null
                    ? slice.wholeGameSummary.csPerMin.mean.toFixed(2)
                    : 'N/A'}
                </span>
              )}
            </div>
          </div>

          {!slice.isSupportedSelection ? (
            <div
              data-testid="unsupported-selection-state"
              role="region"
              aria-label="Unsupported champion or role selection"
              className="rounded border border-amber-700/80 bg-amber-950/25 p-3 space-y-2"
            >
              <p className="text-xs text-amber-100">{slice.unsupportedReason}</p>
              <div className="flex flex-wrap items-center gap-2">
                {slice.alternateRolesForChampion.map((alt) => (
                  <button
                    key={`switch-${alt.role}-${alt.championId}`}
                    type="button"
                    data-testid={`switch-supported-${alt.role}-${alt.championId}`}
                    onClick={() => handleQuickSelectPair(alt.role, alt.championId)}
                    className="px-2.5 py-1 rounded text-xs font-bold bg-sky-500 text-slate-950 hover:bg-sky-400"
                  >
                    Switch to {formatRoleDisplay(alt.role)} · {alt.championId} ({alt.sampleCount}G)
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="btn-show-role-baseline"
                  onClick={() => {
                    setChampionSearchText('');
                    setSelectedChampionId('ALL');
                  }}
                  className="px-2.5 py-1 rounded text-xs font-bold bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700"
                >
                  All {formatRoleDisplay(selectedRole)} Champions
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid="checkpoint-cards-grid"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
            >
              {PRO_CHECKPOINT_MINUTES.map((m) => renderCheckpointCard(m))}
            </div>
          )}

          {/* Essential Caveat Line + On-Demand Evidence & Methodology Buttons */}
          <div
            data-testid="inline-comparison-caveats"
            className="pt-2 border-t border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-2 text-[11px] text-slate-300"
          >
            <p className="leading-snug">
              <strong className="text-amber-300">Note:</strong> Small pro reference (8 Worlds 2026
              games / 80 player-games, patch 16.20)—not a solo-queue target or percentile. No live
              user stats connected. Ended games excluded (never 0 CS); 30m not in dataset export.
              CS@10 HUD-checked in 2/8 games.
            </p>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {slice.isSupportedSelection && (
                <button
                  type="button"
                  data-testid="btn-toggle-evidence"
                  aria-expanded={showEvidence}
                  onClick={() => setShowEvidence((prev) => !prev)}
                  className="px-2.5 py-1 rounded text-xs font-bold bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {showEvidence
                    ? `Hide Match Evidence (${slice.evidenceRows.length}G)`
                    : `Match Evidence (${slice.evidenceRows.length}G)`}
                </button>
              )}
              <button
                type="button"
                data-testid="btn-toggle-methodology"
                aria-expanded={showMethodologyDetails}
                onClick={() => setShowMethodologyDetails((prev) => !prev)}
                className="px-2.5 py-1 rounded text-xs font-bold bg-slate-900 text-sky-300 border border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {showMethodologyDetails ? 'Hide Methodology' : 'Methodology & Limits'}
              </button>
            </div>
          </div>
        </section>

        {/* Expandable On-Demand Section 1: Per-Game Evidence */}
        {slice.isSupportedSelection && showEvidence && (
          <section
            data-testid="per-game-evidence-section"
            aria-label="Per-Game Pro Evidence"
            className="rounded-lg border border-slate-800 bg-slate-900/75 p-3 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white">
                Per-Game Evidence ({slice.evidenceRows.length}G) · Corrected 10:00 HUD VODs:
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095110'].correctedHud10mUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="vod-link-ig-tes-g1"
                  className="font-bold text-sky-300 underline hover:text-sky-200"
                >
                  IG vs TES G1 @10:00 (t=3695s)
                </a>
                <a
                  href={VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095111'].correctedHud10mUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="vod-link-ig-tes-g2"
                  className="font-bold text-sky-300 underline hover:text-sky-200"
                >
                  IG vs TES G2 @10:00 (t=6759s)
                </a>
              </div>
            </div>

            <div className="space-y-2 md:hidden" data-testid="evidence-mobile-list">
              {slice.evidenceRows.map((row) => (
                <div
                  key={row.observationKey}
                  data-testid={`evidence-card-${row.observationKey}`}
                  className="rounded border border-slate-800 bg-slate-950/80 p-2.5 space-y-1.5 text-xs telemetry-nums"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-white">
                      {row.summonerName} ({row.championId})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {row.gameLabel} · {row.trueInGameDurationFormatted}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    {PRO_CHECKPOINT_MINUTES.map((m) => {
                      const cell = row.checkpoints[m];
                      return (
                        <div
                          key={m}
                          className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 flex justify-between"
                        >
                          <span className="text-slate-400">{m}m</span>
                          <span className="font-bold text-white">
                            {cell.hasExportedSnapshot ? cell.totalCs : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>End: {row.finalCsAtGameEnd} CS</span>
                    {row.hudVerification.isCs10HudVerified &&
                    row.hudVerification.correctedHud10mUrl ? (
                      <a
                        href={row.hudVerification.correctedHud10mUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-300 underline font-semibold"
                      >
                        HUD 10:00 VOD
                      </a>
                    ) : (
                      <span>Unverified</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table
                data-testid="evidence-desktop-table"
                className="w-full text-left border-collapse text-xs telemetry-nums"
              >
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-1.5 pr-2">Match</th>
                    <th className="py-1.5 px-2">Player</th>
                    <th className="py-1.5 px-2 text-right">5m</th>
                    <th className="py-1.5 px-2 text-right">10m</th>
                    <th className="py-1.5 px-2 text-right">15m</th>
                    <th className="py-1.5 px-2 text-right">20m</th>
                    <th className="py-1.5 px-2 text-right">25m</th>
                    <th className="py-1.5 px-2 text-right">30m</th>
                    <th className="py-1.5 px-2 text-right">End CS</th>
                    <th className="py-1.5 pl-2">10m HUD Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {slice.evidenceRows.map((row) => (
                    <tr key={row.observationKey} data-testid={`evidence-row-${row.observationKey}`}>
                      <td className="py-1.5 pr-2 font-semibold text-white">
                        {row.gameLabel}{' '}
                        <span className="text-[11px] font-normal text-slate-400">
                          ({row.trueInGameDurationFormatted})
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-slate-200">
                        {row.summonerName} · {row.championId}
                      </td>
                      {PRO_CHECKPOINT_MINUTES.map((m) => {
                        const cell = row.checkpoints[m];
                        return (
                          <td key={m} className="py-1.5 px-2 text-right font-semibold text-white">
                            {cell.hasExportedSnapshot ? (
                              cell.totalCs
                            ) : (
                              <span className="text-[11px] text-slate-500">Unavailable</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-2 text-right text-slate-300">
                        {row.finalCsAtGameEnd}
                      </td>
                      <td className="py-1.5 pl-2">
                        {row.hudVerification.isCs10HudVerified &&
                        row.hudVerification.correctedHud10mUrl ? (
                          <a
                            href={row.hudVerification.correctedHud10mUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-emerald-300 underline"
                          >
                            HUD Verified VOD
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">Feed Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Expandable On-Demand Section 2: Methodology & Verification Limits */}
        {showMethodologyDetails && (
          <section
            id="methodology-disclosure-panel"
            data-testid="methodology-disclosure-panel"
            aria-label="Methodology and Verification Details"
            className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2.5 text-xs text-slate-300 telemetry-nums"
          >
            <div className="font-bold text-white">Methodology &amp; Sample Verification Limits</div>
            <ul className="list-disc list-inside space-y-1 leading-relaxed">
              <li>
                <strong>Sample Coverage:</strong> 8 Worlds 2026 games (80 player-games, 53 unique
                champion-role pairs in JSON; 37 pairs have n=1; prior report heading listed 57) on
                patch 16.20.
              </li>
              <li>
                <strong>Partial HUD Verification &amp; Pause Heuristic:</strong> Independent
                broadcast HUD verification covered only CS@10 for 20 players in{' '}
                <code>IG vs TES G1+G2</code> (corrected 10:00 VOD timestamps:{' '}
                <a
                  href={VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095110'].correctedHud10mUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 underline"
                >
                  t=3695s
                </a>{' '}
                and{' '}
                <a
                  href={VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095111'].correctedHud10mUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 underline"
                >
                  t=6759s
                </a>
                ; dataset VOD locator was ~73–74s early). Pause subtraction (105.02s in G1) uses a
                zero-gold freeze heuristic in <code>/details</code>, not an authenticated{' '}
                <code>gameState</code> clock across all endpoints.
              </li>
              <li>
                <strong>Why Item Build Timings Are Excluded:</strong> Ingest classified items with
                Data Dragon <code>16.22.1</code> against tournament patch <code>16.20</code>, and
                item completion timestamps were not HUD-verified.
              </li>
            </ul>

            {igTesG1 && (
              <div
                data-testid="pause-audit-panel"
                className="pt-2 border-t border-slate-800 space-y-1.5"
              >
                <div className="font-semibold text-slate-200">
                  IG vs TES G1 (105.02s Pause) — Naive 8:10 vs HUD-Verified 10:00 CS (t=3695s)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {Object.keys(igTesG1.participants)
                    .map((k) => Number(k))
                    .sort((a, b) => a - b)
                    .map((pid) => {
                      const p = igTesG1.participants[String(pid)];
                      const naiveCs =
                        igTesG1.aligned_checkpoints['10m']?.naive_first_frame.pCs[pid - 1] ?? 0;
                      const trueCs =
                        igTesG1.aligned_checkpoints['10m']?.true_in_game_clock.pCs[pid - 1] ?? 0;
                      return (
                        <div
                          key={pid}
                          className="rounded border border-slate-800 bg-slate-900 p-1.5 text-[11px]"
                        >
                          <div className="font-bold text-white truncate">
                            {p.summonerName} ({p.championId})
                          </div>
                          <div className="text-slate-400">
                            {naiveCs} → <strong className="text-emerald-300">{trueCs} CS</strong> (+
                            {trueCs - naiveCs})
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </section>
        )}
          </>
        )}
      </main>
    </div>
  );
};

export default ProComparisonPreview;
