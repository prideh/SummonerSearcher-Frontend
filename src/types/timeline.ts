// TypeScript interfaces mirroring the backend TimelineAnalysisDto

export interface HeatmapPoint {
  x: number;
  y: number;
  matchId: string;
  minute: number;
}

export interface PowerSpikePoint {
  minute: number;
  playerGold: number;
  opponentGold: number;
  playerGoldLead: number;
  playerXp: number;
  opponentXp: number;
  playerCs: number;
  opponentCs: number;
  playerItems: number[];
  opponentItems: number[];
  events: MatchEventEntry[];
}

export interface MatchPowerSpikeDto {
  matchId: string;
  playerChampion: string;
  opponentChampion: string;
  win: boolean;
  points: PowerSpikePoint[];
}

export interface BuildItem {
  itemId: number;
  timestamp: number;
  minuteMark: number;
}

export interface BuildOrderDto {
  matchId: string;
  playerChampion: string;
  win: boolean;
  items: BuildItem[];
}

export interface SkillUp {
  skillSlot: number; // 1=Q, 2=W, 3=E, 4=R
  level: number;
  minuteMark: number;
}

export interface SkillOrderDto {
  matchId: string;
  playerChampion: string;
  win: boolean;
  maxOrder: number[];
  levelUps: SkillUp[];
}

export interface MatchEventEntry {
  type: 'KILL' | 'DEATH' | 'ASSIST' | 'PLATE' | 'OBJECTIVE' | 'WARD_PLACED' | 'WARD_KILLED';
  minuteMark: number;
  secondMark: number;
  actor: string | null;
  target: string | null;
  killer?: string | null;
  assistants?: string[] | null;
  participants?: string[] | null;
  zone?: string | null;
  wardType?: string | null;
  /** Frontend normalized boolean flag (`true` when event involves the queried player). */
  isPlayer?: boolean;
  /** Frontend normalized boolean flag (`true` when event involves the lane opponent). */
  isOpponent?: boolean;
  /** Jackson boolean property serialized by Spring Boot (`boolean isPlayer()` -> `"player"`). */
  player?: boolean;
  /** Jackson boolean property serialized by Spring Boot (`boolean isOpponent()` -> `"opponent"`). */
  opponent?: boolean;
  laneType: string | null;
  monsterType: string | null;
  position: { x: number; y: number } | null;
}

/**
 * Resolves whether a timeline event belongs to the queried player across both
 * Jackson's `player` property (`boolean isPlayer()` getter) and `isPlayer`.
 */
export function isPlayerTimelineEvent(
  ev: Pick<MatchEventEntry, 'isPlayer' | 'player'> | null | undefined
): boolean {
  if (!ev) return false;
  if (typeof ev.isPlayer === 'boolean') return ev.isPlayer;
  if (typeof ev.player === 'boolean') return ev.player;
  return false;
}

/**
 * Resolves whether a timeline event belongs to the lane opponent across both
 * Jackson's `opponent` property (`boolean isOpponent()` getter) and `isOpponent`.
 */
export function isOpponentTimelineEvent(
  ev: Pick<MatchEventEntry, 'isOpponent' | 'opponent'> | null | undefined
): boolean {
  if (!ev) return false;
  if (typeof ev.isOpponent === 'boolean') return ev.isOpponent;
  if (typeof ev.opponent === 'boolean') return ev.opponent;
  return false;
}

/**
 * Normalizes a single `MatchEventEntry` so both `isPlayer`/`player` and `isOpponent`/`opponent`
 * are populated consistently regardless of whether the payload came from Jackson (`player`/`opponent`)
 * or frontend fixtures (`isPlayer`/`isOpponent`).
 */
export function normalizeMatchEventEntry(ev: MatchEventEntry): MatchEventEntry {
  const isPlayer = isPlayerTimelineEvent(ev);
  const isOpponent = isOpponentTimelineEvent(ev);
  return {
    ...ev,
    isPlayer,
    isOpponent,
    player: isPlayer,
    opponent: isOpponent,
  };
}

