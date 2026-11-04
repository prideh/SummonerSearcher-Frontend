import React, { useMemo, useState } from 'react';
import { useDataDragonStore, type ItemMap } from '../store/dataDragonStore';
import {
  formatPurchaseItemLabel,
  formatTemporalEventDescription,
} from '../utils/improvementStatsHelper';
import type {
  ImprovementStatsBreakdownDto,
  ImprovementStatsDto,
  ObjectiveTypeSummaryDto,
  PhaseFarmingWindowDto,
} from '../types/improvementStats';

export interface ImprovementStatsSectionProps {
  stats: ImprovementStatsDto;
  hasTimelineAnalysis: boolean;
  onAnalyzeTimeline?: () => void;
  loadingTimeline?: boolean;
  compact?: boolean;
}

type FilterSelection =
  | { type: 'ALL' }
  | { type: 'ROLE'; key: string }
  | { type: 'CHAMPION'; key: string };

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
  UNKNOWN: 'Unknown Role',
};

const formatRoleName = (role: string): string =>
  ROLE_DISPLAY_NAMES[role.toUpperCase()] ?? role;

const formatSignedNumber = (val: number | null | undefined, suffix = '', decimals = 0): string => {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unavailable';
  const sign = val > 0 ? '+' : '';
  const formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString();
  return `${sign}${formatted}${suffix}`;
};

const formatNumber = (val: number | null | undefined, suffix = '', decimals = 1): string => {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unavailable';
  const formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString();
  return `${formatted}${suffix}`;
};

const formatRatePct = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return 'Unavailable';
  return `${Math.round(rate * 100)}%`;
};

const OBJECTIVES_META: Array<{
  key: 'tower' | 'dragon' | 'horde' | 'riftHerald' | 'baron';
  label: string;
  shortLabel: string;
}> = [
  { key: 'tower', label: 'Towers', shortLabel: 'Towers' },
  { key: 'dragon', label: 'Dragons', shortLabel: 'Dragons' },
  { key: 'horde', label: 'Void Grubs', shortLabel: 'Grubs' },
  { key: 'riftHerald', label: 'Rift Herald', shortLabel: 'Herald' },
  { key: 'baron', label: 'Baron Nashor', shortLabel: 'Baron' },
];

