import React, { useState } from 'react';
import type { MatchDto } from '../types/match';
import RunesTab from './RunesTab';
import AnalysisTab from './AnalysisTab';
import ScoreboardTab from './ScoreboardTab';
import GraphsTab from './GraphsTab';

interface MatchDetailsProps {
  match: MatchDto;
  puuid: string;
  onPlayerClick: (name: string, tag: string) => void;
}

const MatchDetails: React.FC<MatchDetailsProps> = ({ match, puuid, onPlayerClick }) => {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'graphs' | 'runes' | 'analysis'>('scoreboard');

  const getTabClass = (tabName: 'scoreboard' | 'graphs' | 'runes' | 'analysis') =>
    `px-4 py-2 font-semibold rounded-t-lg transition-colors shrink-0 ${
      activeTab === tabName
        ? 'bg-gray-700/80 text-white'
        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
    }`;

  return (
    <div className="col-span-full bg-gray-800/70 rounded-b-lg text-white border-t border-gray-700/50 overflow-hidden">
      <div className="flex border-b border-gray-700/50 px-2 sm:px-4 overflow-x-auto">
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
      {activeTab === 'scoreboard' && <ScoreboardTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
      {activeTab === 'graphs' && <GraphsTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
      {activeTab === 'runes' && <RunesTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
      {activeTab === 'analysis' && <AnalysisTab match={match} puuid={puuid} onPlayerClick={onPlayerClick} />}
    </div>
  );
};

export default MatchDetails;
