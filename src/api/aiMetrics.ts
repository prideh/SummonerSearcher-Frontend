import apiClient from './apiClient';

export type AiMetricsResponse = {
  totalInteractions: number;
  validatedFeedbackCount: number;
  learnedExamplesCount: number;
  satisfactionRate: number;
  thisWeekInteractions: number;
  lastWeekInteractions: number;
};

export type CurationRunResponse = {
  runDate: string;
  candidatesFound: number;
  examplesAdded: number;
  examplesReplaced: number;
  avgQualityScore: number | null;
  durationMs: number | null;
};

export type TemperatureStatResponse = {
  temperature: number;
  totalUses: number;
  positiveCount: number;
  satisfactionRate: number | null;
};

export type DiscoveredPatternResponse = {
  triggerCategory: string;
  followUpCategory: string;
  occurrenceCount: number;
  confidenceScore: number;
  isActive: boolean;
  lastUpdated: string;
};

export const getAiMetrics = async (): Promise<AiMetricsResponse> => {
  const response = await apiClient.get<AiMetricsResponse>('/ai/metrics');
  return response.data;
};

export const getCurationHistory = async (): Promise<CurationRunResponse[]> => {
  const response = await apiClient.get<CurationRunResponse[]>('/ai/curation-history');
  return response.data;
};

export const getTemperatureStats = async (): Promise<TemperatureStatResponse[]> => {
  const response = await apiClient.get<TemperatureStatResponse[]>('/ai/temperature-stats');
  return response.data;
};

export const getDiscoveredPatterns = async (): Promise<DiscoveredPatternResponse[]> => {
  const response = await apiClient.get<DiscoveredPatternResponse[]>('/ai/discovered-patterns');
  return response.data;
};
