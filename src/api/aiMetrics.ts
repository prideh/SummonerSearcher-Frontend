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

export const getAiMetrics = async (): Promise<AiMetricsResponse> => {
  const response = await apiClient.get<AiMetricsResponse>('/ai/metrics');
  return response.data;
};

export const getCurationHistory = async (): Promise<CurationRunResponse[]> => {
  const response = await apiClient.get<CurationRunResponse[]>('/ai/curation-history');
  return response.data;
};
