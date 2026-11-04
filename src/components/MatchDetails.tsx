import React, { useState, Suspense, lazy } from 'react';
import type { MatchDto } from '../types/match';
import { Skeleton } from './ui/Skeleton';

const RunesTab = lazy(() => import('./RunesTab'));
const AnalysisTab = lazy(() => import('./AnalysisTab'));
const ScoreboardTab = lazy(() => import('./ScoreboardTab'));
const GraphsTab = lazy(() => import('./GraphsTab'));
const MatchDetailsTab = lazy(() => import('./MatchDetailsTab'));

/**
 * Props for the MatchDetails component.
 */
interface MatchDetailsProps {
  /** The full data for the match. */
  match: MatchDto;
  /** The PUUID of the searched player to highlight their data in the details. */
  puuid: string;
  /** Callback function to handle clicks on player names. */
  onPlayerClick: (name: string, tag: string) => void;
  /** An optional ID for accessibility and linking. */
  id?: string;
  /** The region for timeline API calls (e.g. 'euw1'). */
  region: string;
}

type ActiveTab = 'scoreboard' | 'graphs' | 'runes' | 'analysis' | 'details';

/**
 * A container component that renders detailed information about a single match.
 * It uses a tabbed interface: Scoreboard, Graphs, Runes, Analysis, and Details.
 */
const MatchDetails: React.FC<MatchDetailsProps> = ({ match, puuid, onPlayerClick, id, region }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scoreboard');


  // Resolve player + opponent for the Details tab
  const playerParticipant = match.info?.participants.find(p => p.puuid === puuid);
  const opponentParticipant = match.info?.participants.find(p =>
    p.teamId !== playerParticipant?.teamId &&
    p.teamPosition === playerParticipant?.teamPosition &&
    p.teamPosition &&
    p.teamPosition !== 'NONE'
  );

  const matchId = match.metadata?.matchId ?? '';

  return (
    <div id={id} className="w-full max-w-full min-w-0 col-span-full bg-white dark:bg-[#0d1322] rounded-b-lg text-slate-800 dark:text-slate-200 border-t border-slate-200 dark:border-slate-800 overflow-hidden telemetry-nums">
      {/* Tab bar */}
      <div className="w-full min-w-0 bg-slate-100/90 dark:bg-[#090d16] border-b border-slate-200 dark:border-slate-800 px-1.5 sm:px-3 py-1.5">
        <div className="flex w-full min-w-0 gap-1 sm:gap-1.5">
          {(['scoreboard', 'graphs', 'runes', 'analysis', 'details'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-auto sm:flex-1 min-w-0 text-center py-1.5 px-1 sm:px-2 text-[10px] sm:text-xs font-extrabold uppercase tracking-tight sm:tracking-wider whitespace-nowrap rounded transition-colors ${
                activeTab === tab
                  ? 'bg-sky-600 text-white dark:bg-cyan-400 dark:text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/70'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<div className="p-4"><Skeleton className="w-full h-48 rounded-md bg-slate-200/60 dark:bg-slate-800/60" /></div>}>
        {activeTab === 'scoreboard' && <ScoreboardTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
        {activeTab === 'graphs' && <GraphsTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
        {activeTab === 'runes' && <RunesTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
        {activeTab === 'analysis' && <AnalysisTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
        {activeTab === 'details' && playerParticipant && (
          <MatchDetailsTab
            matchId={matchId}
            region={region}
            puuid={puuid}
            playerParticipant={playerParticipant}
            opponentParticipant={opponentParticipant}
            allParticipants={match.info?.participants || []}
          />
        )}
        {activeTab === 'details' && !playerParticipant && (
          <div className="p-6 text-center text-slate-500 dark:text-slate-400">Player data not available for this match.</div>
        )}
      </Suspense>
    </div>
  );
};

export default MatchDetails;