/**
 * Normalizes all `MatchEventEntry` items inside a `TimelineAnalysisDto` (`eventTimelines` and
 * `powerSpikeTimelines[].points[].events`).
 */
export function normalizeTimelineAnalysisDto(dto: TimelineAnalysisDto): TimelineAnalysisDto {
  if (!dto || typeof dto !== 'object') return dto;
  return {
    ...dto,
    powerSpikeTimelines: Array.isArray(dto.powerSpikeTimelines)
      ? dto.powerSpikeTimelines.map(spike => ({
          ...spike,
          points: Array.isArray(spike.points)
            ? spike.points.map(pt => ({
                ...pt,
                events: Array.isArray(pt.events) ? pt.events.map(normalizeMatchEventEntry) : [],
              }))
            : [],
        }))
      : [],
    eventTimelines: Array.isArray(dto.eventTimelines)
      ? dto.eventTimelines.map(et => ({
          ...et,
          events: Array.isArray(et.events) ? et.events.map(normalizeMatchEventEntry) : [],
        }))
      : [],
  };
}

export interface MatchEventTimelineDto {
  matchId: string;
  playerChampion: string;
  opponentChampion: string;
  win: boolean;
  events: MatchEventEntry[];
}

import type { ImprovementStatsDto } from './improvementStats';

export interface TimelineAggregateSummary {
  avgFirstDeathMinute: number;
  mostDangerousZone: string;
  avgGoldLeadAt10: number;
  avgGoldLeadAt15: number;
  wardsPlacedTotal: number;
  deathsTotal: number;
  killsTotal: number;
  assistsTotal: number;
  gamesAnalyzed: number;
  deathsBefore10?: number | null;
  assistedDeaths?: number | null;
  unassistedDeaths?: number | null;
  deathsNearObjectiveWindows?: number | null;
}

export interface TimelineAnalysisDto {
  heatmapPositions: HeatmapPoint[];
  deathPositions: HeatmapPoint[];
  wardPositions: HeatmapPoint[];
  killPositions: HeatmapPoint[];
  assistPositions: HeatmapPoint[];
  powerSpikeTimelines: MatchPowerSpikeDto[];
  buildOrders: BuildOrderDto[];
  skillOrders: SkillOrderDto[];
  eventTimelines: MatchEventTimelineDto[];
  aggregateSummary: TimelineAggregateSummary;
  improvementStats?: ImprovementStatsDto | null;
}

// Raw timeline types (for the Details tab single-match view)
export interface TimelinePositionDto {
  x: number;
  y: number;
}

export interface ParticipantFrameDto {
  participantId: number;
  totalGold: number;
  level: number;
  xp: number;
  currentGold: number;
  minionsKilled: number;
  jungleMinionsKilled?: number | null;
  position: TimelinePositionDto;
}

export interface TimelineEventDto {
  type: string;
  timestamp: number;
  participantId?: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  itemId?: number;
  afterId?: number;
  skillSlot?: number;
  level?: number;
  wardType?: string;
  buildingType?: string;
  laneType?: string;
  towerType?: string;
  monsterType?: string;
  monsterSubType?: string;
  teamId?: number;
  killerTeamId?: number;
  creatorId?: number;
  position?: TimelinePositionDto;
  bounty?: number | null;
  shutdownBounty?: number | null;
  goldGain?: number | null;
}

export interface TimelineFrameDto {
  timestamp: number;
  participantFrames: Record<string, ParticipantFrameDto>;
  events: TimelineEventDto[];
}

export interface MatchTimelineDto {
  metadata?: {
    matchId: string;
    participants: string[];
  };
  info?: {
    frameInterval: number;
    frames: TimelineFrameDto[];
    participants: Array<{ participantId: number; puuid: string; championName?: string }>;
  };
}
