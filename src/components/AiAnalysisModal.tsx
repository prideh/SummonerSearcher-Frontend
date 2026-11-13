import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { chatWithAi, submitFeedback } from '../api/ai';
import ImprovementStatsSection from './ImprovementStatsSection';
import type { ImprovementStatsDto } from '../types/improvementStats';
import type { MatchDto } from '../types/match';
import type { CoachTimelineCoverageContext } from '../types/timeline';
import {
  buildCoachGreetingMessage,
  generatePersonalizedSuggestions,
  parseAiResponseWithSuggestions,
} from '../utils/aiContextBuilder';

export interface AiContextData {
  summonerName: string;
  primaryRole: string;
  totalGamesAnalyzed: number;
  [key: string]: string | number | unknown;
}

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  summonerName: string;
  context: AiContextData;
  /** If provided, automatically sends this message when the modal first opens. */
  initialMessage?: string;
  improvementStats?: ImprovementStatsDto;
  hasTimelineAnalysis?: boolean;
  onAnalyzeTimeline?: () => void;
  loadingTimeline?: boolean;
  matches?: MatchDto[];
  puuid?: string;
  /**
   * Optional async resolver invoked right before sending a chat prompt so in-flight
   * timeline preparation can finish finitely and supply fresh context (or null if cancelled).
   */
  onResolveChatContext?: () => Promise<AiContextData | null>;
}

interface Message {
  role: 'user' | 'model';
  content: string;
  interactionId?: string; // Track backend interaction ID
  feedback?: 'positive' | 'negative'; // User's feedback
  timestamp?: number; // When message was shown
}

const isSubstantiveHistory = (msgs: unknown): msgs is Message[] =>
  Array.isArray(msgs) &&
  msgs.some((m) => {
    if (!m || typeof m !== 'object') return false;
    const candidate = m as { role?: unknown; content?: unknown; interactionId?: unknown };
    if (candidate.role !== 'model') return false;
    if (candidate.interactionId) return true;
    return (
      typeof candidate.content === 'string' &&
      !candidate.content.startsWith("Hi! I'm your AI Coach.")
    );
  });

