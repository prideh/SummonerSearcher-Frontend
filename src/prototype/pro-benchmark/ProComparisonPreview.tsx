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

export interface ProComparisonPreviewProps {
  dataset?: RawProBenchmarkDataset;
  initialRole?: ProRoleFilter;
  initialChampionId?: string;
  initialMode?: ComparisonMode;
}

const SYNTHETIC_DEMO_PRESETS: Record<ProRoleFilter, DemoCsInputMap> = {
  ALL: { 5: '35', 10: '78', 15: '122', 20: '165', 25: '205', 30: '240' },
  top: { 5: '34', 10: '79', 15: '121', 20: '164', 25: '202', 30: '238' },
  jungle: { 5: '36', 10: '72', 15: '112', 20: '148', 25: '180', 30: '210' },
  mid: { 5: '38', 10: '86', 15: '136', 20: '182', 25: '224', 30: '260' },
  bottom: { 5: '37', 10: '84', 15: '134', 20: '188', 25: '238', 30: '275' },
  support: { 5: '6', 10: '14', 15: '21', 20: '26', 25: '30', 30: '34' },
};

export const ProComparisonPreview: React.FC<ProComparisonPreviewProps> = ({
  dataset = DEFAULT_PRO_BENCHMARK_DATASET,
  initialRole = 'top',
  initialChampionId = 'KSante',
  initialMode = 'REFERENCE_ONLY',
}) => {
  const [selectedRole, setSelectedRole] = useState<ProRoleFilter>(initialRole);
  const [selectedChampionId, setSelectedChampionId] = useState<string>(initialChampionId);
  const [championSearchText, setChampionSearchText] = useState<string>('');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(initialMode);
  const [demoInputs, setDemoInputs] = useState<DemoCsInputMap>({});
  const [showAllEvidenceRows, setShowAllEvidenceRows] = useState<boolean>(false);
  const [showPauseAuditTable, setShowPauseAuditTable] = useState<boolean>(false);

  const allRoleChampionOptions = useMemo(
    () => getSupportedRoleChampionOptions(dataset, 'ALL'),
    [dataset]
  );

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
    setShowAllEvidenceRows(false);
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
    setShowAllEvidenceRows(false);
  };

  const handleQuickSelectPair = (role: ProRoleFilter, championId: string) => {
    setChampionSearchText('');
    setSelectedRole(role);
    setSelectedChampionId(championId);
    setShowAllEvidenceRows(false);
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

  const visibleEvidenceRows = showAllEvidenceRows
    ? slice.evidenceRows
    : slice.evidenceRows.slice(0, 10);

  const renderCheckpointDenominatorBadge = (cp: ProCheckpointSummary) => {
    if (cp.totalSliceGames === 0) {
      return '0/0 games';
    }
    if (cp.status === 'AVAILABLE') {
      const base = `${cp.availableSnapshotCount}/${cp.totalSliceGames}G reached (n=${cp.availableSnapshotCount})`;
      if (cp.shortGamesEndedBeforeMarkCount > 0) {
        return `${base} · ${cp.shortGamesEndedBeforeMarkCount} ended <${cp.minuteMark}m`;
      }
      return base;
    }
    if (cp.unavailableReason === 'ALL_GAMES_ENDED_BEFORE_MARK') {
      return `0/${cp.totalSliceGames}G reached ${cp.minuteMark}:00`;
    }
    return `0/${cp.totalSliceGames}G snapshot (${cp.gamesReachedDurationCount}/${cp.totalSliceGames}G reached ${cp.minuteMark}:00)`;
  };

  const renderCheckpointCard = (minuteMark: ProCheckpointMinute) => {
    const cp = slice.checkpoints[minuteMark];
    const demoComp = demoComparisons[minuteMark];
    const isAvailable = cp.status === 'AVAILABLE' && cp.meanTotalCs !== null;

    return (
      <article
        key={minuteMark}
        data-testid={`checkpoint-card-${minuteMark}m`}
        aria-label={`Total CS checkpoint at ${minuteMark} minutes`}
        className={`rounded-lg border p-3 flex flex-col justify-between transition-colors telemetry-nums ${
          isAvailable
            ? 'bg-slate-900/90 border-slate-700/90 text-slate-100'
            : 'bg-slate-950/70 border-slate-800/90 text-slate-300'
        }`}
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-800">
            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
              @{minuteMark}:00 In-Game
            </span>
            <span
              data-testid={`checkpoint-denom-${minuteMark}m`}
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                isAvailable
                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                  : 'bg-amber-950/50 text-amber-200 border-amber-800/70'
              }`}
            >
              {renderCheckpointDenominatorBadge(cp)}
            </span>
          </div>

          {isAvailable && cp.meanTotalCs !== null ? (
            <div className="mt-2.5 space-y-1.5">
              <div>
                <div className="text-[11px] font-semibold text-slate-400">
                  Mean Total CS (incl. jungle)
                </div>
                <div
                  data-testid={`checkpoint-mean-cs-${minuteMark}m`}
                  className="text-2xl font-black text-white tracking-tight whitespace-nowrap mt-0.5"
                >
                  {cp.meanTotalCs.toFixed(1)}{' '}
                  <span className="text-xs font-bold text-sky-300">CS</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1 text-xs text-slate-300">
                <span className="text-slate-400">Mean Rate:</span>
                <span className="font-semibold whitespace-nowrap">
                  {cp.meanTotalCsPerMin?.toFixed(2)} CS/m
                </span>
              </div>

              <div className="flex items-center justify-between gap-1 text-xs text-slate-300">
                <span className="text-slate-400">Sample Range:</span>
                <span
                  data-testid={`checkpoint-range-cs-${minuteMark}m`}
                  className="font-semibold whitespace-nowrap"
                >
                  {cp.minTotalCs === cp.maxTotalCs
                    ? `${cp.minTotalCs} CS (1G)`
                    : `${cp.minTotalCs}–${cp.maxTotalCs} CS`}
                </span>
              </div>

              {cp.shortGamesEndedBeforeMarkCount > 0 && (
                <p
                  data-testid={`checkpoint-short-note-${minuteMark}m`}
                  className="text-[11px] text-amber-300/95 bg-amber-950/30 border border-amber-800/50 rounded px-2 py-1 mt-1"
                >
                  {cp.shortGamesEndedBeforeMarkCount} game
                  {cp.shortGamesEndedBeforeMarkCount === 1 ? '' : 's'} ended before{' '}
                  {minuteMark}:00 and {cp.shortGamesEndedBeforeMarkCount === 1 ? 'is' : 'are'}{' '}
                  excluded (never counted as 0 CS).
                </p>
              )}

              {minuteMark === 10 && (
                <p className="text-[11px] text-sky-200/90 bg-sky-950/40 border border-sky-800/60 rounded px-2 py-1 mt-1">
                  HUD check: {cp.hudVerifiedObservationCount}/{cp.availableSnapshotCount}{' '}
                  game{cp.availableSnapshotCount === 1 ? '' : 's'} in slice verified vs
                  broadcast HUD @10:00 (IG/TES G1+G2).
                </p>
              )}
            </div>
          ) : (
            <div
              data-testid={`checkpoint-unavailable-${minuteMark}m`}
              className="mt-2.5 space-y-1.5"
            >
              <div>
                <div className="text-[11px] font-semibold text-slate-400">
                  Mean Total CS (incl. jungle)
                </div>
                <div className="text-base font-extrabold text-amber-300 mt-0.5">
                  Unavailable
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {cp.unavailableReason === 'ALL_GAMES_ENDED_BEFORE_MARK' ? (
                  <>
                    0 of {cp.totalSliceGames} sample games reached {minuteMark}:00 (all{' '}
                    {cp.shortGamesEndedBeforeMarkCount} ended earlier). Ended games are
                    excluded—never shown as 0 CS.
                  </>
                ) : cp.unavailableReason === 'SNAPSHOT_NOT_EXPORTED_AT_MARK' ? (
                  <>
                    {cp.gamesReachedDurationCount} of {cp.totalSliceGames} sample games
                    lasted ≥{minuteMark}:00
                    {cp.shortGamesEndedBeforeMarkCount > 0
                      ? ` (${cp.shortGamesEndedBeforeMarkCount} ended <${minuteMark}:00)`
                      : ''}
                    , but the sample dataset only exported checkpoints through 25m (5m, 10m,
                    14m, 15m, 20m, 25m). No 30m value or post-game zero is invented.
                  </>
                ) : (
                  <>No sample observations available for the selected filter.</>
                )}
              </p>
            </div>
          )}
        </div>

        {comparisonMode === 'DEMO_INPUT' && (
          <div
            data-testid={`demo-comparison-box-${minuteMark}m`}
            className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-1">
              <label
                htmlFor={`demo-cs-input-${minuteMark}m`}
                className="text-[11px] font-bold text-amber-300"
              >
                Demo Input @{minuteMark}m
              </label>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-200 border border-amber-700/70">
                Demo Only
              </span>
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
              placeholder={isAvailable ? `e.g. ${Math.round(cp.meanTotalCs ?? 80)}` : 'N/A'}
              value={demoInputs[minuteMark] ?? ''}
              onChange={(e) => handleDemoInputChange(minuteMark, e.target.value)}
              className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div
              data-testid={`demo-delta-${minuteMark}m`}
              className="text-[11px] leading-snug"
            >
              {demoComp.canCompare && demoComp.deltaCs !== null ? (
                <div className="space-y-0.5">
                  <div
                    className={`font-bold ${
                      demoComp.deltaCs >= 0 ? 'text-emerald-300' : 'text-amber-200'
                    }`}
                  >
                    {demoComp.formattedDelta}
                  </div>
                  <div className="text-slate-400">
                    Synthetic/manual demo input vs {cp.availableSnapshotCount}G pro sample
                    mean (not live player data or rank percentile).
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">{demoComp.statusMessage}</span>
              )}
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <div
      data-testid="pro-comparison-preview-root"
      className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-sky-500/20 selection:text-sky-300"
    >
      {/* Top Preview Isolation Bar */}
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="preview-isolation-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider bg-sky-950 text-sky-200 border border-sky-700/80"
            >
              Private Review Preview
            </span>
            <span className="text-xs text-slate-300 font-medium">
              Summoner Searcher · Pro CS Checkpoint Reference (Local Sample Only · Zero Riot API Calls)
            </span>
          </div>
          <div className="text-xs text-slate-400 telemetry-nums">
            Dataset: <code className="text-slate-200">pro_benchmark_sample_baselines.json</code> · Patch{' '}
            <strong className="text-slate-200">{slice.patchShort}</strong>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
        {/* Hero / Primary Purpose & Mode Banner */}
        <section
          aria-labelledby="pro-preview-heading"
          className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <h1
                id="pro-preview-heading"
                className="text-lg sm:text-xl font-extrabold tracking-tight text-white"
              >
                Worlds 2026 Pro CS Checkpoint Reference (Patch {slice.patchShort} Sample)
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Explore mean <strong>Total CS (lane minions + jungle monsters combined)</strong> at{' '}
                <strong>5, 10, 15, 20, 25, and 30 minutes</strong> across the verified{' '}
                <strong>8-game (80 player-game)</strong> Worlds 2026 sample dataset. Every number
                shows its exact games-reached denominator, excludes games that ended early instead of
                recording post-game zeros, and keeps sample limits visible alongside the data.
              </p>
            </div>

            {/* Data Mode Switcher: Reference-Only vs Optional Demo Input */}
            <div
              data-testid="comparison-mode-banner"
              className="shrink-0 rounded-lg border border-slate-700/90 bg-slate-950/90 p-3 space-y-2 w-full lg:w-auto lg:min-w-[300px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  User Data Status:
                </span>
                {comparisonMode === 'REFERENCE_ONLY' ? (
                  <span
                    data-testid="mode-status-badge"
                    className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-950/80 text-emerald-200 border border-emerald-700/70"
                  >
                    Reference-Only Mode (No Live User Data)
                  </span>
                ) : (
                  <span
                    data-testid="mode-status-badge"
                    className="px-2 py-0.5 rounded text-xs font-bold bg-amber-950/90 text-amber-200 border border-amber-700/80"
                  >
                    Demo Input Mode (Synthetic / Manual Only)
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-snug">
                {comparisonMode === 'REFERENCE_ONLY'
                  ? 'Showing pro reference baselines only. No live player profile or Riot API data is loaded.'
                  : 'Optional manual/synthetic demo CS inputs active. Clearly marked as Demo—never live user stats.'}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  data-testid="mode-btn-reference-only"
                  aria-pressed={comparisonMode === 'REFERENCE_ONLY'}
                  onClick={() => setComparisonMode('REFERENCE_ONLY')}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    comparisonMode === 'REFERENCE_ONLY'
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Reference-Only Mode
                </button>
                <button
                  type="button"
                  data-testid="mode-btn-demo-input"
                  aria-pressed={comparisonMode === 'DEMO_INPUT'}
                  onClick={() => setComparisonMode('DEMO_INPUT')}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    comparisonMode === 'DEMO_INPUT'
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Optional Demo CS Input
                </button>
                {comparisonMode === 'DEMO_INPUT' && (
                  <>
                    <button
                      type="button"
                      data-testid="btn-fill-synthetic-demo"
                      onClick={handleFillSyntheticDemo}
                      className="px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-800 text-amber-200 border border-amber-700/60 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Fill Example Demo Values
                    </button>
                    <button
                      type="button"
                      data-testid="btn-clear-demo"
                      onClick={handleClearDemoInputs}
                      className="px-2 py-1.5 rounded text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dataset Scope Summary Strip */}
          <div
            data-testid="dataset-scope-strip"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-800 text-xs telemetry-nums"
          >
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
              <div className="text-slate-400 font-semibold">Sample Size &amp; Patch</div>
              <div className="text-white font-bold mt-0.5">
                {slice.totalGamesInDataset} Worlds 2026 Games · {slice.totalObservationsInDataset}{' '}
                Player-Games
              </div>
              <div className="text-slate-400 mt-0.5">
                Tournament patch <code className="text-slate-200">{slice.patchVersion}</code>
              </div>
            </div>

            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
              <div className="text-slate-400 font-semibold">Supported Champion-Role Pairs</div>
              <div className="text-white font-bold mt-0.5">
                {slice.totalRoleChampionPairsInDataset} Pairs in JSON (1–3 games each)
              </div>
              <div className="text-slate-400 mt-0.5">
                Report table heading cited {slice.reportClaimedRoleChampionPairs}; actual JSON has{' '}
                {slice.totalRoleChampionPairsInDataset} pairs (37 with n=1).
              </div>
            </div>

            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
              <div className="text-slate-400 font-semibold">Independent HUD Verification</div>
              <div className="text-white font-bold mt-0.5">
                2 / 8 Games Verified (CS@10 Only · 20 Players)
              </div>
              <div className="text-slate-400 mt-0.5">
                IG vs TES G1 &amp; G2 @10:00 only. Not all 8 games, not ±0.5s globally, not items.
              </div>
            </div>

            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5">
              <div className="text-slate-400 font-semibold">Why CS Checkpoints First</div>
              <div className="text-white font-bold mt-0.5">
                Item Build Timings Excluded from Primary View
              </div>
              <div className="text-slate-400 mt-0.5">
                Ingest used DDragon <code className="text-slate-200">{slice.ddragonVersionUsedInIngest}</code>{' '}
                vs game patch <code className="text-slate-200">{slice.patchShort}</code> &amp;
                unverified item timestamps.
              </div>
            </div>
          </div>
        </section>

        {/* Step 1: Controls for Role and Champion Selection */}
        <section
          aria-labelledby="filter-controls-heading"
          className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="filter-controls-heading"
                className="text-sm sm:text-base font-extrabold text-white"
              >
                1. Choose Pro Role &amp; Champion Reference
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Select any of the {slice.totalRoleChampionPairsInDataset} supported champion-role
                references, view a role-wide aggregate (16 player-games per role), or test an
                unsupported champion/role query.
              </p>
            </div>
            <button
              type="button"
              data-testid="btn-reset-default-reference"
              onClick={() => handleQuickSelectPair('top', 'KSante')}
              className="px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Reset to Top · KSante (n=3)
            </button>
          </div>

          {/* Role Pills */}
          <div className="space-y-1.5">
            <span
              id="role-pill-group-label"
              className="block text-xs font-bold uppercase tracking-wider text-slate-300"
            >
              Filter by Role
            </span>
            <div
              role="group"
              aria-labelledby="role-pill-group-label"
              className="flex flex-wrap gap-1.5"
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
                    className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors telemetry-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
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
          </div>

          {/* Accessible Select + Search Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div>
              <label
                htmlFor="pro-role-select"
                className="block text-xs font-bold text-slate-200 mb-1"
              >
                Role Reference Selector
              </label>
              <select
                id="pro-role-select"
                data-testid="pro-role-select"
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as ProRoleFilter)}
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="ALL">All Roles Combined (80 player-games)</option>
                {PRO_ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {PRO_ROLE_LABELS[r]} (16 player-games)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pro-champion-select"
                className="block text-xs font-bold text-slate-200 mb-1"
              >
                Supported Champion-Role Pair ({roleFilteredOptions.length} in{' '}
                {formatRoleDisplay(selectedRole)})
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
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="ALL">
                  All Supported Champions in {formatRoleDisplay(selectedRole)} (
                  {selectedRole === 'ALL' ? '80G' : '16G'})
                </option>
                <optgroup
                  label={`Supported in ${formatRoleDisplay(selectedRole)} (${
                    roleFilteredOptions.length
                  } pairs)`}
                >
                  {roleFilteredOptions.map((opt) => (
                    <option
                      key={`${opt.role}::${opt.championId}`}
                      value={`${opt.role}::${opt.championId}`}
                    >
                      {formatRoleDisplay(opt.role)} · {opt.championId} (n={opt.sampleCount}G —{' '}
                      {opt.players.join(', ')})
                    </option>
                  ))}
                </optgroup>
                {selectedRole !== 'ALL' && (
                  <optgroup label="Other Sample Champions (0G in selected role — test unsupported pair)">
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
                className="block text-xs font-bold text-slate-200 mb-1"
              >
                Direct Champion Filter / Unsupported Check
              </label>
              <div className="flex gap-1.5">
                <input
                  id="pro-champion-search"
                  data-testid="pro-champion-search"
                  type="text"
                  value={championSearchText}
                  onChange={(e) => setChampionSearchText(e.target.value)}
                  placeholder="Type e.g. Syndra, Qiyana, or Ahri..."
                  className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                {championSearchText.trim().length > 0 && (
                  <button
                    type="button"
                    data-testid="btn-clear-champion-search"
                    onClick={() => setChampionSearchText('')}
                    className="shrink-0 px-2.5 py-2 rounded-md text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Multi-Game Reference Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-slate-400 font-semibold mr-1">
              Multi-game pairs in {formatRoleDisplay(selectedRole)}:
            </span>
            {(selectedRole === 'ALL' ? allRoleChampionOptions : roleFilteredOptions)
              .filter((o) => o.sampleCount >= 2)
              .slice(0, 10)
              .map((opt) => {
                const isSelected =
                  slice.filter.role === opt.role &&
                  slice.filter.championId.toLowerCase() === opt.championId.toLowerCase();
                return (
                  <button
                    key={`quick-${opt.role}-${opt.championId}`}
                    type="button"
                    data-testid={`quick-pair-${opt.role}-${opt.championId}`}
                    onClick={() => handleQuickSelectPair(opt.role, opt.championId)}
                    className={`px-2 py-1 rounded text-xs font-semibold border transition-colors telemetry-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      isSelected
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {formatRoleDisplay(opt.role)} · {opt.championId} ({opt.sampleCount}G)
                  </button>
                );
              })}
          </div>
        </section>

        {/* Step 2: Primary CS Checkpoint Comparison OR Honest Unsupported Selection State */}
        <section
          aria-labelledby="checkpoint-section-heading"
          className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="checkpoint-section-heading"
                  data-testid="active-selection-title"
                  className="text-base sm:text-lg font-extrabold text-white"
                >
                  2. {slice.selectionTitle}
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
                    ? `Sample: ${slice.matchingObservationCount} Player-Game${
                        slice.matchingObservationCount === 1 ? '' : 's'
                      } (${slice.uniqueGamesInSliceCount}/8 Matches)`
                    : 'Unsupported / 0 Sample Games'}
                </span>
              </div>
              <p
                data-testid="active-selection-subtitle"
                className="text-xs text-slate-300 mt-1"
              >
                {slice.selectionSubtitle}
              </p>
            </div>

            {slice.isSupportedSelection && slice.optional14mSummary.meanTotalCs !== null && (
              <div
                data-testid="secondary-14m-pill"
                className="text-xs bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-slate-300 telemetry-nums"
              >
                Additional dataset mark <strong>@14:00</strong>:{' '}
                <strong className="text-white">
                  {slice.optional14mSummary.meanTotalCs.toFixed(1)} CS
                </strong>{' '}
                (range {slice.optional14mSummary.minTotalCs}–{slice.optional14mSummary.maxTotalCs}{' '}
                CS, n={slice.optional14mSummary.availableSnapshotCount}G)
              </div>
            )}
          </div>

          {/* Inline Comparison Caveats (Always Visible Next to Comparisons) */}
          <aside
            data-testid="inline-comparison-caveats"
            aria-label="Key sample and verification caveats"
            className="rounded-lg bg-slate-950/90 border border-amber-800/60 p-3.5 text-xs text-slate-200 space-y-2"
          >
            <div className="font-extrabold uppercase tracking-wider text-amber-300">
              Key Sample &amp; Methodology Caveats (Read Alongside Checkpoints)
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 list-disc list-inside text-slate-300 leading-relaxed">
              <li>
                <strong className="text-white">Small Pro Reference, Not Solo-Queue Target:</strong>{' '}
                Derived from only <strong>8 Worlds 2026 games (80 player-games)</strong> on patch{' '}
                <strong>16.20</strong>. Do not interpret as population percentiles, confidence
                scores, or expected solo-queue ranks.
              </li>
              <li>
                <strong className="text-white">Total CS Includes Jungle &amp; Early Wards:</strong>{' '}
                Each checkpoint reports mean <code className="text-slate-100">creepScore</code>{' '}
                (lane minions + jungle monsters combined; raw feed <code className="text-slate-100">creepScore</code>{' '}
                also increments on pre-0:55 ward clears).
              </li>
              <li>
                <strong className="text-white">No Post-Game Zeros &amp; Honest 30m State:</strong>{' '}
                Games that ended before a checkpoint are excluded from that checkpoint&apos;s
                denominator. Although 5/8 games lasted ≥30:00 (3 ended at 26:12, 28:06, 29:29), the
                sample JSON only exported snapshots through <strong>25m</strong>, so{' '}
                <strong>30m is shown as Unavailable</strong>.
              </li>
              <li>
                <strong className="text-white">
                  Partial HUD Verification &amp; Heuristic Pause Clock:
                </strong>{' '}
                Independent broadcast HUD verification covered <strong>only CS@10 in 2 games</strong>{' '}
                (20 players in <code className="text-slate-100">IG vs TES G1+G2</code> at corrected
                VOD timestamps <code className="text-slate-100">t=3695s</code> &amp;{' '}
                <code className="text-slate-100">t=6759s</code>; raw dataset VOD locator was ~73–74s
                early). Pause subtraction uses a zero-gold freeze heuristic, not universal ±0.5s
                authenticated precision.
              </li>
            </ul>
          </aside>

          {!slice.isSupportedSelection ? (
            <div
              data-testid="unsupported-selection-state"
              role="region"
              aria-label="Unsupported champion or role selection"
              className="rounded-lg border border-amber-700/80 bg-amber-950/25 p-5 space-y-3"
            >
              <div className="text-sm font-extrabold text-amber-200">
                Unsupported Selection in 8-Game Sample Dataset (0 Player-Games)
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {slice.unsupportedReason} No fallback, extrapolated, or zero-filled CS numbers are
                shown when a champion or role pair has 0 observations in the sample.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {slice.alternateRolesForChampion.map((alt) => (
                  <button
                    key={`switch-${alt.role}-${alt.championId}`}
                    type="button"
                    data-testid={`switch-supported-${alt.role}-${alt.championId}`}
                    onClick={() => handleQuickSelectPair(alt.role, alt.championId)}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-sky-500 text-slate-950 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    Switch to {formatRoleDisplay(alt.role)} · {alt.championId} (n=
                    {alt.sampleCount}G)
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="btn-show-role-baseline"
                  onClick={() => {
                    setChampionSearchText('');
                    setSelectedChampionId('ALL');
                  }}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  View All {formatRoleDisplay(selectedRole)} Champions in Sample
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid="checkpoint-cards-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3"
            >
              {PRO_CHECKPOINT_MINUTES.map((m) => renderCheckpointCard(m))}
            </div>
          )}
        </section>

        {/* Step 3: Per-Game Evidence & Corrected HUD 10:00 VOD Verification */}
        {slice.isSupportedSelection && (
          <section
            data-testid="per-game-evidence-section"
            aria-labelledby="per-game-evidence-heading"
            className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h2
                  id="per-game-evidence-heading"
                  className="text-base font-extrabold text-white"
                >
                  3. Per-Game Pro Evidence &amp; Broadcast HUD Verification ({slice.evidenceRows.length}{' '}
                  Observation{slice.evidenceRows.length === 1 ? '' : 's'})
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Individual Worlds 2026 player-games in this slice. Shows true pause-adjusted
                  duration, Total CS at 5/10/15/20/25/30m, game-end Final CS, and corrected HUD
                  10:00 YouTube links for IG vs TES G1 &amp; G2.
                </p>
              </div>

              {slice.evidenceRows.length > 10 && (
                <button
                  type="button"
                  data-testid="btn-toggle-all-evidence"
                  onClick={() => setShowAllEvidenceRows((prev) => !prev)}
                  className="self-start sm:self-auto px-3 py-1.5 rounded text-xs font-bold bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {showAllEvidenceRows
                    ? `Show First 10 of ${slice.evidenceRows.length} Rows`
                    : `Show All ${slice.evidenceRows.length} Player-Games`}
                </button>
              )}
            </div>

            {/* Corrected HUD 10:00 VOD Reference Callout */}
            <div
              data-testid="corrected-vod-callout"
              className="rounded-lg bg-slate-950/80 border border-sky-800/60 p-3 text-xs space-y-1.5"
            >
              <div className="font-bold text-sky-300">
                Corrected Broadcast HUD 10:00 Verification Links (Dataset VOD Locator Was ~73–74s
                Early)
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-slate-300">
                <a
                  href={VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095110'].correctedHud10mUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="vod-link-ig-tes-g1"
                  className="inline-flex items-center gap-1 font-bold text-sky-300 underline hover:text-sky-200 break-all"
                >
                  IG vs TES G1 HUD @10:00 (t=3695s)
                </a>
                <a
                  href={VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095111'].correctedHud10mUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="vod-link-ig-tes-g2"
                  className="inline-flex items-center gap-1 font-bold text-sky-300 underline hover:text-sky-200 break-all"
                >
                  IG vs TES G2 HUD @10:00 (t=6759s)
                </a>
                <span className="text-slate-400">
                  Other 6 games: feed-derived only (not independently HUD-checked).
                </span>
              </div>
            </div>

            {/* Responsive Per-Game Evidence: Stacked Cards on Mobile (<md), Table on Desktop (>=md) */}
            <div className="space-y-2.5 md:hidden" data-testid="evidence-mobile-list">
              {visibleEvidenceRows.map((row) => (
                <div
                  key={row.observationKey}
                  data-testid={`evidence-card-${row.observationKey}`}
                  className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-2 text-xs telemetry-nums"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                    <div>
                      <span className="font-extrabold text-white">{row.summonerName}</span>{' '}
                      <span className="text-sky-300 font-bold">
                        ({row.championId} · {formatRoleDisplay(row.role)})
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-semibold">
                      {row.gameLabel} · {row.trueInGameDurationFormatted}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    {PRO_CHECKPOINT_MINUTES.map((m) => {
                      const cell = row.checkpoints[m];
                      return (
                        <div
                          key={m}
                          className="rounded bg-slate-900/90 border border-slate-800 px-2 py-1"
                        >
                          <div className="text-slate-400 font-semibold">@{m}m</div>
                          <div
                            className={`font-bold ${
                              cell.hasExportedSnapshot ? 'text-white' : 'text-amber-300'
                            }`}
                          >
                            {cell.hasExportedSnapshot ? `${cell.totalCs} CS` : 'Unavailable'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-[11px] text-slate-300">
                    <span>
                      Final Game-End CS ({row.trueInGameDurationFormatted}):{' '}
                      <strong className="text-white">{row.finalCsAtGameEnd} CS</strong>
                    </span>
                    {row.hudVerification.isCs10HudVerified &&
                    row.hudVerification.correctedHud10mUrl ? (
                      <a
                        href={row.hudVerification.correctedHud10mUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-sky-300 underline"
                      >
                        Verified HUD 10:00 VOD
                      </a>
                    ) : (
                      <span className="text-slate-400">Feed-derived (HUD unverified)</span>
                    )}
                  </div>

                  {row.pauseHeuristicNote && (
                    <div className="text-[11px] text-amber-300">
                      Clock note: {row.pauseHeuristicNote}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table
                data-testid="evidence-desktop-table"
                className="w-full text-left border-collapse text-xs telemetry-nums"
              >
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-2 pr-3">Match &amp; Duration</th>
                    <th className="py-2 px-2">Player (Champ · Role)</th>
                    <th className="py-2 px-2 text-right">CS@5m</th>
                    <th className="py-2 px-2 text-right">CS@10m</th>
                    <th className="py-2 px-2 text-right">CS@15m</th>
                    <th className="py-2 px-2 text-right">CS@20m</th>
                    <th className="py-2 px-2 text-right">CS@25m</th>
                    <th className="py-2 px-2 text-right">CS@30m</th>
                    <th className="py-2 px-2 text-right">Game-End CS</th>
                    <th className="py-2 pl-3">HUD @10:00 Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {visibleEvidenceRows.map((row) => (
                    <tr
                      key={row.observationKey}
                      data-testid={`evidence-row-${row.observationKey}`}
                      className="hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-bold text-white">{row.gameLabel}</div>
                        <div className="text-[11px] text-slate-400">
                          Duration: {row.trueInGameDurationFormatted}
                          {row.trueInGameDurationSeconds < 1800 && (
                            <span className="ml-1 text-amber-300">(Ended &lt;30:00)</span>
                          )}
                        </div>
                        {row.pauseHeuristicNote && (
                          <div className="text-[11px] text-amber-300">{row.pauseHeuristicNote}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-slate-100">{row.summonerName}</div>
                        <div className="text-[11px] text-sky-300">
                          {row.championId} · {formatRoleDisplay(row.role)} ({row.side})
                        </div>
                      </td>
                      {PRO_CHECKPOINT_MINUTES.map((m) => {
                        const cell = row.checkpoints[m];
                        return (
                          <td key={m} className="py-2.5 px-2 text-right">
                            {cell.hasExportedSnapshot ? (
                              <span className="font-bold text-white">{cell.totalCs}</span>
                            ) : (
                              <span
                                className="text-[11px] text-amber-300 font-semibold"
                                title={cell.statusLabel}
                              >
                                {cell.reachedDuration ? 'Unavailable (no 30m export)' : 'Ended <30m'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-2 text-right">
                        <span className="font-semibold text-slate-200">
                          {row.finalCsAtGameEnd} CS
                        </span>
                        <div className="text-[10px] text-slate-400">
                          @{row.trueInGameDurationFormatted}
                        </div>
                      </td>
                      <td className="py-2.5 pl-3">
                        {row.hudVerification.isCs10HudVerified &&
                        row.hudVerification.correctedHud10mUrl ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-950/80 text-emerald-200 border border-emerald-700/70">
                              CS@10 HUD Verified
                            </span>
                            <div>
                              <a
                                href={row.hudVerification.correctedHud10mUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-sky-300 underline hover:text-sky-200"
                              >
                                Open Corrected 10:00 VOD
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            Feed-Derived Only (Unverified)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Optional Expandable IG vs TES G1 Pause Alignment Audit */}
            {igTesG1 && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  data-testid="btn-toggle-pause-audit"
                  aria-expanded={showPauseAuditTable}
                  onClick={() => setShowPauseAuditTable((prev) => !prev)}
                  className="text-xs font-bold text-sky-300 hover:text-sky-200 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                >
                  {showPauseAuditTable
                    ? 'Hide IG vs TES G1 105.02s Pause Alignment Audit (Naive 8:10 vs HUD-Verified 10:00)'
                    : 'Inspect IG vs TES G1 105.02s Pause Alignment Audit (Why Naive 10m Undercounted CS by 14–25 CS)'}
                </button>

                {showPauseAuditTable && (
                  <div
                    data-testid="pause-audit-panel"
                    className="mt-3 rounded-lg border border-slate-800 bg-slate-950/90 p-3 space-y-2 text-xs telemetry-nums"
                  >
                    <p className="text-slate-300 leading-relaxed">
                      In <strong>IG vs TES G1</strong> (<code className="text-slate-200">115660540726095110</code>), a{' '}
                      <strong>105.02s freeze</strong> occurred at 6:23 in-game (detected via the
                      zero-gold freeze heuristic in <code className="text-slate-200">/details</code>).
                      Sampling naive wall-clock <code className="text-slate-200">T_first_frame + 600s</code>{' '}
                      reads the game at <strong>8:10 in-game</strong> instead of <strong>10:00</strong>{' '}
                      (verified on broadcast HUD at{' '}
                      <a
                        href="https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=3695s"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-300 underline font-semibold"
                      >
                        t=3695s
                      </a>
                      ):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      {Object.keys(igTesG1.participants)
                        .map((k) => Number(k))
                        .sort((a, b) => a - b)
                        .map((pid) => {
                          const p = igTesG1.participants[String(pid)];
                          const naiveCs =
                            igTesG1.aligned_checkpoints['10m']?.naive_first_frame.pCs[pid - 1] ?? 0;
                          const trueCs =
                            igTesG1.aligned_checkpoints['10m']?.true_in_game_clock.pCs[pid - 1] ?? 0;
                          const diff = trueCs - naiveCs;
                          return (
                            <div
                              key={pid}
                              className="rounded border border-slate-800 bg-slate-900/80 p-2"
                            >
                              <div className="font-bold text-white truncate">
                                {p.summonerName} ({p.championId})
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Naive (8:10): {naiveCs} CS → True @10:00:{' '}
                                <strong className="text-emerald-300">{trueCs} CS</strong> (+{diff})
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default ProComparisonPreview;
