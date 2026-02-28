import apiClient from './apiClient';

export interface TimelineAnalysisRequest {
  region: string;
  puuid: string;
}

/**
 * Fetches a single match timeline from the backend (cached 24h on server side).
 */
export const getMatchTimeline = async (region: string, matchId: string) => {
  const response = await apiClient.get(`/riot/timeline/${region}/${matchId}`);
  return response.data;
};

/**
 * Fetches and analyzes the last 10 ranked match timelines for a player.
 */
export const analyzeTimelines = async (region: string, puuid: string) => {
  const response = await apiClient.get(`/riot/timeline/analyze/${region}/${puuid}`);
  return response.data;
};