const EMPTY_MESSAGES: Message[] = [];

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  isOpen,
  onClose,
  summonerName,
  context,
  initialMessage,
  improvementStats,
  hasTimelineAnalysis = false,
  onAnalyzeTimeline,
  loadingTimeline = false,
  matches,
  puuid,
  onResolveChatContext,
}) => {
  const [messagesState, setMessagesState] = useState<{
    ownerKey: string | null;
    items: Message[];
  }>({ ownerKey: null, items: EMPTY_MESSAGES });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEvidenceDrawer, setShowEvidenceDrawer] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const STORAGE_KEY = `chat_history_${summonerName}`;
  const EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes
  const playerOwnerKey = `${puuid ?? ''}::${summonerName}`;
  const activeModalKey = isOpen ? playerOwnerKey : null;
  const messages =
    messagesState.ownerKey === playerOwnerKey ? messagesState.items : EMPTY_MESSAGES;

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const playerOwnerKeyRef = useRef<string>(playerOwnerKey);
  const contextRef = useRef<AiContextData>(context);
  const suggestionsRef = useRef<string[]>(suggestions);
  const onResolveChatContextRef = useRef<(() => Promise<AiContextData | null>) | undefined>(onResolveChatContext);
  const openSessionTokenRef = useRef(0);
  const initializedModalKeyRef = useRef<string | null>(null);
  const hasSentInitial = useRef(false);

  playerOwnerKeyRef.current = playerOwnerKey;
  contextRef.current = context;
  suggestionsRef.current = suggestions;
  onResolveChatContextRef.current = onResolveChatContext;

  // Keep ref in sync with active player's messages
  messagesRef.current = messages;

  const updateOwnerMessages = useCallback(
    (ownerKey: string, updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessagesState((prev) => {
        const base = prev.ownerKey === ownerKey ? prev.items : [];
        const nextItems = typeof updater === 'function' ? updater(base) : updater;
        if (prev.ownerKey === ownerKey && prev.items === nextItems) {
          return prev;
        }
        return { ownerKey, items: nextItems };
      });
    },
    []
  );

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const sessionTokenAtStart = openSessionTokenRef.current;
    const ownerAtStart = playerOwnerKeyRef.current;
    const currentMessages = messagesRef.current;
    updateOwnerMessages(ownerAtStart, prev => [...prev, { role: 'user' as const, content: text }]);
    setInput('');
    setLoading(true);

    try {
      const resolvedContext = onResolveChatContextRef.current
        ? await onResolveChatContextRef.current()
        : contextRef.current;

      if (resolvedContext === null || openSessionTokenRef.current !== sessionTokenAtStart) {
        if (openSessionTokenRef.current === sessionTokenAtStart) {
          setLoading(false);
        }
        return;
      }

      const apiResponse = await chatWithAi(resolvedContext, currentMessages, text, sessionId);
      if (openSessionTokenRef.current !== sessionTokenAtStart) {
        return;
      }

      const { cleanResponse, suggestions: nextSuggestions } = parseAiResponseWithSuggestions(
        apiResponse.response,
        suggestionsRef.current
      );
      if (nextSuggestions.length > 0) {
        setSuggestions(nextSuggestions);
      }

      updateOwnerMessages(ownerAtStart, prev => [...prev, { 
        role: 'model', 
        content: cleanResponse,
        interactionId: apiResponse.interactionId,
        timestamp: Date.now()
      }]);
    } catch (error) {
      if (openSessionTokenRef.current !== sessionTokenAtStart) {
        return;
      }
      console.error('Failed to get AI response:', error);
      updateOwnerMessages(ownerAtStart, prev => [...prev, { role: 'model', content: 'Sorry, I encountered an error while analyzing the data.' }]);
    } finally {
      if (openSessionTokenRef.current === sessionTokenAtStart) {
        setLoading(false);
      }
    }
  }, [sessionId, updateOwnerMessages]);

  const handleFeedback = async (interactionId: string | undefined, feedbackType: 'positive' | 'negative', messageTimestamp: number | undefined) => {
    if (!interactionId || !messageTimestamp) return;
    
    const engagementTime = Date.now() - messageTimestamp;
    const ownerAtClick = playerOwnerKeyRef.current;
    
    try {
      await submitFeedback(interactionId, feedbackType, engagementTime, sessionId);
      
      // Update UI to show feedback was recorded
      updateOwnerMessages(ownerAtClick, prev => prev.map(m => 
        m.interactionId === interactionId 
          ? { ...m, feedback: feedbackType } 
          : m
      ));
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  // Load history on open (and reset cleanly on close or player switch)
  useEffect(() => {
    if (!activeModalKey) {
      if (initializedModalKeyRef.current !== null) {
        openSessionTokenRef.current += 1;
        initializedModalKeyRef.current = null;
        hasSentInitial.current = false;
        setLoading(false);
      }
      return;
    }

    if (initializedModalKeyRef.current !== activeModalKey) {
      openSessionTokenRef.current += 1;
      initializedModalKeyRef.current = activeModalKey;
      hasSentInitial.current = false;
      setLoading(false);

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const age = Date.now() - parsed.timestamp;

          if (age < EXPIRATION_TIME && isSubstantiveHistory(parsed.messages)) {
            updateOwnerMessages(activeModalKey, parsed.messages);
            setSuggestions(
              Array.isArray(parsed.suggestions)
                ? parsed.suggestions
                : generatePersonalizedSuggestions(context)
            );
            return;
          } else if (age >= EXPIRATION_TIME) {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }

      // Default initialization if no substantive conversation history exists
      const personalizedSuggestions = generatePersonalizedSuggestions(context);
      updateOwnerMessages(activeModalKey, [
        {
          role: 'model',
          content: buildCoachGreetingMessage(context, loadingTimeline),
        },
      ]);
      setSuggestions(personalizedSuggestions);
    }
  }, [activeModalKey, context, loadingTimeline, STORAGE_KEY, EXPIRATION_TIME, updateOwnerMessages]);

  // Keep the initial greeting truthful as background timeline preparation transitions states
  useEffect(() => {
    if (!activeModalKey) return;
    const nextGreeting = buildCoachGreetingMessage(context, loadingTimeline);
    updateOwnerMessages(activeModalKey, (prev) => {
      if (
        prev.length === 1 &&
        prev[0].role === 'model' &&
        !prev[0].interactionId &&
        prev[0].content !== nextGreeting
      ) {
        return [{ ...prev[0], content: nextGreeting }];
      }
      return prev;
    });
  }, [activeModalKey, context, loadingTimeline, updateOwnerMessages]);

  // Auto-send initialMessage if provided (e.g., from TimelineAnalysisModal or starred summary pill)
  useEffect(() => {
    if (!isOpen) {
      hasSentInitial.current = false;
      return;
    }
    if (initialMessage && !hasSentInitial.current && !loading) {
      // Small delay to ensure the modal is fully rendered
      const t = setTimeout(() => {
        if (hasSentInitial.current) return;
        hasSentInitial.current = true;
        void handleSendMessage(initialMessage);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialMessage, loading, handleSendMessage]);

  // Save substantive history on update ONLY when messages belong to the active summoner
  useEffect(() => {
    if (
      activeModalKey &&
      messagesState.ownerKey === activeModalKey &&
      isSubstantiveHistory(messagesState.items)
    ) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        timestamp: Date.now(),
        messages: messagesState.items,
        suggestions
      }));
    }
  }, [activeModalKey, messagesState, suggestions, STORAGE_KEY]);

  const handleClearChat = () => {
    localStorage.removeItem(STORAGE_KEY);
    const personalizedSuggestions = generatePersonalizedSuggestions(context);
    updateOwnerMessages(playerOwnerKey, [{ 
      role: 'model', 
      content: buildCoachGreetingMessage(context, loadingTimeline)
    }]);
    setSuggestions(personalizedSuggestions);
  };

  useEffect(() => {
    if (!isOpen) return;
    const isGreetingOnlyState =
      !loading &&
      messages.length <= 1 &&
      !messages.some((m) => m.role === 'user') &&
      !isSubstantiveHistory(messages);
    if (isGreetingOnlyState) {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = 0;
      }
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages, loading]);

  if (!isOpen) return null;

  const avgLaneCs10 = context.avgLaneCsAt10 as
    | {
        avgActual?: number;
        matchCount?: number;
        avgSupportedActual?: number | null;
        avgTarget?: number | null;
        targetMatchCount?: number;
        targetLabel?: string;
      }
    | null
    | undefined;
  const missingCs10 = (context.missingLaneCsAt10Matches as number | undefined) ?? 0;
  const imp = context.improvementStats as
    | {
        totalGamesConsidered?: number;
        excludedMissingTimelineGames?: number;
        hasTimelineAnalysis?: boolean;
        phaseFarming?: {
          min10To20?: { eligibleGames?: number; avgTotalCsPerMin?: number | null; shortGames?: number };
          min20ToEnd?: { eligibleGames?: number; avgTotalCsPerMin?: number | null; shortGames?: number };
        };
        leadRetention?: {
          eligibleGamesAt10?: number;
          eligibleGamesAt20?: number;
          avgGoldLeadAt10?: number | null;
          avgGoldLeadAt20?: number | null;
          goldLeadRetentionRate?: number | null;
        };
        deathCost?: {
          eligibleTimeDeadGames?: number;
          avgTimeSpentDeadSeconds?: number | null;
          bounty?: { eligibleTimelineGames?: number; totalCombinedBountyGold?: number | null };
        };
        unspentGold?: {
          eligibleGames?: number;
          sampleCount?: number;
          medianCurrentGold?: number | null;
          highBalanceThresholdGold?: number;
          highBalanceSampleCount?: number | null;
        };
        teamObjectives?: {
          eligibleTeamObjectiveGames?: number;
          tower?: { teamAvg?: number | null; enemyAvg?: number | null };
          dragon?: { teamAvg?: number | null; enemyAvg?: number | null };
        };
      }
    | undefined;
  const timelineAnalyzedInContext =
    context.timelineStatus === 'ANALYZED' || Boolean(imp?.hasTimelineAnalysis);
  const timelineCoverageInContext = context.timelineCoverage as
    | CoachTimelineCoverageContext
    | undefined;
  const timelineBadgeLabel = loadingTimeline
    ? 'Preparing 10m/20m timelines...'
    : context.timelineStatus === 'PARTIAL'
    ? timelineCoverageInContext && timelineCoverageInContext.requested > 0
      ? `10m/20m timelines loaded (${timelineCoverageInContext.covered}/${timelineCoverageInContext.requested}G partial)`
      : '10m/20m timelines loaded (partial)'
    : context.timelineStatus === 'BLOCKED'
    ? 'Match summaries only (timeline unavailable)'
    : timelineAnalyzedInContext
    ? '10m/20m timelines loaded'
    : 'Match summaries only (timeline not run)';

  const modalContent = (
    <div
      data-testid="ai-coach-modal-backdrop"
      className="fixed inset-0 z-[70] flex items-stretch justify-end bg-slate-950/55 dark:bg-black/65 backdrop-blur-xs transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="ai-coach-modal-dialog"
        className="bg-white/98 dark:bg-[#0d1322]/98 backdrop-blur-xl w-full max-w-2xl h-[100dvh] max-h-[100dvh] min-h-0 shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div
          data-testid="ai-coach-modal-header"
          className="px-2.5 py-2 sm:px-5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 bg-slate-50/70 dark:bg-[#090d16]/70"
        >
          <h2 className="text-xs sm:text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-cyan-500/30 flex items-center justify-center shadow-sm p-1 sm:p-1.5 overflow-hidden shrink-0">
              <img src="/lol.svg" alt="AI Coach" className="w-full h-full object-contain invert dark:invert-0 brightness-150 grayscale opacity-90 transition-all dark:opacity-100 dark:brightness-100 dark:grayscale-0" />
            </div>
            <span className="truncate">AI Coach: {summonerName}</span>
          </h2>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              data-testid="ai-coach-evidence-toggle"
              aria-expanded={showEvidenceDrawer}
              aria-controls="ai-coach-evidence-drawer"
              onClick={() => setShowEvidenceDrawer(prev => !prev)}
              className={`text-[11px] sm:text-xs font-semibold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                showEvidenceDrawer
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
              }`}
            >
              {showEvidenceDrawer ? 'Hide Evidence' : 'Show Evidence'}
            </button>
            <button
              type="button"
              onClick={handleClearChat}
              className="text-[11px] sm:text-xs text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 whitespace-nowrap"
            >
              Clear Chat
            </button>
            <button
              type="button"
              data-testid="ai-coach-close-button"
              aria-label="Close AI Coach"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors p-1 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Collapsible In-Coach Evidence Surface (independently scrollable, capped so chat stays usable) */}
        {showEvidenceDrawer && (
          <div
            id="ai-coach-evidence-drawer"
            data-testid="ai-coach-evidence-drawer"
            className="px-2 py-1.5 sm:px-5 sm:py-3 bg-slate-50/95 dark:bg-slate-950/90 border-b border-indigo-200/70 dark:border-indigo-900/60 max-h-[42dvh] sm:max-h-[44dvh] min-h-0 shrink overflow-y-auto overscroll-contain text-xs space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                What Your Coach Sees (Observed Stats &amp; Guardrails)
              </span>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Observed: {context.totalGamesAnalyzed || 0} matches · {timelineBadgeLabel}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Guardrails: Theoretical maximum &ne; missed CS · No guessed wave states
                </span>
              </div>
            </div>

            {improvementStats ? (
              <ImprovementStatsSection
                stats={improvementStats}
                hasTimelineAnalysis={hasTimelineAnalysis}
                onAnalyzeTimeline={onAnalyzeTimeline}
                loadingTimeline={loadingTimeline}
                matches={matches}
                puuid={puuid}
                compact={true}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 telemetry-nums">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                    Early 10m Lane CS
                  </div>
                  <div className="mt-0.5 text-slate-800 dark:text-slate-100 font-semibold">
                    {avgLaneCs10
                      ? `Avg ${avgLaneCs10.avgActual} CS (${avgLaneCs10.matchCount}G) · ${
                          avgLaneCs10.avgTarget !== null && avgLaneCs10.avgTarget !== undefined
                            ? `Theoretical maximum ${avgLaneCs10.avgTarget} CS (${avgLaneCs10.targetMatchCount}G)`
                            : avgLaneCs10.targetMatchCount
                            ? `Theoretical maximum: Unavailable (mixed patch) · 26.1+ actual: ${avgLaneCs10.avgSupportedActual ?? avgLaneCs10.avgActual} CS (${avgLaneCs10.targetMatchCount}G)`
                            : 'Theoretical maximum: Unavailable (pre-26.1)'
                        }`
                      : 'No eligible laner games'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {missingCs10 > 0 ? `${missingCs10}G short/missing excl. · ` : ''}Theoretical maximum &ne; missed CS
                  </div>
                </div>

                {imp && (
                  <>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
                      <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                        1. Mid &amp; Late CS/m
                      </div>
                      <div className="mt-0.5 text-slate-800 dark:text-slate-100 font-semibold">
                        10–20m: {imp.phaseFarming?.min10To20?.avgTotalCsPerMin ?? 'Unavailable'}/m ({imp.phaseFarming?.min10To20?.eligibleGames ?? 0}G)
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        20m+: {imp.phaseFarming?.min20ToEnd?.avgTotalCsPerMin ?? 'Unavailable'}/m ({imp.phaseFarming?.min20ToEnd?.eligibleGames ?? 0}G) · Short games excluded
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
                      <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                        2. 10m &amp; 20m Lane Leads
                      </div>
                      <div className="mt-0.5 text-slate-800 dark:text-slate-100 font-semibold">
                        @10m: {imp.leadRetention?.avgGoldLeadAt10 ?? 'Unavailable'}g ({imp.leadRetention?.eligibleGamesAt10 ?? 0}G) · @20m: {imp.leadRetention?.avgGoldLeadAt20 ?? 'Unavailable'}g ({imp.leadRetention?.eligibleGamesAt20 ?? 0}G)
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        10–20m events are timing context, not proof of a throw
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
                      <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                        3. Death Cost &amp; 4. Unspent Gold
                      </div>
                      <div className="mt-0.5 text-slate-800 dark:text-slate-100 font-semibold">
                        Dead: {imp.deathCost?.avgTimeSpentDeadSeconds ?? 'Unavailable'}s/g ({imp.deathCost?.eligibleTimeDeadGames ?? 0}G) · Bounty: {imp.deathCost?.bounty?.totalCombinedBountyGold ?? 'Unavailable'}g
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Unspent med: {imp.unspentGold?.medianCurrentGold ?? 'Unavailable'}g ({imp.unspentGold?.sampleCount ?? 0} 1m checks, neutral)
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 sm:col-span-2">
                      <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                        5. Objectives ({imp.teamObjectives?.eligibleTeamObjectiveGames ?? 0}G)
                      </div>
                      <div className="mt-0.5 text-slate-800 dark:text-slate-100 font-semibold">
                        Towers: {imp.teamObjectives?.tower?.teamAvg ?? '—'} vs {imp.teamObjectives?.tower?.enemyAvg ?? '—'} · Dragons: {imp.teamObjectives?.dragon?.teamAvg ?? '—'} vs {imp.teamObjectives?.dragon?.enemyAvg ?? '—'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        5v5 team totals kept separate from personal takedowns; missing stats stay Unavailable
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chat Area (independently scrollable with guaranteed minimum height) */}
        <div
          ref={chatScrollRef}
          data-testid="ai-coach-chat-scroll"
          className="flex-1 min-h-[5.5rem] overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3 sm:space-y-6 bg-transparent"
        >
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
            >
              <div className={`flex max-w-[92%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 sm:gap-3`}>
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-cyan-600' 
                    : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-cyan-500/30 p-1 sm:p-1.5'
                }`}>
                  {msg.role === 'user' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <img src="/lol.svg" alt="AI Coach" className="w-full h-full object-contain invert dark:invert-0 brightness-150 grayscale opacity-90 transition-all dark:opacity-100 dark:brightness-100 dark:grayscale-0" />
                  )}
                </div>
                <div 
                  className={`rounded-2xl sm:rounded-3xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-cyan-600 dark:bg-cyan-600/90 text-white rounded-br-sm' 
                      : 'bg-gray-100/80 dark:bg-slate-800/80 text-gray-800 dark:text-gray-100 rounded-bl-sm border border-gray-200/50 dark:border-white/5'
                  }`}
                >
                  {msg.role === 'model' ? (
                    <>
                      <div className="prose dark:prose-invert prose-sm sm:prose-base max-w-none prose-p:leading-relaxed prose-strong:text-cyan-700 dark:prose-strong:text-cyan-400 prose-strong:font-semibold">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {/* Feedback buttons */}
                      {msg.interactionId && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          {msg.feedback === 'positive' ? (
                            <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Helpful
                            </span>
                          ) : msg.feedback === 'negative' ? (
                            <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Not helpful
                            </span>
                          ) : (
                            <>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Was this helpful?</span>
                              <button
                                onClick={() => handleFeedback(msg.interactionId, 'positive', msg.timestamp)}
                                className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                                title="This was helpful"
                              >
                                👍
                              </button>
                              <button
                                onClick={() => handleFeedback(msg.interactionId, 'negative', msg.timestamp)}
                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="This was not helpful"
                              >
                                👎
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in-up pb-2">
              <div className="flex max-w-[92%] sm:max-w-[85%] flex-row items-end gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-cyan-500/30 flex items-center justify-center shrink-0 shadow-sm p-1 sm:p-1.5 overflow-hidden">
                  <img src="/lol.svg" alt="AI Coach" className="w-full h-full object-contain invert dark:invert-0 brightness-150 grayscale opacity-90 transition-all dark:opacity-100 dark:brightness-100 dark:grayscale-0" />
                </div>
                <div className="bg-gray-100/80 dark:bg-slate-800/80 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-3xl rounded-bl-sm border border-gray-200/50 dark:border-white/5 shadow-sm flex items-center gap-1.5 h-[42px] sm:h-[52px]">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-500/60 dark:bg-cyan-400/80 rounded-full typing-dot"></div>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-500/60 dark:bg-cyan-400/80 rounded-full typing-dot"></div>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-500/60 dark:bg-cyan-400/80 rounded-full typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {suggestions.length > 0 && !loading && (
          <div className="px-2.5 py-1.5 sm:px-5 sm:py-2.5 bg-transparent border-t border-gray-200/50 dark:border-white/5 shrink-0">
            <div className="flex overflow-x-auto sm:flex-wrap gap-1.5 sm:gap-2 pb-0.5 scrollbar-hide snap-x">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="shrink-0 snap-start px-2.5 py-1 sm:px-3.5 sm:py-1.5 bg-transparent border border-cyan-500/40 dark:border-cyan-400/30 text-cyan-700 dark:text-cyan-300 text-xs sm:text-sm rounded-full hover:bg-cyan-500 hover:text-white dark:hover:bg-cyan-400 dark:hover:text-slate-900 transition-all duration-300 shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div
          data-testid="ai-coach-modal-footer"
          className="px-2.5 py-2 sm:px-5 sm:py-3.5 border-t border-gray-200/50 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 shrink-0"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <input
              data-testid="ai-coach-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(input)}
              placeholder="Ask a question about this player..."
              className="flex-1 min-w-0 bg-white/80 dark:bg-slate-800/80 border border-gray-200/50 dark:border-white/10 rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:text-white placeholder-gray-400 shadow-sm text-xs sm:text-sm transition-all"
              disabled={loading}
            />
            <button
              type="button"
              data-testid="ai-coach-send-button"
              aria-label="Send message"
              onClick={() => handleSendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-cyan-500/25 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none shrink-0 flex items-center justify-center transform active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default AiAnalysisModal;
