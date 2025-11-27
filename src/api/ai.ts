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

export const chatWithAi = async (
  context: AiContextData,
  messages: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> => {
  const response = await apiClient.post<string>('/ai/chat', {
    context,
    messages,
    userMessage,
  });
  return response.data;
};
