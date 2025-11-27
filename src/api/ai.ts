import apiClient from './apiClient';

export interface AiChatRequest {
  context: Record<string, any>;
  messages: Array<{ role: string; content: string }>;
  userMessage: string;
}

export const chatWithAi = async (
  context: Record<string, any>,
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
