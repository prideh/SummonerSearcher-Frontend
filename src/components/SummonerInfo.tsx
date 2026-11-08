import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import type { SummonerData } from '../types/summoner';
import type { MatchDto } from '../types/match';
import RankedInfo from './RankedInfo';
import { useTimeAgo } from '../hooks/useTimeAgo';
import { useDataDragonStore } from '../store/dataDragonStore';
import { useAuthStore, isSameStarredProfile } from '../store/authStore';
import AiAnalysisModal, {
  generatePersonalizedSuggestions,
  parseAiResponseWithSuggestions,
} from './AiAnalysisModal';
import { chatWithAi } from '../api/ai';
import { getLiveGame } from '../api/riot';
import LiveGameDisplay, { type CurrentGameInfo } from './LiveGameDisplay';
import { buildAiContext } from '../utils/aiContextBuilder';
import { analyzeTimelines } from '../api/timeline';
import TimelineAnalysisModal from './TimelineAnalysisModal';
import type { TimelineAnalysisDto } from '../types/timeline';
import { resolveImprovementStats } from '../utils/improvementStatsHelper';
import { getCorrectChampionName } from '../utils/championNameHelper';

const SUMMARY_PROMPT =
  'Give me a concise 2-3 sentence executive summary of my recent performance, key strength, and #1 focus area.';
const CHAT_EXPIRATION_TIME = 30 * 60 * 1000;

const buildFallbackAiSummary = (summoner: SummonerData, sigChamp: string | null): string => {
  const rank = summoner.soloQueueRank
    ? `${summoner.soloQueueRank.tier} ${summoner.soloQueueRank.rank} (${summoner.soloQueueRank.leaguePoints} LP)`
    : 'Unranked';
  const winRate =
    summoner.overallStats?.winRate !== undefined
      ? `${Math.round(summoner.overallStats.winRate)}% WR`
      : summoner.soloQueueRank
      ? `${Math.round(
          (summoner.soloQueueRank.wins /
            Math.max(1, summoner.soloQueueRank.wins + summoner.soloQueueRank.losses)) *
            100
        )}% WR`
      : null;
  const kda =
    summoner.overallStats?.kda !== undefined
      ? `${summoner.overallStats.kda.toFixed(2)} KDA`
      : null;
  const statsBits = [rank, winRate, kda].filter(Boolean).join(' • ');
  const champBit = sigChamp ? ` with **${sigChamp}** as your signature pick` : '';
  return `**${summoner.gameName}#${summoner.tagLine}** is currently sitting at **${statsBits}**${champBit}. Click to continue this conversation in AI Coach for a full breakdown of your laning, macro, and #1 climb priority.`;
};

/**
 * Props for the SummonerInfo component.
 */
interface SummonerInfoProps {
  /** The data object for the searched summoner. */
  summonerData: SummonerData;
  /** Callback function to handle the refresh action. */
  handleRefresh: () => void;
  /** Boolean indicating if a refresh is currently in progress. */
  loading: boolean;
  /** Boolean indicating if a refresh operation is in progress (keeps data visible). */
  refreshing: boolean;
  /** The subset of matches currently visible in the match history. */
  visibleMatches: MatchDto[];
  /** Callback function to handle clicks on player names. */
  onPlayerClick: (name: string, tag: string) => void;
  /** Callback to open the full seasonal profile. */
  onViewProfile: () => void;
  /** Boolean indicating if the full profile is currently shown. */
  showFullProfile: boolean;
  /** Optional explicit override indicating whether this profile is starred. */
  isStarred?: boolean;
  /** Optional callback when toggling the star state. */
  onToggleStar?: () => void;
}

/**
 * Displays the main profile card for a searched summoner.
 * It includes their profile icon, Riot ID, level, and a "Refresh" button.
 * It also contains the `RankedInfo` component to show ranked statistics.
 */
