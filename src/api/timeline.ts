import apiClient from './apiClient';
import {
  normalizeCoachTimelinePreparationResultDto,
  normalizeTimelineAnalysisDto,
  type CoachTimelinePreparationRequestDto,
  type CoachTimelinePreparationResultDto,
  type TimelineAnalysisDto,
} from '../types/timeline';

export interface TimelineAnalysisRequest {
  region: string;
  puuid: string;
}

export const MAX_COACH_PREPARATION_MATCH_IDS = 20;
export const DEFAULT_PREPARE_COACH_TIMEOUT_MS = 20_000;

export interface PrepareCoachTimelinesOptions {
  matchIds?: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Fetches a single match timeline from the backend (cached 24h on server side).
 */
export const getMatchTimeline = async (region: string, matchId: string) => {
  const response = await apiClient.get(`/riot/timeline/${region}/${matchId}`);
  return response.data;
};

/**
 * Fetches and analyzes ranked match timelines for the manual Timeline Analysis modal.
 * Normalizes Jackson boolean field names (`player`/`opponent`) to `isPlayer`/`isOpponent`.
 */
export const analyzeTimelines = async (region: string, puuid: string): Promise<TimelineAnalysisDto> => {
  const response = await apiClient.get(`/riot/timeline/analyze/${region}/${puuid}`);
  return normalizeTimelineAnalysisDto(response.data);
};

/**
 * Bounded on-demand timeline preparation for AI Coach (`POST /riot/timeline/prepare-coach/{region}/{puuid}`).
 * Supports explicit matchIds (capped at 20), AbortSignal cancellation, and a finite request timeout.
 */
export const prepareCoachTimelines = async (
  region: string,
  puuid: string,
  options?: PrepareCoachTimelinesOptions
): Promise<CoachTimelinePreparationResultDto> => {
  const normalizedRegion = region.trim().toLowerCase();
  const trimmedPuuid = puuid.trim();
  const sanitizedMatchIds = Array.isArray(options?.matchIds)
    ? Array.from(
        new Set(
          options.matchIds
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .map(id => id.trim())
        )
      ).slice(0, MAX_COACH_PREPARATION_MATCH_IDS)
    : [];

  const payload: CoachTimelinePreparationRequestDto =
    sanitizedMatchIds.length > 0 ? { matchIds: sanitizedMatchIds } : {};

  const response = await apiClient.post<CoachTimelinePreparationResultDto>(
    `/riot/timeline/prepare-coach/${encodeURIComponent(normalizedRegion)}/${encodeURIComponent(trimmedPuuid)}`,
    payload,
    {
      signal: options?.signal,
      timeout: options?.timeoutMs ?? DEFAULT_PREPARE_COACH_TIMEOUT_MS,
    }
  );

  return normalizeCoachTimelinePreparationResultDto(
    response.data,
    normalizedRegion,
    trimmedPuuid,
    sanitizedMatchIds
  );
};

