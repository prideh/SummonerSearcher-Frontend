import React, { useMemo, useState } from 'react';
import { useDataDragonStore, type ItemMap } from '../store/dataDragonStore';
import {
  formatPurchaseItemLabel,
  formatTemporalEventDescription,
} from '../utils/improvementStatsHelper';
import {
  calculateAverageLaneCsAt10,
  calculateLaneCsAt10Comparison,
  isEligibleLaneCsAt10Match,
  isLanerPosition,
} from '../utils/statsCalculator';
import { formatPatchMajorMinor } from '../utils/aiContextBuilder';
import type { MatchDto } from '../types/match';
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
  matches?: MatchDto[];
  puuid?: string;
}

type FilterSelection =
  | { type: 'ALL' }
  | { type: 'ROLE'; key: string }
  | { type: 'CHAMPION'; key: string };

type EvidenceTabKey =
  | 'ALL'
  | 'LANE_CS_10'
  | 'PHASE_FARMING'
  | 'LEAD_RETENTION'
  | 'DEATH_COST'
  | 'UNSPENT_GOLD'
  | 'TEAM_OBJECTIVES';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
  SUPPORT: 'Support',
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

const formatDurationClock = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return 'Unavailable';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
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

interface LaneCsAt10MatchEvidenceRow {
  matchId: string;
  championName: string;
  role: string;
  patch: string;
  durationSeconds: number;
  win: boolean;
  actual: number | null;
  target: number | null;
  targetLabel: string | null;
  statusBadge: string;
  statusTone: 'emerald' | 'amber' | 'slate';
}

