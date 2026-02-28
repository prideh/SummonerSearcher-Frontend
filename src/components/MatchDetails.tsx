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
    <div id={id} className="col-span-full bg-white dark:bg-gray-900/70 rounded-b-lg text-gray-800 dark:text-gray-200 border-t border-gray-200 dark:border-gray-800/50 overflow-hidden">
      {/* Tab bar */}
      <div className="relative border-b border-gray-200 dark:border-gray-800/50">
        <div className="flex w-full px-1 pt-1">
          {(['scoreboard', 'graphs', 'runes', 'analysis', 'details'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-2 text-xs sm:text-sm font-semibold whitespace-nowrap capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<div className="p-4"><Skeleton className="w-full h-48 rounded-md bg-gray-200/50 dark:bg-gray-800/50" /></div>}>
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
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">Player data not available for this match.</div>
        )}
      </Suspense>
    </div>
  );
};

export default MatchDetails;
