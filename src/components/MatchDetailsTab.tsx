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
  matchId, region, puuid, playerParticipant, opponentParticipant
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
    for (const frame of timeline.info.frames) {
      for (const event of frame.events) {
        if (event.type === 'SKILL_LEVEL_UP' && event.participantId === playerPid && event.skillSlot && event.level) {
          ups.push({
            skillSlot: event.skillSlot,
            level: event.level,
            minuteMark: Math.floor(event.timestamp / 60000),
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

    for (const frame of timeline.info.frames) {
      for (const event of frame.events) {
        const minute = Math.floor((event.timestamp || 0) / 60000);
        const second = Math.floor(((event.timestamp || 0) / 1000) % 60);

        if (event.type === 'CHAMPION_KILL') {
          const isPlayerKiller = event.killerId === playerPid;
          const isPlayerVictim = event.victimId === playerPid;
          const isPlayerAssist = event.assistingParticipantIds?.includes(playerPid);
          const isOpponentKiller = opponentPid !== undefined && event.killerId === opponentPid;
          const isOpponentVictim = opponentPid !== undefined && event.victimId === opponentPid;

          if (isPlayerKiller || isPlayerVictim || isPlayerAssist || isOpponentKiller || isOpponentVictim) {
            const type = isPlayerKiller ? 'KILL' : isPlayerVictim ? 'DEATH' : isPlayerAssist ? 'ASSIST' : isOpponentKiller ? 'KILL' : 'DEATH';
            const actor = isPlayerKiller ? playerParticipant.championName : isOpponentKiller ? opponentParticipant?.championName : null;
            const target = isPlayerVictim ? playerParticipant.championName : isOpponentVictim ? opponentParticipant?.championName : null;
            result.push({ type, minuteMark: minute, secondMark: second, actor: actor || null, target: target || null, isPlayer: !!(isPlayerKiller || isPlayerVictim || isPlayerAssist), isOpponent: !!(isOpponentKiller || isOpponentVictim), laneType: null, monsterType: null, position: event.position || null });
          }
        }

        if (event.type === 'BUILDING_KILL') {
          const playerInvolved = event.killerId === playerPid || event.assistingParticipantIds?.includes(playerPid);
          const opponentInvolved = opponentPid !== undefined && (event.killerId === opponentPid || event.assistingParticipantIds?.includes(opponentPid));
          if (playerInvolved || opponentInvolved) {
            const lane = event.laneType?.replace('_LANE', '') || 'UNKNOWN';
            result.push({ type: 'PLATE', minuteMark: minute, secondMark: second, actor: playerInvolved ? playerParticipant.championName || null : opponentParticipant?.championName || null, target: lane, isPlayer: !!playerInvolved, isOpponent: !!opponentInvolved, laneType: lane, monsterType: null, position: event.position || null });
          }
        }

        if (event.type === 'ELITE_MONSTER_KILL') {
          const playerInvolved = event.killerId === playerPid || event.assistingParticipantIds?.includes(playerPid);
          const opponentInvolved = opponentPid !== undefined && (event.killerId === opponentPid || event.assistingParticipantIds?.includes(opponentPid));
          if (playerInvolved || opponentInvolved) {
            result.push({ type: 'OBJECTIVE', minuteMark: minute, secondMark: second, actor: playerInvolved ? playerParticipant.championName || null : opponentParticipant?.championName || null, target: event.monsterType || 'OBJECTIVE', isPlayer: !!playerInvolved, isOpponent: !!opponentInvolved, laneType: null, monsterType: event.monsterType || null, position: event.position || null });
          }
        }
      }
    }
    return result.sort((a, b) => (a.minuteMark * 60 + a.secondMark) - (b.minuteMark * 60 + b.secondMark));
  }, [timeline, playerPid, opponentPid, playerParticipant, opponentParticipant]);

  // Compute skill max order
  const maxOrder = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const su of skillUps) {
      if (su.skillSlot >= 1 && su.skillSlot <= 3) counts[su.skillSlot]++;
    }
    return [1, 2, 3].sort((a, b) => counts[b] - counts[a]);
  }, [skillUps]);

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
  const accentClass = isWin ? 'border-green-500/50' : 'border-red-500/50';

  return (
    <div className="p-4 space-y-6">

      {/* ── Build Order ── */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="text-lg">🛡️</span> Item Build Order
        </h3>
        <div className="flex flex-wrap items-start gap-3">
            {buildGroups.map((group, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && (
                  <div className="self-center text-gray-400 dark:text-gray-600 text-lg mt-[-12px]">›</div>
                )}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1">
                    {group.items.map((item, ii) => (
                      <div
                        key={ii}
                        className={`rounded-md overflow-hidden border ${accentClass} hover:scale-110 transition-transform`}
                        title={`Item ${item.itemId}`}
                      >
                      <ItemIcon itemId={item.itemId} className="w-9 h-9 rounded" />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{group.minute}min</span>
                </div>
              </React.Fragment>
            ))}
          {buildGroups.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No item purchases found.</p>
            )}
          </div>
      </section>

      {/* ── Skill Order ── */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="text-lg">⚡</span> Skill Order
        </h3>
        {skillUps.length > 0 ? (
          <div className="space-y-3">
            {/* Max order summary */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 dark:text-gray-400">Max Priority:</span>
              {maxOrder.map((slot, i) => (
                <React.Fragment key={slot}>
                  {i > 0 && <span className="text-gray-400 dark:text-gray-600">›</span>}
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-white shadow"
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
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-sm transition-transform hover:scale-110"
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
          <p className="text-sm text-gray-500 dark:text-gray-400">No skill level data found.</p>
        )}
      </section>

      {/* ── Event Timeline ── */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="text-lg">📋</span> Key Events
        </h3>
        {events.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Side</th>
                  <th className="px-4 py-2 text-left">Actor</th>
                  <th className="px-4 py-2 text-center">Action</th>
                  <th className="px-4 py-2 text-left">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {events.map((ev, i) => {
                  const rowClass = ev.isPlayer
                    ? (isWin ? 'bg-green-50/40 dark:bg-green-900/10' : 'bg-red-50/40 dark:bg-red-900/10')
                    : 'bg-white/30 dark:bg-gray-900/20';

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
                    <tr key={i} className={`${rowClass} hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors`}>
                      <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatTime(ev.minuteMark * 60 + ev.secondMark)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-0.5">
                          <div className={`w-2.5 h-5 rounded-sm ${ev.isPlayer ? (isWin ? 'bg-blue-500' : 'bg-red-500') : 'bg-gray-400'}`} />
                          <div className={`w-2.5 h-5 rounded-sm ${ev.isOpponent ? (isWin ? 'bg-red-500' : 'bg-blue-500') : 'bg-gray-400'}`} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {actorChamp && (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={`${CDN_URL}/img/champion/${actorChamp}.png`}
                              alt={actorChamp}
                              className="w-5 h-5 rounded-full"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <span className="text-gray-700 dark:text-gray-200">{actorChamp}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center text-lg">{actionIcon}</td>
                      <td className="px-4 py-2">
                        {targetName && (
                          <div className="flex items-center gap-1.5">
                            {(ev.type === 'KILL' || ev.type === 'DEATH' || ev.type === 'ASSIST') && (
                              <img
                                src={`${CDN_URL}/img/champion/${targetName}.png`}
                                alt={targetName}
                                className="w-5 h-5 rounded-full"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <span className="text-gray-700 dark:text-gray-200">{targetName}</span>
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
