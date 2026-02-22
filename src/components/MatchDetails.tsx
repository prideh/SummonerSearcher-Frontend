import React, { useState, Suspense, lazy } from 'react';
import type { MatchDto } from '../types/match';
import { Skeleton } from './ui/Skeleton';

const RunesTab = lazy(() => import('./RunesTab'));
const AnalysisTab = lazy(() => import('./AnalysisTab'));
const ScoreboardTab = lazy(() => import('./ScoreboardTab'));
const GraphsTab = lazy(() => import('./GraphsTab'));

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
}

/**
 * A container component that renders detailed information about a single match.
 * It uses a tabbed interface to switch between different views: Scoreboard, Graphs, Runes, and Analysis.
 */
const MatchDetails: React.FC<MatchDetailsProps> = ({ match, puuid, onPlayerClick, id }) => {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'graphs' | 'runes' | 'analysis'>('scoreboard');

  // Helper function to determine the CSS classes for a tab based on whether it's active.
  const getTabClass = (tabName: 'scoreboard' | 'graphs' | 'runes' | 'analysis') =>
    `px-4 py-2 font-semibold rounded-t-lg transition-colors shrink-0 ${
      activeTab === tabName
        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        : 'bg-gray-100/60 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 hover:bg-white/80 dark:hover:bg-gray-800/80'
    }`;

  return (
    <div id={id} className="col-span-full bg-white dark:bg-gray-900/70 rounded-b-lg text-gray-800 dark:text-gray-200 border-t border-gray-200 dark:border-gray-800/50 overflow-hidden">
      <div className="flex border-b border-gray-200 dark:border-gray-800/50 px-2 sm:px-4 overflow-x-auto">
        <button onClick={() => setActiveTab('scoreboard')} className={getTabClass('scoreboard')}>
          Scoreboard
        </button>
        <button onClick={() => setActiveTab('graphs')} className={getTabClass('graphs')}>
          Graphs
        </button>
        <button onClick={() => setActiveTab('runes')} className={getTabClass('runes')}>
          Runes
        </button>
        <button onClick={() => setActiveTab('analysis')} className={getTabClass('analysis')}>
          Analysis
        </button>
      </div>
      {/* Conditionally render the content of the active tab. */}
      <Suspense fallback={<div className="p-4"><Skeleton className="w-full h-48 rounded-md bg-gray-200/50 dark:bg-gray-800/50" /></div>}>
        {activeTab === 'scoreboard' && <ScoreboardTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
        {activeTab === 'graphs' && <GraphsTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
        {activeTab === 'runes' && <RunesTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
        {activeTab === 'analysis' && <AnalysisTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
      </Suspense>
    </div>
  );
};

export default MatchDetails;