const SummonerInfo: React.FC<SummonerInfoProps> = ({ summonerData, handleRefresh, loading, refreshing, visibleMatches, onPlayerClick, onViewProfile, showFullProfile, isStarred: isStarredProp, onToggleStar }) => {
  const [timeAgo, ref] = useTimeAgo(new Date(summonerData.lastUpdated).getTime());
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const starredProfile = useAuthStore(state => state?.starredProfile ?? null);
  const toggleStarredProfile = useAuthStore(state => state?.toggleStarredProfile);
  const isStarred = isStarredProp !== undefined
    ? isStarredProp
    : isSameStarredProfile(starredProfile, summonerData);

  const handleStarClick = () => {
    if (onToggleStar) {
      onToggleStar();
      return;
    }
    if (toggleStarredProfile) {
      const nowStarred = toggleStarredProfile({
        puuid: summonerData.puuid,
        gameName: summonerData.gameName,
        tagLine: summonerData.tagLine,
        region: summonerData.region,
        profileIconId: summonerData.profileIconId,
        summonerLevel: summonerData.summonerLevel,
      });
      if (nowStarred) {
        toast.success(`Starred ${summonerData.gameName}#${summonerData.tagLine} as your landing page profile`);
      } else {
        toast.info(`Removed ${summonerData.gameName}#${summonerData.tagLine} as landing page profile`);
      }
    }
  };
  const [showAiModal, setShowAiModal] = useState(false);
  const [liveGameData, setLiveGameData] = useState<CurrentGameInfo | null>(null);
  const [loadingLiveGame, setLoadingLiveGame] = useState(false);
  const [showLiveGame, setShowLiveGame] = useState(false);
  const [liveGameError, setLiveGameError] = useState<string | null>(null);

  // Timeline analysis state — must be declared before buildAiContext so it can be merged in
  const [timelineAnalysis, setTimelineAnalysis] = useState<TimelineAnalysisDto | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);

  // AI Summary state for starred profile
  const [aiSummaryText, setAiSummaryText] = useState<string | null>(null);
  const [aiSummarySuggestions, setAiSummarySuggestions] = useState<string[]>([]);
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);

  // Resolve signature champion for ambient splash header
  const signatureChampion = useMemo(() => {
    if (summonerData.championStats && summonerData.championStats.length > 0) {
      return summonerData.championStats[0].championName;
    }
    const counts: Record<string, number> = {};
    for (const m of visibleMatches || []) {
      const p = m.info?.participants?.find(part => part.puuid === summonerData.puuid);
      if (p?.championName) {
        counts[p.championName] = (counts[p.championName] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  }, [summonerData.championStats, summonerData.puuid, visibleMatches]);

  const resolvedImprovement = useMemo(
    () =>
      resolveImprovementStats(
        summonerData.improvementStats,
        timelineAnalysis,
        visibleMatches,
        summonerData.puuid
      ),
    [summonerData.improvementStats, timelineAnalysis, visibleMatches, summonerData.puuid]
  );

  // Build comprehensive AI context from all loaded matches.
  // If timeline has been analyzed by the user, buildAiContext merges its aggregate summary
  // and per-match timeline diffs, death context, item spikes, skill max order, and 5-stat improvement evidence.
  const aiContext = buildAiContext(
    summonerData.gameName,
    summonerData.tagLine,
    visibleMatches,
    summonerData.puuid,
    summonerData.soloQueueRank,
    summonerData.championStats,
    summonerData.overallStats,
    timelineAnalysis,
    resolvedImprovement.stats
  );

  const summonerFullName = `${summonerData.gameName}#${summonerData.tagLine}`;
  const chatStorageKey = `chat_history_${summonerFullName}`;

  // Generate or load the AI Coach Summary for the starred profile and keep its chat history synced
  useEffect(() => {
    if (!isStarred) {
      setAiSummaryText(null);
      setAiSummarySuggestions([]);
      setLoadingAiSummary(false);
      return;
    }

    // Check if localStorage already has a recent AI summary or conversation for this summoner
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age < CHAT_EXPIRATION_TIME && Array.isArray(parsed.messages)) {
          const substantiveModelMsgs = parsed.messages.filter(
            (m: { role?: string; content?: string }) =>
              m.role === 'model' &&
              typeof m.content === 'string' &&
              !m.content.startsWith("Hi! I'm your AI Coach.")
          );
          if (substantiveModelMsgs.length > 0) {
            setAiSummaryText(substantiveModelMsgs[substantiveModelMsgs.length - 1].content);
            setAiSummarySuggestions(
              Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
                ? parsed.suggestions
                : generatePersonalizedSuggestions(aiContext)
            );
            setLoadingAiSummary(false);
            return;
          }
        }
      }
    } catch {
      // Ignore storage parse errors
    }

    let cancelled = false;
    const matchCount = aiContext.totalGamesAnalyzed || 0;
    const impCtx = aiContext.improvementStats as { hasTimelineAnalysis?: boolean } | undefined;
    const timelineReady = aiContext.timelineStatus === 'ANALYZED' || Boolean(impCtx?.hasTimelineAnalysis);
    const greetingMsg = {
      role: 'model' as const,
      content: timelineReady
        ? `Hi! I'm your AI Coach. Match summaries and 10m/20m timeline checkpoints from ${matchCount} recent games are ready. Ask a question below to generate coaching feedback!`
        : `Hi! I'm your AI Coach. Match summaries from ${matchCount} recent games are loaded (deep timeline analysis not run yet). Ask a question below to generate coaching feedback!`,
    };
    const defaultSuggestions = generatePersonalizedSuggestions(aiContext);

    const fetchSummary = async () => {
      setLoadingAiSummary(true);
      try {
        const apiResponse = await chatWithAi(
          aiContext,
          [greetingMsg],
          SUMMARY_PROMPT,
          `summary_${summonerData.puuid || summonerFullName}`
        );
        if (cancelled) return;

        if (apiResponse && typeof apiResponse.response === 'string' && apiResponse.response.trim()) {
          const { cleanResponse, suggestions: nextSuggestions } = parseAiResponseWithSuggestions(
            apiResponse.response,
            defaultSuggestions
          );
          const seededMessages = [
            greetingMsg,
            { role: 'user' as const, content: SUMMARY_PROMPT },
            {
              role: 'model' as const,
              content: cleanResponse,
              interactionId: apiResponse.interactionId,
              timestamp: Date.now(),
            },
          ];
          localStorage.setItem(
            chatStorageKey,
            JSON.stringify({
              timestamp: Date.now(),
              messages: seededMessages,
              suggestions: nextSuggestions,
            })
          );
          setAiSummaryText(cleanResponse);
          setAiSummarySuggestions(nextSuggestions);
          return;
        }
      } catch {
        // Fall through to deterministic telemetry summary if AI endpoint is unreachable
      }

      if (cancelled) return;
      const fallback = buildFallbackAiSummary(summonerData, signatureChampion);
      const seededMessages = [
        greetingMsg,
        { role: 'user' as const, content: SUMMARY_PROMPT },
        {
          role: 'model' as const,
          content: fallback,
          timestamp: Date.now(),
        },
      ];
      localStorage.setItem(
        chatStorageKey,
        JSON.stringify({
          timestamp: Date.now(),
          messages: seededMessages,
          suggestions: defaultSuggestions,
        })
      );
      setAiSummaryText(fallback);
      setAiSummarySuggestions(defaultSuggestions);
    };

    fetchSummary().finally(() => {
      if (!cancelled) {
        setLoadingAiSummary(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarred, chatStorageKey, showAiModal]);

  const handleAnalyzeTimeline = async () => {
    if (timelineAnalysis) {
      setShowTimelineModal(true);
      return;
    }
    setLoadingTimeline(true);
    try {
      const data = await analyzeTimelines(summonerData.region, summonerData.puuid);
      setTimelineAnalysis(data);
      setShowTimelineModal(true);
      toast.success('Timeline telemetry frames analyzed');
    } catch {
      toast.error('Could not load timeline analysis right now');
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleAiCoachFromTimeline = (suggestion?: string) => {
    setAiInitialMessage(suggestion);
    setShowAiModal(true);
  };

  const handleContinueSummaryInCoach = () => {
    setAiInitialMessage(undefined);
    setShowAiModal(true);
  };

  const handleLiveGameClick = async () => {
    if (showLiveGame) {
      setShowLiveGame(false);
      return;
    }

    setLoadingLiveGame(true);
    setLiveGameError(null);
    try {
      const data = await getLiveGame(summonerData.region, summonerData.puuid);
      if (data) {
        setLiveGameData(data);
        setShowLiveGame(true);
        toast.success('Live game telemetry connected');
      } else {
        setLiveGameError('Summoner is not currently in a SoloQ game or is hiding their activity.');
      }
    } catch {
      setLiveGameError('Failed to fetch live game data.');
    } finally {
      setLoadingLiveGame(false);
    }
  };

  return (
    <div ref={ref} className="relative overflow-hidden bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
      {/* Top Telemetry Accent Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-sky-500 via-cyan-400 to-transparent" />

      {/* Ambient Champion Splash Art Backdrop */}
      {signatureChampion && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden">
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${getCorrectChampionName(signatureChampion)}_0.jpg`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="ml-auto h-full w-full md:w-3/5 object-cover object-top opacity-20 dark:opacity-25 splash-mask"
          />
        </div>
      )}

      <div className="relative z-10 p-5">
        {isStarred && (
          <div
            data-testid="starred-ai-summary-card"
            role="button"
            tabIndex={0}
            onClick={handleContinueSummaryInCoach}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleContinueSummaryInCoach();
              }
            }}
            className="mb-4 group cursor-pointer rounded-xl border border-sky-200/80 dark:border-cyan-500/30 bg-gradient-to-r from-sky-50/90 via-cyan-50/60 to-white dark:from-cyan-950/40 dark:via-slate-900/90 dark:to-[#0d1322] p-4 shadow-xs hover:border-sky-400 dark:hover:border-cyan-400/60 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-sky-600/10 dark:bg-cyan-500/15 border border-sky-500/20 dark:border-cyan-400/30 text-sky-600 dark:text-cyan-300">
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-cyan-300">
                  AI Coach Summary
                </span>
              </div>
              <span className="text-xs font-bold text-sky-600 dark:text-cyan-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                Continue in AI Coach &rarr;
              </span>
            </div>

            {loadingAiSummary && !aiSummaryText ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 animate-pulse py-1">
                Generating your personalized AI Coach summary...
              </div>
            ) : (
              <div
                data-testid="starred-ai-summary-content"
                className="prose dark:prose-invert prose-sm max-w-none text-slate-700 dark:text-slate-200 prose-p:my-1 prose-strong:text-sky-700 dark:prose-strong:text-cyan-300"
              >
                <ReactMarkdown>{aiSummaryText || ''}</ReactMarkdown>
              </div>
            )}

            {aiSummarySuggestions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {aiSummarySuggestions.slice(0, 3).map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAiCoachFromTimeline(suggestion);
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-white/80 dark:bg-slate-800/90 border border-sky-300/70 dark:border-cyan-500/30 text-sky-700 dark:text-cyan-300 hover:bg-sky-600 hover:text-white dark:hover:bg-cyan-400 dark:hover:text-slate-950 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
            <div className="relative shrink-0">
              <img
                src={`${CDN_URL}/img/profileicon/${summonerData.profileIconId}.png`}
                alt={`${summonerData.gameName}'s Profile Icon`}
                className="w-20 h-20 rounded-xl border-2 border-sky-500 dark:border-cyan-400 shadow-md"
              />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-900 dark:text-cyan-300 border border-slate-700 text-[10px] font-extrabold whitespace-nowrap telemetry-nums shadow-xs">
                Level {summonerData.summonerLevel}
              </span>
            </div>
            <div className="pt-1 sm:pt-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {summonerData.gameName} <span className="text-slate-400 dark:text-slate-500 font-bold text-lg telemetry-nums">#{summonerData.tagLine}</span>
                </h2>
                {summonerData.region && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded bg-sky-50 dark:bg-cyan-950/70 text-sky-700 dark:text-cyan-300 border border-sky-200 dark:border-cyan-800/60 telemetry-nums">
                    {summonerData.region.replace(/[0-9]/g, '').toUpperCase()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleStarClick}
                  data-testid="star-profile-button"
                  aria-pressed={isStarred}
                  aria-label={isStarred ? `Remove ${summonerData.gameName}#${summonerData.tagLine} as landing page profile` : `Star ${summonerData.gameName}#${summonerData.tagLine} as landing page profile`}
                  title={isStarred ? 'Starred as your landing page profile (click to remove)' : 'Star this profile to load it immediately on the landing page'}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded border transition-colors ${
                    isStarred
                      ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-500/25'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-300'
                  }`}
                >
                  <svg
                    className={`w-3.5 h-3.5 ${isStarred ? 'text-amber-500 dark:text-amber-400 fill-current' : 'text-slate-400 dark:text-slate-400'}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={isStarred ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                  <span>{isStarred ? 'Starred' : 'Star'}</span>
                </button>
                {signatureChampion && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 telemetry-nums">
                    Signature: {signatureChampion}
                  </span>
                )}
              </div>
              {summonerData.lastUpdated && (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 telemetry-nums">
                  Last updated: {timeAgo}
                </p>
              )}
            </div>
          </div>

          {!loading && (
            <div className="shrink-0 flex flex-wrap justify-center lg:justify-end gap-2">
              {!showFullProfile && (
                <button
                    onClick={onViewProfile}
                    className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3.5 py-2 rounded-lg transition-colors"
                >
                    View Full Seasonal Profile
                </button>
              )}
              <button
                onClick={handleLiveGameClick}
                disabled={loadingLiveGame}
                className={`flex items-center space-x-1.5 ${showLiveGame ? 'bg-rose-600 hover:bg-rose-500 border-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'} border font-bold py-2 px-3.5 text-xs rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                 {loadingLiveGame ? (
                    <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                 ) : (
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                 )}
                <span>{showLiveGame ? 'Close Live' : 'Live Game'}</span>
              </button>
              <button
                onClick={handleAnalyzeTimeline}
                disabled={loadingTimeline}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 dark:border-cyan-500/30 text-white dark:text-cyan-300 font-bold py-2 px-3.5 text-xs rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingTimeline ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                )}
                <span>{loadingTimeline ? 'Analyzing...' : 'Analyze Timeline'}</span>
              </button>
              <button
                onClick={() => setShowAiModal(true)}
                className="flex items-center space-x-1.5 bg-sky-700 hover:bg-sky-600 dark:bg-cyan-950/80 dark:hover:bg-cyan-900/80 border border-sky-600 dark:border-cyan-500/40 text-white dark:text-cyan-300 font-bold py-2 px-3.5 text-xs rounded-lg transition-colors"
              >
                <svg 
                  className="w-4 h-4" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                <span>AI Coach</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-extrabold py-2 px-3.5 text-xs rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-xs"
              >
                <svg 
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-4.991-2.691V5.25a8.25 8.25 0 0 0-11.667 0v3.183" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          )}
        </div>
        
        {liveGameError && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-md text-xs font-medium">
            {liveGameError}
          </div>
        )}

        {showLiveGame && liveGameData && (
          <LiveGameDisplay gameData={liveGameData} onPlayerClick={onPlayerClick} />
        )}

        {summonerData.soloQueueRank ? (
          <RankedInfo 
            rankedData={summonerData.soloQueueRank} 
            summonerData={summonerData} 
            matches={visibleMatches} 
          />
        ) : (
          <p className="text-center text-slate-500 dark:text-slate-400 mt-4 text-sm">No ranked data available for this summoner.</p>
        )}

        <AiAnalysisModal 
          isOpen={showAiModal}
          onClose={() => { setShowAiModal(false); setAiInitialMessage(undefined); }}
          summonerName={`${summonerData.gameName}#${summonerData.tagLine}`}
          context={aiContext}
          initialMessage={aiInitialMessage}
          improvementStats={resolvedImprovement.stats}
          hasTimelineAnalysis={resolvedImprovement.hasTimelineAnalysis}
          onAnalyzeTimeline={handleAnalyzeTimeline}
          loadingTimeline={loadingTimeline}
          matches={visibleMatches}
          puuid={summonerData.puuid}
        />
        {timelineAnalysis && (
          <TimelineAnalysisModal
            isOpen={showTimelineModal}
            onClose={() => setShowTimelineModal(false)}
            analysis={timelineAnalysis}
            summonerName={`${summonerData.gameName}#${summonerData.tagLine}`}
            onOpenAiCoach={handleAiCoachFromTimeline}
          />
        )}
      </div>
    </div>
  );
};

export default SummonerInfo;

