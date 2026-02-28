import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { TimelineAnalysisDto, MatchPowerSpikeDto, PowerSpikePoint } from '../types/timeline';

// Riot minimap image
const MINIMAP_URL = 'https://raw.communitydragon.org/latest/game/levels/map11/info/2dlevelminimap.png';
// Riot map coordinate space is 0..15000 on each axis
const MAP_COORD_MAX = 15000;

interface TimelineAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: TimelineAnalysisDto;
  summonerName: string;
  onOpenAiCoach: (suggestion?: string) => void;
}

type HeatmapLayer = 'positions' | 'kills' | 'deaths' | 'assists' | 'wards';

const LAYER_COLORS: Record<HeatmapLayer, string> = {
  positions: 'rgba(56, 189, 248, 0.40)',   // cyan — very faint, creates density when stacked
  kills: 'rgba(34, 197, 94, 1)',             // green — solid
  deaths: 'rgba(225, 29, 72, 1)',            // rose red — solid
  assists: 'rgba(52, 211, 153, 1)',          // emerald — solid
  wards: 'rgba(251, 191, 36, 1)',            // yellow — solid
};

// removed LAYER_GLOW

const LAYER_LABELS: Record<HeatmapLayer, string> = {
  positions: '🔵 Positions',
  kills: '⚔️ Kills',
  deaths: '💀 Deaths',
  assists: '🤝 Assists',
  wards: '🟡 Wards',
};

// Custom tooltip for power spike chart
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PowerSpikePoint }>;
  label?: string | number;
}
const EventDot = (props: { cx?: number; cy?: number; payload?: PowerSpikePoint; dataKey?: string }) => {
  const { cx, cy, payload } = props;
  const dataKey = props.dataKey; // We explicitly passed this in the <Line dot={<EventDot dataKey="..." />} />
  
  const events = (payload as PowerSpikePoint)?.events;
  if (!events || events.length === 0) return null;
  
  // Look at events related to the line we are drawing on
  const relevantEvents = dataKey === 'playerGold' 
    ? events.filter(e => e.isPlayer)
    : events.filter(e => e.isOpponent);
    
  if (relevantEvents.length === 0) return null;

  // Choose an icon based on the most important event this minute
  const hasKill = relevantEvents.some(e => e.type === 'KILL');
  const hasDeath = relevantEvents.some(e => e.type === 'DEATH');
  const hasPlate = relevantEvents.some(e => e.type === 'PLATE');
  const hasObjective = relevantEvents.some(e => e.type === 'OBJECTIVE');
  const hasAssist = relevantEvents.some(e => e.type === 'ASSIST');
  
  let icon = '';
  if (hasKill) icon = '⚔️';
  else if (hasDeath) icon = '💀';
  else if (hasAssist) icon = '🤝';
  else if (hasPlate || hasObjective) icon = '🏰';
  
  if (!icon) return null;
  
  const isPositiveLine = dataKey === 'playerGold';
  const glowColor = isPositiveLine ? 'rgba(34, 211, 238, 0.25)' : 'rgba(248, 113, 113, 0.25)';
  const strokeColor = isPositiveLine ? 'rgba(34, 211, 238, 0.8)' : 'rgba(248, 113, 113, 0.8)';
  
  return (
    <g>
      <circle cx={cx ?? 0} cy={(cy ?? 0) - 12} r={11} fill={glowColor} stroke={strokeColor} strokeWidth={1} />
      <text x={cx ?? 0} y={(cy ?? 0) - 12} textAnchor="middle" fontSize="13" dominantBaseline="central">
        {icon}
      </text>
    </g>
  );
};

const PowerSpikeTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const lead = data.playerGoldLead;
  
  return (
    <div className="bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs shadow-xl min-w-[200px] z-50 relative pointer-events-none">
      <div className="flex justify-between items-center mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <span className="text-gray-800 dark:text-gray-300 font-bold">Minute {label}</span>
        <span className={`font-bold ${lead >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {lead >= 0 ? '+' : ''}{lead.toLocaleString()}g lead
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 items-center">
        <div className="text-gray-500 font-bold text-[10px] uppercase">Stat</div>
        <div className="text-cyan-600 dark:text-cyan-400 font-bold text-center">You</div>
        <div className="text-orange-600 dark:text-orange-400 font-bold text-right" >Opp</div>
        
        <div className="text-gray-500 text-[10px] uppercase">Gold</div>
        <div className="text-gray-800 dark:text-gray-300 text-center font-mono">{data.playerGold.toLocaleString()}</div>
        <div className="text-gray-800 dark:text-gray-300 text-right font-mono">{data.opponentGold.toLocaleString()}</div>
        
        <div className="text-gray-500 text-[10px] uppercase">CS</div>
        <div className="text-gray-400 text-center font-mono">{data.playerCs}</div>
        <div className="text-gray-400 text-right font-mono">{data.opponentCs}</div>
        
        <div className="text-gray-500 text-[10px] uppercase">XP</div>
        <div className="text-gray-400 text-center font-mono">{data.playerXp.toLocaleString()}</div>
        <div className="text-gray-400 text-right font-mono">{data.opponentXp.toLocaleString()}</div>
      </div>
      
      {data.events && data.events.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800 space-y-1.5">
          {data.events.map((ev, i) => (
             <div key={i} className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
               <span className="text-xs">{ev.type === 'KILL' ? '⚔️' : ev.type === 'DEATH' ? '💀' : '🏰'}</span>
               <span className="truncate">
                 {ev.actor && <span className="text-gray-700 dark:text-gray-300 font-medium">{ev.actor}</span>}
                 {ev.type === 'KILL' ? ' killed ' : ev.type === 'DEATH' ? ' died to ' : ' destroyed '}
                 {ev.target && <span className="text-gray-700 dark:text-gray-300 font-medium">{ev.target}</span>}
               </span>
             </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TimelineAnalysisModal: React.FC<TimelineAnalysisModalProps> = ({
  isOpen, onClose, analysis, summonerName, onOpenAiCoach
}) => {
  const [activeLayers, setActiveLayers] = useState<Set<HeatmapLayer>>(
    new Set(['positions', 'deaths', 'wards', 'kills', 'assists'])
  );
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [timelineMinute, setTimelineMinute] = useState<number>(0);

  useEffect(() => {
    const points = analysis.powerSpikeTimelines[selectedMatchIndex]?.points;
    const maxMinute = points && points.length > 0 ? points[points.length - 1].minute : 0;
    setTimelineMinute(maxMinute);
  }, [selectedMatchIndex, analysis]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLImageElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const toggleLayer = (layer: HeatmapLayer) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  // Convert Riot map coordinates (0..15000) to canvas pixel coordinates
  const toCanvas = useCallback((x: number, y: number, canvasW: number, canvasH: number) => ({
    cx: (x / MAP_COORD_MAX) * canvasW,
    // Y axis is flipped: 0 is bottom-left in Riot coords, top-left in canvas
    cy: canvasH - (y / MAP_COORD_MAX) * canvasH,
  }), []);

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const currentMatchId = analysis.powerSpikeTimelines[selectedMatchIndex]?.matchId;

    // Draw each layer if active — ordered so kills/deaths/wards render on top of positions
    if (activeLayers.has('positions')) {
      const positions = analysis.heatmapPositions.filter(pt => pt.matchId === currentMatchId && pt.minute <= timelineMinute);
      for (const pt of positions) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = LAYER_COLORS.positions;
        ctx.fill();
      }
    }
    if (activeLayers.has('kills')) {
      const kills = analysis.killPositions.filter(pt => pt.matchId === currentMatchId && pt.minute <= timelineMinute);
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; // Reset opacity bleed from positions
      for (const pt of kills) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.fillText('⚔️', cx, cy);
      }
    }
    if (activeLayers.has('deaths')) {
      const deaths = analysis.deathPositions.filter(pt => pt.matchId === currentMatchId && pt.minute <= timelineMinute);
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; // Reset opacity bleed from positions
      for (const pt of deaths) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.fillText('💀', cx, cy);
      }
    }
    if (activeLayers.has('wards')) {
      const wards = analysis.wardPositions.filter(pt => pt.matchId === currentMatchId && pt.minute <= timelineMinute);
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; // Reset opacity bleed from positions
      for (const pt of wards) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.fillText('🟡', cx, cy);
      }
    }
    if (activeLayers.has('assists')) {
      const assists = analysis.assistPositions.filter(pt => pt.matchId === currentMatchId && pt.minute <= timelineMinute);
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; // Reset opacity bleed from positions
      for (const pt of assists) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.fillText('🤝', cx, cy);
      }
    }
  }, [analysis, activeLayers, mapLoaded, toCanvas, selectedMatchIndex, timelineMinute]);

  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  const selectedSpike: MatchPowerSpikeDto | undefined = analysis.powerSpikeTimelines[selectedMatchIndex];
  const summary = analysis.aggregateSummary;

  // Format gold lead for display
  const formatGold = (g: number) => {
    const sign = g >= 0 ? '+' : '';
    return `${sign}${Math.round(g).toLocaleString()}g`;
  };

  const aiSuggestions = [
    "What do my death patterns reveal about my positioning?",
    "When do I hit my power spikes compared to my opponents?",
    "How can I improve my ward placement efficiency?",
    "What does my gold lead trajectory say about my laning?",
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="timeline-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="timeline-modal-content"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl mx-auto my-6 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-indigo-50/60 to-violet-50/60 dark:from-indigo-950/60 dark:to-violet-950/60">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-2xl">📊</span> Timeline Analysis
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Last {summary.gamesAnalyzed} ranked games · {summonerName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-8">

            {/* ── Aggregate Stats Cards ── */}
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Aggregate Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Games Analyzed', value: summary.gamesAnalyzed, color: 'text-cyan-600 dark:text-cyan-400' },
                  { label: 'Avg First Death', value: `${summary.avgFirstDeathMinute}min`, color: 'text-red-600 dark:text-red-400' },
                  { label: 'Most Dangerous Zone', value: summary.mostDangerousZone, color: 'text-orange-600 dark:text-orange-400' },
                  { label: 'Gold Lead @10', value: formatGold(summary.avgGoldLeadAt10), color: summary.avgGoldLeadAt10 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
                  { label: 'Gold Lead @15', value: formatGold(summary.avgGoldLeadAt15), color: summary.avgGoldLeadAt15 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
                  { label: 'KDA (K/D)', value: `${summary.killsTotal}/${summary.deathsTotal}`, color: 'text-violet-600 dark:text-violet-400' },
                ].map(card => (
                  <div key={card.label} className="bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-center">
                    <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{card.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Two-column: Heatmap + Power Spike ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Heatmap */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Player Heatmap</h3>
                  {analysis.powerSpikeTimelines.length > 1 && (
                    <select
                      value={selectedMatchIndex}
                      onChange={e => setSelectedMatchIndex(Number(e.target.value))}
                      className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-2 py-1 lg:hidden"
                    >
                      {analysis.powerSpikeTimelines.map((spike, i) => (
                        <option key={i} value={i}>
                          Match {i + 1} ({spike.win ? '✓' : '✗'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="relative bg-gray-100 dark:bg-black rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800" style={{ aspectRatio: '1 / 1' }}>
                  <img
                    ref={minimapRef}
                    src={MINIMAP_URL}
                    alt="League of Legends Minimap"
                    className="w-full h-full object-cover"
                    onLoad={() => {
                      setMapLoaded(true);
                      setTimeout(drawHeatmap, 50);
                    }}
                    crossOrigin="anonymous"
                  />
                  <canvas
                    ref={canvasRef}
                    width={512}
                    height={512}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                  {!mapLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Layer toggles */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {(Object.keys(LAYER_LABELS) as HeatmapLayer[]).map(layer => (
                    <button
                      key={layer}
                      onClick={() => toggleLayer(layer)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                        activeLayers.has(layer)
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-500 bg-transparent'
                      }`}
                      style={activeLayers.has(layer) ? { backgroundColor: LAYER_COLORS[layer].replace(/[\d.]+\)$/, '0.8)') } : {}}
                    >
                      {LAYER_LABELS[layer]}
                    </button>
                  ))}
                </div>
                
                {/* Timeline Scrubber */}
                <div className="mt-4 px-2">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs text-gray-500 font-medium tracking-wide">MATCH TIMELINE</span>
                    <span className="text-sm font-bold text-cyan-500 dark:text-cyan-400">{timelineMinute}:00</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={(() => {
                      const pts = analysis.powerSpikeTimelines[selectedMatchIndex]?.points;
                      return pts && pts.length > 0 ? pts[pts.length - 1].minute : 0;
                    })()}
                    value={timelineMinute}
                    onChange={(e) => setTimelineMinute(parseInt(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-600 mt-1">
                    <span>0:00</span>
                    <span>End of Game</span>
                  </div>
                </div>
              </section>

              {/* Gold Timeline */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Gold Timeline</h3>
                  {analysis.powerSpikeTimelines.length > 1 && (
                    <select
                      value={selectedMatchIndex}
                      onChange={e => setSelectedMatchIndex(Number(e.target.value))}
                      className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-2 py-1"
                    >
                      {analysis.powerSpikeTimelines.map((spike, i) => (
                        <option key={i} value={i}>
                          {spike.playerChampion} vs {spike.opponentChampion} ({spike.win ? '✓ Win' : '✗ Loss'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {selectedSpike ? (
                  <div className="bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-cyan-400 rounded" />
                        <span className="text-gray-600 dark:text-gray-400">You ({selectedSpike.playerChampion})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-orange-400 rounded" />
                        <span className="text-gray-600 dark:text-gray-400">Opponent ({selectedSpike.opponentChampion})</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={selectedSpike.points} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                          dataKey="minute"
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          label={{ value: 'minute', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<PowerSpikeTooltip />} />
                        <ReferenceLine y={0} stroke="#374151" />
                        <Line
                          type="monotone"
                          dataKey="playerGold"
                          stroke="#22d3ee"
                          strokeWidth={2}
                          dot={<EventDot dataKey="playerGold" />}
                          activeDot={{ r: 4, fill: '#22d3ee' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="opponentGold"
                          stroke="#fb923c"
                          strokeWidth={2}
                          dot={<EventDot dataKey="opponentGold" />}
                          activeDot={{ r: 4, fill: '#fb923c' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="bg-gray-900/60 rounded-xl p-6 text-center text-gray-500 text-sm">
                    No power spike data available.
                  </div>
                )}
              </section>
            </div>

            {/* ── AI Coach Section ── */}
            <section className="bg-gradient-to-r from-violet-50 dark:from-violet-950/50 to-indigo-50 dark:to-indigo-950/50 border border-violet-200 dark:border-violet-900/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-violet-500 dark:text-violet-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300">Ask AI Coach about your Timeline</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => { onOpenAiCoach(suggestion); onClose(); }}
                    className="text-xs bg-violet-100 dark:bg-violet-900/40 hover:bg-violet-200 dark:hover:bg-violet-800/60 border border-violet-200 dark:border-violet-800/60 hover:border-violet-300 dark:hover:border-violet-600 text-violet-800 dark:text-violet-200 px-3 py-1.5 rounded-full transition-all hover:shadow-lg hover:shadow-violet-200 dark:hover:shadow-violet-900/30"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TimelineAnalysisModal;
