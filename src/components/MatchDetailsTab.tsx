import React, { useState, useEffect, useRef } from 'react';
import { getMatchTimeline } from '../api/timeline';
import type { MatchTimelineDto, MatchEventEntry, BuildItem, SkillUp } from '../types/timeline';
import type { ParticipantDto } from '../types/match';
import ItemIcon from './ItemIcon';
import { useDataDragonStore } from '../store/dataDragonStore';

interface MatchDetailsTabProps {
  matchId: string;
  region: string;
  puuid: string;
  playerParticipant: ParticipantDto;
  opponentParticipant?: ParticipantDto;
  allParticipants: ParticipantDto[];
  gameDuration?: number;
}

const SKILL_LABELS = ['', 'Q', 'W', 'E', 'R'];
const SKILL_COLORS = ['', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b'];
const SKILL_MAX_COLORS = ['', '#0891b2', '#7c3aed', '#059669', '#d97706'];

const formatTime = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const MatchDetailsTab: React.FC<MatchDetailsTabProps> = ({
  matchId, region, puuid, playerParticipant, opponentParticipant, allParticipants
}) => {
  const [timeline, setTimeline] = useState<MatchTimelineDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetch = async () => {
      try {
        const data = await getMatchTimeline(region, matchId);
        setTimeline(data);
      } catch {
        setError('Failed to load timeline data.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [matchId, region]);

  // Resolved participant IDs
  const playerPid = timeline?.info?.participants?.find(p => p.puuid === puuid)?.participantId;
  const opponentPid = opponentParticipant?.puuid
    ? timeline?.info?.participants?.find(p => p.puuid === opponentParticipant.puuid)?.participantId
    : undefined;

  // Parse build order
  const buildItems = React.useMemo<BuildItem[]>(() => {
    if (!timeline?.info || !playerPid) return [];
    const items: BuildItem[] = [];
    for (const frame of timeline.info.frames) {
      for (const event of frame.events) {
        if (event.type === 'ITEM_PURCHASED' && event.participantId === playerPid && event.itemId) {
          items.push({
            itemId: event.itemId,
            timestamp: event.timestamp,
            minuteMark: Math.floor(event.timestamp / 60000),
          });
        }
      }
    }
    return items;
  }, [timeline, playerPid]);

  // Parse skill order
  const skillUps = React.useMemo<SkillUp[]>(() => {
    if (!timeline?.info || !playerPid) return [];
    const ups: SkillUp[] = [];
    let currentLevel = 1;
    for (const frame of timeline.info.frames) {
      for (const event of frame.events) {
        if (event.type === 'LEVEL_UP' && event.participantId === playerPid && event.level) {
          currentLevel = event.level;
        }
        if (event.type === 'SKILL_LEVEL_UP' && event.participantId === playerPid && event.skillSlot) {
          ups.push({
            skillSlot: event.skillSlot,
            level: currentLevel,
            minuteMark: Math.floor((event.timestamp || 0) / 60000),
          });
        }
      }
    }
    return ups;
  }, [timeline, playerPid]);

  // Parse events (kills/deaths/plates/objectives for player + opponent)
  const events = React.useMemo<MatchEventEntry[]>(() => {
    if (!timeline?.info || !playerPid) return [];
    const result: MatchEventEntry[] = [];
    const pMap = new Map((allParticipants || []).map(p => [p.participantId, p.championName]));

    for (const frame of timeline.info.frames) {
      for (const event of frame.events) {
        const minute = Math.floor((event.timestamp || 0) / 60000);
        const second = Math.floor(((event.timestamp || 0) / 1000) % 60);

        if (event.type === 'CHAMPION_KILL') {
          const isPlayerKiller = event.killerId === playerPid;
          const isPlayerVictim = event.victimId === playerPid;
          const isPlayerAssist = playerPid ? event.assistingParticipantIds?.includes(playerPid) : false;
          const isOpponentKiller = opponentPid !== undefined && event.killerId === opponentPid;
          const isOpponentVictim = opponentPid !== undefined && event.victimId === opponentPid;
          const isOpponentAssist = opponentPid !== undefined && event.assistingParticipantIds?.includes(opponentPid);

          if (isPlayerKiller || isPlayerVictim || isPlayerAssist || isOpponentKiller || isOpponentVictim || isOpponentAssist) {
            const type = isPlayerKiller ? 'KILL'
              : isPlayerVictim ? 'DEATH'
              : isPlayerAssist ? 'ASSIST'
              : isOpponentKiller ? 'KILL'
              : isOpponentAssist ? 'ASSIST'
              : 'DEATH';

            // For assists, the actor is the assisting player, not the killer
            const actorId = isPlayerAssist
              ? playerPid
              : isOpponentAssist && !isOpponentKiller
              ? opponentPid
              : event.killerId;

            const actor = actorId ? pMap.get(actorId) : null;
            const target = event.victimId ? pMap.get(event.victimId) : null;
            const killer = (type === 'ASSIST' && event.killerId) ? pMap.get(event.killerId) : null;
            const assistants = (type === 'KILL' || type === 'DEATH')
              ? (event.assistingParticipantIds || []).map(id => pMap.get(id)).filter(Boolean) as string[]
              : [];
            result.push({ type, minuteMark: minute, secondMark: second, actor: actor || null, target: target || null, killer: killer || null, assistants, isPlayer: !!(isPlayerKiller || isPlayerVictim || isPlayerAssist), isOpponent: !!(isOpponentKiller || isOpponentVictim || isOpponentAssist), laneType: null, monsterType: null, position: event.position || null });
          }
        }

        if (event.type === 'BUILDING_KILL') {
          const playerInvolved = event.killerId === playerPid || (playerPid ? event.assistingParticipantIds?.includes(playerPid) : false);
          const opponentInvolved = opponentPid !== undefined && (event.killerId === opponentPid || event.assistingParticipantIds?.includes(opponentPid));
          if (playerInvolved || opponentInvolved) {
            const lane = event.laneType?.replace('_LANE', '') || 'UNKNOWN';
            result.push({ type: 'PLATE', minuteMark: minute, secondMark: second, actor: playerInvolved ? playerParticipant.championName || null : opponentParticipant?.championName || null, target: lane, isPlayer: !!playerInvolved, isOpponent: !!opponentInvolved, laneType: lane, monsterType: null, position: event.position || null });
          }
        }

        if (event.type === 'ELITE_MONSTER_KILL') {
          const playerInvolved = event.killerId === playerPid || (playerPid ? event.assistingParticipantIds?.includes(playerPid) : false);
          const opponentInvolved = opponentPid !== undefined && (event.killerId === opponentPid || event.assistingParticipantIds?.includes(opponentPid));
          if (playerInvolved || opponentInvolved) {
            result.push({ type: 'OBJECTIVE', minuteMark: minute, secondMark: second, actor: playerInvolved ? playerParticipant.championName || null : opponentParticipant?.championName || null, target: event.monsterType || 'OBJECTIVE', isPlayer: !!playerInvolved, isOpponent: !!opponentInvolved, laneType: null, monsterType: event.monsterType || null, position: event.position || null });
          }
        }
      }
    }
    return result.sort((a, b) => (a.minuteMark * 60 + a.secondMark) - (b.minuteMark * 60 + b.secondMark));
  }, [timeline, playerPid, opponentPid, playerParticipant, opponentParticipant, allParticipants]);

  // Compute skill max order
  const maxOrder = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const su of skillUps) {
      if (su.skillSlot >= 1 && su.skillSlot <= 3) counts[su.skillSlot]++;
    }
    return [1, 2, 3].sort((a, b) => counts[b] - counts[a]);
  }, [skillUps]);

  const [diffMetric, setDiffMetric] = useState<'gold' | 'xp'>('gold');

  // Compute per-minute lane Gold & XP differential curve when participantFrames are available
  const diffPoints = React.useMemo(() => {
    if (!timeline?.info?.frames || !playerPid || !opponentPid) return [];
    const pts: { minute: number; goldDiff: number; xpDiff: number }[] = [];
    for (const frame of timeline.info.frames) {
      const pFrame = frame.participantFrames?.[String(playerPid)];
      const oFrame = frame.participantFrames?.[String(opponentPid)];
      if (pFrame && oFrame) {
        pts.push({
          minute: Math.round((frame.timestamp || 0) / 60000),
          goldDiff: (pFrame.totalGold ?? 0) - (oFrame.totalGold ?? 0),
          xpDiff: (pFrame.xp ?? 0) - (oFrame.xp ?? 0),
        });
      }
    }
    return pts;
  }, [timeline, playerPid, opponentPid]);

  // Group build items by minute (within tolerance) to create "purchase groups"
  const buildGroups = React.useMemo(() => {
    const groups: { minute: number; items: BuildItem[] }[] = [];
    let lastMinute = -1;
    for (const item of buildItems) {
      if (Math.abs(item.minuteMark - lastMinute) <= 1 && groups.length > 0) {
        groups[groups.length - 1].items.push(item);
      } else {
        groups.push({ minute: item.minuteMark, items: [item] });
        lastMinute = item.minuteMark;
      }
    }
    return groups;
  }, [buildItems]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <svg className="w-5 h-5 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading timeline...
        </div>
      </div>
    );
  }

  if (error || !timeline) {
    return <div className="p-6 text-center text-red-500 dark:text-red-400">{error || 'Timeline unavailable.'}</div>;
  }

  const isWin = playerParticipant.win;
  const accentClass = isWin ? 'border-emerald-500/50' : 'border-rose-500/50';

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 space-y-6 telemetry-nums overflow-hidden">

      {/* ── Lane Gold / XP Differential Area Chart ── */}
      {diffPoints.length >= 2 && (() => {
        const values = diffPoints.map(d => diffMetric === 'gold' ? d.goldDiff : d.xpDiff);
        const maxAbs = Math.max(...values.map(v => Math.abs(v)), 1000);
        const w = 640;
        const h = 150;
        const midY = h / 2;
        const coords = diffPoints.map((d, idx) => {
          const val = diffMetric === 'gold' ? d.goldDiff : d.xpDiff;
          const x = 44 + (idx / Math.max(1, diffPoints.length - 1)) * (w - 64);
          const y = midY - (val / maxAbs) * (midY - 18);
          return { x, y, val, minute: d.minute };
        });
        const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
        const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${midY} L${coords[0].x.toFixed(1)},${midY} Z`;
        const endPositive = coords[coords.length - 1].val >= 0;
        const strokeColor = endPositive ? '#22d3ee' : '#fb7185';

        return (
          <section className="min-w-0 p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0b101d] border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lane Differential vs {opponentParticipant?.championName || 'Opponent'}
              </h3>
              <div className="inline-flex rounded-lg bg-white dark:bg-[#090d16] p-0.5 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDiffMetric('gold')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    diffMetric === 'gold'
                      ? 'bg-sky-600 text-white dark:bg-cyan-400 dark:text-slate-950'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Gold Diff
                </button>
                <button
                  type="button"
                  onClick={() => setDiffMetric('xp')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    diffMetric === 'xp'
                      ? 'bg-sky-600 text-white dark:bg-cyan-400 dark:text-slate-950'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  XP Diff
                </button>
              </div>
            </div>
            <svg className="w-full h-36 overflow-visible" viewBox={`0 0 ${w} ${h}`}>
              <line x1="44" y1={midY} x2={w - 20} y2={midY} stroke="#475569" strokeDasharray="4 4" strokeWidth="1" />
              <text x="4" y="20" className="fill-sky-600 dark:fill-cyan-400 text-[10px] font-bold">+{maxAbs}</text>
              <text x="4" y={midY + 3} className="fill-slate-400 text-[10px]">0</text>
              <text x="4" y={h - 8} className="fill-rose-500 text-[10px] font-bold">-{maxAbs}</text>
              <path d={areaPath} fill={strokeColor} fillOpacity="0.18" />
              <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.2" />
            </svg>
          </section>
        );
      })()}

      {/* ── Build Order ── */}
      <section className="min-w-0">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
          <span className="text-base">🛡️</span> Item Build Order
        </h3>
        {buildGroups.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No item purchases found.</p>
        ) : (
          <div className="w-full min-w-0 pb-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
              {buildGroups.map((group, gi) => (
                <React.Fragment key={gi}>
                  {gi > 0 && (
                    <span className="text-slate-300 dark:text-slate-600 text-xl select-none">›</span>
                  )}
                  <div className="flex flex-col items-center gap-1.5 max-w-full">
                    {/* Item icons */}
                    <div className={`flex flex-wrap gap-1 p-1.5 rounded-lg bg-slate-50 dark:bg-[#0b101d] border ${accentClass}`}>
                      {group.items.map((item, ii) => (
                        <div
                          key={ii}
                          className="rounded overflow-hidden hover:scale-105 transition-transform"
                          title={`Item ${item.itemId}`}
                        >
                          <ItemIcon itemId={item.itemId} className="w-8 h-8 rounded" />
                        </div>
                      ))}
                    </div>
                    {/* Minute badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tracking-wide">
                      {group.minute}m
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Skill Order ── */}
      <section className="min-w-0">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
          <span className="text-base">⚡</span> Skill Order
        </h3>
        {skillUps.length > 0 ? (
          <div className="space-y-3 min-w-0">
            {/* Max order summary */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Max Priority:</span>
              {maxOrder.map((slot, i) => (
                <React.Fragment key={slot}>
                  {i > 0 && <span className="text-slate-400 dark:text-slate-600">›</span>}
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-white shadow-xs"
                    style={{ backgroundColor: SKILL_COLORS[slot] }}
                  >
                    {SKILL_LABELS[slot]}
                  </span>
                </React.Fragment>
              ))}
            </div>
            {/* Level up sequence */}
            <div className="flex items-center gap-1 flex-wrap">
              {skillUps.map((su, i) => {
                const isR = su.skillSlot === 4;
                return (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-xs transition-transform hover:scale-105"
                    style={{
                      backgroundColor: isR ? SKILL_MAX_COLORS[4] : SKILL_COLORS[su.skillSlot],
                      border: isR ? '2px solid #f59e0b' : 'none',
                    }}
                    title={`Level ${su.level} → ${SKILL_LABELS[su.skillSlot]} at ${su.minuteMark}min`}
                  >
                    {SKILL_LABELS[su.skillSlot]}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No skill level data found.</p>
        )}
      </section>

      {/* ── Event Timeline ── */}
      <section className="min-w-0">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
          <span className="text-base">📋</span> Key Events
        </h3>
        {events.length > 0 ? (
          <div className="overflow-x-auto overflow-y-auto max-h-96 rounded-lg border border-slate-200 dark:border-slate-800 w-full max-w-full min-w-0 sm:inline-block sm:w-auto">
            <table className="text-xs sm:text-sm w-full sm:w-auto">
              <thead>
                <tr className="bg-slate-100 dark:bg-[#090d16] text-slate-500 dark:text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">
                  <th className="px-1.5 sm:px-4 py-2 text-left">Time</th>
                  <th className="px-1.5 sm:px-4 py-2 text-left">Actor</th>
                  <th className="px-1.5 sm:px-4 py-2 text-center">Action</th>
                  <th className="px-1.5 sm:px-4 py-2 text-left">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {events.map((ev, i) => {
                  const rowClass = !ev.isPlayer ? 'bg-white/40 dark:bg-transparent'
                    : ev.type === 'KILL'      ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                    : ev.type === 'DEATH'     ? 'bg-rose-50/50 dark:bg-rose-950/20'
                    : ev.type === 'ASSIST'    ? 'bg-amber-50/50 dark:bg-amber-950/20'
                    : ev.type === 'PLATE'     ? 'bg-sky-50/50 dark:bg-sky-950/20'
                    : ev.type === 'OBJECTIVE' ? 'bg-purple-50/50 dark:bg-purple-950/20'
                    : 'bg-white/40 dark:bg-slate-900/20';

                  const actionIcon = {
                    'KILL': '⚔️',
                    'DEATH': '💀',
                    'ASSIST': '🤝',
                    'PLATE': '🏰',
                    'OBJECTIVE': '🎯',
                    'WARD_PLACED': '👁️',
                    'WARD_KILLED': '🚫',
                  }[ev.type] || '•';

                  const actorChamp = ev.actor;
                  const targetName = ev.target;

                  return (
                    <tr key={i} className={`${rowClass} hover:brightness-95 dark:hover:bg-gray-800/40 transition-colors`}>
                      <td className="px-1.5 sm:px-4 py-2 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatTime(ev.minuteMark * 60 + ev.secondMark)}
                      </td>
                      <td className="px-1.5 sm:px-4 py-2">
                        {actorChamp && (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={`${CDN_URL}/img/champion/${actorChamp}.png`}
                              alt={actorChamp}
                              className="w-5 h-5 rounded-full shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <span className={actorChamp === playerParticipant.championName ? "text-cyan-600 dark:text-cyan-400 font-bold" : actorChamp === opponentParticipant?.championName ? "text-orange-600 dark:text-orange-400 font-bold" : "text-gray-700 dark:text-gray-200"}>{actorChamp}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-1.5 sm:px-4 py-2 text-center text-base sm:text-lg">{actionIcon}</td>
                      <td className="px-1.5 sm:px-4 py-2">
                        {targetName && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(ev.type === 'KILL' || ev.type === 'DEATH' || ev.type === 'ASSIST') && (
                              <img
                                src={`${CDN_URL}/img/champion/${targetName}.png`}
                                alt={targetName}
                                className="w-5 h-5 rounded-full shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <span className={targetName === playerParticipant.championName ? "text-cyan-600 dark:text-cyan-400 font-bold" : targetName === opponentParticipant?.championName ? "text-orange-600 dark:text-orange-400 font-bold" : "text-gray-700 dark:text-gray-200"}>{targetName}</span>
                            {ev.type === 'ASSIST' && ev.killer && (
                              <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500 text-xs ml-1 flex-wrap">
                                <span>via</span>
                                <img
                                  src={`${CDN_URL}/img/champion/${ev.killer}.png`}
                                  alt={ev.killer}
                                  className="w-4 h-4 rounded-full inline shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <span className={ev.killer === playerParticipant.championName ? "text-cyan-600 dark:text-cyan-400" : ev.killer === opponentParticipant?.championName ? "text-orange-600 dark:text-orange-400" : "text-gray-500 dark:text-gray-400"}>{ev.killer}</span>
                              </span>
                            )}
                            {(ev.type === 'KILL' || ev.type === 'DEATH') && ev.assistants && ev.assistants.length > 0 && (
                              <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500 text-xs ml-1 flex-wrap">
                                <span>with</span>
                                {ev.assistants.map((a, ai) => (
                                  <span key={ai} className="flex items-center gap-0.5">
                                    <img
                                      src={`${CDN_URL}/img/champion/${a}.png`}
                                      alt={a}
                                      className="w-4 h-4 rounded-full"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                    <span className={a === playerParticipant.championName ? "text-cyan-600 dark:text-cyan-400" : a === opponentParticipant?.championName ? "text-orange-600 dark:text-orange-400" : "text-gray-500 dark:text-gray-400"}>{a}</span>
                                    {ai < ev.assistants!.length - 1 && <span className="text-gray-400">,</span>}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No relevant events found for this match.</p>
        )}
      </section>
    </div>
  );
};

export default MatchDetailsTab;