const ImprovementStatsSection: React.FC<ImprovementStatsSectionProps> = ({
  stats,
  hasTimelineAnalysis,
  onAnalyzeTimeline,
  loadingTimeline = false,
  compact = false,
  matches,
  puuid,
}) => {
  const [selection, setSelection] = useState<FilterSelection>({ type: 'ALL' });
  const [showEvidenceCards, setShowEvidenceCards] = useState<boolean>(false);
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<EvidenceTabKey>('ALL');

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

  const laneCs10Evidence = useMemo(() => {
    if (!matches || !puuid || matches.length === 0) return null;

    const filteredMatches = matches.filter(m => {
      const p = m.info?.participants?.find(part => part.puuid === puuid);
      if (!p) return false;
      if (selection.type === 'ROLE') {
        const normRole =
          p.teamPosition?.toUpperCase() === 'SUPPORT'
            ? 'UTILITY'
            : p.teamPosition?.toUpperCase() || 'UNKNOWN';
        return normRole === selection.key.toUpperCase();
      }
      if (selection.type === 'CHAMPION') {
        return p.championName === selection.key;
      }
      return true;
    });

    const summary = calculateAverageLaneCsAt10(filteredMatches, puuid);
    let missingLanerCount = 0;
    let shortOrEarlySurrenderLanerCount = 0;
    let pre26LanerCount = 0;
    let nonLanerCount = 0;

    const rows: LaneCsAt10MatchEvidenceRow[] = [];

    for (let i = 0; i < Math.min(filteredMatches.length, 20); i++) {
      const match = filteredMatches[i];
      const p = match.info?.participants?.find(part => part.puuid === puuid);
      if (!p) continue;

      const role = p.teamPosition || 'UNKNOWN';
      const patch = formatPatchMajorMinor(match.info?.gameVersion) ?? 'Unknown';
      const durationSeconds = match.info?.gameDuration ?? 0;
      const matchId =
        match.metadata?.matchId ||
        (match.info?.gameId !== undefined ? String(match.info.gameId) : `Match-${i + 1}`);
      const rawLaneCs10 = p.challenges?.laneMinionsFirst10Minutes;
      const isLaner = isLanerPosition(role);
      const isDurationAndQueueEligible = isEligibleLaneCsAt10Match(match.info);
      const isEarlySurrender = Boolean(p.gameEndedInEarlySurrender);
      const hasRawNumber =
        typeof rawLaneCs10 === 'number' && Number.isFinite(rawLaneCs10) && rawLaneCs10 >= 0;

      if (!isLaner) {
        nonLanerCount += 1;
        rows.push({
          matchId,
          championName: p.championName || 'Unknown',
          role,
          patch,
          durationSeconds,
          win: Boolean(p.win),
          actual: hasRawNumber ? Math.round(rawLaneCs10 * 10) / 10 : null,
          target: null,
          targetLabel: null,
          statusBadge: 'Non-laner role (excluded from theoretical maximum)',
          statusTone: 'slate',
        });
        continue;
      }

      if (!isDurationAndQueueEligible || isEarlySurrender) {
        missingLanerCount += 1;
        shortOrEarlySurrenderLanerCount += 1;
        rows.push({
          matchId,
          championName: p.championName || 'Unknown',
          role,
          patch,
          durationSeconds,
          win: Boolean(p.win),
          actual: hasRawNumber ? Math.round(rawLaneCs10 * 10) / 10 : null,
          target: null,
          targetLabel: null,
          statusBadge: isEarlySurrender
            ? 'Early surrender (excluded from 10m theoretical maximum)'
            : durationSeconds < 600
            ? 'Short game <10:00 (excluded from 10m theoretical maximum)'
            : 'Non-standard queue (excluded)',
          statusTone: 'amber',
        });
        continue;
      }

      if (!hasRawNumber) {
        missingLanerCount += 1;
        rows.push({
          matchId,
          championName: p.championName || 'Unknown',
          role,
          patch,
          durationSeconds,
          win: Boolean(p.win),
          actual: null,
          target: null,
          targetLabel: null,
          statusBadge: 'Missing 10m challenge telemetry (excluded)',
          statusTone: 'amber',
        });
        continue;
      }

      const comp = calculateLaneCsAt10Comparison(rawLaneCs10, match.info?.gameVersion, role);
      if (comp && comp.target !== null) {
        rows.push({
          matchId,
          championName: p.championName || 'Unknown',
          role,
          patch,
          durationSeconds,
          win: Boolean(p.win),
          actual: comp.actual,
          target: comp.target,
          targetLabel: comp.targetLabel,
          statusBadge: `Eligible · ${comp.targetLabel ?? 'Patch 26.1+ theoretical maximum'} (${comp.target})`,
          statusTone: 'emerald',
        });
      } else {
        pre26LanerCount += 1;
        rows.push({
          matchId,
          championName: p.championName || 'Unknown',
          role,
          patch,
          durationSeconds,
          win: Boolean(p.win),
          actual: comp?.actual ?? Math.round(rawLaneCs10 * 10) / 10,
          target: null,
          targetLabel: null,
          statusBadge: 'Pre-26.1 patch (actual recorded · no theoretical maximum)',
          statusTone: 'slate',
        });
      }
    }

    return {
      summary,
      missingLanerCount,
      shortOrEarlySurrenderLanerCount,
      pre26LanerCount,
      nonLanerCount,
      rows,
    };
  }, [matches, puuid, selection]);

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
          <div className="py-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
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
              <span className="font-extrabold text-slate-800 dark:text-slate-100">
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
        className="block sm:table-row py-2 sm:py-0 border-t border-slate-200/70 dark:border-slate-800/80 first:border-t-0 sm:first:border-t text-xs telemetry-nums"
      >
        <td className="block sm:table-cell pb-1 sm:py-1.5 sm:pr-2 font-bold text-slate-800 dark:text-slate-200 sm:whitespace-nowrap">
          <span>{meta.label}</span>
          <span className="ml-1 text-[10px] font-normal text-slate-400 dark:text-slate-500">
            ({summary.eligibleGamesWithKills}G)
          </span>
        </td>
        <td className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 py-0.5 sm:table-cell sm:py-1.5 sm:px-2 sm:text-center sm:whitespace-nowrap">
          <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            First Rate
          </span>
          {hasFirstRate ? (
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {formatRatePct(summary.teamFirstRate)}{' '}
              <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                ({summary.teamFirstCount}/{summary.eligibleGamesWithFirstFlag})
              </span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Unavailable</span>
          )}
        </td>
        <td className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 py-0.5 sm:table-cell sm:py-1.5 sm:px-2 sm:text-center sm:whitespace-nowrap">
          <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Team vs Enemy
          </span>
          {hasTeamKills ? (
            <span className="text-slate-800 dark:text-slate-100">
              <span className="font-bold">
                {formatNumber(summary.teamAvgKills, '', 2)}
              </span>
              <span className="text-slate-400 dark:text-slate-500 mx-1">vs</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
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
        <td className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 pt-0.5 sm:table-cell sm:py-1.5 sm:pl-2 sm:text-right sm:whitespace-nowrap">
          <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Personal LH / TD
          </span>
          {hasPersonalLh || hasPersonalTd ? (
            <span className="text-slate-700 dark:text-slate-300 text-right">
              {hasPersonalLh && (
                <span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">LH: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {summary.personalTotalLastHits}
                  </span>
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
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
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

  const openSpecificEvidenceCard = (tab: EvidenceTabKey) => {
    setShowEvidenceCards(true);
    setActiveEvidenceTab(tab);
  };

  return (
    <section
      data-testid="improvement-stats-section"
      className={`bg-slate-50/70 dark:bg-[#0b101d] rounded-lg ${
        compact ? 'mt-0 p-2 sm:p-3' : 'mt-4 p-4'
      } border border-slate-200 dark:border-slate-800`}
    >
      {/* Section Header + Filter Pills */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between ${compact ? 'gap-1.5 pb-1.5' : 'gap-2.5 pb-2.5'} border-b border-slate-200 dark:border-slate-800`}>
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!compact && (
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                5-Stat Improvement Summary
              </h3>
            )}
            <span
              data-testid="improvement-stats-sample-badge"
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 telemetry-nums"
            >
              {totalGamesConsidered} {totalGamesConsidered === 1 ? 'Game' : 'Games'} Considered
              {excludedInvalidDurationGames > 0 && ` (${excludedInvalidDurationGames} invalid duration excl.)`}
            </span>
            <span
              data-testid="improvement-stats-timeline-status"
              className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 telemetry-nums"
            >
              {sliceHasTimelineData
                ? `Timeline Analyzed (${bountySummary.eligibleTimelineGames}/${totalGamesConsidered}G)`
                : `Match-Level Only (Timeline Not Analyzed · ${excludedMissingTimelineGames}G)`}
            </span>
          </div>
          {!compact && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Mid/late CS per minute, 10m &amp; 20m lane leads, death time &amp; bounty gold, 1-minute gold-in-hand snapshots, and team vs personal objectives.
            </p>
          )}
        </div>

        {!sliceHasTimelineData && onAnalyzeTimeline && (
          <button
            type="button"
            onClick={onAnalyzeTimeline}
            disabled={loadingTimeline}
            data-testid="improvement-stats-analyze-cta"
            className="self-start lg:self-auto shrink-0 text-xs font-bold bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 px-3 py-1.5 rounded-md border border-slate-700 dark:border-slate-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingTimeline ? 'Analyzing Timeline...' : 'Analyze Timeline for Full Stats'}
          </button>
        )}
      </div>

      {/* Role & Champion Breakdown Selector */}
      {(roleEntries.length > 0 || championEntries.length > 0) && (
        <div
          data-testid="improvement-stats-filters"
          className={`flex items-center gap-1 ${compact ? 'pt-1.5 pb-0.5 overflow-x-auto whitespace-nowrap no-scrollbar' : 'flex-wrap pt-3 pb-1'} text-xs`}
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
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-950 border-slate-800 dark:border-slate-200'
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
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-950 border-slate-800 dark:border-slate-200'
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
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-950 border-slate-800 dark:border-slate-200'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {champKey} ({slice.totalGamesConsidered}G)
              </button>
            );
          })}
        </div>
      )}

      {/* Default Compact Summary Cards (Metric + Sample + Per-Card Inspect Evidence) */}
      <div
        data-testid="improvement-stats-compact-summary"
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          laneCs10Evidence ? 'lg:grid-cols-3' : 'lg:grid-cols-5'
        } gap-2.5 mt-3 text-xs telemetry-nums`}
      >
        {/* Summary 0: Early 10m Lane CS (when match data is provided) */}
        {laneCs10Evidence && (
          <div
            data-testid="summary-lane-cs-10"
            className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 flex flex-col justify-between gap-1.5"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  10m Lane CS
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {laneCs10Evidence.summary?.matchCount ?? 0}G laner
                  {laneCs10Evidence.missingLanerCount > 0 &&
                    ` · ${laneCs10Evidence.missingLanerCount} excl.`}
                </span>
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div
                  data-testid="summary-lane-cs-10-actual"
                  className="flex justify-between gap-1"
                >
                  <span className="text-slate-500 dark:text-slate-400">Avg @10m:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {laneCs10Evidence.summary
                      ? `${laneCs10Evidence.summary.avgActual} CS (${laneCs10Evidence.summary.matchCount}G)`
                      : 'Unavailable (0G)'}
                  </span>
                </div>
                <div
                  data-testid="summary-lane-cs-10-target"
                  className="flex justify-between gap-1"
                >
                  <span className="text-slate-500 dark:text-slate-400">
                    Theoretical maximum (&ne; missed CS):
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-right">
                    {laneCs10Evidence.summary?.avgTarget !== null &&
                    laneCs10Evidence.summary?.avgTarget !== undefined
                      ? `${laneCs10Evidence.summary.avgTarget} CS (${laneCs10Evidence.summary.targetMatchCount}G)`
                      : laneCs10Evidence.summary?.targetMatchCount &&
                        laneCs10Evidence.summary.targetMatchCount > 0
                      ? 'Unavailable (mixed patch)'
                      : laneCs10Evidence.summary
                      ? 'Unavailable (pre-26.1)'
                      : 'Unavailable'}
                  </span>
                </div>
                {laneCs10Evidence.summary?.avgTarget === null &&
                  laneCs10Evidence.summary?.avgSupportedActual !== null &&
                  laneCs10Evidence.summary?.avgSupportedActual !== undefined &&
                  laneCs10Evidence.summary.targetMatchCount > 0 && (
                    <div
                      data-testid="summary-lane-cs-10-supported-actual"
                      className="flex justify-between gap-1"
                    >
                      <span className="text-slate-500 dark:text-slate-400">26.1+ actual:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-right">
                        {laneCs10Evidence.summary.avgSupportedActual} CS (
                        {laneCs10Evidence.summary.targetMatchCount}G)
                      </span>
                    </div>
                  )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => openSpecificEvidenceCard('LANE_CS_10')}
              className="self-start text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Inspect evidence ({laneCs10Evidence.rows.length}G) &rarr;
            </button>
          </div>
        )}

        {/* Summary 1: Phase Farming */}
        <div
          data-testid="summary-phase-farming"
          className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 flex flex-col justify-between gap-1.5"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                1. Phase CS/m
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {phaseFarming.min10To20.eligibleGames}G / {phaseFarming.min20ToEnd.eligibleGames}G
              </span>
            </div>
            {!sliceHasTimelineData && phaseFarming.min10To20.eligibleGames === 0 ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Unavailable (Analyze Timeline required)
              </div>
            ) : (
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400">10–20m:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {phaseFarming.min10To20.eligibleGames > 0
                      ? `${formatNumber(phaseFarming.min10To20.avgTotalCsPerMin, '/m', 2)} (${phaseFarming.min10To20.eligibleGames}G)`
                      : 'Unavailable (0G)'}
                  </span>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400">20m–End:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {phaseFarming.min20ToEnd.eligibleGames > 0
                      ? `${formatNumber(phaseFarming.min20ToEnd.avgTotalCsPerMin, '/m', 2)} (${phaseFarming.min20ToEnd.eligibleGames}G)`
                      : 'Unavailable (0G)'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => openSpecificEvidenceCard('PHASE_FARMING')}
            className="self-start text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Inspect evidence &rarr;
          </button>
        </div>

        {/* Summary 2: 10m & 20m Leads (unmatched samples) */}
        <div
          data-testid="summary-lead-retention"
          className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 flex flex-col justify-between gap-1.5"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                2. 10m &amp; 20m Leads
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {leadRetention.eligibleGamesAt10}G vs {leadRetention.eligibleGamesAt20}G
              </span>
            </div>
            {!sliceHasTimelineData && leadRetention.eligibleGamesAt10 === 0 ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Unavailable (Analyze Timeline required)
              </div>
            ) : leadRetention.eligibleGamesAt10 === 0 ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Unavailable (0G)
              </div>
            ) : (
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    Gold ({leadRetention.eligibleGamesAt10}G / {leadRetention.eligibleGamesAt20}G):
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {formatSignedNumber(leadRetention.avgGoldLeadAt10, 'g', 1)} /{' '}
                    {formatSignedNumber(leadRetention.avgGoldLeadAt20, 'g', 1)}
                  </span>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400">Held @20m:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {leadRetention.goldLeadRetentionRate !== null
                      ? `${formatRatePct(leadRetention.goldLeadRetentionRate)} (${leadRetention.gamesRetainedGoldLeadAt20}/${leadRetention.gamesAheadInGoldAt10Reaching20}G)`
                      : 'Unavailable'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => openSpecificEvidenceCard('LEAD_RETENTION')}
            className="self-start text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Inspect evidence &rarr;
          </button>
        </div>

        {/* Summary 3: Death Cost */}
        <div
          data-testid="summary-death-cost"
          className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 flex flex-col justify-between gap-1.5"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                3. Death Cost
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {deathCost.eligibleTimeDeadGames}G / {bountySummary.eligibleTimelineGames}G
              </span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">Avg Dead:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {deathCost.eligibleTimeDeadGames > 0
                    ? `${formatNumber(deathCost.avgTimeSpentDeadSeconds, 's', 1)} (${formatNumber(deathCost.avgDeadTimeGameSharePct, '%', 2)})`
                    : 'Unavailable'}
                </span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">Bounty Given:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {bountySummary.eligibleTimelineGames > 0
                    ? `${formatNumber(bountySummary.totalCombinedBountyGold, 'g', 0)} (${bountySummary.totalRecordedDeaths ?? 0}D)`
                    : !sliceHasTimelineData
                    ? 'Unavailable (Timeline)'
                    : 'Unavailable (0G)'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openSpecificEvidenceCard('DEATH_COST')}
            className="self-start text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Inspect evidence &rarr;
          </button>
        </div>

        {/* Summary 4: Unspent Gold (1m snapshots, not mistakes) */}
        <div
          data-testid="summary-unspent-gold"
          className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 flex flex-col justify-between gap-1.5"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                4. Unspent Gold
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {unspentGold.eligibleGames}G · {unspentGold.sampleCount} snaps
              </span>
            </div>
            {!sliceHasTimelineData && unspentGold.eligibleGames === 0 ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Unavailable (Analyze Timeline required)
              </div>
            ) : unspentGold.eligibleGames === 0 || unspentGold.sampleCount === 0 ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Unavailable (0 snapshots)
              </div>
            ) : (
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400">Med / Avg:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {formatNumber(unspentGold.medianCurrentGold, 'g', 1)} /{' '}
                    {formatNumber(unspentGold.avgCurrentGold, 'g', 1)}
                  </span>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    &ge;{unspentGold.highBalanceThresholdGold}g (neutral):
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {unspentGold.highBalanceSampleCount ?? 'Unavailable'}/{unspentGold.sampleCount}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => openSpecificEvidenceCard('UNSPENT_GOLD')}
            className="self-start text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Inspect evidence &rarr;
          </button>
        </div>

        {/* Summary 5: Team Objectives */}
        <div
          data-testid="summary-team-objectives"
          className={`bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 flex flex-col justify-between gap-1.5 ${
            laneCs10Evidence ? '' : 'sm:col-span-2 lg:col-span-1'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                5. Objectives
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {teamObjectives.eligibleTeamObjectiveGames}G eligible
              </span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">
                  Towers ({teamObjectives.tower.eligibleGamesWithKills}G):
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {teamObjectives.tower.eligibleGamesWithKills > 0 &&
                  teamObjectives.tower.teamAvgKills !== null
                    ? `${formatNumber(teamObjectives.tower.teamAvgKills, '', 2)} vs ${formatNumber(teamObjectives.tower.enemyTeamAvgKills, '', 2)}`
                    : 'Unavailable'}
                </span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">
                  Dragons ({teamObjectives.dragon.eligibleGamesWithKills}G):
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {teamObjectives.dragon.eligibleGamesWithKills > 0 &&
                  teamObjectives.dragon.teamAvgKills !== null
                    ? `${formatNumber(teamObjectives.dragon.teamAvgKills, '', 2)} vs ${formatNumber(teamObjectives.dragon.enemyTeamAvgKills, '', 2)}`
                    : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openSpecificEvidenceCard('TEAM_OBJECTIVES')}
            className="self-start text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Inspect evidence &rarr;
          </button>
        </div>
      </div>

      {/* Action Bar: Inspect Evidence Toggle */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="inspect-evidence-cards-toggle"
          aria-expanded={showEvidenceCards}
          aria-controls="inspectable-evidence-cards-panel"
          onClick={() => setShowEvidenceCards(prev => !prev)}
          className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-3 py-1.5 border transition-colors ${
            showEvidenceCards
              ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500'
              : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
          }`}
        >
          <span className="text-[10px]">{showEvidenceCards ? '▼' : '▶'}</span>
          <span>Inspect Evidence (Matches &amp; Checkpoints)</span>
        </button>
      </div>

      {/* Inspectable Coach Evidence Cards Panel (Compact Summary Cards + Expandable Per-Card Evidence) */}
      {showEvidenceCards && (
        <div
          id="inspectable-evidence-cards-panel"
          data-testid="inspectable-evidence-cards-panel"
          className="mt-3 bg-white/90 dark:bg-slate-950/70 border border-indigo-200/80 dark:border-indigo-900/60 rounded-lg p-3 space-y-2.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Match &amp; Checkpoint Evidence
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Observed Stats
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                Coach Boundary
              </span>
            </div>

            {/* Category filter tabs for keyboard/mobile navigation */}
            <div
              role="tablist"
              aria-label="Evidence Card Categories"
              className="flex flex-wrap gap-1"
            >
              {(
                [
                  { key: 'ALL', label: 'All Cards' },
                  ...(laneCs10Evidence ? [{ key: 'LANE_CS_10', label: '10m Lane CS' }] : []),
                  { key: 'PHASE_FARMING', label: '1. Phase CS' },
                  { key: 'LEAD_RETENTION', label: '2. Lead Retention' },
                  { key: 'DEATH_COST', label: '3. Death Cost' },
                  { key: 'UNSPENT_GOLD', label: '4. Unspent Gold' },
                  { key: 'TEAM_OBJECTIVES', label: '5. Objectives' },
                ] as Array<{ key: EvidenceTabKey; label: string }>
              ).map(tab => {
                const active = activeEvidenceTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`evidence-tab-${tab.key}`}
                    onClick={() => setActiveEvidenceTab(tab.key)}
                    className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {/* Evidence Card 0: Early Lane CS @ 10m Theoretical Maximum (Table collapsed by default in All Cards) */}
            {laneCs10Evidence &&
              (activeEvidenceTab === 'ALL' || activeEvidenceTab === 'LANE_CS_10') && (
                <div
                  data-testid="evidence-card-lane-cs-10"
                  className="bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 space-y-1.5 text-xs telemetry-nums"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      Early Lane CS @ 10m
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      Eligible Laner Games: {laneCs10Evidence.summary?.matchCount ?? 0}G · Theoretical-Max-Supported:{' '}
                      {laneCs10Evidence.summary?.targetMatchCount ?? 0}G · Missing/Short Laner Excl:{' '}
                      {laneCs10Evidence.missingLanerCount}G
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700 dark:text-slate-200">
                    <div>
                      <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mr-1.5">
                        Observed
                      </span>
                      Avg 10m Lane CS:{' '}
                      <strong>
                        {laneCs10Evidence.summary
                          ? `${laneCs10Evidence.summary.avgActual} CS (${laneCs10Evidence.summary.matchCount}G)`
                          : 'Unavailable (0 eligible laner games)'}
                      </strong>
                      {' · '}
                      Theoretical Maximum:{' '}
                      <strong>
                        {laneCs10Evidence.summary?.avgTarget !== null &&
                        laneCs10Evidence.summary?.avgTarget !== undefined
                          ? `${laneCs10Evidence.summary.avgTarget} (${laneCs10Evidence.summary.targetMatchCount}G on Patch 26.1+)`
                          : `Unavailable (${laneCs10Evidence.pre26LanerCount} pre-26.1 / mixed-patch${
                              laneCs10Evidence.summary?.avgSupportedActual !== null &&
                              laneCs10Evidence.summary?.avgSupportedActual !== undefined
                                ? ` · supported actual ${laneCs10Evidence.summary.avgSupportedActual} CS in ${laneCs10Evidence.summary.targetMatchCount}G`
                                : ''
                            })`}
                      </strong>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      Theoretical maximum &ne; missed CS (114 Top/Bot, 120 Mid passive wave ceiling)
                    </span>
                  </div>

                  <details open={activeEvidenceTab !== 'ALL'} className="group pt-0.5">
                    <summary className="cursor-pointer select-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                      Inspect evidence ({laneCs10Evidence.rows.length} matches · role, patch, duration &amp; guardrail)
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5 leading-snug">
                        <strong className="text-amber-700 dark:text-amber-300">Coach boundary:</strong>{' '}
                        Passive wave theoretical maximums (114 Top/Bot, 120 Mid on Patch 26.1+) are 10m spawn ceilings, not expected CS—never subtract actual from the theoretical maximum to claim missed CS. Short (&lt;10:00) and early-surrender games are excluded, never counted as 0.
                      </p>
                      <div className="sm:overflow-x-auto">
                        <table className="block sm:table w-full text-left border-collapse text-[11px]">
                          <thead className="hidden sm:table-header-group text-[10px] uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="py-1 pr-2">Match / Champion</th>
                              <th className="py-1 px-2">Role &amp; Patch</th>
                              <th className="py-1 px-2">Duration</th>
                              <th className="py-1 px-2">Observed 10m CS</th>
                              <th className="py-1 px-2">Theoretical Maximum (&ne; missed CS)</th>
                              <th className="py-1 pl-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="block sm:table-row-group divide-y divide-slate-200/60 dark:divide-slate-800/70">
                            {laneCs10Evidence.rows.slice(0, 10).map(row => (
                              <tr
                                key={row.matchId}
                                data-testid={`evidence-lane-cs-row-${row.matchId}`}
                                className="block sm:table-row py-1.5 sm:py-0"
                              >
                                <td className="block sm:table-cell sm:py-1.5 sm:pr-2 font-bold text-slate-800 dark:text-slate-100">
                                  <span
                                    className={`inline-block w-4 text-center mr-1 rounded text-[10px] ${
                                      row.win
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                    }`}
                                  >
                                    {row.win ? 'W' : 'L'}
                                  </span>
                                  {row.championName}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">
                                    ({row.matchId})
                                  </span>
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-600 dark:text-slate-300">
                                  <span className="sm:hidden text-[10px] text-slate-400 mr-1">Role/Patch:</span>
                                  {formatRoleName(row.role)} · Patch {row.patch}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-600 dark:text-slate-300">
                                  <span className="sm:hidden text-[10px] text-slate-400 mr-1">Duration:</span>
                                  {formatDurationClock(row.durationSeconds)}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 font-bold text-slate-800 dark:text-slate-100">
                                  <span className="sm:hidden text-[10px] font-normal text-slate-400 mr-1">
                                    Observed 10m CS:
                                  </span>
                                  {row.actual !== null ? `${row.actual} CS` : 'Unavailable'}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 font-semibold text-slate-700 dark:text-slate-200">
                                  <span className="sm:hidden text-[10px] font-normal text-slate-400 mr-1">
                                    Theoretical maximum:
                                  </span>
                                  {row.target !== null ? `${row.target} CS` : 'No theoretical maximum'}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:pl-2">
                                  <span
                                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      row.statusTone === 'emerald'
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : row.statusTone === 'amber'
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                        : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {row.statusBadge}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </div>
              )}

            {/* Evidence Card 1: Phase Farming Checkpoints */}
            {(activeEvidenceTab === 'ALL' || activeEvidenceTab === 'PHASE_FARMING') && (
              <div
                data-testid="evidence-card-phase-farming"
                className="bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 space-y-1.5 text-xs telemetry-nums"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    1. Phase Farming (10–20m &amp; 20m–End)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    10–20m: {phaseFarming.min10To20.eligibleGames}G ({phaseFarming.min10To20.excludedShortGames} short excl.) · 20m–End:{' '}
                    {phaseFarming.min20ToEnd.eligibleGames}G ({phaseFarming.min20ToEnd.excludedShortGames} short excl.) · No Timeline:{' '}
                    {phaseFarming.excludedMissingTimelineGames}G
                  </span>
                </div>

                <div className="text-[11px] text-slate-700 dark:text-slate-200">
                  <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mr-1.5">
                    Observed
                  </span>
                  10–20m:{' '}
                  <strong>
                    {phaseFarming.min10To20.eligibleGames > 0
                      ? `${formatNumber(phaseFarming.min10To20.avgTotalCsPerMin, '/m', 2)} (Lane ${formatNumber(phaseFarming.min10To20.avgLaneCsPerMin, '/m', 2)}, Jg ${formatNumber(phaseFarming.min10To20.avgJungleCsPerMin, '/m', 2)})`
                      : 'Unavailable'}
                  </strong>
                  {' · '}20m–End:{' '}
                  <strong>
                    {phaseFarming.min20ToEnd.eligibleGames > 0
                      ? `${formatNumber(phaseFarming.min20ToEnd.avgTotalCsPerMin, '/m', 2)} (Lane ${formatNumber(phaseFarming.min20ToEnd.avgLaneCsPerMin, '/m', 2)}, Jg ${formatNumber(phaseFarming.min20ToEnd.avgJungleCsPerMin, '/m', 2)})`
                      : 'Unavailable'}
                  </strong>
                </div>

                <details open={activeEvidenceTab !== 'ALL'} className="group pt-0.5">
                  <summary className="cursor-pointer select-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Inspect evidence ({(phaseFarming.perMatch ?? []).length}G checkpoints &amp; guardrail)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5 leading-snug">
                      <strong className="text-amber-700 dark:text-amber-300">Coach boundary:</strong>{' '}
                      Counts lane and jungle CS gained between 10:00, 20:00, and game end. Short games are excluded; missed last-hits or wave states are never guessed.
                    </p>
                    <div className="sm:overflow-x-auto">
                      <table className="block sm:table w-full text-left border-collapse text-[11px]">
                        <thead className="hidden sm:table-header-group text-[10px] uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-1 pr-2">Match</th>
                            <th className="py-1 px-2">Duration</th>
                            <th className="py-1 px-2">10m → 20m → End CS</th>
                            <th className="py-1 px-2">10–20m CS/m (Lane + Jg)</th>
                            <th className="py-1 px-2">20m–End CS/m</th>
                            <th className="py-1 pl-2">Checkpoint Status</th>
                          </tr>
                        </thead>
                        <tbody className="block sm:table-row-group divide-y divide-slate-200/60 dark:divide-slate-800/70">
                          {(phaseFarming.perMatch ?? []).slice(0, 8).map(m => {
                            const csAt10 =
                              m.laneCsAt10 !== null || m.jungleCsAt10 !== null
                                ? (m.laneCsAt10 ?? 0) + (m.jungleCsAt10 ?? 0)
                                : null;
                            const csAt20 =
                              m.laneCsAt20 !== null || m.jungleCsAt20 !== null
                                ? (m.laneCsAt20 ?? 0) + (m.jungleCsAt20 ?? 0)
                                : null;
                            const csAtEnd =
                              m.laneCsAtEnd !== null || m.jungleCsAtEnd !== null
                                ? (m.laneCsAtEnd ?? 0) + (m.jungleCsAtEnd ?? 0)
                                : null;
                            const statusLabel = !m.reached10To20
                              ? m.gameDurationSeconds < 1200
                                ? 'Short game <20:00 (10–20m & 20m+ excluded)'
                                : 'Timeline not analyzed'
                              : !m.reached20ToEnd
                              ? 'Reached 20:00 (20m–End window short/excluded)'
                              : 'Full 10m & 20m checkpoints';
                            return (
                              <tr
                                key={`pf-${m.matchId}`}
                                data-testid={`evidence-phase-row-${m.matchId}`}
                                className="block sm:table-row py-1.5 sm:py-0"
                              >
                                <td className="block sm:table-cell sm:py-1.5 sm:pr-2 font-bold text-slate-800 dark:text-slate-100">
                                  {m.championName} ({formatRoleName(m.role)}){' '}
                                  <span className="text-[10px] font-normal text-slate-400">
                                    {m.matchId}
                                  </span>
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-600 dark:text-slate-300">
                                  {formatDurationClock(m.gameDurationSeconds)}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                  {csAt10 ?? '—'} → {csAt20 ?? '—'} → {csAtEnd ?? '—'}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 font-semibold text-slate-800 dark:text-slate-100">
                                  {m.totalCsPerMin10To20 !== null
                                    ? `${formatNumber(m.totalCsPerMin10To20, '/m', 2)} (+${m.laneCsGained10To20 ?? 0}L / +${m.jungleCsGained10To20 ?? 0}J)`
                                    : 'Unavailable'}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 font-semibold text-slate-800 dark:text-slate-100">
                                  {m.totalCsPerMin20ToEnd !== null
                                    ? `${formatNumber(m.totalCsPerMin20ToEnd, '/m', 2)} (+${m.laneCsGained20ToEnd ?? 0}L / +${m.jungleCsGained20ToEnd ?? 0}J)`
                                    : 'Unavailable'}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:pl-2">
                                  <span
                                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      m.reached10To20 && m.reached20ToEnd
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                    }`}
                                  >
                                    {statusLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Evidence Card 2: Lead Retention & 10-20m Temporal Events */}
            {(activeEvidenceTab === 'ALL' || activeEvidenceTab === 'LEAD_RETENTION') && (
              <div
                data-testid="evidence-card-lead-retention"
                className="bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 space-y-1.5 text-xs telemetry-nums"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    2. 10m &amp; 20m Lane Leads
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    @10m: {leadRetention.eligibleGamesAt10}G · @20m: {leadRetention.eligibleGamesAt20}G · Missing Opp:{' '}
                    {leadRetention.excludedMissingOpponentGames}G · Short &lt;20m: {leadRetention.excludedShortGamesBefore20}G
                  </span>
                </div>

                <div className="text-[11px] text-slate-700 dark:text-slate-200">
                  <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mr-1.5">
                    Observed
                  </span>
                  Gold @10m: <strong>{formatSignedNumber(leadRetention.avgGoldLeadAt10, 'g', 1)}</strong> ({leadRetention.eligibleGamesAt10}G) · @20m:{' '}
                  <strong>{formatSignedNumber(leadRetention.avgGoldLeadAt20, 'g', 1)}</strong> ({leadRetention.eligibleGamesAt20}G) · Held @20m:{' '}
                  <strong>
                    {leadRetention.goldLeadRetentionRate !== null
                      ? `${formatRatePct(leadRetention.goldLeadRetentionRate)} (${leadRetention.gamesRetainedGoldLeadAt20}/${leadRetention.gamesAheadInGoldAt10Reaching20}G)`
                      : 'Unavailable'}
                  </strong>
                </div>

                <details open={activeEvidenceTab !== 'ALL'} className="group pt-0.5">
                  <summary className="cursor-pointer select-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Inspect evidence ({(leadRetention.perMatch ?? []).length}G lead checkpoints &amp; 10–20m events)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5 leading-snug">
                      <strong className="text-amber-700 dark:text-amber-300">Coach boundary:</strong>{' '}
                      10m and 20m averages use different game counts when matches end before 20:00. Mid-game 10–20m objective/turret events are temporal associations only—never proof of a throw.
                    </p>
                    <div className="sm:overflow-x-auto">
                      <table className="block sm:table w-full text-left border-collapse text-[11px]">
                        <thead className="hidden sm:table-header-group text-[10px] uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-1 pr-2">Match</th>
                            <th className="py-1 px-2">10m Gold / XP Lead</th>
                            <th className="py-1 px-2">20m Gold / XP Lead</th>
                            <th className="py-1 px-2">Retention Outcome</th>
                            <th className="py-1 pl-2">10–20m Team Events</th>
                          </tr>
                        </thead>
                        <tbody className="block sm:table-row-group divide-y divide-slate-200/60 dark:divide-slate-800/70">
                          {(leadRetention.perMatch ?? []).slice(0, 8).map(m => {
                            const retentionBadge =
                              m.goldLeadAt10 === null
                                ? 'No matched 10m checkpoint'
                                : m.goldLeadAt10 > 0 && m.goldLeadAt20 === null
                                ? 'Ahead @10m · Ended <20:00'
                                : m.retainedGoldLeadAt20 === true
                                ? 'Ahead @10m → Held Lead @20m'
                                : m.retainedGoldLeadAt20 === false
                                ? 'Ahead @10m → Lost Lead @20m'
                                : 'Even / Behind @10m';
                            return (
                              <tr
                                key={`lr-${m.matchId}`}
                                data-testid={`evidence-lead-row-${m.matchId}`}
                                className="block sm:table-row py-1.5 sm:py-0"
                              >
                                <td className="block sm:table-cell sm:py-1.5 sm:pr-2 font-bold text-slate-800 dark:text-slate-100">
                                  {m.championName}
                                  {m.opponentChampionName ? ` vs ${m.opponentChampionName}` : ''} (
                                  {formatRoleName(m.role)}){' '}
                                  <span className="text-[10px] font-normal text-slate-400">
                                    {m.matchId}
                                  </span>
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                  {formatSignedNumber(m.goldLeadAt10, 'g', 0)} /{' '}
                                  {formatSignedNumber(m.xpLeadAt10, ' XP', 0)}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                  {formatSignedNumber(m.goldLeadAt20, 'g', 0)} /{' '}
                                  {formatSignedNumber(m.xpLeadAt20, ' XP', 0)}
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:px-2">
                                  <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                    {retentionBadge}
                                  </span>
                                </td>
                                <td className="block sm:table-cell sm:py-1.5 sm:pl-2 text-slate-600 dark:text-slate-300">
                                  {m.temporalEvents10To20 && m.temporalEvents10To20.length > 0
                                    ? m.temporalEvents10To20
                                        .slice(0, 2)
                                        .map(
                                          ev =>
                                            `${ev.minuteMark}:${String(ev.secondMark).padStart(2, '0')} ${formatTemporalEventDescription(ev)}`
                                        )
                                        .join(' · ')
                                    : 'None recorded'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Evidence Card 3: Death Cost (Time Dead & Bounty Conceded) */}
            {(activeEvidenceTab === 'ALL' || activeEvidenceTab === 'DEATH_COST') && (
              <div
                data-testid="evidence-card-death-cost"
                className="bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 space-y-1.5 text-xs telemetry-nums"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    3. Death Cost (Time Dead &amp; Bounty Gold)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    Time Dead: {deathCost.eligibleTimeDeadGames}G · Bounty Timeline:{' '}
                    {bountySummary.eligibleTimelineGames}G · Missing Bounty Deaths:{' '}
                    {bountySummary.deathsMissingBountyData}
                  </span>
                </div>

                <div className="text-[11px] text-slate-700 dark:text-slate-200">
                  <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mr-1.5">
                    Observed
                  </span>
                  Avg Dead: <strong>{formatNumber(deathCost.avgTimeSpentDeadSeconds, 's', 1)}</strong> ({formatNumber(deathCost.avgDeadTimeGameSharePct, '%', 2)}) · Bounty Given:{' '}
                  <strong>
                    {bountySummary.eligibleTimelineGames > 0
                      ? `${formatNumber(bountySummary.totalCombinedBountyGold, 'g', 0)} (Base ${formatNumber(bountySummary.totalBaseKillBountyGold, 'g', 0)} + Shutdown ${formatNumber(bountySummary.totalShutdownBountyGold, 'g', 0)})`
                      : 'Unavailable (Analyze Timeline required)'}
                  </strong>
                </div>

                <details open={activeEvidenceTab !== 'ALL'} className="group pt-0.5">
                  <summary className="cursor-pointer select-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Inspect evidence ({(deathCost.perMatch ?? []).length}G death cost &amp; guardrail)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5 leading-snug">
                      <strong className="text-amber-700 dark:text-amber-300">Coach boundary:</strong>{' '}
                      Reports recorded grey-screen time and direct kill/shutdown reward gold on deaths. Never estimates lost minion waves, indirect map pressure, or whether a death was avoidable.
                    </p>
                    <div className="sm:overflow-x-auto">
                      <table className="block sm:table w-full text-left border-collapse text-[11px]">
                        <thead className="hidden sm:table-header-group text-[10px] uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-1 pr-2">Match</th>
                            <th className="py-1 px-2">Time Dead (Game Share)</th>
                            <th className="py-1 px-2">Recorded Deaths</th>
                            <th className="py-1 px-2">Base + Shutdown Given</th>
                            <th className="py-1 pl-2">Combined Bounty Given</th>
                          </tr>
                        </thead>
                        <tbody className="block sm:table-row-group divide-y divide-slate-200/60 dark:divide-slate-800/70">
                          {(deathCost.perMatch ?? []).slice(0, 8).map(m => (
                            <tr
                              key={`dc-${m.matchId}`}
                              data-testid={`evidence-death-row-${m.matchId}`}
                              className="block sm:table-row py-1.5 sm:py-0"
                            >
                              <td className="block sm:table-cell sm:py-1.5 sm:pr-2 font-bold text-slate-800 dark:text-slate-100">
                                {m.championName} ({formatRoleName(m.role)}){' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  {m.matchId}
                                </span>
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                {m.totalTimeSpentDeadSeconds !== null
                                  ? `${m.totalTimeSpentDeadSeconds}s (${formatNumber(m.deadTimeGameSharePct, '%', 2)})`
                                  : 'Unavailable'}
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                {m.recordedDeathsCount !== null
                                  ? `${m.recordedDeathsCount} recorded`
                                  : 'Timeline required'}
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                {m.totalBaseKillBountyGold !== null || m.totalShutdownBountyGold !== null
                                  ? `${formatNumber(m.totalBaseKillBountyGold, 'g', 0)} + ${formatNumber(m.totalShutdownBountyGold, 'g', 0)}`
                                  : 'Unavailable'}
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:pl-2 font-bold text-slate-800 dark:text-slate-100">
                                {m.totalCombinedBountyGold !== null
                                  ? formatNumber(m.totalCombinedBountyGold, 'g', 0)
                                  : 'Unavailable'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Evidence Card 4: Unspent Gold Checkpoints & Pre-Purchase Samples */}
            {(activeEvidenceTab === 'ALL' || activeEvidenceTab === 'UNSPENT_GOLD') && (
              <div
                data-testid="evidence-card-unspent-gold"
                className="bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 space-y-1.5 text-xs telemetry-nums"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    4. Unspent Gold (1m Checkpoints)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    Eligible: {unspentGold.eligibleGames}G · 1m Checkpoints: {unspentGold.sampleCount} · &ge;
                    {unspentGold.highBalanceThresholdGold}g:{' '}
                    {unspentGold.highBalanceSampleCount ?? 'Unavailable'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-700 dark:text-slate-200">
                  <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mr-1.5">
                    Observed
                  </span>
                  Median: <strong>{formatNumber(unspentGold.medianCurrentGold, 'g', 1)}</strong> · Avg:{' '}
                  <strong>{formatNumber(unspentGold.avgCurrentGold, 'g', 1)}</strong> · Max:{' '}
                  <strong>{formatNumber(unspentGold.maxCurrentGold, 'g', 0)}</strong> · Followed by Purchase:{' '}
                  <strong>{unspentGold.highBalanceBeforePurchaseSampleCount ?? 'Unavailable'}</strong>
                </div>

                <details open={activeEvidenceTab !== 'ALL'} className="group pt-0.5">
                  <summary className="cursor-pointer select-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Inspect evidence ({(unspentGold.highBalanceBeforePurchaseSamples ?? []).length} high-balance samples &amp; guardrail)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5 leading-snug">
                      <strong className="text-amber-700 dark:text-amber-300">Coach boundary:</strong>{' '}
                      Sampled at 1-minute timeline marks—never recall events or continuous time held. Holding {unspentGold.highBalanceThresholdGold}g+ before buying an item is a neutral snapshot, never an automatic mistake score.
                    </p>
                    {(unspentGold.highBalanceBeforePurchaseSamples ?? []).length > 0 && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          &ge;{unspentGold.highBalanceThresholdGold}g Pre-Purchase Samples (
                          {(unspentGold.highBalanceBeforePurchaseSamples ?? []).length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(unspentGold.highBalanceBeforePurchaseSamples ?? []).slice(0, 6).map((s, idx) => {
                            const itemLabel = formatPurchaseItemLabel(s.nextPurchaseItemId, itemMap);
                            return (
                              <span
                                key={`${s.matchId}-${s.sampledMinute}-${idx}`}
                                data-testid={`evidence-unspent-sample-${s.matchId}-${s.sampledMinute}`}
                                className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                              >
                                {s.championName} ({s.matchId}) @{s.sampledMinute}m:{' '}
                                <strong>{s.currentGoldAtSample}g</strong>
                                {itemLabel && s.nextPurchaseMinute !== null
                                  ? ` → bought ${itemLabel} @${s.nextPurchaseMinute}m`
                                  : ' (no purchase within 2m)'}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Evidence Card 5: Team Objectives vs Personal Participation */}
            {(activeEvidenceTab === 'ALL' || activeEvidenceTab === 'TEAM_OBJECTIVES') && (
              <div
                data-testid="evidence-card-team-objectives"
                className="bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md p-2.5 space-y-1.5 text-xs telemetry-nums"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    5. Objectives (Team vs Personal)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    Team Eligible: {teamObjectives.eligibleTeamObjectiveGames}G · Missing Team Data:{' '}
                    {teamObjectives.excludedMissingTeamsDataGames}G
                  </span>
                </div>

                <div className="text-[11px] text-slate-700 dark:text-slate-200">
                  <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mr-1.5">
                    Observed
                  </span>
                  Towers: Team {formatNumber(teamObjectives.tower.teamAvgKills, '/g', 2)} vs Enemy{' '}
                  {formatNumber(teamObjectives.tower.enemyTeamAvgKills, '/g', 2)} · Dragons: Team{' '}
                  {formatNumber(teamObjectives.dragon.teamAvgKills, '/g', 2)} vs Enemy{' '}
                  {formatNumber(teamObjectives.dragon.enemyTeamAvgKills, '/g', 2)} · Baron: Team{' '}
                  {formatNumber(teamObjectives.baron.teamAvgKills, '/g', 2)} vs Enemy{' '}
                  {formatNumber(teamObjectives.baron.enemyTeamAvgKills, '/g', 2)}
                </div>

                <details open={activeEvidenceTab !== 'ALL'} className="group pt-0.5">
                  <summary className="cursor-pointer select-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Inspect evidence ({(teamObjectives.perMatch ?? []).length}G objectives &amp; guardrail)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-1.5 leading-snug">
                      <strong className="text-amber-700 dark:text-amber-300">Coach boundary:</strong>{' '}
                      Team objective totals and first-objective rates are 5v5 team outcomes and are kept strictly separate from personal last-hits and takedowns. Missing fields remain Unavailable rather than 0.
                    </p>
                    <div className="sm:overflow-x-auto">
                      <table className="block sm:table w-full text-left border-collapse text-[11px]">
                        <thead className="hidden sm:table-header-group text-[10px] uppercase text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-1 pr-2">Match</th>
                            <th className="py-1 px-2">Towers (Team:Enemy · Personal TD)</th>
                            <th className="py-1 px-2">Dragons (Team:Enemy · Personal TD)</th>
                            <th className="py-1 px-2">Grubs / Herald (Team:Enemy)</th>
                            <th className="py-1 pl-2">Baron (Team:Enemy · Personal LH)</th>
                          </tr>
                        </thead>
                        <tbody className="block sm:table-row-group divide-y divide-slate-200/60 dark:divide-slate-800/70">
                          {(teamObjectives.perMatch ?? []).slice(0, 8).map(m => (
                            <tr
                              key={`to-${m.matchId}`}
                              data-testid={`evidence-objective-row-${m.matchId}`}
                              className="block sm:table-row py-1.5 sm:py-0"
                            >
                              <td className="block sm:table-cell sm:py-1.5 sm:pr-2 font-bold text-slate-800 dark:text-slate-100">
                                {m.championName} ({formatRoleName(m.role)}){' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  {m.matchId}
                                </span>
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                {m.allyObjectives?.tower?.kills ?? '—'}:{m.enemyObjectives?.tower?.kills ?? '—'} (TD:{' '}
                                {m.personalTurretTakedowns ?? 'Unavailable'})
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                {m.allyObjectives?.dragon?.kills ?? '—'}:{m.enemyObjectives?.dragon?.kills ?? '—'} (TD:{' '}
                                {m.personalDragonTakedowns ?? 'Unavailable'})
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:px-2 text-slate-700 dark:text-slate-200">
                                Grubs {m.allyObjectives?.horde?.kills ?? '—'}:{m.enemyObjectives?.horde?.kills ?? '—'} · Herald{' '}
                                {m.allyObjectives?.riftHerald?.kills ?? '—'}:{m.enemyObjectives?.riftHerald?.kills ?? '—'}
                              </td>
                              <td className="block sm:table-cell sm:py-1.5 sm:pl-2 text-slate-700 dark:text-slate-200">
                                {m.allyObjectives?.baron?.kills ?? '—'}:{m.enemyObjectives?.baron?.kills ?? '—'} (LH:{' '}
                                {m.personalBaronKills ?? 'Unavailable'})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Details Section (Full Numbers & Plain-English Explanations) */}
      <details data-testid="improvement-stats-details" className="mt-3 group">
        <summary
          data-testid="improvement-stats-details-toggle"
          className="cursor-pointer select-none list-none inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 transition-colors"
        >
          <span className="inline-block transition-transform group-open:rotate-90 text-[10px]">
            &#9654;
          </span>
          <span>Details (Full Numbers &amp; Explanations)</span>
        </summary>

        {/* 5 Full Metric Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-3">
          {/* 1. Phase Farming (10-20m & 20m-end) */}
          <div
            data-testid="card-phase-farming"
            className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  1. Mid &amp; Late Phase Farming (Lane vs Jungle CS/m)
                </h4>
                <button
                  type="button"
                  onClick={() => openSpecificEvidenceCard('PHASE_FARMING')}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Inspect Evidence →
                </button>
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
              Measured from 10-minute and 20-minute timeline checkpoints using separate lane minion and jungle camp counts. Games ending before a checkpoint are excluded rather than extrapolated, and missed last-hits are never guessed.
            </p>
          </div>

          {/* 2. Lead Retention (10m -> 20m Gold/XP vs Role Opponent) */}
          <div
            data-testid="card-lead-retention"
            className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  2. 10m &amp; 20m Lane Leads &amp; Retention
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
                    @10m: {leadRetention.eligibleGamesAt10}G · @20m: {leadRetention.eligibleGamesAt20}G (unmatched)
                  </span>
                  <button
                    type="button"
                    onClick={() => openSpecificEvidenceCard('LEAD_RETENTION')}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Inspect Evidence →
                  </button>
                </div>
              </div>

              {!sliceHasTimelineData && leadRetention.eligibleGamesAt10 === 0 ? (
                <div className="py-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
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
                        <span className="text-slate-500 dark:text-slate-400">
                          Avg Lead @10m ({leadRetention.eligibleGamesAt10}G):
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {formatSignedNumber(leadRetention.avgGoldLeadAt10, 'g', 1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Avg Lead @20m ({leadRetention.eligibleGamesAt20}G):
                        </span>
                        <span
                          className={`font-bold ${
                            leadRetention.avgGoldLeadAt20 === null
                              ? 'text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {formatSignedNumber(leadRetention.avgGoldLeadAt20, 'g', 1)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">Retained @20m:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">
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
                        <span className="text-slate-500 dark:text-slate-400">
                          Avg Lead @10m ({leadRetention.eligibleGamesAt10}G):
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {formatSignedNumber(leadRetention.avgXpLeadAt10, ' XP', 1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Avg Lead @20m ({leadRetention.eligibleGamesAt20}G):
                        </span>
                        <span
                          className={`font-bold ${
                            leadRetention.avgXpLeadAt20 === null
                              ? 'text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {formatSignedNumber(leadRetention.avgXpLeadAt20, ' XP', 1)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">Retained @20m:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">
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
              Compares your gold and XP against your matched role opponent at 10:00 and 20:00. The 10m and 20m averages are unmatched when games end between 10:00 and 20:00; retention rates count only games where you were ahead at 10:00 and the match reached 20:00. Mid-game objective and turret events are shown for timing context only, not personal credit or proof of a throw.
            </p>
          </div>

          {/* 3. Death Cost (Recorded Time Dead & Shutdown/Bounty Gold) */}
          <div
            data-testid="card-death-cost"
            className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  3. Death Cost (Time Dead &amp; Bounty Gold)
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
                    Time Dead: {deathCost.eligibleTimeDeadGames}G · Bounty: {bountySummary.eligibleTimelineGames}G
                  </span>
                  <button
                    type="button"
                    onClick={() => openSpecificEvidenceCard('DEATH_COST')}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Inspect Evidence →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs telemetry-nums">
                {/* Match-level Time Spent Dead */}
                <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                    Match Time Spent Dead ({deathCost.eligibleTimeDeadGames}G)
                  </div>
                  {deathCost.eligibleTimeDeadGames === 0 ? (
                    <div className="py-1 text-slate-500 dark:text-slate-400">
                      Unavailable ({deathCost.excludedMissingTimeSpentDeadGames}G missing time-dead data)
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Avg Dead / Game:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">
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
                    <div className="py-2 text-slate-600 dark:text-slate-300 font-medium">
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
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">
                          {formatNumber(bountySummary.totalCombinedBountyGold, 'g', 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
              Time spent dead comes from match summaries; gold given on deaths comes from timeline kill events (base kill reward plus any streak shutdown bonus, combined without double-counting). Unknown values remain Unavailable rather than 0, and lost farm or death avoidability is never inferred.
            </p>
          </div>

          {/* 4. Unspent Gold (1-Minute Timeline Snapshots) */}
          <div
            data-testid="card-unspent-gold"
            className="bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  4. Sampled Unspent Gold (1m Timeline Snapshots)
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
                    {unspentGold.eligibleGames}G · {unspentGold.sampleCount} snapshots
                  </span>
                  <button
                    type="button"
                    onClick={() => openSpecificEvidenceCard('UNSPENT_GOLD')}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Inspect Evidence →
                  </button>
                </div>
              </div>

              {!sliceHasTimelineData && unspentGold.eligibleGames === 0 ? (
                <div className="py-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
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
                      <div className="font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                        {formatNumber(unspentGold.maxCurrentGold, 'g', 0)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-md p-2.5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Snapshots &ge; {unspentGold.highBalanceThresholdGold}g (neutral):
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
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
              Sampled from 1-minute gold-in-hand checkpoints on the match timeline (not continuous time held). Holding 1,300g+ at a minute mark or before a purchase is a descriptive snapshot (for example, saving for a costly component or staying on the map for an objective), not a mistake score.
            </p>
          </div>

          {/* 5. Team Objectives vs Personal Takedowns (Full Width) */}
          <div
            data-testid="card-team-objectives"
            className="lg:col-span-2 bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                5. Team Objectives vs Personal Last-Hits / Takedowns
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 telemetry-nums">
                  Team Data: {teamObjectives.eligibleTeamObjectiveGames}G eligible
                  {teamObjectives.excludedMissingTeamsDataGames > 0 &&
                    ` · ${teamObjectives.excludedMissingTeamsDataGames}G missing team objective data`}
                </span>
                <button
                  type="button"
                  onClick={() => openSpecificEvidenceCard('TEAM_OBJECTIVES')}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Inspect Evidence →
                </button>
              </div>
            </div>

            <div className="sm:overflow-x-auto">
              <table className="block sm:table w-full text-left border-collapse">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="pb-1.5 pr-2">Objective</th>
                    <th className="pb-1.5 px-2 text-center">Team First Rate</th>
                    <th className="pb-1.5 px-2 text-center">Team vs Enemy Avg (Total)</th>
                    <th className="pb-1.5 pl-2 text-right">Personal LH / Takedowns (TD)</th>
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group">
                  {OBJECTIVES_META.map(meta =>
                    renderObjectiveRow(meta, teamObjectives[meta.key])
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
              Team objective outcomes (first-objective rates and team totals) are reported separately from your personal last-hits and takedowns. Missing values remain Unavailable and are excluded from averages rather than counted as 0.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
};

export default ImprovementStatsSection;
