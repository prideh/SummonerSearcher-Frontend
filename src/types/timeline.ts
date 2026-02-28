// TypeScript interfaces mirroring the backend TimelineAnalysisDto

export interface HeatmapPoint {
  x: number;
  y: number;
  matchId: string;
}

export interface PowerSpikePoint {
  minute: number;
  playerGold: number;
  opponentGold: number;
  playerGoldLead: number;
  playerItems: number[];
  opponentItems: number[];
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
  isPlayer: boolean;
  isOpponent: boolean;
  laneType: string | null;
  monsterType: string | null;
  position: { x: number; y: number } | null;
}

export interface MatchEventTimelineDto {
  matchId: string;
  playerChampion: string;
  opponentChampion: string;
  win: boolean;
  events: MatchEventEntry[];
}

export interface TimelineAggregateSummary {
  avgFirstDeathMinute: number;
  mostDangerousZone: string;
  avgGoldLeadAt10: number;
  avgGoldLeadAt15: number;
  wardsPlacedTotal: number;
  deathsTotal: number;
  killsTotal: number;
  gamesAnalyzed: number;
}

export interface TimelineAnalysisDto {
  heatmapPositions: HeatmapPoint[];
  deathPositions: HeatmapPoint[];
  wardPositions: HeatmapPoint[];
  killPositions: HeatmapPoint[];
  powerSpikeTimelines: MatchPowerSpikeDto[];
  buildOrders: BuildOrderDto[];
  skillOrders: SkillOrderDto[];
  eventTimelines: MatchEventTimelineDto[];
  aggregateSummary: TimelineAggregateSummary;
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
  monsterType?: string;
  monsterSubType?: string;
  teamId?: number;
  position?: TimelinePositionDto;
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
    participants: Array<{ participantId: number; puuid: string }>;
  };
}
