import apiClient from './apiClient';

interface AiContextData {
  summonerName: string;
  primaryRole: string;
  totalGamesAnalyzed: number;
  [key: string]: string | number | unknown;
}

export interface AiChatRequest {
  context: AiContextData;
  messages: Array<{ role: string; content: string }>;
  userMessage: string;
}

export interface AiChatResponse {
  response: string;
  interactionId: string;
}

export const chatWithAi = async (
  context: AiContextData,
  messages: Array<{ role: string; content: string }>,
  userMessage: string,
  sessionId?: string
): Promise<AiChatResponse> => {
  const response = await apiClient.post<AiChatResponse>('/ai/chat', {
    context,
    messages,
    userMessage,
    sessionId,
  });
  return response.data;
};

export interface FeedbackRequest {
  interactionId: string;
  feedbackType: 'positive' | 'negative';
  engagementTimeMs: number;
}

export interface FeedbackResponse {
  accepted: boolean;
}

export const submitFeedback = async (
  interactionId: string,
  feedbackType: 'positive' | 'negative',
  engagementTimeMs: number,
  sessionId?: string
): Promise<FeedbackResponse> => {
  const response = await apiClient.post<FeedbackResponse>('/ai/feedback', {
    interactionId,
    feedbackType,
    engagementTimeMs,
    sessionId
  });
  return response.data;
};