const ImprovementStatsSection: React.FC<ImprovementStatsSectionProps> = ({
  stats,
  hasTimelineAnalysis,
  onAnalyzeTimeline,
  loadingTimeline = false,
  compact = false,
}) => {
  const [selection, setSelection] = useState<FilterSelection>({ type: 'ALL' });
  const selectorItemMap = useDataDragonStore(state => state?.itemMap);
  const storeStateItemMap =
    typeof useDataDragonStore.getState === 'function'
      ? useDataDragonStore.getState()?.itemMap
      : null;
  const itemMap: ItemMap | null =
    selectorItemMap && typeof selectorItemMap === 'object'
      ? selectorItemMap
      : storeStateItemMap && typeof storeStateItemMap === 'object'
      ? storeStateItemMap
      : null;

  const roleEntries = useMemo(
    () =>
      Object.entries(stats.byRole ?? {}).sort(
        (a, b) => b[1].totalGamesConsidered - a[1].totalGamesConsidered || a[0].localeCompare(b[0])
      ),
    [stats.byRole]
  );

  const championEntries = useMemo(
    () =>
      Object.entries(stats.byChampion ?? {}).sort(
        (a, b) => b[1].totalGamesConsidered - a[1].totalGamesConsidered || a[0].localeCompare(b[0])
      ),
    [stats.byChampion]
  );

  const activeSlice: ImprovementStatsBreakdownDto = useMemo(() => {
    if (selection.type === 'ROLE' && stats.byRole?.[selection.key]) {
      return stats.byRole[selection.key];
    }
    if (selection.type === 'CHAMPION' && stats.byChampion?.[selection.key]) {
      return stats.byChampion[selection.key];
    }
    return {
      key: 'ALL',
      totalGamesConsidered: stats.totalGamesConsidered,
      excludedInvalidDurationGames: stats.excludedInvalidDurationGames,
      excludedMissingTimelineGames: stats.excludedMissingTimelineGames,
      phaseFarming: stats.phaseFarming,
      leadRetention: stats.leadRetention,
      deathCost: stats.deathCost,
      unspentGold: stats.unspentGold,
      teamObjectives: stats.teamObjectives,
    };
  }, [selection, stats]);

  const {
    phaseFarming,
    leadRetention,
    deathCost,
    unspentGold,
    teamObjectives,
    totalGamesConsidered,
    excludedInvalidDurationGames,
    excludedMissingTimelineGames,
  } = activeSlice;

  const associatedEvents10To20 = useMemo(() => {
    const events: Array<{
      matchId: string;
      championName: string;
      minuteMark: number;
      secondMark: number;
      securingTeam: string;
      objectiveType: string;
      monsterSubType?: string | null;
      towerType?: string | null;
      laneType?: string | null;
      playerPersonallyInvolved: boolean;
    }> = [];
    for (const m of leadRetention.perMatch ?? []) {
      for (const ev of m.temporalEvents10To20 ?? []) {
        events.push({
          matchId: m.matchId,
          championName: m.championName,
          minuteMark: ev.minuteMark,
          secondMark: ev.secondMark,
          securingTeam: ev.securingTeam,
          objectiveType: ev.objectiveType,
          monsterSubType: ev.monsterSubType,
          towerType: ev.towerType,
          laneType: ev.laneType,
          playerPersonallyInvolved: ev.playerPersonallyInvolved,
        });
      }
    }
    return events;
  }, [leadRetention.perMatch]);

  if (stats.totalGamesConsidered === 0) {
    return null;
  }

  const sliceHasTimelineData =
    hasTimelineAnalysis ||
    phaseFarming.min10To20.eligibleGames > 0 ||
    leadRetention.eligibleGamesAt10 > 0 ||
    deathCost.bountyOnPlayerDeaths.eligibleTimelineGames > 0 ||
    unspentGold.eligibleGames > 0;

  const renderPhaseWindow = (
    windowDto: PhaseFarmingWindowDto,
    title: string,
    missingTimelineGames: number
  ) => {
    const hasWindowData = windowDto.eligibleGames > 0;
    return (
      <div
        data-testid={`phase-window-${windowDto.windowLabel}`}
        className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {title}
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
            {windowDto.eligibleGames}G eligible
          </span>
        </div>

        {!sliceHasTimelineData && !hasWindowData ? (
          <div className="py-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
            Unavailable{' '}
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              (Analyze Timeline required)
            </span>
          </div>
        ) : !hasWindowData ? (
          <div className="py-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Unavailable{' '}
            <span className="text-[11px]">
              (0 eligible games
              {windowDto.excludedShortGames > 0 ? `; ${windowDto.excludedShortGames} short` : ''}
              {missingTimelineGames > 0 ? `; ${missingTimelineGames} no timeline` : ''}
              )
            </span>
          </div>
        ) : (
          <div className="space-y-1 text-xs telemetry-nums">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Total CS/m:</span>
              <span className="font-extrabold text-sky-600 dark:text-cyan-400">
                {formatNumber(windowDto.avgTotalCsPerMin, '/m', 2)}{' '}
                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                  ({formatNumber(windowDto.avgTotalCsGained, ' CS', 1)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Lane CS/m:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatNumber(windowDto.avgLaneCsPerMin, '/m', 2)}{' '}
                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                  ({formatNumber(windowDto.avgLaneCsGained, ' CS', 1)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Jungle CS/m:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatNumber(windowDto.avgJungleCsPerMin, '/m', 2)}{' '}
                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                  ({formatNumber(windowDto.avgJungleCsGained, ' CS', 1)})
                </span>
              </span>
            </div>
            {(windowDto.excludedShortGames > 0 || missingTimelineGames > 0) && (
              <div className="pt-1 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80">
                Excl: {windowDto.excludedShortGames > 0 && `${windowDto.excludedShortGames} short`}
                {windowDto.excludedShortGames > 0 && missingTimelineGames > 0 && ' · '}
                {missingTimelineGames > 0 && `${missingTimelineGames} missing timeline`}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderObjectiveRow = (
    meta: { key: string; label: string; shortLabel: string },
    summary: ObjectiveTypeSummaryDto
  ) => {
    const hasTeamKills = summary.eligibleGamesWithKills > 0 && summary.teamAvgKills !== null;
    const hasFirstRate = summary.eligibleGamesWithFirstFlag > 0 && summary.teamFirstRate !== null;
    const hasPersonalLh = summary.personalTotalLastHits !== null;
    const hasPersonalTd = summary.personalTotalTakedowns !== null;

    return (
      <tr
        key={meta.key}
        data-testid={`objective-row-${meta.key}`}
        className="border-t border-slate-200/70 dark:border-slate-800/80 text-xs telemetry-nums"
      >
        <td className="py-1.5 pr-2 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
          <span>{meta.label}</span>
          <span className="ml-1 text-[10px] font-normal text-slate-400 dark:text-slate-500">
            ({summary.eligibleGamesWithKills}G)
          </span>
        </td>
        <td className="py-1.5 px-2 text-center whitespace-nowrap">
          {hasFirstRate ? (
            <span className="font-semibold text-sky-600 dark:text-cyan-400">
              {formatRatePct(summary.teamFirstRate)}{' '}
              <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                ({summary.teamFirstCount}/{summary.eligibleGamesWithFirstFlag})
              </span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Unavailable</span>
          )}
        </td>
        <td className="py-1.5 px-2 text-center whitespace-nowrap">
          {hasTeamKills ? (
            <span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatNumber(summary.teamAvgKills, '', 2)}
              </span>
              <span className="text-slate-400 dark:text-slate-500 mx-1">vs</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {formatNumber(summary.enemyTeamAvgKills, '', 2)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">
                ({summary.teamTotalKills ?? 0}:{summary.enemyTeamTotalKills ?? 0})
              </span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Unavailable</span>
          )}
        </td>
        <td className="py-1.5 pl-2 text-right whitespace-nowrap">
          {hasPersonalLh || hasPersonalTd ? (
            <span className="text-slate-700 dark:text-slate-300">
              {hasPersonalLh && (
                <span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">LH: </span>
                  <span className="font-semibold">{summary.personalTotalLastHits}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {' '}
                    ({formatNumber(summary.personalAvgLastHits, '/g', 2)})
                  </span>
                </span>
              )}
              {hasPersonalLh && hasPersonalTd && (
                <span className="mx-1 text-slate-300 dark:text-slate-700">·</span>
              )}
              {hasPersonalTd && (
                <span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">TD: </span>
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    {summary.personalTotalTakedowns}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {' '}
                    ({formatNumber(summary.personalAvgTakedowns, '/g', 2)})
                  </span>
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Unavailable</span>
          )}
        </td>
      </tr>
    );
  };

  const bountySummary = deathCost.bountyOnPlayerDeaths;

  return (
    <section
      data-testid="improvement-stats-section"
      className={`bg-slate-50/70 dark:bg-[#0b101d] rounded-lg ${compact ? 'mt-0' : 'mt-4'} border border-slate-200 dark:border-slate-800 p-4`}
    >
      {/* Section Header + Filter Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Evidence-Based Improvement Telemetry
            </h3>
            <span
              data-testid="improvement-stats-sample-badge"
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 dark:bg-cyan-950/60 text-sky-700 dark:text-cyan-300 border border-sky-200 dark:border-cyan-800/60 telemetry-nums"
            >
              {totalGamesConsidered} {totalGamesConsidered === 1 ? 'Game' : 'Games'} Considered
              {excludedInvalidDurationGames > 0 && ` (${excludedInvalidDurationGames} invalid duration excl.)`}
            </span>
            <span
              data-testid="improvement-stats-timeline-status"
              className={`text-[10px] font-bold px-2 py-0.5 rounded border telemetry-nums ${
                sliceHasTimelineData
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
              }`}
            >
              {sliceHasTimelineData
                ? `Timeline Analyzed (${bountySummary.eligibleTimelineGames}/${totalGamesConsidered}G)`
                : `Match-Level Only (Timeline Not Analyzed · ${excludedMissingTimelineGames}G)`}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Phase CS/min, 10m→20m lead retention, death time &amp; shutdown bounty cost, 1m gold snapshots, and team vs personal objectives.
          </p>
        </div>

        {!sliceHasTimelineData && onAnalyzeTimeline && (
          <button
            type="button"
            onClick={onAnalyzeTimeline}
            disabled={loadingTimeline}
            data-testid="improvement-stats-analyze-cta"
            className="self-start lg:self-auto shrink-0 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md border border-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingTimeline ? 'Analyzing Timeline...' : 'Analyze Timeline for Full Telemetry'}
          </button>
        )}
      </div>

      {/* Role & Champion Breakdown Selector */}
      {(roleEntries.length > 0 || championEntries.length > 0) && (
        <div
          data-testid="improvement-stats-filters"
          className="flex flex-wrap items-center gap-1.5 pt-3 pb-1 text-xs"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
            Slice:
          </span>
          <button
            type="button"
            data-testid="filter-all"
            onClick={() => setSelection({ type: 'ALL' })}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors border telemetry-nums ${
              selection.type === 'ALL'
                ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 border-sky-600 dark:border-cyan-400'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All ({stats.totalGamesConsidered}G)
          </button>

          {roleEntries.map(([roleKey, slice]) => {
            const active = selection.type === 'ROLE' && selection.key === roleKey;
            return (
              <button
                key={`role-${roleKey}`}
                type="button"
                data-testid={`filter-role-${roleKey}`}
                onClick={() => setSelection({ type: 'ROLE', key: roleKey })}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors border telemetry-nums ${
                  active
                    ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 border-sky-600 dark:border-cyan-400'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {formatRoleName(roleKey)} ({slice.totalGamesConsidered}G)
              </button>
            );
          })}

          {championEntries.slice(0, 6).map(([champKey, slice]) => {
            const active = selection.type === 'CHAMPION' && selection.key === champKey;
            return (
              <button
                key={`champ-${champKey}`}
                type="button"
                data-testid={`filter-champ-${champKey}`}
                onClick={() => setSelection({ type: 'CHAMPION', key: champKey })}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors border telemetry-nums ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {champKey} ({slice.totalGamesConsidered}G)
              </button>
            );
          })}
        </div>
      )}

      {/* 5 Metric Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-3">
        {/* 1. Phase Farming (10-20m & 20m-end) */}
        <div
          data-testid="card-phase-farming"
          className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-cyan-400">
                1. Mid &amp; Late Phase Farming (Lane vs Jungle CS/m)
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {renderPhaseWindow(
                phaseFarming.min10To20,
                'Mid Game (10–20m)',
                phaseFarming.excludedMissingTimelineGames
              )}
              {renderPhaseWindow(
                phaseFarming.min20ToEnd,
                'Late Game (20m–End)',
                phaseFarming.excludedMissingTimelineGames
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            {phaseFarming.methodologyNote}
          </p>
        </div>

        {/* 2. Lead Retention (10m -> 20m Gold/XP vs Role Opponent) */}
        <div
          data-testid="card-lead-retention"
          className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                2. 10m → 20m Lead Conversion &amp; Retention
              </h4>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
                @10m: {leadRetention.eligibleGamesAt10}G · @20m: {leadRetention.eligibleGamesAt20}G
              </span>
            </div>

            {!sliceHasTimelineData && leadRetention.eligibleGamesAt10 === 0 ? (
              <div className="py-4 text-xs text-amber-700 dark:text-amber-300 font-medium">
                Unavailable{' '}
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  (Analyze Timeline required · {leadRetention.excludedMissingTimelineGames}G awaiting timeline)
                </span>
              </div>
            ) : leadRetention.eligibleGamesAt10 === 0 ? (
              <div className="py-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                Unavailable (0 eligible games with matched role opponent at 10m)
              </div>
            ) : (
              <div className="space-y-2 text-xs telemetry-nums">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 space-y-1">
                    <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                      Gold vs Role Opponent
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Avg Lead @10m:</span>
                      <span
                        className={`font-bold ${
                          (leadRetention.avgGoldLeadAt10 ?? 0) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedNumber(leadRetention.avgGoldLeadAt10, 'g', 1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Avg Lead @20m:</span>
                      <span
                        className={`font-bold ${
                          leadRetention.avgGoldLeadAt20 === null
                            ? 'text-slate-400 dark:text-slate-500'
                            : leadRetention.avgGoldLeadAt20 >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedNumber(leadRetention.avgGoldLeadAt20, 'g', 1)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Retained @20m:</span>
                      <span className="font-extrabold text-sky-600 dark:text-cyan-400">
                        {leadRetention.goldLeadRetentionRate !== null
                          ? `${formatRatePct(leadRetention.goldLeadRetentionRate)} (${leadRetention.gamesRetainedGoldLeadAt20}/${leadRetention.gamesAheadInGoldAt10Reaching20}G)`
                          : `Unavailable (${leadRetention.gamesAheadInGoldAt10} ahead @10m)`}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 space-y-1">
                    <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                      XP vs Role Opponent
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Avg Lead @10m:</span>
                      <span
                        className={`font-bold ${
                          (leadRetention.avgXpLeadAt10 ?? 0) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedNumber(leadRetention.avgXpLeadAt10, ' XP', 1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Avg Lead @20m:</span>
                      <span
                        className={`font-bold ${
                          leadRetention.avgXpLeadAt20 === null
                            ? 'text-slate-400 dark:text-slate-500'
                            : leadRetention.avgXpLeadAt20 >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedNumber(leadRetention.avgXpLeadAt20, ' XP', 1)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Retained @20m:</span>
                      <span className="font-extrabold text-sky-600 dark:text-cyan-400">
                        {leadRetention.xpLeadRetentionRate !== null
                          ? `${formatRatePct(leadRetention.xpLeadRetentionRate)} (${leadRetention.gamesRetainedXpLeadAt20}/${leadRetention.gamesAheadInXpAt10Reaching20}G)`
                          : `Unavailable (${leadRetention.gamesAheadInXpAt10} ahead @10m)`}
                      </span>
                    </div>
                  </div>
                </div>

                {associatedEvents10To20.length > 0 && (
                  <div
                    data-testid="lead-retention-temporal-events"
                    className="bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      10–20m Temporally Associated Events ({associatedEvents10To20.length}):{' '}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {associatedEvents10To20.slice(0, 3).map((ev, idx) => (
                        <span key={`${ev.matchId}-${ev.minuteMark}-${ev.secondMark}-${idx}`}>
                          {idx > 0 && ' · '}
                          {ev.championName} {ev.minuteMark}:{String(ev.secondMark).padStart(2, '0')}{' '}
                          {formatTemporalEventDescription(ev)}
                          {ev.playerPersonallyInvolved ? ' (involved)' : ' (team-only)'}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            {leadRetention.associationNote}
          </p>
        </div>

        {/* 3. Death Cost (Recorded Time Dead & Shutdown/Bounty Gold) */}
        <div
          data-testid="card-death-cost"
          className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                3. Death Cost (Time Dead &amp; Shutdown/Bounty Gold)
              </h4>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
                Time Dead: {deathCost.eligibleTimeDeadGames}G · Bounty: {bountySummary.eligibleTimelineGames}G
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs telemetry-nums">
              {/* Match-level Time Spent Dead */}
              <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                  Match Time Spent Dead ({deathCost.eligibleTimeDeadGames}G)
                </div>
                {deathCost.eligibleTimeDeadGames === 0 ? (
                  <div className="py-1 text-slate-500 dark:text-slate-400">
                    Unavailable ({deathCost.excludedMissingTimeSpentDeadGames}G missing field)
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Avg Dead / Game:</span>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {formatNumber(deathCost.avgTimeSpentDeadSeconds, 's', 1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Avg Game Share:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatNumber(deathCost.avgDeadTimeGameSharePct, '%', 2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Total Dead Time:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatNumber(deathCost.totalTimeSpentDeadSeconds, 's', 0)} (
                        {formatNumber(deathCost.overallDeadTimeGameSharePct, '%', 2)})
                      </span>
                    </div>
                    {deathCost.excludedMissingTimeSpentDeadGames > 0 && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                        Excl: {deathCost.excludedMissingTimeSpentDeadGames}G missing time-dead
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Timeline-level Shutdown & Kill Bounty Conceded */}
              <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                  Bounty Conceded on Deaths ({bountySummary.eligibleTimelineGames}G)
                </div>
                {!sliceHasTimelineData && bountySummary.eligibleTimelineGames === 0 ? (
                  <div className="py-2 text-amber-700 dark:text-amber-300 font-medium">
                    Unavailable{' '}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      (Analyze Timeline required)
                    </span>
                  </div>
                ) : bountySummary.eligibleTimelineGames === 0 ? (
                  <div className="py-2 text-slate-500 dark:text-slate-400">
                    Unavailable (0 timeline games)
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Recorded Deaths:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {bountySummary.totalRecordedDeaths ?? 'Unavailable'} (
                        {bountySummary.deathsWithAnyBountyData} w/ bounty
                        {bountySummary.deathsMissingBountyData > 0
                          ? `, ${bountySummary.deathsMissingBountyData} unknown`
                          : ''}
                        )
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Base + Shutdown:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatNumber(bountySummary.totalBaseKillBountyGold, 'g', 0)} +{' '}
                        {formatNumber(bountySummary.totalShutdownBountyGold, 'g', 0)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Combined Given:</span>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {formatNumber(bountySummary.totalCombinedBountyGold, 'g', 0)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            {deathCost.goldComponentDefinition}
          </p>
        </div>

        {/* 4. Unspent Gold (currentGold 1-Minute Snapshots) */}
        <div
          data-testid="card-unspent-gold"
          className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                4. Sampled Unspent Gold (1m Timeline Snapshots)
              </h4>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
                {unspentGold.eligibleGames}G · {unspentGold.sampleCount} snapshots
              </span>
            </div>

            {!sliceHasTimelineData && unspentGold.eligibleGames === 0 ? (
              <div className="py-4 text-xs text-amber-700 dark:text-amber-300 font-medium">
                Unavailable{' '}
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  (Analyze Timeline required · {unspentGold.excludedMissingTimelineGames}G awaiting timeline)
                </span>
              </div>
            ) : unspentGold.eligibleGames === 0 || unspentGold.sampleCount === 0 ? (
              <div className="py-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                Unavailable (0 sampled timeline frames)
              </div>
            ) : (
              <div className="space-y-2 text-xs telemetry-nums">
                <div className="grid grid-cols-3 gap-2 bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                      Median Gold
                    </div>
                    <div className="font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                      {formatNumber(unspentGold.medianCurrentGold, 'g', 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                      Avg Snapshot
                    </div>
                    <div className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                      {formatNumber(unspentGold.avgCurrentGold, 'g', 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                      Max Snapshot
                    </div>
                    <div className="font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                      {formatNumber(unspentGold.maxCurrentGold, 'g', 0)}
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Snapshots &ge; {unspentGold.highBalanceThresholdGold}g:
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {unspentGold.highBalanceSampleCount ?? 'Unavailable'} / {unspentGold.sampleCount} frames
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      &ge; {unspentGold.highBalanceThresholdGold}g Before Purchase:
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {unspentGold.highBalanceBeforePurchaseSampleCount ?? 'Unavailable'} frames
                    </span>
                  </div>
                  {unspentGold.highBalanceBeforePurchaseSamples.length > 0 && (
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Pre-purchase windows:{' '}
                      </span>
                      {unspentGold.highBalanceBeforePurchaseSamples.slice(0, 3).map((s, idx) => {
                        const itemLabel = formatPurchaseItemLabel(s.nextPurchaseItemId, itemMap);
                        return (
                          <span key={`${s.matchId}-${s.sampledMinute}-${idx}`}>
                            {idx > 0 && ' · '}
                            {s.championName} @{s.sampledMinute}m ({s.currentGoldAtSample}g
                            {itemLabel ? ` → ${itemLabel}` : ''})
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            {unspentGold.samplingSemanticsNote}
          </p>
        </div>

        {/* 5. Team Objectives vs Personal Takedowns (Full Width) */}
        <div
          data-testid="card-team-objectives"
          className="lg:col-span-2 bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              5. Team Objectives (info.teams) vs Personal Last-Hits / Takedowns
            </h4>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
              Team Data: {teamObjectives.eligibleTeamObjectiveGames}G eligible
              {teamObjectives.excludedMissingTeamsDataGames > 0 &&
                ` · ${teamObjectives.excludedMissingTeamsDataGames}G missing info.teams`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="pb-1.5 pr-1 sm:pr-2">Objective</th>
                  <th className="pb-1.5 px-1 sm:px-2 text-center">Team First Rate</th>
                  <th className="pb-1.5 px-1 sm:px-2 text-center">Team vs Enemy Avg (Total)</th>
                  <th className="pb-1.5 pl-1 sm:pl-2 text-right">Personal LH / Takedowns (TD)</th>
                </tr>
              </thead>
              <tbody>
                {OBJECTIVES_META.map(meta =>
                  renderObjectiveRow(meta, teamObjectives[meta.key])
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
            {teamObjectives.attributionNote}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ImprovementStatsSection;
