import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { TimelineAnalysisDto, MatchPowerSpikeDto } from '../types/timeline';

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

type HeatmapLayer = 'positions' | 'kills' | 'deaths' | 'wards';

const LAYER_COLORS: Record<HeatmapLayer, string> = {
  positions: 'rgba(56, 189, 248, 0.75)',   // cyan — semi-transparent to show density
  kills: 'rgba(52, 211, 153, 1)',            // green — solid
  deaths: 'rgba(248, 113, 113, 1)',          // red — solid
  wards: 'rgba(251, 191, 36, 1)',            // yellow — solid
};

// Glow (shadow) colors per layer
const LAYER_GLOW: Record<HeatmapLayer, string> = {
  positions: 'rgba(56, 189, 248, 0.6)',
  kills:     'rgba(52, 211, 153, 0.9)',
  deaths:    'rgba(248, 113, 113, 0.9)',
  wards:     'rgba(251, 191, 36, 0.9)',
};

const LAYER_LABELS: Record<HeatmapLayer, string> = {
  positions: '🔵 Positions',
  kills: '🟢 Kills',
  deaths: '🔴 Deaths',
  wards: '🟡 Wards',
};

// Custom tooltip for power spike chart
const PowerSpikeTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const playerGold = payload.find((p: any) => p.dataKey === 'playerGold')?.value;
  const opponentGold = payload.find((p: any) => p.dataKey === 'opponentGold')?.value;
  const lead = playerGold - opponentGold;
  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-300 mb-1 font-bold">Minute {label}</p>
      <p className="text-cyan-400">You: {playerGold?.toLocaleString()}g</p>
      <p className="text-orange-400">Opponent: {opponentGold?.toLocaleString()}g</p>
      <p className={`font-bold mt-1 ${lead >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {lead >= 0 ? '+' : ''}{lead?.toLocaleString()}g lead
      </p>
    </div>
  );
};

const TimelineAnalysisModal: React.FC<TimelineAnalysisModalProps> = ({
  isOpen, onClose, analysis, summonerName, onOpenAiCoach
}) => {
  const [activeLayers, setActiveLayers] = useState<Set<HeatmapLayer>>(
    new Set(['positions', 'deaths', 'wards', 'kills'])
  );
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
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

    const drawPointsLayer = (points: { x: number; y: number }[], layerKey: HeatmapLayer, fn: (cx: number, cy: number) => void) => {
      if (!activeLayers.has(layerKey)) return;
      for (const pt of points) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        fn(cx, cy);
      }
    };
    void drawPointsLayer; // suppress unused-var if not needed below

    // Draw each layer if active — ordered so kills/deaths/wards render on top of positions
    if (activeLayers.has('positions')) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = LAYER_GLOW.positions;
      for (const pt of analysis.heatmapPositions) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = LAYER_COLORS.positions;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    if (activeLayers.has('kills')) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = LAYER_GLOW.kills;
      for (const pt of analysis.killPositions) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = LAYER_COLORS.kills;
        ctx.fill();
        // White centre dot
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    if (activeLayers.has('deaths')) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = LAYER_GLOW.deaths;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const pt of analysis.deathPositions) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        ctx.strokeStyle = LAYER_COLORS.deaths;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8);
        ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
    }
    if (activeLayers.has('wards')) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = LAYER_GLOW.wards;
      for (const pt of analysis.wardPositions) {
        const { cx, cy } = toCanvas(pt.x, pt.y, w, h);
        // Draw rotated square (diamond) for wards
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = LAYER_COLORS.wards;
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    }
  }, [analysis, activeLayers, mapLoaded, toCanvas]);

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
          className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl mx-auto my-6 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-indigo-950/60 to-violet-950/60">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">📊</span> Timeline Analysis
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">Last {summary.gamesAnalyzed} ranked games · {summonerName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
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
                  { label: 'Games Analyzed', value: summary.gamesAnalyzed, color: 'text-cyan-400' },
                  { label: 'Avg First Death', value: `${summary.avgFirstDeathMinute}min`, color: 'text-red-400' },
                  { label: 'Most Dangerous Zone', value: summary.mostDangerousZone, color: 'text-orange-400' },
                  { label: 'Gold Lead @10', value: formatGold(summary.avgGoldLeadAt10), color: summary.avgGoldLeadAt10 >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Gold Lead @15', value: formatGold(summary.avgGoldLeadAt15), color: summary.avgGoldLeadAt15 >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: 'KDA (K/D)', value: `${summary.killsTotal}/${summary.deathsTotal}`, color: 'text-violet-400' },
                ].map(card => (
                  <div key={card.label} className="bg-gray-900/70 border border-gray-800 rounded-xl p-3 text-center">
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
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Player Movement Heatmap</h3>
                <div className="relative bg-black rounded-xl overflow-hidden border border-gray-800" style={{ aspectRatio: '1 / 1' }}>
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
                          : 'border-gray-700 text-gray-500 bg-transparent'
                      }`}
                      style={activeLayers.has(layer) ? { backgroundColor: LAYER_COLORS[layer].replace(/[\d.]+\)$/, '0.8)') } : {}}
                    >
                      {LAYER_LABELS[layer]}
                    </button>
                  ))}
                </div>
              </section>

              {/* Power Spike Timeline */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Power Spike Timeline</h3>
                  {analysis.powerSpikeTimelines.length > 1 && (
                    <select
                      value={selectedMatchIndex}
                      onChange={e => setSelectedMatchIndex(Number(e.target.value))}
                      className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-2 py-1"
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
                  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-cyan-400 rounded" />
                        <span className="text-gray-400">You ({selectedSpike.playerChampion})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-orange-400 rounded" />
                        <span className="text-gray-400">Opponent ({selectedSpike.opponentChampion})</span>
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
                          dot={false}
                          activeDot={{ r: 4, fill: '#22d3ee' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="opponentGold"
                          stroke="#fb923c"
                          strokeWidth={2}
                          dot={false}
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
            <section className="bg-gradient-to-r from-violet-950/50 to-indigo-950/50 border border-violet-900/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-violet-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <h3 className="text-sm font-bold text-violet-300">Ask AI Coach about your Timeline</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => { onOpenAiCoach(suggestion); onClose(); }}
                    className="text-xs bg-violet-900/40 hover:bg-violet-800/60 border border-violet-800/60 hover:border-violet-600 text-violet-200 px-3 py-1.5 rounded-full transition-all hover:shadow-lg hover:shadow-violet-900/30"
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
