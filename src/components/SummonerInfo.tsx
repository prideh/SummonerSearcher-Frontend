import React, { useState } from 'react';
import type { SummonerData } from '../types/summoner';
import type { MatchDto } from '../types/match';
import RankedInfo from './RankedInfo';
import { useTimeAgo } from '../hooks/useTimeAgo';
import { useDataDragonStore } from '../store/dataDragonStore';
import AiAnalysisModal from './AiAnalysisModal';
import { getLiveGame } from '../api/riot';
import LiveGameDisplay, { type CurrentGameInfo } from './LiveGameDisplay';
import { buildAiContext } from '../utils/aiContextBuilder';
import { analyzeTimelines } from '../api/timeline';
import TimelineAnalysisModal from './TimelineAnalysisModal';
import type { TimelineAnalysisDto } from '../types/timeline';

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
}

/**
 * Displays the main profile card for a searched summoner.
 * It includes their profile icon, Riot ID, level, and a "Refresh" button.
 * It also contains the `RankedInfo` component to show ranked statistics.
 */
const SummonerInfo: React.FC<SummonerInfoProps> = ({ summonerData, handleRefresh, loading, refreshing, visibleMatches, onPlayerClick, onViewProfile, showFullProfile }) => {
  const [timeAgo, ref] = useTimeAgo(new Date(summonerData.lastUpdated).getTime());
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
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

  // Build comprehensive AI context from all loaded matches.
  // If timeline has been analyzed, merge its aggregate summary under 'timelineInsights'
  // so the backend's buildTimelineInsightsSection() can inject it into the AI prompt.
  const baseAiContext = buildAiContext(
    summonerData.gameName,
    summonerData.tagLine,
    visibleMatches,
    summonerData.puuid,
    summonerData.soloQueueRank,
    summonerData.championStats,
    summonerData.overallStats
  );
  const aiContext = timelineAnalysis
    ? { ...baseAiContext, timelineInsights: timelineAnalysis.aggregateSummary }
    : baseAiContext;

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
    } catch {
      // Silently fail — could add a toast notification here
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleAiCoachFromTimeline = (suggestion?: string) => {
    setAiInitialMessage(suggestion);
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
    <div ref={ref} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 rounded-lg shadow-xs">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
          <div className="relative shrink-0">
            <img
              src={`${CDN_URL}/img/profileicon/${summonerData.profileIconId}.png`}
              alt={`${summonerData.gameName}'s Profile Icon`}
              className="w-20 h-20 rounded-xl border-2 border-sky-500 dark:border-cyan-400 shadow-xs"
            />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-800 dark:text-cyan-300 border border-slate-700 text-[10px] font-extrabold whitespace-nowrap telemetry-nums shadow-xs">
              Level {summonerData.summonerLevel}
            </span>
          </div>
          <div className="pt-1 sm:pt-0">
            <div className="flex flex-wrap items-baseline justify-center sm:justify-start gap-1.5">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {summonerData.gameName} <span className="text-slate-400 dark:text-slate-500 font-bold text-lg">#{summonerData.tagLine}</span>
              </h2>
              {summonerData.region && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded bg-sky-50 dark:bg-cyan-950/60 text-sky-700 dark:text-cyan-300 border border-sky-200 dark:border-cyan-800/60">
                  {summonerData.region.replace(/[0-9]/g, '').toUpperCase()}
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
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3.5 py-2 rounded-md transition-colors"
              >
                  View Full Seasonal Profile
              </button>
            )}
            <button
              onClick={handleLiveGameClick}
              disabled={loadingLiveGame}
              className={`flex items-center space-x-1.5 ${showLiveGame ? 'bg-rose-600 hover:bg-rose-500 border-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'} border font-bold py-2 px-3.5 text-xs rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed`}
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
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white font-bold py-2 px-3.5 text-xs rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
              className="flex items-center space-x-1.5 bg-purple-600 hover:bg-purple-500 border border-purple-500 text-white font-bold py-2 px-3.5 text-xs rounded-md transition-colors"
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
              className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-extrabold py-2 px-3.5 text-xs rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
  );
};

export default SummonerInfo;
