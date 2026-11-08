import React, { useMemo } from 'react';
import type { MatchDto } from '../../types/match';

interface PlaystyleRadarProps {
  matches: MatchDto[];
  puuid: string;
}

const AXES = ['DMG', 'FARM', 'VIS', 'OBJ', 'SURV'] as const;

const clampScore = (val: number) => Math.max(25, Math.min(99, Math.round(val)));

export const PlaystyleRadar: React.FC<PlaystyleRadarProps> = ({ matches, puuid }) => {
  const scores = useMemo(() => {
    const valid = (matches || [])
      .map((m) => {
        const p = m.info?.participants?.find((part) => part.puuid === puuid);
        const durMin = (m.info?.gameDuration || 1800) / 60;
        const teamKills =
          m.info?.participants
            ?.filter((part) => part.teamId === p?.teamId)
            .reduce((acc, part) => acc + (part.kills || 0), 0) || 1;
        return p && durMin >= 10 ? { p, durMin, teamKills } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (valid.length === 0) {
      return [75, 75, 75, 75, 75];
    }

    const n = valid.length;
    const avgKp =
      valid.reduce((acc, { p, teamKills }) => acc + ((p.kills || 0) + (p.assists || 0)) / Math.max(1, teamKills), 0) / n;
    const avgDpm =
      valid.reduce((acc, { p, durMin }) => acc + (p.totalDamageDealtToChampions || 0) / durMin, 0) / n;
    const avgCsm =
      valid.reduce(
        (acc, { p, durMin }) => acc + ((p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0)) / durMin,
        0
      ) / n;
    const avgVspm =
      valid.reduce((acc, { p, durMin }) => acc + (p.visionScore || 0) / durMin, 0) / n;
    const avgObj =
      valid.reduce(
        (acc, { p, durMin }) =>
          acc + ((p.damageDealtToObjectives || 0) + (p.damageDealtToTurrets || 0) * 1.5) / durMin,
        0
      ) / n;
    const avgDeaths = valid.reduce((acc, { p }) => acc + (p.deaths ?? 4), 0) / n;

    const dmgScore = clampScore(45 + avgKp * 45 + Math.min(25, avgDpm / 40));
    const farmScore = clampScore(35 + avgCsm * 7.2);
    const visScore = clampScore(42 + avgVspm * 34);
    const objScore = clampScore(45 + Math.min(52, avgObj / 14));
    const survScore = clampScore(98 - avgDeaths * 7.5);

    return [dmgScore, farmScore, visScore, objScore, survScore];
  }, [matches, puuid]);

  const cx = 90;
  const cy = 90;
  const maxR = 60;
  const baseline = [70, 70, 70, 70, 70];

  const polarToXY = (idx: number, val: number): [number, number] => {
    const angle = (Math.PI * 2 * idx) / 5 - Math.PI / 2;
    const r = (val / 100) * maxR;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const basePoints = baseline.map((v, i) => polarToXY(i, v).join(',')).join(' ');
  const userPoints = scores.map((v, i) => polarToXY(i, v).join(',')).join(' ');

  return (
    <div className="flex flex-col justify-between h-full telemetry-nums" data-testid="playstyle-radar">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          5-Axis Telemetry Radar
        </h3>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 dark:bg-cyan-500/15 text-sky-700 dark:text-cyan-300 border border-sky-500/20 dark:border-cyan-500/30">
          vs Tier Avg
        </span>
      </div>

      <div className="flex items-center justify-center my-0.5">
        <svg className="w-40 h-40 overflow-visible" viewBox="0 0 180 180" aria-label="5-Axis Playstyle Radar">
          {[33, 66, 100].map((lvl) => {
            const pts = [0, 1, 2, 3, 4].map((i) => polarToXY(i, lvl).join(',')).join(' ');
            return (
              <polygon
                key={lvl}
                points={pts}
                fill="none"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="1"
              />
            );
          })}
          {AXES.map((lbl, i) => {
            const [x, y] = polarToXY(i, 100);
            const [lx, ly] = polarToXY(i, 123);
            return (
              <g key={lbl}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[9px] font-extrabold"
                >
                  {lbl}
                </text>
              </g>
            );
          })}
          <polygon
            points={basePoints}
            fill="#64748b"
            fillOpacity="0.12"
            stroke="#64748b"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
          <polygon
            points={userPoints}
            fill="#22d3ee"
            fillOpacity="0.22"
            stroke="#22d3ee"
            strokeWidth="2"
          />
          {scores.map((v, i) => {
            const [x, y] = polarToXY(i, v);
            return <circle key={i} cx={x} cy={y} r="3" fill="#22d3ee" stroke="#090d16" strokeWidth="1.2" />;
          })}
        </svg>
      </div>

      <div className="grid grid-cols-5 gap-1 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-center">
        {AXES.map((lbl, idx) => (
          <div
            key={lbl}
            className="py-1 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800"
          >
            <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{lbl}</div>
            <div className="text-xs font-extrabold text-sky-600 dark:text-cyan-400">{scores[idx]}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaystyleRadar;
